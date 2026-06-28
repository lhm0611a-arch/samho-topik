import React from 'react';
import { GlassCard, StartGradientButton } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { LogIn, QrCode } from 'lucide-react';

export const MainScreen: React.FC<{ onOpenAdmin: () => void, onOpenQr: () => void }> = ({ onOpenAdmin, onOpenQr }) => {
  const { setScreen, dbSyncStatus, questions } = useExamStore();

  const handleStart = () => {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
        if (doc.requestFullscreen) doc.requestFullscreen().catch(err => console.warn(err));
    }
    setScreen('intro');
  };

  const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return (
    <div className="flex-1 overflow-y-auto relative z-10 flex flex-col items-center justify-center p-4 md:p-6 w-full min-h-full animate-fade-in pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <GlassCard className="w-full max-w-lg lg:max-w-4xl xl:max-w-5xl p-8 md:p-12 lg:p-20 rounded-sm relative shadow-2xl flex flex-col items-center lg:min-h-[500px] justify-center">
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-3 lg:w-4 h-3 lg:h-4 border-t border-l border-cyan-500"></div>
        <div className="absolute top-0 right-0 w-3 lg:w-4 h-3 lg:h-4 border-t border-r border-cyan-500"></div>
        <div className="absolute bottom-0 left-0 w-3 lg:w-4 h-3 lg:h-4 border-b border-l border-cyan-500"></div>
        <div className="absolute bottom-0 right-0 w-3 lg:w-4 h-3 lg:h-4 border-b border-r border-cyan-500"></div>

        {/* Admin/QR Buttons */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          <button onClick={onOpenAdmin} className="hidden lg:flex px-2 py-1 border border-cyan-800/80 bg-slate-900/50 text-[9px] text-cyan-500 font-tech items-center gap-1 hover:bg-cyan-900/50 transition-colors rounded-sm tracking-widest">
            <LogIn className="w-3 h-3" /> SYS_ADMIN
          </button>
          <button onClick={onOpenQr} className="px-2 py-1 border border-cyan-800/80 bg-slate-900/50 text-[9px] text-cyan-500 font-tech flex items-center gap-1 hover:bg-cyan-900/50 transition-colors rounded-sm tracking-widest">
            <QrCode className="w-3 h-3" /> QR_LINK
          </button>
        </div>

        {/* Tag & CI */}
        <div className="flex flex-col items-center gap-4 mt-8 mb-6">
          <div className="h-10 md:h-12">
            <img src="/ci.png" alt="HD현대삼호" className="h-full object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/40 border border-cyan-900/50 rounded-sm">
            <span className="w-1 h-1 bg-cyan-400"></span>
            <span className="text-[9px] font-tech text-cyan-500 tracking-[0.2em] uppercase">HD_EVALUATION_SYSTEM</span>
          </div>
        </div>

        {/* Title Area */}
        <h1 className="text-3xl md:text-5xl font-kor font-black text-white tracking-tight mb-2 text-center drop-shadow-md mt-6">
          CBT_TOPIK
        </h1>
        <h2 className="text-sm md:text-xl font-tech font-bold text-[#00b050] tracking-[0.1em] mb-4 text-center drop-shadow-[0_0_8px_rgba(0,176,80,0.4)] uppercase">
          Test of Proficiency in Korean
        </h2>
        <p className="text-[10px] text-slate-400 font-tech tracking-widest mb-12">BUILD V40.DX_PRO</p>

        {/* Start Button */}
        <StartGradientButton onClick={handleStart} className="w-full max-w-sm py-4 rounded-sm flex items-center justify-center gap-2 mb-6">
          <span className="font-kor font-bold text-base md:text-lg tracking-widest">시작하기</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </StartGradientButton>

        {/* Languages (Visual) */}
        <div className="flex gap-2 mb-10">
          {['KO', 'VN', 'ID', 'EN', 'NP'].map(lang => (
            <div key={lang} className="px-3 py-1 border border-slate-700 bg-slate-900/50 text-[10px] text-slate-400 font-tech rounded-sm">
              {lang}
            </div>
          ))}
        </div>

        {/* Footer Status */}
        <div className="w-full border-t border-cyan-900/30 pt-4 mt-4 flex justify-between items-center text-[9px] font-tech tracking-widest">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dbSyncStatus.isCloud ? 'bg-cyan-400' : 'bg-[#00b050]'}`}></span>
            <span className="text-slate-400">LOCAL_DB: <span className="text-white">{questions.filter(q => q.num !== '예시' && q.num !== '보기').length}</span></span>
          </div>
          <div className={dbSyncStatus.color}>
            {dbSyncStatus.msg}
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
