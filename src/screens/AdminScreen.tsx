import React, { useState, useRef } from 'react';
import { GlassCard, PremiumButton, Input } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { exportResultsToCSV, GAS_URL } from '../lib/firebase';
import { extractPDFWithAI } from '../lib/api';
import { X, QrCode, Activity, BarChart2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LiveMonitor } from '../components/LiveMonitor';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';

// Make sure pdfjsLib is available (loaded via CDN in index.html)
declare const pdfjsLib: any;

export const AdminScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { availableExams, activeExamName, setActiveExamName } = useExamStore();
  
  const [logs, setLogs] = useState<{msg: string, type: string, time: string}[]>([{ msg: '> SYSTEM STANDBY...', type: 'info', time: new Date().toLocaleTimeString() }]);
  const [newExamName, setNewExamName] = useState('');
  const [selectedSaveExam, setSelectedSaveExam] = useState(activeExamName);
  const [jsonResult, setJsonResult] = useState('');
  
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
    writeLog(`응시자 화면 시험 변경 요청: ${target.value}`, 'info');
    try {
      await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'setActiveExam', examName: target.value }) });
      writeLog(`'${target.value}'(으)로 변경 완료.`, 'success');
      alert(`'${target.value}'(으)로 변경되었습니다.\n새로고침 합니다.`);
      setTimeout(() => location.reload(), 1500);
    } catch(e) { 
      writeLog('설정 변경에 실패했습니다.', 'error'); 
    }
  };

  const handleCreateNewExam = async () => {
    const name = newExamName.trim();
    if(!name) return alert("생성할 새 모의고사 이름을 입력하세요.");
    if(availableExams.includes(name)) return alert("이미 존재하는 이름입니다.");
    
    writeLog(`새 슬롯 생성 중: ${name}`, 'info');
    try {
      await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'setActiveExam', examName: name }) });
      writeLog(`'${name}' 슬롯 생성 완료.`, 'success');
      alert(`'${name}' 슬롯이 생성되었습니다.\n새로고침 합니다.`);
      setTimeout(() => location.reload(), 1500);
    } catch(e) { 
      writeLog('슬롯 생성에 실패했습니다.', 'error'); 
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
      
      // Original strict prompt format
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
        } catch(err) {
          writeLog(`AI 호출 실패 (통신 불안정): 페이지 ${i}`, "error");
        }
      }
      
      setJsonResult(JSON.stringify(allItems, null, 2));
      writeLog("분석 완료. [PREVIEW / EDIT] 뷰에서 확인하세요.", "success");
    } catch (e: any) {
      writeLog(`오류 발생: ${e.message}`, "error"); 
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveToSheet = async () => {
    if(!jsonResult) return;
    try {
      const data = JSON.parse(jsonResult).map((o: any) => [
        o.num ?? "", o.type ?? "", o.passage ?? "", o.question ?? "",
        o.image ?? "", o.opt1 ?? "", o.opt2 ?? "", o.opt3 ?? "",
        o.opt4 ?? "", o.answer ?? "", o.score ?? ""
      ]); 
      writeLog(`[${selectedSaveExam}] 슬롯에 저장 중...`, "info");
      await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveQuestions', examName: selectedSaveExam, questionsData: data }) });
      alert(`'${selectedSaveExam}' 슬롯에 동기화 완료!\n새로고침 합니다.`);
      setTimeout(() => location.reload(), 2000);
    } catch(e) { 
      writeLog("저장 실패", "error"); 
      alert("오류 발생");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-2 md:p-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <GlassCard className="w-full max-w-5xl h-[95vh] md:h-[90vh] rounded-sm border-t-amber-500 flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
          <div>
            <div className="text-[10px] font-tech text-amber-500 tracking-[0.3em] mb-0.5">ADMINISTRATION</div>
            <h2 className="text-base md:text-lg font-tech font-bold text-white flex items-center gap-2 tracking-wider">
              SYSTEM CONTROL CENTER <span className="text-[9px] bg-amber-500/20 border border-amber-500 text-amber-400 px-1.5 py-0.5 rounded-sm tracking-widest">PRO</span>
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-lg font-tech transition-all"><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent space-y-4 md:space-y-6 no-scrollbar">
          
          <div className="bg-slate-900/60 p-5 rounded-sm border border-slate-800 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 items-stretch mb-6">
              <PremiumButton onClick={() => setShowLiveMonitor(true)} className="flex-1 py-4 text-sm font-tech tracking-widest flex items-center justify-center gap-2">
                <Activity size={18} /> LIVE DASHBOARD
              </PremiumButton>
              <PremiumButton onClick={() => setShowAnalytics(true)} className="flex-1 py-4 text-sm font-tech tracking-widest flex items-center justify-center gap-2 border-indigo-500/50 hover:bg-indigo-900/30 text-indigo-400">
                <BarChart2 size={18} /> SCORE ANALYTICS
              </PremiumButton>
            </div>
            <div className="bg-indigo-900/20 p-4 rounded-sm border border-indigo-500/30 mb-4">
              <h4 className="font-tech text-indigo-400 mb-1 text-xs tracking-widest flex items-center gap-2"><span className="text-[8px]">▶</span> ACTIVE EXAM SLOT</h4>
              <p className="text-[11px] font-kor text-slate-400">응시자에게 노출될 활성 모의고사를 지정하거나 새 슬롯을 생성합니다.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <select id="admin-active-exam-select" defaultValue={activeExamName} className="system-input p-2.5 outline-none text-sm flex-1 font-kor">
                  {availableExams.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
                <button onClick={handleChangeActiveExam} className="bg-indigo-600/80 border border-indigo-500 text-white px-4 py-2.5 rounded-sm font-tech text-xs tracking-widest hover:bg-indigo-600 transition-colors shrink-0">APPLY</button>
              </div>
              <div className="flex-1 flex gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-4">
                <Input value={newExamName} onChange={(e) => setNewExamName(e.target.value)} placeholder="새 슬롯명 (예: 모의고사3회)" className="p-2.5 outline-none text-sm flex-1 font-kor text-left" />
                <button onClick={handleCreateNewExam} className="bg-slate-800 border border-slate-700 text-cyan-400 px-4 py-2.5 rounded-sm font-tech text-xs tracking-widest hover:bg-slate-700 transition-colors shrink-0">+ CREATE</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-slate-900/60 p-5 rounded-sm border border-slate-800 shadow-sm space-y-4 flex flex-col">
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

            <div className="flex flex-col bg-slate-900/60 p-5 rounded-sm border border-slate-800 shadow-sm">
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

          <div className="bg-slate-900/60 p-5 rounded-sm border border-slate-800 shadow-sm col-span-1 lg:col-span-2">
            <div className="flex justify-between items-center mb-3">
              <label className="font-tech text-emerald-500 text-[11px] tracking-widest"><span className="mr-1">3.</span> RESULT MANAGEMENT</label>
              <button onClick={exportResultsToCSV} className="bg-emerald-600 border border-emerald-500 text-white px-4 py-2.5 rounded-sm font-tech text-xs tracking-widest hover:bg-emerald-500 transition-colors">
                📊 EXPORT TO CSV
              </button>
            </div>
            <p className="text-[11px] font-kor text-slate-400 mb-2">파이어베이스에 저장된 모든 응시자의 시험 결과를 엑셀(CSV) 파일로 다운로드합니다.</p>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-sm border border-slate-800 shadow-sm col-span-1 lg:col-span-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
              <label className="font-tech text-cyan-500 text-[11px] tracking-widest"><span className="mr-1">4.</span> JSON DATA & SYNC</label>
              <div className="flex gap-2 w-full md:w-auto items-center">
                {jsonResult && (
                  <>
                    <button onClick={() => setShowPreview(true)} className="flex-1 md:flex-none bg-slate-800 border border-slate-700 text-cyan-400 px-3 py-2 rounded-sm font-tech text-[10px] tracking-widest hover:bg-slate-700 transition-colors">👀 PREVIEW / EDIT</button>
                    <select value={selectedSaveExam} onChange={(e) => setSelectedSaveExam(e.target.value)} className="system-input p-1.5 text-xs font-kor outline-none">
                      {availableExams.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                    <PremiumButton onClick={handleSaveToSheet} className="flex-1 md:flex-none px-4 py-2 rounded-sm font-tech text-[10px] tracking-widest flex items-center gap-1.5">☁️ CLOUD SYNC</PremiumButton>
                  </>
                )}
              </div>
            </div>
            <textarea value={jsonResult} readOnly className="w-full h-40 bg-slate-950/80 border border-slate-800 rounded-sm p-3 font-tech text-[10px] text-cyan-300 focus:border-cyan-500 outline-none shadow-inner tracking-wider" placeholder="{ DATA OUTPUT }"></textarea>
          </div>
        </div>
      </GlassCard>

      {/* Simplified Preview Modal for length constraint */}
      {showPreview && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 md:p-4">
          <GlassCard className="w-full max-w-4xl h-[95vh] md:h-[90vh] rounded-sm border-t-cyan-500 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 z-10 shrink-0">
              <h3 className="font-tech font-bold text-xs md:text-sm text-cyan-400 tracking-widest">👀 DATA INSPECTION</h3>
              <button onClick={() => setShowPreview(false)} className="w-7 h-7 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-sm text-slate-400 hover:text-white hover:bg-slate-700 font-tech transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-transparent no-scrollbar font-kor">
               <textarea value={jsonResult} onChange={(e) => setJsonResult(e.target.value)} className="w-full h-full bg-slate-950/80 border border-slate-800 rounded-sm p-3 font-tech text-xs text-cyan-300 outline-none" />
            </div>
          </GlassCard>
        </div>
      )}

      {showLiveMonitor && <LiveMonitor onClose={() => setShowLiveMonitor(false)} />}
      {showAnalytics && <AnalyticsDashboard onClose={() => setShowAnalytics(false)} />}
    </div>
  );
};
