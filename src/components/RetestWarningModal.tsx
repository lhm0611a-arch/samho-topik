import React, { useState } from 'react';
import { GlassCard } from './ui';
import { useExamStore } from '../store/useExamStore';
import { getTranslation } from '../lib/i18n';
import { AlertTriangle, AlertOctagon, X, ArrowRight, RotateCcw } from 'lucide-react';

interface RetestWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const RetestWarningModal: React.FC<RetestWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  const { selectedLang, setSelectedLang } = useExamStore();
  const [step, setStep] = useState<1 | 2>(1);

  if (!isOpen) return null;

  const t = getTranslation(selectedLang);

  const handleNextStep = () => {
    setStep(2);
  };

  const handleFinalConfirm = () => {
    setStep(1);
    onConfirm();
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  const langs = [
    { id: 'ko', label: '한국어' },
    { id: 'en', label: 'English' },
    { id: 'id', label: 'Indonesia' },
    { id: 'vi', label: 'Tiếng Việt' },
    { id: 'ne', label: 'नेपाली' }
  ] as const;

  return (
    <div 
      className="fixed inset-0 z-[500] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={handleClose}
    >
      <GlassCard 
        className={`w-full max-w-md rounded-sm p-6 shadow-2xl transition-all relative overflow-hidden ${
          step === 1 ? 'border-t-amber-500' : 'border-t-red-500'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Language Selector & Close */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4 gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {langs.map(l => (
              <button
                key={l.id}
                onClick={() => setSelectedLang(l.id as any)}
                className={`px-2.5 py-1 rounded text-[11px] font-kor transition-colors shrink-0 whitespace-nowrap leading-none ${
                  selectedLang === l.id 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold' 
                    : 'text-slate-400 hover:text-white bg-slate-800/60 border border-slate-700/50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button 
            onClick={handleClose} 
            className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className={`flex items-center gap-1 text-[11px] font-tech tracking-wider px-2.5 py-1 rounded-full ${
            step === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 font-bold' : 'bg-slate-800 text-slate-400'
          }`}>
            <span>STEP 1</span>
          </div>
          <div className="w-6 h-0.5 bg-slate-700"></div>
          <div className={`flex items-center gap-1 text-[11px] font-tech tracking-wider px-2.5 py-1 rounded-full ${
            step === 2 ? 'bg-red-500/20 text-red-400 border border-red-500/50 font-bold animate-pulse' : 'bg-slate-800 text-slate-400'
          }`}>
            <span>STEP 2</span>
          </div>
        </div>

        {/* Step Content */}
        {step === 1 ? (
          <div className="text-center animate-fade-in space-y-4">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/40 text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <AlertTriangle size={32} />
            </div>

            <div>
              <h3 className="text-base md:text-lg font-kor font-bold text-amber-400 mb-2">
                {t.retestWarning1Title}
              </h3>
              <p className="text-xs md:text-sm text-slate-200 font-kor leading-relaxed break-keep px-1">
                {t.retestWarning1Msg}
              </p>
            </div>

            <div className="bg-slate-900/90 border border-amber-900/40 p-3 rounded text-[11px] font-kor text-amber-300/90 text-left">
              • 현재 기록된 시험 점수 및 풀이 답안이 모두 초기화됩니다.<br/>
              • Current score & answer history will be reset.
            </div>

            <div className="space-y-2 pt-2">
              <button 
                onClick={handleNextStep}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-kor font-bold text-sm rounded-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>{t.confirmNext}</span>
                <ArrowRight size={16} />
              </button>
              <button 
                onClick={handleClose}
                className="w-full py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 font-kor text-xs rounded-sm transition-all"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center animate-fade-in space-y-4">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-bounce">
              <AlertOctagon size={34} />
            </div>

            <div>
              <h3 className="text-base md:text-lg font-kor font-bold text-red-400 mb-2">
                {t.retestWarning2Title}
              </h3>
              <p className="text-xs md:text-sm text-slate-100 font-kor font-medium leading-relaxed break-keep px-1">
                {t.retestWarning2Msg}
              </p>
            </div>

            <div className="bg-red-950/40 border border-red-800/60 p-3 rounded text-[11px] font-kor text-red-300 text-left">
              ⚠️ 주의: 이전 응시 데이터는 절대 복구할 수 없습니다.<br/>
              ⚠️ Attention: Previous exam data cannot be recovered.
            </div>

            <div className="space-y-2 pt-2">
              <button 
                onClick={handleFinalConfirm}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-kor font-bold text-sm rounded-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>{t.confirmFinal}</span>
              </button>
              <button 
                onClick={handleClose}
                className="w-full py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 font-kor text-xs rounded-sm transition-all"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
