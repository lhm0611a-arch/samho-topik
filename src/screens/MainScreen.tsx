import React, { useState } from 'react';
import { GlassCard, StartGradientButton } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { LogIn, QrCode, Play, RotateCcw, Award } from 'lucide-react';
import { RetestWarningModal } from '../components/RetestWarningModal';

export const MainScreen: React.FC<{ onOpenAdmin: () => void, onOpenQr: () => void }> = ({ onOpenAdmin, onOpenQr }) => {
  const { setScreen, dbSyncStatus, questions, isExamRunning, result, resetSession, activeExamName } = useExamStore();
  const [showWarningModal, setShowWarningModal] = useState(false);

  const handleStartFresh = () => {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
      if (doc.requestFullscreen) doc.requestFullscreen().catch(err => console.warn(err));
    }
    resetSession();
    setScreen('intro');
  };

  const handleStartClick = () => {
    if (result) {
      setShowWarningModal(true);
    } else {
      handleStartFresh();
    }
  };

  const handleResume = () => {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
      if (doc.requestFullscreen) doc.requestFullscreen().catch(err => console.warn(err));
    }
    setScreen('test');
  };

  const handleViewResult = () => {
    setScreen('result');
  };

  const realQuestionCount = questions.filter(q => q.num !== '예시' && q.num !== '보기').length;

  return (
    <div className="flex-1 overflow-y-auto relative z-10 flex flex-col items-center justify-start sm:justify-center p-3.5 sm:p-6 w-full min-h-full animate-fade-in py-4 sm:py-8 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <GlassCard className="w-full max-w-lg lg:max-w-4xl xl:max-w-5xl p-5 sm:p-8 md:p-10 lg:p-14 rounded-sm relative shadow-2xl flex flex-col items-center justify-center my-auto">
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-3 lg:w-4 h-3 lg:h-4 border-t border-l border-cyan-500"></div>
        <div className="absolute top-0 right-0 w-3 lg:w-4 h-3 lg:h-4 border-t border-r border-cyan-500"></div>
        <div className="absolute bottom-0 left-0 w-3 lg:w-4 h-3 lg:h-4 border-b border-l border-cyan-500"></div>
        <div className="absolute bottom-0 right-0 w-3 lg:w-4 h-3 lg:h-4 border-b border-r border-cyan-500"></div>

        {/* Admin/QR Buttons */}
        <div className="absolute top-4 right-4 flex gap-1.5 z-20">
          <button onClick={onOpenAdmin} className="hidden md:flex px-2 py-1 border border-cyan-800/80 bg-slate-900/50 text-[9px] text-cyan-500 font-tech items-center gap-1 hover:bg-cyan-900/50 transition-colors rounded-sm tracking-widest">
            <LogIn className="w-3 h-3" /> SYS_ADMIN
          </button>
          <button onClick={onOpenQr} className="hidden md:flex px-2 py-1 border border-cyan-800/80 bg-slate-900/50 text-[9px] text-cyan-500 font-tech items-center gap-1 hover:bg-cyan-900/50 transition-colors rounded-sm tracking-widest">
            <QrCode className="w-3 h-3" /> QR_LINK
          </button>
        </div>

        {/* Tag & CI */}
        <div className="flex flex-col items-center gap-2.5 mt-2 sm:mt-4 mb-3 sm:mb-4">
          <div className="h-9 sm:h-11 md:h-12 flex items-center justify-center">
            <img 
              src="/ci.png" 
              alt="HD현대삼호" 
              className="h-full object-contain filter drop-shadow-[0_0_2px_rgba(255,255,255,0.7)]" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/40 border border-cyan-900/50 rounded-sm">
            <span className="w-1.5 h-1.5 bg-cyan-400 animate-pulse"></span>
            <span className="text-[10px] font-tech text-cyan-400 tracking-[0.2em] uppercase">HD_EVALUATION_SYSTEM</span>
          </div>
        </div>

        {/* Title Area */}
        <h1 className="text-3xl md:text-5xl font-kor font-black text-white tracking-tight mb-2 text-center drop-shadow-md">
          CBT_TOPIK
        </h1>
        <h2 className="text-sm md:text-xl font-tech font-bold text-[#00b050] tracking-[0.1em] mb-2 text-center drop-shadow-[0_0_8px_rgba(0,176,80,0.4)] uppercase">
          Test of Proficiency in Korean
        </h2>
        
        {/* Active Exam Badge */}
        <div className="my-4 px-4 py-2 bg-slate-900/80 border border-cyan-500/40 rounded-sm flex items-center gap-3 shadow-inner">
          <span className="text-[10px] font-tech text-cyan-400 tracking-widest uppercase">ACTIVE EXAM:</span>
          <span className="text-xs md:text-sm font-kor font-bold text-white tracking-wide">{activeExamName}</span>
          <span className="text-[10px] font-tech text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
            {realQuestionCount} 문항
          </span>
        </div>

        <p onClick={onOpenAdmin} className="text-[10px] text-slate-400 font-tech tracking-widest mb-6 cursor-pointer select-none hover:text-cyan-400 transition-colors">BUILD V40.DX_PRO</p>

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3 mb-6">
          {isExamRunning ? (
            <>
              <StartGradientButton onClick={handleResume} className="w-full py-4 rounded-sm flex items-center justify-center gap-2 shadow-lg">
                <Play className="w-5 h-5" />
                <span className="font-kor font-bold text-base md:text-lg tracking-widest">진행 중인 시험 이어보기</span>
              </StartGradientButton>
              <button 
                onClick={() => setShowWarningModal(true)} 
                className="w-full py-3 bg-slate-900/80 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-white rounded-sm font-kor text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>새로운 시험으로 다시 시작하기</span>
              </button>
            </>
          ) : (
            <StartGradientButton onClick={handleStartClick} className="w-full py-4 rounded-sm flex items-center justify-center gap-2 shadow-lg">
              <span className="font-kor font-bold text-base md:text-lg tracking-widest">새 시험 시작하기</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </StartGradientButton>
          )}

          {result && !isExamRunning && (
            <button 
              onClick={handleViewResult} 
              className="w-full py-2.5 bg-indigo-950/50 border border-indigo-700/60 hover:border-indigo-500 text-indigo-300 hover:text-white rounded-sm font-kor text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
            >
              <Award className="w-4 h-4 text-indigo-400" />
              <span>지난 시험 결과 확인 ({result.studentName || '응시자'} : {result.score}점)</span>
            </button>
          )}
        </div>

        {/* Languages (Visual) */}
        <div className="flex gap-2 mb-6">
          {['KO', 'VN', 'ID', 'EN', 'NP'].map(lang => (
            <div key={lang} className="px-3 py-1 border border-slate-700 bg-slate-900/50 text-[10px] text-slate-400 font-tech rounded-sm">
              {lang}
            </div>
          ))}
        </div>

        {/* Footer Status */}
        <div className="w-full border-t border-cyan-900/30 pt-4 flex justify-between items-center text-[9px] font-tech tracking-widest">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dbSyncStatus.isCloud ? 'bg-cyan-400' : 'bg-[#00b050]'}`}></span>
            <span className="text-slate-400">AVAILABLE_QS: <span className="text-white">{realQuestionCount}</span></span>
          </div>
          <div className={dbSyncStatus.color}>
            {dbSyncStatus.msg}
          </div>
        </div>
      </GlassCard>

      <RetestWarningModal 
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={handleStartFresh}
      />
    </div>
  );
};
