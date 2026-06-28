import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { getAIFeedback } from '../lib/api';
import { updateLiveSession } from '../lib/firebase';
import ReactMarkdown from 'react-markdown';

export const ResultScreen: React.FC = () => {
  const { result, selectedLang } = useExamStore();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (result) {
      updateLiveSession(result.registrationNo, result.studentName, result.examName, 'SUBMITTED', result.correctCount, result.totalQuestions, result.score);
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

  const handleReturnHome = () => {
    useExamStore.getState().resetSession();
    window.location.reload();
  };

  return (
    <div className="flex-1 flex flex-col p-6 bg-transparent items-center justify-center relative z-10 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <GlassCard className="max-w-md w-full text-center py-10 border-t-[#00b050] rounded-sm shadow-2xl p-8 animate-fade-in">
        <div className="w-20 h-20 bg-green-900/30 border border-[#00b050] text-[#00b050] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(0,176,80,0.2)]">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 className="text-2xl font-tech text-white mb-3 tracking-widest">SUBMISSION COMPLETE</h2>
        <p className="text-slate-300 font-kor font-medium mb-6 text-sm break-keep">답안이 시스템에 성공적으로 동기화되었습니다.<br/>수고하셨습니다.</p>
        
        {!feedback && (
          <button onClick={fetchFeedback} disabled={isLoading} className="w-full py-3.5 mb-5 bg-cyan-900/60 border border-cyan-600 text-white font-tech tracking-widest text-xs rounded-sm hover:bg-cyan-800 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
            {isLoading ? '⏳ ANALYZING...' : '✨ GET AI FEEDBACK'}
          </button>
        )}

        {feedback && (
          <div className="mb-6 p-5 bg-slate-900/80 rounded-sm border border-cyan-800/50 text-cyan-50 text-sm leading-relaxed font-kor shadow-inner text-left">
            <div className="font-bold text-cyan-300 mb-2 border-b border-cyan-800/50 pb-1">✨ Personalized Feedback:</div>
            <div className="whitespace-pre-wrap"><ReactMarkdown>{feedback}</ReactMarkdown></div>
          </div>
        )}

        <button onClick={handleReturnHome} className="w-full py-4 bg-slate-800 border border-slate-700 text-slate-300 font-tech tracking-widest text-xs rounded-sm hover:bg-slate-700 hover:text-white transition-all">
          RETURN TO HOME
        </button>
      </GlassCard>
    </div>
  );
};
