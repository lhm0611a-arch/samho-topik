/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useExamStore } from './store/useExamStore';
import { MainScreen } from './screens/MainScreen';
import { IntroScreen } from './screens/IntroScreen';
import { WaitingScreen } from './screens/WaitingScreen';
import { TestScreen } from './screens/TestScreen';
import { ResultScreen } from './screens/ResultScreen';
import { AdminScreen } from './screens/AdminScreen';
import { QrModal, AdminAuthModal } from './screens/Modals';
import { ZoomModal } from './components/ZoomModal';
import { ExamExitModal } from './components/ExamExitModal';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  GAS_URL, subscribeExamConfig, getExamConfig, 
  getExamQuestionsFromFirestore, saveExamQuestionsToFirestore, 
  ensureAuth 
} from './lib/firebase';
import { Question } from './types';
import { getTranslation } from './lib/i18n';

const dummyData: Question[] = [
  { num: "예시", realIdx: "-", type: "듣기", passage: "가: 공책이 있어요?\n나: ____________________", question: "※ [1~4] 다음을 듣고 <보기>와 같이 물음에 맞는 대답을 고르십시오.", image: "", options: ["네, 공책이 있어요.", "네, 공책을 사요.", "아니요, 공책에 써요.", "아니요, 공책이 작아요."], answer: "", score: 0 },
  { num: 1, realIdx: 1, type: "듣기", passage: "", question: "(4점)", image: "", options: ["네, 회사원이에요.", "네, 회사원이 있어요.", "아니요, 회사원이 없어요.", "아니요, 회사원이 일해요."], answer: 0, score: 4 },
  { num: 2, realIdx: 2, type: "듣기", passage: "", question: "(4점)", image: "", options: ["네, 책을 사요.", "네, 책이 비싸요.", "아니요, 책을 좋아해요.", "아니요, 책을 안 읽어요."], answer: 0, score: 4 },
  { num: "예시", realIdx: "-", type: "읽기", passage: "오늘은 월요일입니다. 내일은 화요일입니다.", question: "※ [31~33] 무엇에 대한 내용입니까? <보기>와 같이 알맞은 것을 고르십시오.", image: "", options: ["공부", "얼굴", "요일", "계절"], answer: "", score: 0 },
  { num: 31, realIdx: 3, type: "읽기", passage: "아버지와 어머니가 있습니다. 그리고 형도 있습니다.", question: "(2점)", image: "", options: ["가족", "이름", "나이", "시간"], answer: 0, score: 2 }
];

