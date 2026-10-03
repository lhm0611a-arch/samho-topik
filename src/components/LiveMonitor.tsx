import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, appId, deleteLiveSession, updateLiveSessionCandidate, ensureAuth } from '../lib/firebase';
import { GlassCard } from './ui';
import { Activity, X, Users, CheckCircle2, Clock, Trash2, Edit3 } from 'lucide-react';

interface SessionData {
  regNo: string;
  name: string;
  examName: string;
  status: 'WAITING' | 'TESTING' | 'SUBMITTED';
  answered: number;
  total: number;
  score: number | null;
  lastUpdate: any;
}

export const LiveMonitor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    regNo: '',
    examName: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    ensureAuth();
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'active_sessions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: SessionData[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as SessionData);
      });
      // Sort by status, then name
      data.sort((a, b) => {
        if (a.status === 'SUBMITTED' && b.status !== 'SUBMITTED') return 1;
        if (a.status !== 'SUBMITTED' && b.status === 'SUBMITTED') return -1;
        return a.name.localeCompare(b.name);
      });
      setSessions(data);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenEdit = (session: SessionData) => {
    setEditingSession(session);
    setEditForm({
      name: session.name || '',
      regNo: session.regNo || '',
      examName: session.examName || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    const cleanName = editForm.name.trim();
    const cleanReg = editForm.regNo.trim();
    const cleanExam = editForm.examName.trim();

    if (!cleanName || !cleanReg) {
      alert("성명과 수험번호는 필수 항목입니다.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const ok = await updateLiveSessionCandidate(editingSession.regNo, {
        name: cleanName,
        regNo: cleanReg,
        examName: cleanExam || editingSession.examName
      });

      if (ok) {
        setEditingSession(null);
        setToastMsg(`'${cleanName} (${cleanReg})' 세션 정보가 성공적으로 수정되었습니다.`);
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        throw new Error("실시간 세션 정보 수정 실패");
      }
    } catch (e: any) {
      alert("정보 수정 중 오류가 발생했습니다: " + (e.message || ''));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteSession = async (regNo: string, name: string) => {
    if (window.confirm(`'${name} (${regNo})' 응시자 세션을 모니터링 목록에서 삭제하시겠습니까?`)) {
      try {
        await deleteLiveSession(regNo);
        setToastMsg(`'${name}' 세션이 목록에서 삭제되었습니다.`);
        setTimeout(() => setToastMsg(null), 3000);
      } catch (e) {
        alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const testingCount = sessions.filter(s => s.status === 'TESTING').length;
  const waitingCount = sessions.filter(s => s.status === 'WAITING').length;
  const submittedCount = sessions.filter(s => s.status === 'SUBMITTED').length;

  return (
    <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 md:p-6 animate-fade-in">
      <GlassCard className="w-full max-w-6xl h-full max-h-[90vh] rounded-sm border-t-cyan-500 flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-900/30 border border-cyan-500 rounded-sm flex items-center justify-center text-cyan-400">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="font-tech font-bold text-white text-lg tracking-widest flex items-center gap-2">
                REAL-TIME MONITOR <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              </h2>
              <p className="text-[10px] text-cyan-500 font-tech tracking-widest uppercase">Live Candidate Status</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6 bg-slate-950 flex-1 overflow-y-auto no-scrollbar flex flex-col gap-6">
          
          <div className="grid grid-cols-3 gap-3 md:gap-6 shrink-0">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-sm flex flex-col items-center justify-center shadow-inner">
              <Clock className="w-6 h-6 text-amber-500 mb-2" />
              <div className="text-2xl font-tech font-bold text-white">{waitingCount}</div>
              <div className="text-[10px] text-amber-500 font-tech tracking-widest mt-1">WAITING</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-sm flex flex-col items-center justify-center shadow-inner">
              <Users className="w-6 h-6 text-cyan-400 mb-2" />
              <div className="text-2xl font-tech font-bold text-white">{testingCount}</div>
              <div className="text-[10px] text-cyan-400 font-tech tracking-widest mt-1">TESTING</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-sm flex flex-col items-center justify-center shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-[#00b050] mb-2" />
              <div className="text-2xl font-tech font-bold text-white">{submittedCount}</div>
              <div className="text-[10px] text-[#00b050] font-tech tracking-widest mt-1">SUBMITTED</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map(s => {
              const isWaiting = s.status === 'WAITING';
              const isTesting = s.status === 'TESTING';
              const isSubmitted = s.status === 'SUBMITTED';
              
              let borderColor = 'border-slate-800';
              let bgColor = 'bg-slate-900/60';
              if (isTesting) {
                borderColor = 'border-cyan-800';
                bgColor = 'bg-cyan-950/20';
              } else if (isSubmitted) {
                borderColor = 'border-[#00b050]/50';
                bgColor = 'bg-[#00b050]/10';
              }

              const progressPct = s.total > 0 ? (s.answered / s.total) * 100 : 0;

              return (
                <div key={s.regNo} className={`p-4 rounded-sm border ${borderColor} ${bgColor} shadow-sm transition-all flex flex-col gap-3 relative overflow-hidden`}>
                  {isTesting && <div className="absolute top-0 left-0 w-full h-1 bg-cyan-900"><div className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all" style={{width: `${progressPct}%`}}></div></div>}
                  {isSubmitted && <div className="absolute top-0 left-0 w-full h-1 bg-[#00b050]"></div>}
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-kor font-bold text-white text-base leading-none mb-1">{s.name}</h4>
                      <p className="font-tech text-slate-400 text-[10px] tracking-widest">{s.regNo}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isWaiting && <span className="bg-amber-900/30 text-amber-500 border border-amber-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest">STANDBY</span>}
                      {isTesting && <span className="bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span> IN_PROGRESS</span>}
                      {isSubmitted && <span className="bg-green-900/30 text-[#00b050] border border-green-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest">COMPLETED</span>}
                      <button 
                        onClick={() => handleOpenEdit(s)} 
                        className="text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-800/80 transition-colors"
                        title="응시자 정보 수정"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeleteSession(s.regNo, s.name)} 
                        className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800/80 transition-colors"
                        title="세션 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-950/50 p-2 rounded-sm border border-slate-800">
                      <div className="text-[9px] text-slate-500 font-tech tracking-widest mb-1">EXAM SLOT</div>
                      <div className="text-xs font-kor text-slate-300 truncate">{s.examName}</div>
                    </div>
                    <div className="bg-slate-950/50 p-2 rounded-sm border border-slate-800">
                      {isSubmitted ? (
                        <>
                          <div className="text-[9px] text-[#00b050] font-tech tracking-widest mb-1">FINAL SCORE</div>
                          <div className="text-xs font-tech text-white font-bold">{s.score ?? 0} PT</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[9px] text-cyan-500 font-tech tracking-widest mb-1">PROGRESS</div>
                          <div className="text-xs font-tech text-white font-bold">{s.answered} / {s.total}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {sessions.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
                <Users size={48} className="opacity-20" />
                <p className="font-tech tracking-widest">NO ACTIVE SESSIONS FOUND</p>
              </div>
            )}
          </div>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="absolute bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500 text-cyan-300 px-4 py-3 rounded shadow-2xl flex items-center gap-2 text-sm animate-fade-in">
            <CheckCircle2 size={18} className="text-cyan-400" />
            <span className="font-kor font-medium">{toastMsg}</span>
          </div>
        )}

        {/* Edit Live Session Examinee Modal */}
        {editingSession && (
          <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-slate-900 border border-cyan-500/80 rounded-sm shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
              <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500 flex items-center justify-center text-cyan-400">
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h3 className="font-tech font-bold text-white text-base tracking-wide">
                      EDIT LIVE CANDIDATE
                    </h3>
                    <p className="text-[11px] font-kor text-slate-400">
                      실시간 세션 응시자 정보 직접 수정
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingSession(null)} 
                  className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 bg-slate-900/90 text-sm">
                {/* Live Status Pill */}
                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded text-xs flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-tech text-slate-400 tracking-wider uppercase">STATUS:</span>
                    <span className="text-xs font-tech font-bold text-cyan-400">{editingSession.status}</span>
                  </div>
                  <div className="text-slate-400 font-tech text-xs">
                    PROGRESS: <span className="text-white font-bold">{editingSession.answered} / {editingSession.total}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-tech text-cyan-400 tracking-wider mb-1">
                      CANDIDATE NAME (성명 / 외국인 성함) <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="예: NGUYEN VAN A / 홍길동"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-white font-kor text-sm outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">외국인 근로자가 오입력한 성/이름 순서 및 철자를 수정합니다.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-tech text-cyan-400 tracking-wider mb-1">
                      REGISTRATION NO (수험번호) <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={editForm.regNo}
                      onChange={(e) => setEditForm(prev => ({ ...prev, regNo: e.target.value }))}
                      placeholder="예: TM-001, K-01"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-white font-tech tracking-wider text-sm outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">수험번호 변경 시 실시간 세션 데이터 키가 안전하게 업데이트됩니다.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-tech text-cyan-400 tracking-wider mb-1">
                      EXAM SLOT (시험 슬롯명)
                    </label>
                    <input 
                      type="text" 
                      value={editForm.examName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, examName: e.target.value }))}
                      placeholder="예: 모의고사1회"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-white font-kor text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-tech text-xs tracking-wider transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-kor font-medium text-xs tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <span>수정 중...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>세션 정보 수정</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
