import React, { useEffect } from 'react';
import { GlassCard, StartGradientButton } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { getTranslation } from '../lib/i18n';
import { updateLiveSession } from '../lib/firebase';

export const WaitingScreen: React.FC = () => {
  const { setScreen, selectedLang, timeLeft, startExam, questions, candidate, activeExamName } = useExamStore();
  const t = getTranslation(selectedLang);
  
  const realQuestionsCount = questions.filter(q => q.num !== '예시' && q.num !== '보기').length;
  const minutes = Math.floor(timeLeft / 60);

  useEffect(() => {
    if (candidate) {
      updateLiveSession(candidate.regNo, candidate.name, activeExamName, 'WAITING', 0, realQuestionsCount);
    }
  }, [candidate, activeExamName, realQuestionsCount]);

  const handleBegin = () => {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
        if (doc.requestFullscreen) doc.requestFullscreen().catch(err => console.warn(err));
    }
    startExam();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent relative z-10 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6">
      <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-6">
        <GlassCard className="p-6 md:p-10 max-w-lg w-full border-t-cyan-400 animate-fade-in rounded-sm">
          <h2 className="text-2xl font-tech text-white mb-6 text-center tracking-widest">{t.standby}</h2>
          
          <div className="space-y-4 bg-slate-900/60 p-5 md:p-6 rounded border border-slate-800 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 shrink-0 border border-cyan-800 flex items-center justify-center text-cyan-400 font-tech text-sm shadow-[0_0_10px_rgba(14,165,233,0.1)] rounded-sm">T_</div>
              <div>
                <p className="text-[10px] text-cyan-500 font-tech tracking-widest">{t.timeLimit}</p>
                <p className="font-tech text-white text-xl">{minutes} {t.min}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 shrink-0 border border-cyan-800 flex items-center justify-center text-cyan-400 font-tech text-sm shadow-[0_0_10px_rgba(14,165,233,0.1)] rounded-sm">Q_</div>
              <div>
                <p className="text-[10px] text-cyan-500 font-tech tracking-widest">{t.totalQs}</p>
                <p className="font-tech text-white text-xl">{realQuestionsCount} {t.qs}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 pt-4 border-t border-slate-800 mt-2">
              <div className="w-10 h-10 shrink-0 border border-amber-800 flex items-center justify-center text-amber-500 font-tech text-sm shadow-[0_0_10px_rgba(245,158,11,0.1)] rounded-sm">!_</div>
              <div>
                <p className="text-[10px] text-amber-500 font-tech tracking-widest">{t.instruction}</p>
                <p className="font-kor text-slate-300 text-sm leading-relaxed mt-1 break-keep" dangerouslySetInnerHTML={{ __html: t.instText }}></p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 mt-4">
            <StartGradientButton onClick={handleBegin} className="w-full py-4 font-tech text-sm tracking-widest flex items-center justify-center gap-3 rounded-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
              <span>{t.beginBtn}</span>
            </StartGradientButton>
            <button onClick={() => setScreen('intro')} className="w-full bg-transparent border border-slate-700 text-slate-400 py-3 rounded-sm font-tech text-xs tracking-widest hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center">
              <span>{t.backBtn}</span>
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
