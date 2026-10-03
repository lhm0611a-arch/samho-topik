import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db, appId, deleteLiveSession, updateLiveSessionCandidate, ensureAuth } from '../lib/firebase';
import { GlassCard } from './ui';
import { Activity, X, Users, CheckCircle2, Clock, Trash2, Edit3, Search, ArrowUpDown } from 'lucide-react';

interface SessionData {
  regNo: string;
  name: string;
  company?: string;
  examName: string;
  status: 'WAITING' | 'TESTING' | 'SUBMITTED';
  answered: number;
  total: number;
  score: number | null;
  lastUpdate: any;
}

export const LiveMonitor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [sortOption, setSortOption] = useState<'date_desc' | 'date_asc' | 'company_asc' | 'company_desc' | 'name_asc' | 'status'>('date_desc');

  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    regNo: '',
    company: '',
    examName: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    ensureAuth();
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'active_sessions');
    const q = query(colRef);

    const parseSession = (docSnap: any): SessionData => {
      const d = docSnap.data() as any || {};
      return {
        regNo: (d.regNo || docSnap.id).toString(),
        name: (d.name || '미입력').toString(),
        company: d.company || d.organization || '-',
        examName: (d.examName || '모의고사').toString(),
        status: d.status || 'WAITING',
        answered: typeof d.answered === 'number' ? d.answered : 0,
        total: typeof d.total === 'number' ? d.total : 70,
        score: d.score !== undefined && d.score !== null ? Number(d.score) : null,
        lastUpdate: d.lastUpdate || null
      };
    };

    // Fast initial load
    getDocs(q).then((snap) => {
      if (!isMounted) return;
      if (snap.size > 0) {
        const data: SessionData[] = [];
        snap.forEach(docSnap => data.push(parseSession(docSnap)));
        setSessions(data);
      }
    }).catch(err => {
      console.warn("LiveMonitor direct getDocs notice:", err);
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isMounted) return;
      const data: SessionData[] = [];
      snapshot.forEach(docSnap => {
        data.push(parseSession(docSnap));
      });
      setSessions(data);
    }, (err) => {
      console.error("LiveMonitor onSnapshot error:", err);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleOpenEdit = (session: SessionData) => {
    setEditingSession(session);
    setEditForm({
      name: session.name || '',
      regNo: session.regNo || '',
      company: session.company && session.company !== '-' ? session.company : '',
      examName: session.examName || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    const cleanName = editForm.name.trim();
    const cleanReg = editForm.regNo.trim();
    const cleanComp = editForm.company.trim();
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
        company: cleanComp,
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

  const uniqueCompanies = Array.from(new Set(sessions.map(s => s.company).filter(c => Boolean(c) && c !== '-')));

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    if (selectedCompany !== 'ALL' && s.company !== selectedCompany) {
      return false;
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const sName = (s.name || '').toLowerCase();
    const rNo = (s.regNo || '').toLowerCase();
    const comp = (s.company || '').toLowerCase();
    const ex = (s.examName || '').toLowerCase();
    return sName.includes(term) || rNo.includes(term) || comp.includes(term) || ex.includes(term);
  });

  // Sort sessions
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const getMs = (t: any) => {
      if (!t) return 0;
      if (typeof t.toMillis === 'function') return t.toMillis();
      if (t.seconds) return t.seconds * 1000;
      if (typeof t === 'string' || typeof t === 'number') {
        const p = new Date(t).getTime();
        return isNaN(p) ? 0 : p;
      }
      return 0;
    };

    if (sortOption === 'date_desc') {
      const ta = getMs(a.lastUpdate);
      const tb = getMs(b.lastUpdate);
      return tb - ta;
    }
    if (sortOption === 'date_asc') {
      const ta = getMs(a.lastUpdate);
      const tb = getMs(b.lastUpdate);
      return ta - tb;
    }
    if (sortOption === 'company_asc') {
      const cA = (a.company || '').trim();
      const cB = (b.company || '').trim();
      const cmp = cA.localeCompare(cB, 'ko-KR');
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name, 'ko-KR');
    }
    if (sortOption === 'company_desc') {
      const cA = (a.company || '').trim();
      const cB = (b.company || '').trim();
      const cmp = cB.localeCompare(cA, 'ko-KR');
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name, 'ko-KR');
    }
    if (sortOption === 'name_asc') {
      return a.name.localeCompare(b.name, 'ko-KR');
    }
    if (sortOption === 'status') {
      const order: Record<string, number> = { 'TESTING': 0, 'WAITING': 1, 'SUBMITTED': 2 };
      const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'ko-KR');
    }
    return 0;
  });

  const testingCount = sessions.filter(s => s.status === 'TESTING').length;
  const waitingCount = sessions.filter(s => s.status === 'WAITING').length;
  const submittedCount = sessions.filter(s => s.status === 'SUBMITTED').length;

  const formatSessionTime = (lastUpdate: any) => {
    if (!lastUpdate) return '-';
    try {
      if (typeof lastUpdate.toDate === 'function') {
        const d = lastUpdate.toDate();
        return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }
      if (lastUpdate.seconds) {
        const d = new Date(lastUpdate.seconds * 1000);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }
      const d = new Date(lastUpdate);
      if (!isNaN(d.getTime())) {
        return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }
    } catch (e) {
      // ignore
    }
    return '-';
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 md:p-6 animate-fade-in">
      <GlassCard className="w-full max-w-6xl h-full max-h-[92vh] rounded-sm border-t-cyan-500 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
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

        <div className="p-4 md:p-6 bg-slate-950 flex-1 overflow-y-auto no-scrollbar flex flex-col gap-4 sm:gap-6">
          
          {/* Status Metrics */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 shrink-0">
            <div className="bg-slate-900/60 border border-slate-800 p-3 sm:p-4 rounded-sm flex flex-col items-center justify-center shadow-inner">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-tech font-bold text-white">{waitingCount}</div>
              <div className="text-[9px] sm:text-[10px] text-amber-500 font-tech tracking-widest mt-0.5 sm:mt-1">WAITING</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-3 sm:p-4 rounded-sm flex flex-col items-center justify-center shadow-inner">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-tech font-bold text-white">{testingCount}</div>
              <div className="text-[9px] sm:text-[10px] text-cyan-400 font-tech tracking-widest mt-0.5 sm:mt-1">TESTING</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-3 sm:p-4 rounded-sm flex flex-col items-center justify-center shadow-inner">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#00b050] mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-tech font-bold text-white">{submittedCount}</div>
              <div className="text-[9px] sm:text-[10px] text-[#00b050] font-tech tracking-widest mt-0.5 sm:mt-1">SUBMITTED</div>
            </div>
          </div>

          {/* Search, Company Filter, and Sorting Controls */}
          <div className="bg-slate-900/70 border border-slate-800 p-3 sm:p-4 rounded-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0 shadow-sm">
            <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="성명, 수험번호, 업체명 검색..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-sm py-2 pl-9 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-kor"
                />
              </div>

              {/* Company Filter */}
              <div className="w-full sm:w-48">
                <select 
                  value={selectedCompany} 
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-sm py-2 px-3 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-kor"
                >
                  <option value="ALL">전체 업체 ({sessions.length})</option>
                  {uniqueCompanies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-slate-400 font-tech shrink-0">
                <ArrowUpDown size={14} className="text-cyan-400" />
                <span className="hidden sm:inline">SORT:</span>
              </div>
              <select 
                value={sortOption} 
                onChange={(e) => setSortOption(e.target.value as any)}
                className="bg-slate-950 border border-cyan-800/80 rounded-sm py-2 px-3 text-xs sm:text-sm text-cyan-300 font-kor focus:outline-none focus:border-cyan-400 cursor-pointer shadow-inner w-full md:w-auto"
              >
                <option value="date_desc">🕒 시험 일시 (최신순)</option>
                <option value="date_asc">🕒 시험 일시 (오래된순)</option>
                <option value="company_asc">🏢 업체명순 (가나다/A-Z)</option>
                <option value="company_desc">🏢 업체명순 (역순/Z-A)</option>
                <option value="name_asc">👤 응시자 이름순 (가나다)</option>
                <option value="status">⚡ 진행 상태순 (시험중 &gt; 대기 &gt; 완료)</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedSessions.map(s => {
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
                  
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <h4 className="font-kor font-bold text-white text-base leading-none truncate">{s.name}</h4>
                        {s.company && s.company !== '-' && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 text-[10px] font-kor font-medium border border-cyan-800/80 truncate max-w-[120px]">
                            {s.company}
                          </span>
                        )}
                      </div>
                      <p className="font-tech text-slate-400 text-[10px] tracking-widest">{s.regNo}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isWaiting && <span className="bg-amber-900/30 text-amber-500 border border-amber-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest">STANDBY</span>}
                      {isTesting && <span className="bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span> IN_PROGRESS</span>}
                      {isSubmitted && <span className="bg-green-900/30 text-[#00b050] border border-green-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest">COMPLETED</span>}
                      
                      <button 
                        onClick={() => handleOpenEdit(s)} 
                        className="text-slate-400 hover:text-cyan-300 p-1.5 rounded hover:bg-slate-800/80 transition-colors ml-0.5"
                        title="응시자 정보 수정"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeleteSession(s.regNo, s.name)} 
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-slate-800/80 transition-colors"
                        title="세션 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
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

                  {/* Card Footer: Date/Time & Company Info */}
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-tech pt-2 border-t border-slate-800/60 mt-1">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock size={11} className="text-cyan-500" />
                      {formatSessionTime(s.lastUpdate)}
                    </span>
                    <span className="text-slate-400 font-kor truncate max-w-[140px] text-right">
                      {s.company && s.company !== '-' ? `소속: ${s.company}` : '업체 미지정'}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {sortedSessions.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Users size={44} className="opacity-20" />
                <p className="font-tech tracking-widest text-sm">NO ACTIVE SESSIONS FOUND</p>
                {sessions.length > 0 && (
                  <p className="font-kor text-xs text-slate-400">
                    선택한 검색어나 업체 필터에 해당하는 세션이 없습니다. (전체 {sessions.length}명)
                  </p>
                )}
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
                      ORGANIZATION / COMPANY (소속업체명)
                    </label>
                    <input 
                      type="text" 
                      value={editForm.company}
                      onChange={(e) => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="예: HD현대삼호 / KESL"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-white font-kor text-sm outline-none"
                    />
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
