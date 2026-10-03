import React, { useState, useRef } from 'react';
import { GlassCard, PremiumButton, Input } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { 
  exportResultsToCSV, GAS_URL, updateActiveExam, addAvailableExamSlot, 
  saveExamQuestionsToFirestore, getExamQuestionsFromFirestore 
} from '../lib/firebase';
import { extractPDFWithAI } from '../lib/api';
import { X, QrCode, Activity, BarChart2, FolderDown, Save, Eye, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LiveMonitor } from '../components/LiveMonitor';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { Question } from '../types';

// Make sure pdfjsLib is available (loaded via CDN in index.html)
declare const pdfjsLib: any;

export const AdminScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { availableExams, activeExamName, setActiveExamName, setAvailableExams } = useExamStore();
  
  const [logs, setLogs] = useState<{msg: string, type: string, time: string}[]>([{ msg: '> SYSTEM STANDBY... Realtime Cloud Enabled', type: 'info', time: new Date().toLocaleTimeString() }]);
  const [newExamName, setNewExamName] = useState('');
  const [selectedSaveExam, setSelectedSaveExam] = useState(activeExamName);
  const [jsonResult, setJsonResult] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSlot, setIsLoadingSlot] = useState(false);
  
  const [showPreview, setShowPreview] = useState(false);
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('CLICK TO SELECT PDF');
  const [isExtracting, setIsExtracting] = useState(false);

  const writeLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleChangeActiveExam = async () => {
    const target = document.getElementById('admin-active-exam-select') as HTMLSelectElement;
    if(!target.value) return;
    const selected = target.value;
    writeLog(`응시자 시험 슬롯 변경 요청: ${selected}`, 'info');
    try {
      const ok = await updateActiveExam(selected, availableExams);
      if (ok) {
        setActiveExamName(selected);
        setSelectedSaveExam(selected);
        writeLog(`'${selected}' 슬롯이 활성화되었습니다. 모든 응시자 화면에 즉각 실시간 반영됩니다.`, 'success');
        alert(`'${selected}' 슬롯이 성공적으로 활성화되었습니다!`);
      } else {
        throw new Error("클라우드 설정 업데이트 실패");
      }
    } catch(e: any) { 
      writeLog(`설정 변경에 실패했습니다: ${e.message}`, 'error'); 
    }
  };

  const handleCreateNewExam = async () => {
    const name = newExamName.trim();
    if(!name) return alert("생성할 새 모의고사 이름을 입력하세요.");
    if(availableExams.includes(name)) return alert("이미 존재하는 이름입니다.");
    
    writeLog(`새 슬롯 생성 중: ${name}`, 'info');
    try {
      await addAvailableExamSlot(name);
      setAvailableExams([...availableExams, name]);
      setSelectedSaveExam(name);
      setActiveExamName(name);
      setNewExamName('');
      writeLog(`'${name}' 슬롯이 생성 및 활성화되었습니다.`, 'success');
      alert(`'${name}' 슬롯이 생성 및 활성화되었습니다!`);
    } catch(e: any) { 
      writeLog(`슬롯 생성에 실패했습니다: ${e.message}`, 'error'); 
    }
  };

  const handleLoadSlotQuestions = async () => {
    setIsLoadingSlot(true);
    writeLog(`[${selectedSaveExam}] 슬롯 문항 불러오는 중...`, "info");
    try {
      let qs = await getExamQuestionsFromFirestore(selectedSaveExam);
      if (!qs || qs.length === 0) {
        // Fallback to GAS if not in Firestore yet
        const res = await fetch(`${GAS_URL}?exam=${encodeURIComponent(selectedSaveExam)}`);
        const json = await res.json();
        if (json.status === "success" && json.data && json.data.length > 0) {
          const validData = json.data.filter((r: any[]) => r[0] && r[0].toString().trim() !== '문제번호');
          qs = validData.map((r: any[], idx: number) => ({
            num: r[0] || (idx + 1),
            type: r[1] || '읽기',
            passage: r[2] || '',
            question: r[3] || '',
            image: r[4] || '',
            options: [r[5], r[6], r[7], r[8]],
            answer: (r[9] !== undefined && r[9] !== "" && !isNaN(parseInt(r[9]))) ? parseInt(r[9]) - 1 : "",
            score: (r[10] !== undefined && r[10] !== "") ? parseInt(r[10]) : (r[1] === '듣기' ? 3 : 2)
          }));
        }
      }

      if (qs && qs.length > 0) {
        setJsonResult(JSON.stringify(qs, null, 2));
        const realCount = qs.filter((x: any) => x.num !== '예시' && x.num !== '보기').length;
        writeLog(`'${selectedSaveExam}' 슬롯에서 총 ${realCount}문항 (예시 포함 ${qs.length}개)을 성공적으로 불러왔습니다. [PREVIEW / EDIT]에서 편집 가능합니다.`, "success");
      } else {
        writeLog(`'${selectedSaveExam}' 슬롯에 저장된 문항이 없습니다. PDF 스캔 후 저장해주세요.`, "warning");
        setJsonResult(JSON.stringify([], null, 2));
      }
    } catch (e: any) {
      writeLog(`문항 불러오기 실패: ${e.message}`, "error");
    } finally {
      setIsLoadingSlot(false);
    }
  };

  const handleRunExtraction = async () => {
    const file = fileInputRef.current?.files?.[0];
    if(!file) return alert("PDF 파일을 먼저 선택해주세요.");
    
    setIsExtracting(true);
    setLogs([]);
    setJsonResult('');
    
    try {
      writeLog("PDF 파싱 중...", "info");
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
      
      const endPage = pdf.numPages;
      writeLog(`총 ${endPage}페이지 문서 스캔을 시작합니다. (안정성 최우선: 순차 처리 모드 🛡️)`, "info");
      
      let allItems: any[] = [];
      
      const prompt = `당신은 한국어능력시험(TOPIK) 문항 분석 전문가입니다. 제공된 시험지 이미지에서 객관식 문항들을 정확히 인식하여 다음 JSON 배열 형식으로 반환하세요.

[핵심 추출 규칙 - 반드시 지킬 것!]
1. 문항 분류: 1~30번은 "type": "듣기", 31~70번은 "type": "읽기"
2. 듣기/읽기 지문: 문장에 딸린 텍스트 본문이나 대화문은 "passage"에 넣습니다. 지문이 없으면 ""(빈 문자열)로 둡니다.
3. 질문 내용: 실제 질문 내용만 "question"에 넣습니다.
4. 보기 순서 교정: 보기는 번호 순서에 맞게 "opt1", "opt2", "opt3", "opt4"에 배정하세요.
5. 이미지 필수: 모든 문항 객체에 반드시 "image": "" 속성을 포함하세요.
6. 예시 문항 생성 제한: '<보기>' 상자가 물리적으로 존재하는 경우에만 "num": "예시" 문항을 생성하세요.
7. ★문항 번호 중복 제거★: UI에서 번호(예: Q25)를 자동으로 표시하므로, "question" 필드에는 "25. ", "1. " 같은 문항 번호를 절대 쓰지 마세요.
8. ★공통 지시문 배치 규칙 (매우 중요)★:
    - <보기>(예시)가 있는 묶음 문항: "※ [1~4] 다음을 듣고..."와 같은 공통 지시문은 첫 번째 문제(1번)가 아니라 반드시 "num": "예시" 문항의 "question" 필드에 넣으세요. 이 경우 1번 문항의 "question"에는 "(4점)" 같은 배점만 남깁니다.
    - <보기>(예시)가 없는 묶음 문항: 공통 지시문은 해당 묶음의 첫 번째 문항 "question"에 넣고, 줄바꿈(\\n) 후 개별 질문을 적으세요. (예: "※ [25~26]...답하십시오.\\n여자가 왜... (3점)")
9. 대화문 줄바꿈 유지: 대화('가:', '나:')나 단락 구분은 반드시 줄바꿈 문자('\\n')를 포함하여 추출하세요.
10. ★용어 자동 변환★: 원본 시험지에 "윗글"이라고 적혀 있더라도 반드시 "아래 글"로 변경하여 추출하세요.
11. 정답 필드: "answer"는 무조건 빈 문자열 ""로 고정합니다.
12. ★배점 필드★: 문제 텍스트에 "(3점)" 등 배점 표시가 있다면 해당 숫자를 정수형으로 "score"에 넣으세요. 없다면 "듣기"는 3, "읽기"는 2를 기본값으로 넣으세요.
13. ★빈 페이지 처리★: 추출할 문항이 전혀 없다면 오직 빈 배열 [] 만 반환하세요.

[출력 JSON 배열 포맷 예시 1: <보기>가 있는 경우]
[
  { "num": "예시", "type": "듣기", "passage": "가: 공책이 있어요?\\n나: __________________", "question": "※ [1~4] 다음을 듣고 <보기>와 같이 물음에 맞는 대답을 고르십시오.", "image": "", "opt1": "...", "opt2": "...", "opt3": "...", "opt4": "...", "answer": "", "score": 0 },
  { "num": 1, "type": "듣기", "passage": "", "question": "(4점)", "image": "", "opt1": "...", "opt2": "...", "opt3": "...", "opt4": "...", "answer": "", "score": 4 }
]`;
      
      for(let i = 1; i <= endPage; i++) {
        writeLog(`[${i}/${endPage}] 렌더링 및 AI 분석 요청 중...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.height = viewport.height; canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        try {
          const resultText = await extractPDFWithAI(prompt, base64);
          let cleanText = resultText.replace(/__BACKTICK__json|__BACKTICK__/g, '').replace(/\`\`\`json|\`\`\`/g, '').trim();
          const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
          if (arrayMatch) cleanText = arrayMatch[0];
          
          const items = JSON.parse(cleanText);
          if(items && items.length > 0) {
            writeLog(`성공: ${i}페이지 ${items.length}개 항목 추출`, "success");
            allItems = [...allItems, ...items];
          } else {
            writeLog(`알림: ${i}페이지 문항 없음`, "warning");
          }
        } catch(err: any) {
          writeLog(`AI 호출 실패 (페이지 ${i}): ${err?.message || '통신 오류'}`, "error");
        }

        // Pacing delay between pages to prevent rate limits
        if (i < endPage) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      
      setJsonResult(JSON.stringify(allItems, null, 2));
      writeLog("분석 완료. [PREVIEW / EDIT] 뷰에서 확인 후 슬롯에 저장하세요.", "success");
    } catch (e: any) {
      writeLog(`오류 발생: ${e.message}`, "error"); 
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveToSheet = async () => {
    if(!jsonResult) return alert("저장할 문항 데이터가 없습니다. 먼저 PDF를 분석하거나 슬롯 문항을 불러오세요.");
    setIsSaving(true);
    try {
      const parsed = JSON.parse(jsonResult);
      if (!Array.isArray(parsed)) {
        throw new Error("문항 데이터가 올바른 배열 형태가 아닙니다.");
      }

      writeLog(`[${selectedSaveExam}] 슬롯에 문항 저장 중... (${parsed.length}개)`, "info");

      // Normalize questions
      let rc = 0;
      const formattedQs: Question[] = parsed.map((o: any, idx: number) => {
        const isEx = o.num === '예시' || o.num === '보기';
        if (!isEx) rc++;
        return {
          num: o.num !== undefined ? o.num : (idx + 1),
          realIdx: isEx ? '-' : rc,
          type: o.type || '읽기',
          passage: o.passage || '',
          question: o.question || '',
          image: o.image || '',
          options: Array.isArray(o.options) 
            ? o.options 
            : [o.opt1 || '', o.opt2 || '', o.opt3 || '', o.opt4 || ''],
          answer: (o.answer !== undefined && o.answer !== "" && !isNaN(parseInt(o.answer))) 
            ? (typeof o.answer === 'number' ? o.answer : parseInt(o.answer) - 1)
            : (typeof o.answer === 'number' ? o.answer : ""),
          score: o.score !== undefined && o.score !== "" ? Number(o.score) : (o.type === '듣기' ? 3 : 2)
        };
      });

      const ok = await saveExamQuestionsToFirestore(selectedSaveExam, formattedQs);
      if (ok) {
        const realCount = formattedQs.filter(x => x.num !== '예시' && x.num !== '보기').length;
        writeLog(`'${selectedSaveExam}' 슬롯에 총 ${realCount}문항 (예시 포함 ${formattedQs.length}개) 저장 완료! 응시자 화면에 즉각 반영됩니다.`, "success");
        alert(`'${selectedSaveExam}' 슬롯에 총 ${realCount}문항 (예시 포함 ${formattedQs.length}개)이 저장되었습니다!\n모든 응시자 화면에 즉각 반영됩니다.`);
        if (selectedSaveExam === activeExamName) {
          useExamStore.getState().setQuestions(formattedQs);
        }
      } else {
        throw new Error("클라우드 저장 실패");
      }
    } catch(e: any) { 
      writeLog(`저장 실패: ${e.message}`, "error"); 
      alert("오류 발생: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <GlassCard 
        className="w-full max-w-5xl h-[95vh] md:h-[90vh] rounded-sm border-t-amber-500 flex flex-col overflow-hidden shadow-2xl relative"
        style={{
          backgroundImage: "linear-gradient(rgba(10, 15, 30, 0.88), rgba(5, 10, 20, 0.93)), url('/yard.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 md:h-9 flex items-center justify-center">
              <img 
                src="/ci.png" 
                alt="HD현대삼호" 
                className="h-full object-contain filter drop-shadow-[0_0_2px_rgba(255,255,255,0.95)] drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" 
                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              />
            </div>
            <div>
              <div className="text-[10px] font-tech text-amber-500 tracking-[0.3em] mb-0.5">ADMINISTRATION</div>
              <h2 className="text-base md:text-lg font-tech font-bold text-white flex items-center gap-2 tracking-wider">
                SYSTEM CONTROL CENTER <span className="text-[9px] bg-amber-500/20 border border-amber-500 text-amber-400 px-1.5 py-0.5 rounded-sm tracking-widest">PRO</span>
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-lg font-tech transition-all"><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent space-y-4 md:space-y-6 no-scrollbar">
          
          <div className="bg-slate-900/70 p-5 rounded-sm border border-slate-800 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col md:flex-row gap-4 items-stretch mb-6">
              <PremiumButton onClick={() => setShowLiveMonitor(true)} className="flex-1 py-4 text-sm font-tech tracking-widest flex flex-col items-center justify-center gap-1">
                <div className="flex items-center gap-2">
                  <Activity size={18} /> REAL-TIME MONITOR
                </div>
                <span className="text-[10px] font-kor text-cyan-300/80 font-normal tracking-normal">실시간 응시 현황 및 응시자 정보 수정</span>
              </PremiumButton>
              <PremiumButton onClick={() => setShowAnalytics(true)} className="flex-1 py-4 text-sm font-tech tracking-widest flex flex-col items-center justify-center gap-1 border-indigo-500/50 hover:bg-indigo-900/30 text-indigo-400">
                <div className="flex items-center gap-2">
                  <BarChart2 size={18} /> ANALYTICS DASHBOARD
                </div>
                <span className="text-[10px] font-kor text-indigo-300/80 font-normal tracking-normal">성적 통계 분석 및 응시자 정보 직접 수정</span>
              </PremiumButton>
            </div>
            <div className="bg-indigo-900/20 p-4 rounded-sm border border-indigo-500/30 mb-4">
              <h4 className="font-tech text-indigo-400 mb-1 text-xs tracking-widest flex items-center gap-2"><span className="text-[8px]">▶</span> ACTIVE EXAM SLOT (실시간 시험 배정)</h4>
              <p className="text-[11px] font-kor text-slate-300">응시자에게 즉각 노출될 활성 모의고사를 변경하거나 새로운 시험 슬롯을 생성합니다. (변경 즉시 실시간 동기화)</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2 items-center">
                <select id="admin-active-exam-select" defaultValue={activeExamName} className="system-input p-2.5 outline-none text-sm flex-1 font-kor">
                  {availableExams.map(ex => (
                    <option key={ex} value={ex}>
                      {ex} {ex === activeExamName ? '★ [현재 활성]' : ''}
                    </option>
                  ))}
                </select>
                <button onClick={handleChangeActiveExam} className="bg-indigo-600/90 border border-indigo-500 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-sm font-kor font-bold text-xs tracking-wider transition-colors shrink-0 flex items-center gap-1.5 shadow-md">
                  <CheckCircle2 size={14} /> 활성화 적용
                </button>
              </div>
              <div className="flex-1 flex gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-4">
                <Input value={newExamName} onChange={(e) => setNewExamName(e.target.value)} placeholder="새 슬롯명 (예: 모의고사7회)" className="p-2.5 outline-none text-sm flex-1 font-kor text-left" />
                <button onClick={handleCreateNewExam} className="bg-slate-800 border border-slate-700 text-cyan-400 px-4 py-2.5 rounded-sm font-tech text-xs tracking-widest hover:bg-slate-700 transition-colors shrink-0">+ CREATE</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-slate-900/70 p-5 rounded-sm border border-slate-800 shadow-sm space-y-4 flex flex-col backdrop-blur-sm">
              <label className="block font-tech text-cyan-500 text-[11px] tracking-widest mb-1"><span className="mr-1">1.</span> PDF SCANNER</label>
              <label className="border border-dashed border-cyan-800/50 rounded-sm p-6 flex flex-col items-center justify-center bg-slate-900/40 hover:bg-cyan-900/20 cursor-pointer transition-colors flex-1">
                <input type="file" ref={fileInputRef} accept=".pdf" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || 'CLICK TO SELECT PDF')} />
                <div className="text-3xl mb-2 opacity-70">📄</div>
                <p className="text-cyan-400 font-tech text-[10px] tracking-widest mt-2">{fileName}</p>
              </label>
              <PremiumButton onClick={handleRunExtraction} disabled={isExtracting} className="w-full py-3.5 rounded-sm text-xs tracking-widest mt-2">
                {isExtracting ? 'EXTRACTING...' : 'START AI EXTRACTION'}
              </PremiumButton>
            </div>

            <div className="flex flex-col bg-slate-900/70 p-5 rounded-sm border border-slate-800 shadow-sm backdrop-blur-sm">
              <label className="block font-tech text-cyan-500 text-[11px] tracking-widest mb-2"><span className="mr-1">2.</span> ENGINE LOG</label>
              <div className="flex-1 bg-slate-950/80 rounded-sm border border-slate-800 p-4 font-tech text-[10px] space-y-1.5 overflow-y-auto min-h-[150px] shadow-inner tracking-wider">
                {logs.map((l, i) => {
                  let color = 'text-emerald-400';
                  if(l.type === 'error') color = 'text-red-400';
                  if(l.type === 'warning') color = 'text-amber-400';
                  if(l.type === 'success') color = 'text-cyan-400';
                  return <p key={i} className={color}>[{l.time}] {l.msg}</p>;
                })}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 p-5 rounded-sm border border-slate-800 shadow-sm col-span-1 lg:col-span-2 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-3">
              <label className="font-tech text-emerald-500 text-[11px] tracking-widest"><span className="mr-1">3.</span> RESULT MANAGEMENT</label>
              <button onClick={exportResultsToCSV} className="bg-emerald-600 border border-emerald-500 text-white px-4 py-2.5 rounded-sm font-tech text-xs tracking-widest hover:bg-emerald-500 transition-colors">
                📊 EXPORT TO CSV
              </button>
            </div>
            <p className="text-[11px] font-kor text-slate-400 mb-2">파이어베이스에 저장된 모든 응시자의 시험 결과를 엑셀(CSV) 파일로 다운로드합니다.</p>
          </div>

          <div className="bg-slate-900/70 p-5 rounded-sm border border-slate-800 shadow-sm col-span-1 lg:col-span-2 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
              <div>
                <label className="font-tech text-cyan-500 text-[11px] tracking-widest block"><span className="mr-1">4.</span> SLOT QUESTION MANAGEMENT & CLOUD SYNC</label>
                <p className="text-[11px] font-kor text-slate-400 mt-0.5">슬롯별 문항을 불러와 검토하거나, PDF 추출 결과를 해당 슬롯에 실시간 저장합니다.</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                <select value={selectedSaveExam} onChange={(e) => setSelectedSaveExam(e.target.value)} className="system-input p-2 text-xs font-kor outline-none">
                  {availableExams.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
                <button 
                  onClick={handleLoadSlotQuestions} 
                  disabled={isLoadingSlot}
                  className="bg-slate-800 border border-cyan-800 hover:border-cyan-500 text-cyan-300 px-3 py-2 rounded-sm font-kor text-xs tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <FolderDown size={14} /> {isLoadingSlot ? '로딩 중...' : '문항 불러오기'}
                </button>
                {jsonResult && (
                  <>
                    <button onClick={() => setShowPreview(true)} className="bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-sm font-kor text-xs tracking-wider flex items-center gap-1.5 transition-colors">
                      <Eye size={14} /> 편집 / 상세보기
                    </button>
                    <PremiumButton onClick={handleSaveToSheet} disabled={isSaving} className="px-4 py-2 rounded-sm font-kor font-bold text-xs tracking-wider flex items-center gap-1.5">
                      <Save size={14} /> {isSaving ? '저장 중...' : '슬롯에 저장하기'}
                    </PremiumButton>
                  </>
                )}
              </div>
            </div>
            <textarea value={jsonResult} onChange={(e) => setJsonResult(e.target.value)} className="w-full h-40 bg-slate-950/80 border border-slate-800 rounded-sm p-3 font-tech text-[10px] text-cyan-300 focus:border-cyan-500 outline-none shadow-inner tracking-wider" placeholder="{ DATA OUTPUT }"></textarea>
          </div>
        </div>
      </GlassCard>

      {/* Simplified Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 md:p-4">
          <GlassCard className="w-full max-w-4xl h-[95vh] md:h-[90vh] rounded-sm border-t-cyan-500 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 z-10 shrink-0">
              <h3 className="font-tech font-bold text-xs md:text-sm text-cyan-400 tracking-widest">👀 DATA INSPECTION & EDIT</h3>
              <button onClick={() => setShowPreview(false)} className="w-7 h-7 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-sm text-slate-400 hover:text-white hover:bg-slate-700 font-tech transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-transparent no-scrollbar font-kor">
               <div className="flex justify-between items-center text-xs text-slate-400 font-kor">
                 <span>JSON 문항 데이터를 직접 수정할 수 있습니다. 수정한 후 슬롯에 저장하세요.</span>
                 <PremiumButton onClick={() => { setShowPreview(false); handleSaveToSheet(); }} className="px-3 py-1.5 text-xs font-kor">수정 내용 저장</PremiumButton>
               </div>
               <textarea value={jsonResult} onChange={(e) => setJsonResult(e.target.value)} className="w-full h-[80%] bg-slate-950/80 border border-slate-800 rounded-sm p-3 font-tech text-xs text-cyan-300 outline-none" />
            </div>
          </GlassCard>
        </div>
      )}

      {showLiveMonitor && <LiveMonitor onClose={() => setShowLiveMonitor(false)} />}
      {showAnalytics && <AnalyticsDashboard onClose={() => setShowAnalytics(false)} />}
    </div>
  );
};
