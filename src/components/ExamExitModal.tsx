import React, { useState } from 'react';
import { GlassCard } from './ui';
import { useExamStore } from '../store/useExamStore';
import { getTranslation } from '../lib/i18n';
import { LogOut, PauseCircle, Trash2, ArrowLeft, X, AlertTriangle } from 'lucide-react';

interface ExamExitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExamExitModal: React.FC<ExamExitModalProps> = ({ isOpen, onClose }) => {
  const { setScreen, resetSession, activeExamName, questions, answers, selectedLang } = useExamStore();
  const [confirmAbort, setConfirmAbort] = useState(false);
  const t = getTranslation(selectedLang);

  if (!isOpen) return null;

  const realQuestionsCount = questions.filter(q => q.num !== '예시' && q.num !== '보기').length;
  const answeredCount = questions.filter(q => q.num !== '예시' && q.num !== '보기').filter(x => {
    const origIdx = questions.findIndex(orig => orig === x);
    return origIdx !== -1 && answers[origIdx] !== null;
  }).length;

  const handlePauseAndExit = () => {
    // Keep isExamRunning = true so they can resume from MainScreen
    onClose();
    setConfirmAbort(false);
    setScreen('main');
  };

  const handleExecuteAbort = () => {
    onClose();
    setConfirmAbort(false);
    resetSession();
    setScreen('main');
  };

  return (
    <div 
      className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={() => { onClose(); setConfirmAbort(false); }}
    >
      <GlassCard 
        className="w-full max-w-md rounded-sm p-5 sm:p-6 shadow-2xl border-t-amber-500 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2 text-amber-400 font-tech text-sm tracking-wider">
            <LogOut size={18} />
            <span>{t.exitModalTitle}</span>
          </div>
          <button 
            onClick={() => { onClose(); setConfirmAbort(false); }} 
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {!confirmAbort ? (
          <>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/40 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <PauseCircle size={28} />
              </div>
              <h3 className="text-base font-kor font-bold text-white mb-1.5">
                시험을 지금 중단하시겠습니까?
              </h3>
              <p className="text-xs text-slate-300 font-kor leading-relaxed break-keep">
                {t.exitModalDesc}
              </p>
            </div>

            {/* Current status */}
            <div className="bg-slate-900/80 border border-slate-800 rounded p-3 mb-5 text-xs font-kor text-slate-300 space-y-1.5 shadow-inner">
              <div className="flex justify-between">
                <span className="text-slate-400">현재 시험 슬롯:</span>
                <span className="font-bold text-cyan-400">{activeExamName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">답안 작성 현황:</span>
                <span className="font-bold text-emerald-400">{answeredCount} / {realQuestionsCount} 문항 완료</span>
              </div>
            </div>

            {/* Action Options */}
            <div className="space-y-2.5">
              <button 
                onClick={handlePauseAndExit}
                className="w-full py-3.5 px-4 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-600/80 hover:border-cyan-400 text-white rounded text-xs font-kor font-bold flex items-center justify-between transition-all shadow-md group"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <PauseCircle size={20} className="text-cyan-400 shrink-0" />
                  <div>
                    <div className="text-white text-xs sm:text-sm font-bold">{t.pauseOptionTitle}</div>
                    <div className="text-[11px] text-cyan-300/80 font-normal mt-0.5">{t.pauseOptionDesc}</div>
                  </div>
                </div>
                <span className="text-sm text-cyan-400 group-hover:translate-x-1 transition-transform ml-2">▶</span>
              </button>

              <button 
                onClick={() => setConfirmAbort(true)}
                className="w-full py-3 px-4 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 hover:border-red-500 text-red-200 rounded text-xs font-kor font-medium flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Trash2 size={18} className="text-red-400 shrink-0" />
                  <div>
                    <div className="text-red-200 text-xs sm:text-sm font-semibold">{t.abortOptionTitle}</div>
                    <div className="text-[11px] text-red-400/80 font-normal mt-0.5">{t.abortOptionDesc}</div>
                  </div>
                </div>
                <span className="text-sm text-red-400 group-hover:translate-x-1 transition-transform ml-2">▶</span>
              </button>

              <button 
                onClick={() => { onClose(); setConfirmAbort(false); }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded text-xs font-kor font-medium transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <ArrowLeft size={14} />
                <span>{t.continueTestingBtn}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="py-2 text-center">
            <div className="w-14 h-14 bg-red-950/60 border border-red-500/80 text-red-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-base font-kor font-bold text-white mb-2">
              🚨 정말로 모든 답안을 삭제하고 시험을 포기하시겠습니까?
            </h3>
            <p className="text-xs text-red-300 font-kor leading-relaxed break-keep mb-5 bg-red-950/30 p-3 rounded border border-red-900/60">
              포기 시 현재까지 푼 모든 문항의 답안과 타이머가 초기화되며 복구할 수 없습니다.
            </p>
            <div className="flex gap-2.5">
              <button 
                onClick={() => setConfirmAbort(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-kor font-bold border border-slate-700"
              >
                취소 (돌아가기)
              </button>
              <button 
                onClick={handleExecuteAbort}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-kor font-bold shadow-lg shadow-red-900/50"
              >
                네, 포기하고 초기화
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
