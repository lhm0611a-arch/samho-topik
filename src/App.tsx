/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useExamStore } from './store/useExamStore';
import { MainScreen } from './screens/MainScreen';
import { IntroScreen } from './screens/IntroScreen';
import { WaitingScreen } from './screens/WaitingScreen';
import { TestScreen } from './screens/TestScreen';
import { ResultScreen } from './screens/ResultScreen';
import { AdminScreen } from './screens/AdminScreen';
import { QrModal, AdminAuthModal } from './screens/Modals';
import { ZoomModal } from './components/ZoomModal';
import { GAS_URL } from './lib/firebase';
import { Question } from './types';

const dummyData: Question[] = [
  { num: "예시", realIdx: "-", type: "듣기", passage: "가: 공책이 있어요?\n나: ____________________", question: "※ [1~4] 다음을 듣고 <보기>와 같이 물음에 맞는 대답을 고르십시오.", image: "", options: ["네, 공책이 있어요.", "네, 공책을 사요.", "아니요, 공책에 써요.", "아니요, 공책이 작아요."], answer: "", score: 0 },
  { num: 1, realIdx: 1, type: "듣기", passage: "", question: "(4점)", image: "", options: ["네, 회사원이에요.", "네, 회사원이 있어요.", "아니요, 회사원이 없어요.", "아니요, 회사원이 일해요."], answer: 0, score: 4 },
  { num: 2, realIdx: 2, type: "듣기", passage: "", question: "(4점)", image: "", options: ["네, 책을 사요.", "네, 책이 비싸요.", "아니요, 책을 좋아해요.", "아니요, 책을 안 읽어요."], answer: 0, score: 4 },
  { num: "예시", realIdx: "-", type: "읽기", passage: "오늘은 월요일입니다. 내일은 화요일입니다.", question: "※ [31~33] 무엇에 대한 내용입니까? <보기>와 같이 알맞은 것을 고르십시오.", image: "", options: ["공부", "얼굴", "요일", "계절"], answer: "", score: 0 },
  { num: 31, realIdx: 3, type: "읽기", passage: "아버지와 어머니가 있습니다. 그리고 형도 있습니다.", question: "(2점)", image: "", options: ["가족", "이름", "나이", "시간"], answer: 0, score: 2 }
];

export default function App() {
  const { 
    currentScreen, setQuestions, setDbSyncStatus, 
    setActiveExamName, setAvailableExams, isExamRunning 
  } = useExamStore();
  
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showQr, setShowQr] = useState(false);

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

  useEffect(() => {
    const initData = (data: any[], isCloud: boolean) => {
      let rc = 0;
      const formatted = data.map(q => {
        if(q.num === '예시' || q.num === '보기') {
          q.realIdx = '-';
        } else {
          rc++; q.realIdx = rc;
        }
        return q;
      });
      setQuestions(formatted);
      if(isCloud) setDbSyncStatus('SECURE CONNECTION (ONLINE)', 'text-cyan-400', true);
    };

    const state = useExamStore.getState();
    if (state.isExamRunning && state.questions && state.questions.length > 0) {
      setDbSyncStatus('SESSION RESTORED', 'text-amber-400', true);
      // Skip fetching new questions if currently in an active exam to prevent overwriting answers
      return;
    }

    initData(dummyData, false);

    fetch(GAS_URL)
      .then(res => {
        if(!res.ok) throw new Error("Network response error.");
        return res.json();
      })
      .then(json => {
        if (json.status === "success") {
          if(json.activeExam) setActiveExamName(json.activeExam);
          if(json.exams && json.exams.length > 0) setAvailableExams(json.exams);

          if (json.data && json.data.length > 0) {
            const validData = json.data.filter((r: any[]) => r[0] && r[0].toString().trim() !== '문제번호');
            const cloudData = validData.map((r: any[], idx: number) => ({
                num: r[0] || (idx + 1), type: r[1] || '읽기', passage: r[2] || '',
                question: r[3] || '', image: r[4] || '',
                options: [r[5], r[6], r[7], r[8]],
                answer: (r[9] !== undefined && r[9] !== "" && !isNaN(parseInt(r[9]))) ? parseInt(r[9]) - 1 : "",
                score: (r[10] !== undefined && r[10] !== "") ? parseInt(r[10]) : (r[1] === '듣기' ? 3 : 2)
            }));
            
            if(cloudData.length > 0) {
              initData(cloudData, true);
            }
          } else {
            setDbSyncStatus('⚠️ DB EMPTY', 'text-amber-400');
          }
        }
      }).catch((err) => {
        console.warn("DB Connection error:", err);
        setDbSyncStatus('❌ CONNECTION FAILED', 'text-red-500');
      });
  }, [setQuestions, setDbSyncStatus, setActiveExamName, setAvailableExams]);

  return (
    <div className="app-bg relative flex flex-col h-screen w-full overflow-hidden text-slate-200">
      <div className="scanline" />
      
      {currentScreen !== 'main' && (
        <header className="glass-card border-b border-cyan-900/50 p-3 md:p-4 flex justify-between items-center shrink-0 z-20 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 md:h-10 flex items-center justify-center">
                <img src="/ci.png" alt="HD현대삼호" className="h-full object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <div>
                  <h1 className="text-base md:text-lg font-tech font-black text-cyan-400 tracking-widest leading-none">CBT_TOPIK</h1>
                  <p className="text-[9px] text-cyan-600/70 font-eng uppercase tracking-[0.2em] mt-0.5 hidden md:block">Professional Evaluation System</p>
              </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {currentScreen === 'test' && (
              <div className="px-3 py-1.5 bg-black/60 rounded border border-cyan-900/50 font-tech text-lg md:text-xl text-cyan-400 flex items-center gap-2 shadow-inner">
                  <span className="text-[9px] text-cyan-700 tracking-widest">TIME</span>
                  <span className="tracking-wider">
                    {(() => {
                      const tl = useExamStore.getState().timeLeft;
                      const m = Math.floor(tl / 60).toString().padStart(2, '0');
                      const s = (tl % 60).toString().padStart(2, '0');
                      return `${m}:${s}`;
                    })()}
                  </span>
              </div>
            )}
          </div>
        </header>
      )}

      {currentScreen === 'main' && <MainScreen onOpenAdmin={() => setShowAdminAuth(true)} onOpenQr={() => setShowQr(true)} />}
      {currentScreen === 'intro' && <IntroScreen />}
      {currentScreen === 'waiting' && <WaitingScreen />}
      {currentScreen === 'test' && <TestScreen />}
      {currentScreen === 'result' && <ResultScreen />}

      {showAdminAuth && <AdminAuthModal onClose={() => setShowAdminAuth(false)} onSuccess={() => { setShowAdminAuth(false); setShowAdmin(true); }} />}
      {showAdmin && <AdminScreen onClose={() => setShowAdmin(false)} />}
      {showQr && <QrModal onClose={() => setShowQr(false)} />}
      
      <ZoomModal />
    </div>
  );
}
