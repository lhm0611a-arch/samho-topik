import React, { useEffect, useRef, useState } from 'react';
import { GlassCard, StartGradientButton } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { saveResultToFirebase, sendToGoogleSheet, updateLiveSession } from '../lib/firebase';
import { showZoomModal } from '../components/ZoomModal';
import { Bookmark, LayoutGrid, AlertCircle, X, CheckCircle2 } from 'lucide-react';

export const TestScreen: React.FC = () => {
  const { 
    questions, currentIdx, answers, bookmarks, setAnswer, toggleBookmark, jumpToQuestion,
    nextQuestion, prevQuestion, timeLeft, setTimeLeft, endExam, setScreen, setResult, candidate, activeExamName 
  } = useExamStore();
  
  const [showOMR, setShowOMR] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const q = questions[currentIdx];
  if (!q) return null; // Safe guard for rehydration mismatch
  
  const isExample = q.num === '예시' || q.num === '보기';
  
  // Exclude example questions from stats
  const actualQs = questions.filter(x => x.num !== '예시' && x.num !== '보기');
  const realQuestionsCount = actualQs.length;
  const answeredCount = actualQs.filter((x, i) => {
    // Find its original index in questions
    const origIdx = questions.findIndex(orig => orig === x);
    return answers[origIdx] !== null;
  }).length;
  
  const unansweredCount = realQuestionsCount - answeredCount;
  
  const bookmarkedCount = actualQs.filter((x, i) => {
    const origIdx = questions.findIndex(orig => orig === x);
    return bookmarks[origIdx] === true;
  }).length;

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
  }, [timeLeft, setTimeLeft]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentIdx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showOMR || showSubmitConfirm) return; // Disable shortcuts if modals open
      
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
  }, [currentIdx, questions.length, nextQuestion, prevQuestion, setAnswer, showOMR, showSubmitConfirm]);

  const finalizeExam = async () => {
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
  };

  const handleOptionSelect = (idx: number) => {
    setAnswer(currentIdx, idx);
    setTimeout(() => { if(currentIdx < questions.length - 1) nextQuestion(); }, 300);
  };

  const isImage = (opt: string) => {
    if(!opt) return false;
    return opt.match(/^https?:\/\//) || opt.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || opt.startsWith('data:image');
  };

  const renderOptionContent = (opt: string) => {
    if (isImage(opt)) {
      return <img src={opt} alt="보기 이미지" className="max-h-24 sm:max-h-28 md:max-h-32 object-contain rounded-sm border border-slate-700 bg-slate-800 p-1 cursor-zoom-in hover:opacity-80 transition-opacity" onClick={(e) => { e.preventDefault(); e.stopPropagation(); showZoomModal(opt); }} />;
    }
    return <span className="text-slate-200 font-medium text-sm sm:text-base break-keep leading-snug">{opt}</span>;
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
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      {/* Progress Bar */}
      <div className="w-full glass-card border-b border-slate-800 h-1.5 md:h-2 overflow-hidden shrink-0">
        <div className="bg-[#00b050] h-full transition-all duration-300 shadow-[0_0_10px_rgba(0,176,80,0.8)] relative" style={{ width: `${progressPercent}%` }}>
          <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/50 blur-[2px]"></div>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 no-scrollbar w-full">
        <div className="min-h-full flex flex-col items-center justify-center w-full">
          <GlassCard className="w-full max-w-3xl mx-auto p-5 sm:p-6 md:p-8 rounded-sm shadow-xl relative overflow-hidden">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                {isExample ? (
                  <span className="text-[#00b050] font-extrabold text-xl md:text-2xl tracking-normal font-kor">[예시]</span>
                ) : (
                  <span className="text-cyan-400 font-tech font-bold text-2xl md:text-3xl tracking-widest">Q{q.num}.</span>
                )}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  {q.type === '듣기' ? (
                    <span className="bg-cyan-900/50 border border-cyan-800 text-cyan-400 px-2 py-0.5 rounded-sm text-[10px] font-tech tracking-widest whitespace-nowrap">LISTENING</span>
                  ) : (
                    <span className="bg-indigo-900/50 border border-indigo-800 text-indigo-400 px-2 py-0.5 rounded-sm text-[10px] font-tech tracking-widest whitespace-nowrap">READING</span>
                  )}
                  {!isExample && (
                    <button onClick={() => toggleBookmark(currentIdx)} className={`flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-tech tracking-widest transition-colors ${bookmarks[currentIdx] ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                      <Bookmark size={12} className={bookmarks[currentIdx] ? "fill-amber-500" : ""} /> {bookmarks[currentIdx] ? 'MARKED' : 'MARK'}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <button onClick={() => setShowOMR(true)} className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-sm text-[10px] text-cyan-400 font-tech tracking-widest transition-colors">
                  <LayoutGrid size={12} /> OMR NAV
                </button>
                <div className="text-slate-300 font-tech text-xs sm:text-sm bg-slate-900/60 px-2 sm:px-3 py-1 rounded-sm border border-slate-800 flex items-center">
                  <span className="mr-0.5 text-cyan-500">{isExample ? 'P' : 'Q'}</span><span className="text-white">{q.realIdx}</span> <span className="mx-1 text-slate-500">/</span> <span>{realQuestionsCount}</span>
                </div>
              </div>
            </div>

            <h3 className="text-base sm:text-lg md:text-xl font-kor font-medium text-white leading-relaxed break-keep mb-5">
              {q.type === '듣기' && rawQuestionText.includes('점)') && !isExample ? (
                <><span className="inline-block bg-slate-800 border border-slate-700 text-cyan-400 px-2 py-0.5 rounded-sm text-xs mr-1 font-tech tracking-widest align-middle">[AUDIO]</span> <span className="text-white text-base sm:text-lg md:text-xl align-middle" dangerouslySetInnerHTML={{ __html: rawQuestionText.replace(/\n/g, '<br>') }} /></>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: rawQuestionText.replace(/\n/g, '<br>') }} />
              )}
            </h3>

            {q.passage && q.passage.trim() && (
              <div className="mb-6">
                <div className={`p-4 sm:p-5 md:p-6 ${isExample ? 'bg-slate-800/80 border-slate-700 font-bold' : 'bg-slate-900/60 border-slate-800 font-medium'} rounded-sm border text-slate-200 text-sm sm:text-base md:text-lg whitespace-pre-wrap leading-relaxed font-kor`}>
                  {isExample && <div className="w-fit bg-slate-700/80 text-cyan-300 text-[10px] font-tech tracking-widest px-2 py-0.5 rounded-sm mb-3 border border-slate-600">&lt; EXAMPLE &gt;</div>}
                  <span dangerouslySetInnerHTML={{ __html: q.passage.replace(/\n/g, '<br>') }} />
                </div>
              </div>
            )}

            {q.image && q.image.trim() && (
              <div className="mb-6 rounded-sm overflow-hidden border border-slate-800 text-center bg-slate-900/60 p-3 sm:p-4">
                <img src={q.image} className="max-h-[30vh] sm:max-h-[35vh] md:max-h-[40vh] object-contain mx-auto cursor-zoom-in hover:opacity-80 transition-opacity rounded" onClick={() => showZoomModal(q.image)} alt="Question Image" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-5 font-kor">
              {q.options.map((opt, i) => {
                if(!opt || opt.trim() === '') return null;
                const isChecked = answers[currentIdx] === i;
                return (
                  <label key={i} className="relative group block w-full cursor-pointer">
                    <input type="radio" name="opt" className="option-input sr-only" checked={isChecked} onChange={() => handleOptionSelect(i)} />
                    <div className="option-label p-3 sm:p-4 rounded-sm flex items-center min-h-[4rem] sm:min-h-[4.5rem]">
                      <span className="opt-num w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full mr-3 sm:mr-4 shrink-0 text-sm sm:text-base font-bold">{i+1}</span>
                      {renderOptionContent(opt)}
                    </div>
                  </label>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>

      <footer className="p-3 sm:p-4 glass-card border-t border-cyan-900/30 flex gap-3 sm:gap-4 z-10 shrink-0 pb-[max(env(safe-area-inset-bottom),0.75rem)] w-full">
        <div className="max-w-3xl mx-auto w-full flex gap-3 sm:gap-4">
          <button onClick={prevQuestion} disabled={currentIdx === 0} className="flex-[1] py-3.5 sm:py-4 rounded-sm font-tech tracking-widest text-xs sm:text-sm bg-slate-800/80 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-800 transition-all">PREV</button>
          {currentIdx === questions.length - 1 ? (
             <StartGradientButton onClick={() => setShowSubmitConfirm(true)} className="flex-[2] py-3.5 sm:py-4 rounded-sm font-tech tracking-widest text-xs sm:text-sm transition-colors">SUBMIT</StartGradientButton>
          ) : (
            <StartGradientButton onClick={nextQuestion} className="flex-[2] py-3.5 sm:py-4 rounded-sm font-tech tracking-widest text-xs sm:text-sm transition-colors">
              {isExample ? "START EXAM" : "NEXT"}
            </StartGradientButton>
          )}
        </div>
      </footer>

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