export default function App() {
  const { 
    currentScreen, setScreen, setQuestions, setDbSyncStatus, 
    activeExamName, setActiveExamName, setAvailableExams, isExamRunning,
    resetSession, timeLeft, questions, currentIdx, prevQuestion, nextQuestion,
    selectedLang
  } = useExamStore();
  
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const currentExamRef = useRef(activeExamName);
  currentExamRef.current = activeExamName;

  const t = getTranslation(selectedLang);

  // Handle URL query parameters (e.g. from QR re-entry) & session sanitization
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1' || params.get('reset') === '1') {
      resetSession();
      // Clean query parameter from URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // If not actively taking an exam and somehow on result screen or waiting, default to main
      const state = useExamStore.getState();
      if (!state.isExamRunning && state.currentScreen !== 'main') {
        setScreen('main');
      }
    }
  }, [resetSession, setScreen]);

  useEffect(() => {
    // Prevent reload if exam is running
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExamRunning) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isExamRunning]);

  const formatQuestions = useCallback((data: any[]) => {
    let rc = 0;
    return data.map(q => {
      const copy = { ...q };
      if (copy.num === '예시' || copy.num === '보기') {
        copy.realIdx = '-';
      } else {
        rc++; 
        copy.realIdx = rc;
      }
      return copy;
    });
  }, []);

  // Fast Question Loader: Checks Firestore first (<100ms), falls back to GAS
  const loadQuestionsForExam = useCallback(async (examName: string) => {
    const state = useExamStore.getState();
    if (state.isExamRunning && state.questions && state.questions.length > 0) {
      setDbSyncStatus('SESSION RESTORED', 'text-amber-400', true);
      return;
    }

    setDbSyncStatus(`SYNCING [${examName}]...`, 'text-cyan-400', true);

    // 1. Try Firestore direct cache first
    try {
      const fsQuestions = await getExamQuestionsFromFirestore(examName);
      if (fsQuestions && fsQuestions.length > 0) {
        setQuestions(formatQuestions(fsQuestions));
        setDbSyncStatus(`⚡ CLOUD SYNCED (${examName})`, 'text-cyan-400', true);
        return;
      }
    } catch (e) {
      console.warn("Firestore question load error:", e);
    }

    // 2. Fallback to Google Apps Script
    try {
      const res = await fetch(`${GAS_URL}?exam=${encodeURIComponent(examName)}`);
      if (!res.ok) throw new Error("GAS response not ok");
      const json = await res.json();

      if (json.status === "success" && json.data && json.data.length > 0) {
        const validData = json.data.filter((r: any[]) => r[0] && r[0].toString().trim() !== '문제번호');
        const cloudData: Question[] = validData.map((r: any[], idx: number) => ({
          num: r[0] || (idx + 1),
          type: r[1] || '읽기',
          passage: r[2] || '',
          question: r[3] || '',
          image: r[4] || '',
          options: [r[5], r[6], r[7], r[8]],
          answer: (r[9] !== undefined && r[9] !== "" && !isNaN(parseInt(r[9]))) ? parseInt(r[9]) - 1 : "",
          score: (r[10] !== undefined && r[10] !== "") ? parseInt(r[10]) : (r[1] === '듣기' ? 3 : 2)
        }));

        if (cloudData.length > 0) {
          const formatted = formatQuestions(cloudData);
          setQuestions(formatted);
          setDbSyncStatus(`⚡ CLOUD SYNCED (${examName})`, 'text-cyan-400', true);
          // Cache in Firestore for instant future loads
          saveExamQuestionsToFirestore(examName, formatted).catch(() => {});
          return;
        }
      }
    } catch (err) {
      console.warn("GAS fetch error:", err);
    }

    // Fallback: If no cloud data yet, use dummy
    const formattedDummy = formatQuestions(dummyData);
    setQuestions(formattedDummy);
    setDbSyncStatus(`⚡ READY (${examName})`, 'text-amber-400', false);
  }, [formatQuestions, setQuestions, setDbSyncStatus]);

  // Initial connect & Real-time Subscription to Active Exam changes
  useEffect(() => {
    ensureAuth();

    // 1. Fetch initial config
    getExamConfig().then(cfg => {
      if (cfg.activeExamName) setActiveExamName(cfg.activeExamName);
      if (cfg.availableExams && cfg.availableExams.length > 0) setAvailableExams(cfg.availableExams);
      loadQuestionsForExam(cfg.activeExamName || '모의고사1회');
    });

    // 2. Real-time listener: Whenever admin switches slot, update instantly for all clients
    const unsubscribe = subscribeExamConfig((cfg) => {
      if (cfg.availableExams && cfg.availableExams.length > 0) {
        setAvailableExams(cfg.availableExams);
      }
      if (cfg.activeExamName && cfg.activeExamName !== currentExamRef.current) {
        setActiveExamName(cfg.activeExamName);
        const state = useExamStore.getState();
        // If candidate hasn't started the exam yet, switch their questions automatically!
        if (!state.isExamRunning) {
          loadQuestionsForExam(cfg.activeExamName);
        }
      }
    });

    return () => unsubscribe();
  }, [loadQuestionsForExam, setActiveExamName, setAvailableExams]);

  return (
    <div className="app-bg relative flex flex-col h-full w-full overflow-hidden text-slate-200">
      <div className="scanline" />
      
      {currentScreen !== 'main' && (
        <header className="glass-card border-b border-cyan-900/50 px-2.5 sm:px-4 py-2 sm:py-2.5 flex justify-between items-center shrink-0 z-20 pt-[max(env(safe-area-inset-top),0.5rem)]">
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <div className="h-6 sm:h-7 md:h-8 flex items-center justify-center shrink-0">
                <img 
                  src="/ci.png" 
                  alt="HD현대삼호" 
                  className="h-full object-contain filter drop-shadow-[0_0_2px_rgba(255,255,255,0.7)]" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                />
              </div>
              <div className="shrink-0">
                  <h1 className="text-xs sm:text-base font-tech font-black text-cyan-400 tracking-wider leading-none">CBT_TOPIK</h1>
                  <p className="text-[8px] sm:text-[9px] text-cyan-600/70 font-eng uppercase tracking-[0.2em] mt-0.5 hidden sm:block">Professional Evaluation System</p>
              </div>
          </div>

          {/* On Desktop/Tablet: Optional middle navigation */}
          {currentScreen === 'test' && (
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button 
                onClick={prevQuestion}
                disabled={currentIdx === 0}
                className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white disabled:opacity-20 border border-slate-700 rounded text-xs font-kor font-medium flex items-center gap-1 transition-all shrink-0 whitespace-nowrap"
                title="이전 문항으로 뒤로 이동"
              >
                <ChevronLeft size={14} />
                <span>{t.prevBtn}</span>
              </button>
              <div className="px-2.5 py-1 bg-black/60 rounded border border-cyan-900/50 font-tech text-xs sm:text-sm text-cyan-400 shrink-0 whitespace-nowrap">
                Q{currentIdx + 1} / {questions.length}
              </div>
              <button 
                onClick={nextQuestion}
                disabled={currentIdx === questions.length - 1}
                className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 hover:text-white disabled:opacity-20 border border-cyan-700/80 rounded text-xs font-kor font-medium flex items-center gap-1 transition-all shrink-0 whitespace-nowrap"
                title="다음 문항으로 앞으로 이동"
              >
                <span>{t.nextBtn}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {currentScreen === 'test' && (
              <>
                <div className="px-2 sm:px-2.5 py-1 bg-black/70 rounded border border-cyan-900/60 font-tech text-sm sm:text-base md:text-lg text-cyan-400 flex items-center gap-1 shadow-inner shrink-0 whitespace-nowrap">
                    <span className="text-[9px] text-cyan-700 tracking-widest hidden xs:inline">TIME</span>
                    <span className="tracking-wider font-bold">
                      {(() => {
                        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                        const s = (timeLeft % 60).toString().padStart(2, '0');
                        return `${m}:${s}`;
                      })()}
                    </span>
                </div>

                <button 
                  onClick={() => setShowExitModal(true)}
                  className="px-2 sm:px-2.5 py-1 bg-red-950/70 hover:bg-red-900 border border-red-700/80 hover:border-red-500 rounded text-red-200 hover:text-white font-kor font-bold text-xs flex items-center gap-1 transition-all shadow-sm shrink-0 whitespace-nowrap"
                  title="시험 중단 및 나가기"
                >
                  <LogOut size={13} className="shrink-0" />
                  <span>시험 중단</span>
                </button>
              </>
            )}
          </div>
        </header>
      )}

      <main className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
        {currentScreen === 'main' && (
          <MainScreen 
            onOpenAdmin={() => setShowAdminAuth(true)} 
            onOpenQr={() => setShowQr(true)} 
          />
        )}
        {currentScreen === 'intro' && <IntroScreen />}
        {currentScreen === 'waiting' && <WaitingScreen />}
        {currentScreen === 'test' && <TestScreen />}
        {currentScreen === 'result' && <ResultScreen />}
      </main>

      {showAdminAuth && (
        <AdminAuthModal 
          onClose={() => setShowAdminAuth(false)} 
          onSuccess={() => { setShowAdminAuth(false); setShowAdmin(true); }} 
        />
      )}
      {showAdmin && <AdminScreen onClose={() => setShowAdmin(false)} />}
      {showQr && <QrModal onClose={() => setShowQr(false)} />}
      <ExamExitModal isOpen={showExitModal} onClose={() => setShowExitModal(false)} />
      
      <ZoomModal />
    </div>
  );
}
