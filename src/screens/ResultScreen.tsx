import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { getAIFeedback } from '../lib/api';
import { updateLiveSession } from '../lib/firebase';
import { getTranslation } from '../lib/i18n';
import { RetestWarningModal } from '../components/RetestWarningModal';
import ReactMarkdown from 'react-markdown';

export const ResultScreen: React.FC = () => {
  const { result, selectedLang, setScreen, resetSession } = useExamStore();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const t = getTranslation(selectedLang);

  useEffect(() => {
    if (result) {
      updateLiveSession(result.registrationNo, result.studentName, result.examName, 'SUBMITTED', result.correctCount, result.totalQuestions, result.score, result.company);
    }
  }, [result]);

  const fetchFeedback = async () => {
    if (!result) return;
    setIsLoading(true);
    
    const langMap: Record<string, string> = {ko: "Korean", en: "English", id: "Indonesian", vi: "Vietnamese", ne: "Nepali"};
    const targetLang = langMap[selectedLang] || "English";

    const prompt = `You are a TOPIK (Test of Proficiency in Korean) AI Tutor.
    The student named ${result.studentName} just finished their practice exam.
    They scored ${result.score} points, getting ${result.correctCount} out of ${result.totalQuestions} questions correct.
    Please provide a short, encouraging 3-sentence study advice and feedback based on this result. The response MUST be written in ${targetLang}.`;

    try {
      const fb = await getAIFeedback(prompt, "You are an encouraging AI language tutor.");
      setFeedback(fb);
    } catch (e) {
      setFeedback("오류가 발생했습니다. 나중에 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRetest = () => {
    setShowWarningModal(false);
    resetSession();
    setScreen('intro');
  };

  const handleReturnHome = () => {
    setScreen('main');
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-transparent items-center justify-center relative z-10 pb-[max(env(safe-area-inset-bottom),1.5rem)] overflow-y-auto">
      <GlassCard className="max-w-lg w-full text-center py-8 border-t-[#00b050] rounded-sm shadow-2xl p-6 md:p-8 animate-fade-in my-auto">
        <div className="w-16 h-16 bg-green-900/30 border border-[#00b050] text-[#00b050] rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,176,80,0.2)]">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 className="text-xl md:text-2xl font-tech text-white mb-1 tracking-widest">SUBMISSION COMPLETE</h2>
        <p className="text-slate-400 font-kor text-xs mb-5">답안이 시스템에 성공적으로 제출되었습니다.</p>
        
        {/* Score Summary Card */}
        {result && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-sm p-4 mb-5 text-left shadow-inner">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
              <div>
                <span className="text-[10px] font-tech text-cyan-400 tracking-wider">CANDIDATE: </span>
                <span className="font-kor font-bold text-white text-sm">{result.studentName}</span>
                <span className="text-slate-500 text-xs ml-1">({result.registrationNo})</span>
              </div>
              <span className="text-[10px] font-kor bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                {result.examName}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div className="text-[9px] font-tech text-slate-400 tracking-wider">TOTAL SCORE</div>
                <div className="text-xl font-tech font-bold text-emerald-400 mt-0.5">{result.score} <span className="text-[10px] text-slate-500">/ 200</span></div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div className="text-[9px] font-tech text-slate-400 tracking-wider">LISTENING</div>
                <div className="text-xl font-tech font-bold text-cyan-400 mt-0.5">{result.lcScore}</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <div className="text-[9px] font-tech text-slate-400 tracking-wider">READING</div>
                <div className="text-xl font-tech font-bold text-indigo-400 mt-0.5">{result.rcScore}</div>
              </div>
            </div>

            <div className="mt-3 flex justify-between items-center text-xs font-kor text-slate-400 px-1">
              <span>정답 문항 수</span>
              <span className="font-tech font-bold text-white">{result.correctCount} / {result.totalQuestions} 문제</span>
            </div>
          </div>
        )}

        {!feedback && (
          <button onClick={fetchFeedback} disabled={isLoading} className="w-full py-3 mb-4 bg-cyan-900/60 border border-cyan-600 hover:border-cyan-400 text-white font-tech tracking-widest text-xs rounded-sm hover:bg-cyan-800 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
            {isLoading ? '⏳ ANALYZING...' : '✨ GET AI FEEDBACK'}
          </button>
        )}

        {feedback && (
          <div className="mb-5 p-4 bg-slate-900/90 rounded-sm border border-cyan-800/50 text-cyan-50 text-xs md:text-sm leading-relaxed font-kor shadow-inner text-left">
            <div className="font-bold text-cyan-300 mb-1.5 border-b border-cyan-800/50 pb-1">✨ AI Tutor Feedback:</div>
            <div className="whitespace-pre-wrap"><ReactMarkdown>{feedback}</ReactMarkdown></div>
          </div>
        )}

        <div className="space-y-2.5 pt-2">
          <button 
            onClick={() => setShowWarningModal(true)} 
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-kor font-bold tracking-wider text-sm rounded-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>{t.retestBtn || '🔄 새로운 시험 응시하기 / 재시험'}</span>
          </button>
          
          <button 
            onClick={handleReturnHome} 
            className="w-full py-3 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-kor text-xs rounded-sm transition-all"
          >
            메인 화면으로 돌아가기
          </button>
        </div>
      </GlassCard>

      <RetestWarningModal 
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={handleConfirmRetest}
      />
    </div>
  );
};
