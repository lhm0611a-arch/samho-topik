import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GlassCard, StartGradientButton } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { saveResultToFirebase, sendToGoogleSheet, updateLiveSession } from '../lib/firebase';
import { showZoomModal } from '../components/ZoomModal';
import { ExamExitModal } from '../components/ExamExitModal';
import { getTranslation } from '../lib/i18n';
import { 
  Bookmark, LayoutGrid, AlertCircle, X, CheckCircle2, 
  ChevronLeft, ChevronRight, LogOut 
} from 'lucide-react';

export const TestScreen: React.FC = () => {
  const { 
    questions, currentIdx, answers, bookmarks, setAnswer, toggleBookmark, jumpToQuestion,
    nextQuestion, prevQuestion, timeLeft, setTimeLeft, endExam, setScreen, setResult, candidate, activeExamName,
    selectedLang
  } = useExamStore();
  
  const [showOMR, setShowOMR] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = getTranslation(selectedLang);

  const q = questions && questions.length > 0 && currentIdx < questions.length ? questions[currentIdx] : null;
  const isExample = q ? (q.num === '예시' || q.num === '보기') : false;
  
  // Exclude example questions from stats
  const actualQs = questions ? questions.filter(x => x.num !== '예시' && x.num !== '보기') : [];
  const realQuestionsCount = actualQs.length;
  const answeredCount = actualQs.filter(x => {
    const origIdx = questions.findIndex(orig => orig === x);
    return origIdx !== -1 && answers[origIdx] !== null;
  }).length;
  
  const unansweredCount = realQuestionsCount - answeredCount;
  
  const bookmarkedCount = actualQs.filter(x => {
    const origIdx = questions.findIndex(orig => orig === x);
    return origIdx !== -1 && bookmarks[origIdx] === true;
  }).length;

  const finalizeExam = useCallback(async () => {
    endExam();
    
    let correct = 0;
    let earned_total = 0;
    let earned_lc = 0;
    let earned_rc = 0;
    let detailedAnswers: Record<string, number> = {};

    questions.forEach((qItem, i) => {
      if(qItem.num === '예시' || qItem.num === '보기') return;

      let point = Number(qItem.score);
      if (isNaN(point) || point === 0) {
        const scoreMatch = qItem.question.match(/(\d+)\s*점/);
        point = scoreMatch ? parseInt(scoreMatch[1], 10) : (qItem.type === '듣기' ? 3 : 2);
      }

      if (qItem.answer !== "" && qItem.answer !== null && answers[i] === qItem.answer) {
        correct++;
        earned_total += point;
        if (qItem.type === '듣기') earned_lc += point;
        else earned_rc += point;
      }
      detailedAnswers[`Q${qItem.num}`] = answers[i] !== null ? (answers[i] as number) + 1 : 0;
    });

    const resultData = {
      examName: activeExamName,
      registrationNo: candidate?.regNo || 'Unknown',
      studentName: candidate?.name || 'Unknown',
      company: candidate?.company || 'Unknown',
      score: earned_total,
      lcScore: earned_lc,
      rcScore: earned_rc,
      correctCount: correct,
      totalQuestions: realQuestionsCount,
      detailedAnswers
    };

    setResult(resultData);
    setScreen('result');

    const success = await saveResultToFirebase(resultData);
    if (!success) {
      sendToGoogleSheet(resultData);
    }
  }, [questions, answers, activeExamName, candidate, endExam, setResult, setScreen, realQuestionsCount]);

  useEffect(() => {
    if (candidate) {
      updateLiveSession(candidate.regNo, candidate.name, activeExamName, 'TESTING', answeredCount, realQuestionsCount);
    }
  }, [candidate, activeExamName, answeredCount, realQuestionsCount]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setTimeLeft(timeLeft - 1);
      if (timeLeft <= 1) {
        finalizeExam();
      }
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, setTimeLeft, finalizeExam]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentIdx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showOMR || showSubmitConfirm || showExitModal) return; // Disable shortcuts if modals open
      
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        setAnswer(currentIdx, idx);
        setTimeout(() => { if(currentIdx < questions.length - 1) nextQuestion(); }, 300);
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentIdx < questions.length - 1) nextQuestion();
        else setShowSubmitConfirm(true);
      } else if (e.key === 'ArrowLeft') {
        if (currentIdx > 0) prevQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, questions.length, nextQuestion, prevQuestion, setAnswer, showOMR, showSubmitConfirm, showExitModal]);

  if (!q) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-cyan-400 font-tech text-base tracking-widest animate-pulse mb-3">
          INITIALIZING EXAMINATION ENVIRONMENT...
        </div>
        <p className="text-xs text-slate-400 font-kor">문항 데이터를 불러오는 중입니다. 잠시만 기다려주세요.</p>
      </div>
    );
  }

  const handleOptionSelect = (idx: number) => {
    setAnswer(currentIdx, idx);
    setTimeout(() => { if(currentIdx < questions.length - 1) nextQuestion(); }, 300);
  };

  const isImage = (opt: any) => {
    if (!opt) return false;
    const str = String(opt);
    return str.match(/^https?:\/\//) || str.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || str.startsWith('data:image');
  };

  const renderOptionContent = (opt: any) => {
    const str = String(opt);
    if (isImage(str)) {
      return (
        <img 
          src={str} 
          alt="보기 이미지" 
          className="max-h-24 sm:max-h-28 md:max-h-32 object-contain rounded-sm border border-slate-700 bg-slate-800 p-1 cursor-zoom-in hover:opacity-80 transition-opacity" 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); showZoomModal(str); }} 
        />
      );
    }
    return <span className="text-slate-200 font-medium text-xs sm:text-base break-keep leading-snug">{str}</span>;
  };

  let rawQuestionText = q.question;
  if (!isExample) {
    const numRegex1 = new RegExp(`^${q.num}\\.\\s*`);
    const numRegex2 = new RegExp(`\\n${q.num}\\.\\s*`);
    rawQuestionText = rawQuestionText.replace(numRegex1, '').replace(numRegex2, '\n');
  }
  rawQuestionText = rawQuestionText.replace(/윗글/g, '아래 글');

  const progressPercent = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden bg-transparent">
      {/* Progress Bar */}
      <div className="w-full glass-card border-b border-slate-800 h-1.5 md:h-2 overflow-hidden shrink-0">
        <div className="bg-[#00b050] h-full transition-all duration-300 shadow-[0_0_10px_rgba(0,176,80,0.8)] relative" style={{ width: `${progressPercent}%` }}>
          <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/50 blur-[2px]"></div>
        </div>
      </div>
      
      {/* Scrollable Question Content Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6 w-full select-none"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        <div className="w-full max-w-3xl mx-auto py-1 sm:py-2 pb-28 sm:pb-32">
          <GlassCard className="w-full p-3.5 sm:p-5 md:p-7 rounded-sm shadow-xl relative">
            
            {/* Top Question Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-2 sm:pb-2.5 mb-2.5 sm:mb-3 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {isExample ? (
                  <span className="text-[#00b050] font-extrabold text-xl md:text-2xl tracking-normal font-kor">[예시]</span>
                ) : (
                  <span className="text-cyan-400 font-tech font-bold text-2xl md:text-3xl tracking-widest">
                    Q{q.num}.
                  </span>
                )}
                
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {q.type === '듣기' ? (
                    <span className="bg-cyan-900/50 border border-cyan-800 text-cyan-400 px-2 py-0.5 rounded text-[10px] font-tech tracking-widest whitespace-nowrap">LISTENING</span>
                  ) : (
                    <span className="bg-indigo-900/50 border border-indigo-800 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-tech tracking-widest whitespace-nowrap">READING</span>
                  )}
                  {!isExample && (
                    <button 
                      onClick={() => toggleBookmark(currentIdx)} 
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-tech tracking-widest transition-colors whitespace-nowrap ${bookmarks[currentIdx] ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      <Bookmark size={11} className={bookmarks[currentIdx] ? "fill-amber-500" : ""} /> {bookmarks[currentIdx] ? 'MARKED' : 'MARK'}
                    </button>
                  )}
                </div>
              </div>

              {/* Right Controls: Question Counter */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="text-slate-300 font-tech text-xs bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800 shrink-0 whitespace-nowrap">
                  <span className="text-cyan-400">{isExample ? 'P' : 'Q'}</span>{q.realIdx} <span className="mx-0.5 text-slate-500">/</span> {realQuestionsCount}
                </div>
              </div>
            </div>

            {/* Question Text */}
            <h3 className="text-sm sm:text-lg md:text-xl font-kor font-medium text-white leading-relaxed break-keep mb-2.5 sm:mb-4">
              {q.type === '듣기' && rawQuestionText.includes('점)') && !isExample ? (
                <>
                  <span className="inline-block bg-slate-800 border border-slate-700 text-cyan-400 px-2 py-0.5 rounded-sm text-xs mr-1 font-tech tracking-widest align-middle">[AUDIO]</span> 
                  <span className="text-white text-sm sm:text-lg md:text-xl align-middle" dangerouslySetInnerHTML={{ __html: rawQuestionText.replace(/\n/g, '<br>') }} />
                </>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: rawQuestionText.replace(/\n/g, '<br>') }} />
              )}
            </h3>

            {/* Passage if exists */}
            {q.passage && q.passage.trim() && (
              <div className="mb-2.5 sm:mb-4">
                <div className={`p-2.5 sm:p-4 ${isExample ? 'bg-slate-800/80 border-slate-700 font-bold' : 'bg-slate-900/60 border-slate-800 font-medium'} rounded-sm border text-slate-200 text-xs sm:text-base md:text-lg whitespace-pre-wrap leading-relaxed font-kor shadow-inner`}>
                  {isExample && <div className="w-fit bg-slate-700/80 text-cyan-300 text-[10px] font-tech tracking-widest px-2 py-0.5 rounded-sm mb-2 border border-slate-600">&lt; EXAMPLE &gt;</div>}
                  <span dangerouslySetInnerHTML={{ __html: q.passage.replace(/\n/g, '<br>') }} />
                </div>
              </div>
            )}

            {/* Image if exists */}
            {q.image && q.image.trim() && (
              <div className="mb-2.5 sm:mb-4 rounded-sm overflow-hidden border border-slate-800 text-center bg-slate-900/60 p-2 sm:p-3">
                <img 
                  src={q.image} 
                  className="max-h-[22vh] sm:max-h-[32vh] md:max-h-[38vh] object-contain mx-auto cursor-zoom-in hover:opacity-80 transition-opacity rounded" 
                  onClick={() => showZoomModal(q.image)} 
                  alt="Question Image" 
                />
              </div>
            )}

            {/* Answer Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3.5 font-kor">
              {q.options.map((opt, i) => {
                if (opt === undefined || opt === null || String(opt).trim() === '') return null;
                const isChecked = answers[currentIdx] === i;
                return (
                  <label key={i} className="relative group block w-full cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="opt" 
                      className="option-input sr-only" 
                      checked={isChecked} 
                      onChange={() => handleOptionSelect(i)} 
                    />
                    <div className="option-label p-2 sm:p-3.5 rounded-sm flex items-center min-h-[2.85rem] sm:min-h-[3.5rem]">
                      <span className="opt-num w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full mr-2 sm:mr-3 shrink-0 text-xs sm:text-base font-bold">
                        {i+1}
                      </span>
                      {renderOptionContent(opt)}
                    </div>
                  </label>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Guaranteed Fixed Bottom Navigation Footer */}
      <footer className="shrink-0 p-2.5 sm:p-3 glass-card border-t border-cyan-900/50 flex z-30 pb-[max(env(safe-area-inset-bottom),0.5rem)] w-full shadow-2xl backdrop-blur-md">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-2 sm:gap-3">
          {/* Previous Question (뒤로 가기) */}
          <button 
            onClick={prevQuestion} 
            disabled={currentIdx === 0} 
            className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded font-kor font-bold text-xs sm:text-sm bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-20 disabled:hover:bg-slate-800 transition-all flex items-center justify-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
          >
            <ChevronLeft size={16} className="shrink-0" />
            <span>{t.prevBtn}</span>
          </button>

          {/* OMR Button */}
          <button 
            onClick={() => setShowOMR(true)} 
            className="py-2.5 sm:py-3 px-3.5 sm:px-5 bg-slate-800 hover:bg-slate-700 border border-cyan-900/60 rounded font-kor font-bold text-xs sm:text-sm text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1.5 transition-colors shrink-0 whitespace-nowrap active:scale-95 shadow-sm"
            title="OMR 답안표 열기"
          >
            <LayoutGrid size={16} className="shrink-0" />
            <span>OMR 답안표</span>
          </button>

          {/* Next / Submit Question (앞으로 가기 / 최종 제출) */}
          {currentIdx === questions.length - 1 ? (
             <StartGradientButton 
               onClick={() => setShowSubmitConfirm(true)} 
               className="flex-[1.3] py-2.5 sm:py-3 px-3 sm:px-5 rounded font-kor font-bold text-xs sm:text-sm flex items-center justify-center gap-1 shadow-lg whitespace-nowrap active:scale-95"
             >
               <span>최종 제출 ✔</span>
             </StartGradientButton>
          ) : (
            <StartGradientButton 
              onClick={nextQuestion} 
              className="flex-[1.3] py-2.5 sm:py-3 px-3 sm:px-5 rounded font-kor font-bold text-xs sm:text-sm flex items-center justify-center gap-1 shadow-lg whitespace-nowrap active:scale-95"
            >
              <span>{isExample ? "시험 시작 ▶" : t.nextBtn}</span>
              <ChevronRight size={16} className="shrink-0" />
            </StartGradientButton>
          )}
        </div>
      </footer>

      {/* Exam Exit Confirmation Modal */}
      <ExamExitModal 
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
      />

      {/* OMR Navigator Modal */}
      {showOMR && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowOMR(false)}>
          <GlassCard className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-sm shadow-2xl border-t-cyan-500" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
              <h3 className="font-tech text-cyan-400 tracking-widest text-sm sm:text-base flex items-center gap-2">
                <LayoutGrid size={18}/> OMR NAVIGATOR
              </h3>
              <button onClick={() => setShowOMR(false)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1 rounded-sm transition-colors"><X size={20}/></button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar">
              <div className="flex gap-4 mb-4 text-[10px] sm:text-xs font-kor text-slate-400 justify-center flex-wrap">
                <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-[#00b050]/20 border border-[#00b050] rounded-sm"></div> 답변 완료</span>
                <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-800/50 border border-slate-700 rounded-sm"></div> 미작성</span>
                <span className="flex items-center gap-1"><Bookmark size={12} className="text-amber-500 fill-amber-500" /> 북마크</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-3">
                {questions.map((qItem, i) => {
                  if (qItem.num === '예시' || qItem.num === '보기') return null;
                  const isAns = answers[i] !== null;
                  const isMarked = bookmarks[i];
                  const isCurrent = currentIdx === i;
                  return (
                    <button key={i} onClick={() => { jumpToQuestion(i); setShowOMR(false); }} className={`p-2 rounded-sm border flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 active:scale-95 ${isCurrent ? 'ring-2 ring-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : ''} ${isAns ? 'bg-[#00b050]/10 border-[#00b050] text-[#00b050]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                      <span className="font-tech text-xs sm:text-sm font-bold tracking-widest">{qItem.realIdx}</span>
                      <div className="flex gap-1 h-3 items-center">
                        {isAns && <CheckCircle2 size={12} className="text-[#00b050]" />}
                        {isMarked && <Bookmark size={12} className="text-amber-500 fill-amber-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Final Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowSubmitConfirm(false)}>
          <GlassCard className="w-full max-w-sm p-6 sm:p-8 rounded-sm shadow-2xl border-t-amber-500 text-center" onClick={e => e.stopPropagation()}>
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="font-tech text-white mb-2 tracking-widest text-lg">SUBMIT EXAM?</h3>
            <p className="text-slate-300 font-kor text-sm mb-5 break-keep">현재까지의 답안 작성 현황입니다.</p>
            
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-sm text-sm space-y-3 mb-6 font-kor text-left">
               <div className="flex justify-between items-center text-slate-300 border-b border-slate-800 pb-2"><span>전체 문항:</span> <span className="font-tech text-base">{realQuestionsCount}</span></div>
               <div className="flex justify-between items-center text-[#00b050]"><span>작성 완료:</span> <span className="font-tech text-base font-bold">{answeredCount}</span></div>
               <div className={`flex justify-between items-center ${unansweredCount > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}`}><span>미작성:</span> <span className="font-tech text-base">{unansweredCount}</span></div>
               <div className="flex justify-between items-center text-amber-500 border-t border-slate-800 pt-2"><span>북마크 (검토요망):</span> <span className="font-tech text-base">{bookmarkedCount}</span></div>
            </div>
            
            {unansweredCount > 0 && (
              <p className="text-xs text-red-400 mb-5 font-kor font-bold break-keep">아직 풀지 않은 문항이 {unansweredCount}개 있습니다!</p>
            )}
            
            <p className="text-[11px] text-slate-400 mb-6 font-kor break-keep">제출 후에는 답안을 수정할 수 없습니다. 정말 제출하시겠습니까?</p>
            
            <div className="flex gap-3">
               <button onClick={() => setShowSubmitConfirm(false)} className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-tech py-3.5 rounded-sm text-xs tracking-widest hover:bg-slate-700 transition-colors">RETURN</button>
               <StartGradientButton onClick={() => { setShowSubmitConfirm(false); finalizeExam(); }} className="flex-1 py-3.5 rounded-sm text-xs font-tech tracking-widest">FINAL SUBMIT</StartGradientButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
