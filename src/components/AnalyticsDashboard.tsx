import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, appId, exportResultsToCSV, deleteExamResult, updateExamResultCandidate, ensureAuth } from '../lib/firebase';
import { GlassCard } from './ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from 'recharts';
import { X, BarChart2, Users, Target, Search, Download, Trophy, ChevronDown, ChevronUp, Trash2, Edit3, CheckCircle2, AlertCircle, Save } from 'lucide-react';

interface ResultData {
  id: string;
  examName: string;
  registrationNo: string;
  studentName: string;
  company?: string;
  score: number;
  lcScore: number;
  rcScore: number;
  correctCount: number;
  totalQuestions: number;
  timestamp: any;
}

export const AnalyticsDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [results, setResults] = useState<ResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ResultData>('timestamp');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedExam, setSelectedExam] = useState<string>('ALL');
  
  // Examinee Editing State
  const [editingResult, setEditingResult] = useState<ResultData | null>(null);
  const [editForm, setEditForm] = useState({
    studentName: '',
    registrationNo: '',
    company: '',
    examName: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await ensureAuth();
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'exam_results'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const data: ResultData[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as ResultData);
        });
        setResults(data);
      } catch (e) {
        console.error("Failed to fetch analytics:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const uniqueExams = Array.from(new Set(results.map(r => r.examName)));
  const filteredExams = selectedExam === 'ALL' ? results : results.filter(r => r.examName === selectedExam);
  
  const searchedResults = filteredExams.filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.registrationNo.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    
    if (sortField === 'timestamp') {
      valA = a.timestamp?.toMillis() || 0;
      valB = b.timestamp?.toMillis() || 0;
    }
    
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  const totalCandidates = filteredExams.length;
  const avgScore = totalCandidates > 0 ? Math.round(filteredExams.reduce((sum, r) => sum + r.score, 0) / totalCandidates) : 0;
  const maxScore = totalCandidates > 0 ? Math.max(...filteredExams.map(r => r.score)) : 0;
  const avgLc = totalCandidates > 0 ? Math.round(filteredExams.reduce((sum, r) => sum + r.lcScore, 0) / totalCandidates) : 0;
  const avgRc = totalCandidates > 0 ? Math.round(filteredExams.reduce((sum, r) => sum + r.rcScore, 0) / totalCandidates) : 0;

  // Prepare score distribution data (200점 만점 기준 20점 단위)
  const scoreRanges = [
    { name: '0-20', count: 0, min: 0, max: 20 },
    { name: '21-40', count: 0, min: 21, max: 40 },
    { name: '41-60', count: 0, min: 41, max: 60 },
    { name: '61-80', count: 0, min: 61, max: 80 },
    { name: '81-100', count: 0, min: 81, max: 100 },
    { name: '101-120', count: 0, min: 101, max: 120 },
    { name: '121-140', count: 0, min: 121, max: 140 },
    { name: '141-160', count: 0, min: 141, max: 160 },
    { name: '161-180', count: 0, min: 161, max: 180 },
    { name: '181-200', count: 0, min: 181, max: 200 },
  ];
  
  filteredExams.forEach(r => {
    const s = r.score;
    if (s <= 20) scoreRanges[0].count++;
    else if (s <= 40) scoreRanges[1].count++;
    else if (s <= 60) scoreRanges[2].count++;
    else if (s <= 80) scoreRanges[3].count++;
    else if (s <= 100) scoreRanges[4].count++;
    else if (s <= 120) scoreRanges[5].count++;
    else if (s <= 140) scoreRanges[6].count++;
    else if (s <= 160) scoreRanges[7].count++;
    else if (s <= 180) scoreRanges[8].count++;
    else scoreRanges[9].count++;
  });

  const handleSort = (field: keyof ResultData) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const SortIcon = ({ field }: { field: keyof ResultData }) => {
    if (sortField !== field) return <span className="opacity-20 ml-1">↕</span>;
    return sortDesc ? <ChevronDown size={12} className="inline ml-1 text-cyan-400" /> : <ChevronUp size={12} className="inline ml-1 text-cyan-400" />;
  };

  const handleOpenEdit = (record: ResultData) => {
    setEditingResult(record);
    setEditForm({
      studentName: record.studentName || '',
      registrationNo: record.registrationNo || '',
      company: record.company || '',
      examName: record.examName || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingResult) return;
    const cleanName = editForm.studentName.trim();
    const cleanReg = editForm.registrationNo.trim();
    const cleanCompany = editForm.company.trim();
    const cleanExam = editForm.examName.trim();

    if (!cleanName || !cleanReg) {
      alert("성명과 수험번호는 필수 입력 항목입니다. (Name and Registration No are required.)");
      return;
    }

    setIsSavingEdit(true);
    try {
      const ok = await updateExamResultCandidate(editingResult.id, {
        studentName: cleanName,
        registrationNo: cleanReg,
        company: cleanCompany,
        examName: cleanExam || editingResult.examName
      });

      if (ok) {
        setResults(prev => prev.map(r => r.id === editingResult.id ? {
          ...r,
          studentName: cleanName,
          registrationNo: cleanReg,
          company: cleanCompany,
          examName: cleanExam || r.examName
        } : r));
        setEditingResult(null);
        setToastMsg({
          text: `'${cleanName} (${cleanReg})' 응시자 정보가 성공적으로 수정되었습니다.`,
          type: 'success'
        });
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        throw new Error("수정 작업에 실패했습니다.");
      }
    } catch (err: any) {
      alert("정보 수정 중 오류가 발생했습니다: " + (err.message || ''));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("정말 이 응시자의 기록을 삭제하시겠습니까? (Are you sure you want to delete this record?)")) {
      try {
        const ok = await deleteExamResult(id);
        if (ok) {
          setResults(prev => prev.filter(r => r.id !== id));
          setToastMsg({
            text: "응시자 기록이 삭제되었습니다.",
            type: 'success'
          });
          setTimeout(() => setToastMsg(null), 3000);
        } else {
          throw new Error("삭제 작업 실패");
        }
      } catch (error) {
        console.error("Error deleting document:", error);
        alert("삭제 중 오류가 발생했습니다. (Error deleting document.)");
      }
    }
  };

  // Prepare performance trend data (chronological)
  const chronologicalResults = [...filteredExams].sort((a, b) => {
    const ta = a.timestamp?.toMillis() || 0;
    const tb = b.timestamp?.toMillis() || 0;
    return ta - tb; // Oldest to newest
  }).slice(-30); // Last 30 exams

  return (
    <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 md:p-6 animate-fade-in">
      <GlassCard className="w-full max-w-7xl h-full max-h-[95vh] rounded-sm border-t-cyan-500 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-900/30 border border-indigo-500 rounded-sm flex items-center justify-center text-indigo-400">
              <BarChart2 size={20} />
            </div>
            <div>
              <h2 className="font-tech font-bold text-white text-lg tracking-widest flex items-center gap-2">
                ANALYTICS DASHBOARD
              </h2>
              <p className="text-[10px] text-indigo-500 font-tech tracking-widest uppercase">Score Analysis & Statistics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => exportResultsToCSV()} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-sm text-xs font-tech tracking-widest transition-colors">
              <Download size={14} /> EXPORT CSV
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6 flex flex-col gap-6 no-scrollbar">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-cyan-500 font-tech tracking-widest animate-pulse">LOADING ANALYTICS DATA...</div>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-slate-500" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search by name or registration number..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-sm py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-kor"
                  />
                </div>
                <div className="w-full md:w-64">
                  <label className="block text-[10px] text-slate-400 font-tech tracking-widest mb-1">FILTER BY EXAM</label>
                  <select 
                    value={selectedExam} 
                    onChange={(e) => setSelectedExam(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-sm py-2 px-3 text-sm text-white focus:outline-none focus:border-cyan-500 font-kor"
                  >
                    <option value="ALL">ALL EXAMS</option>
                    {uniqueExams.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Top Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-sm">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Users size={16} /> <span className="font-tech text-[10px] tracking-widest">TOTAL CANDIDATES</span>
                  </div>
                  <div className="text-3xl font-tech font-bold text-white">{totalCandidates}</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-sm">
                  <div className="flex items-center gap-2 text-cyan-400 mb-2">
                    <Target size={16} /> <span className="font-tech text-[10px] tracking-widest">AVERAGE SCORE</span>
                  </div>
                  <div className="text-3xl font-tech font-bold text-cyan-400">{avgScore} <span className="text-sm text-slate-500">PT</span></div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-sm">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <Trophy size={16} /> <span className="font-tech text-[10px] tracking-widest">HIGHEST SCORE</span>
                  </div>
                  <div className="text-3xl font-tech font-bold text-amber-400">{maxScore} <span className="text-sm text-slate-500">PT</span></div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-sm flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-tech text-[10px] tracking-widest text-slate-400">AVG LISTENING</span>
                    <span className="font-tech text-white font-bold">{avgLc}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4">
                    <div className="bg-cyan-500 h-full" style={{ width: `${Math.min(100, (avgLc/100)*100)}%`}}></div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-tech text-[10px] tracking-widest text-slate-400">AVG READING</span>
                    <span className="font-tech text-white font-bold">{avgRc}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(100, (avgRc/100)*100)}%`}}></div>
                  </div>
                </div>
              </div>

              {/* Charts area */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64 md:h-80">
                <div className="bg-slate-900/60 border border-slate-800 rounded-sm p-4 flex flex-col">
                  <h3 className="font-tech text-xs tracking-widest text-slate-400 mb-4">SCORE DISTRIBUTION</h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreRanges} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip 
                          cursor={{fill: '#1e293b'}} 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '4px', fontSize: '12px', color: '#fff' }} 
                        />
                        <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                          {scoreRanges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#22d3ee' : '#0ea5e9'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="bg-slate-900/60 border border-slate-800 rounded-sm p-4 flex flex-col">
                  <h3 className="font-tech text-xs tracking-widest text-slate-400 mb-4">RECENT PERFORMANCES</h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chronologicalResults} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="studentName" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.substring(0, 3) + '..'} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '4px', fontSize: '12px', color: '#fff' }} 
                        />
                        <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="lcScore" stroke="#0ea5e9" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                        <Line type="monotone" dataKey="rcScore" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm font-kor text-slate-300 whitespace-nowrap">
                    <thead className="bg-slate-950/80 font-tech text-[10px] tracking-widest text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('timestamp')}>
                          DATE <SortIcon field="timestamp" />
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('examName')}>
                          EXAM <SortIcon field="examName" />
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('company')}>
                          ORG <SortIcon field="company" />
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('registrationNo')}>
                          REG_NO <SortIcon field="registrationNo" />
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('studentName')}>
                          NAME <SortIcon field="studentName" />
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors text-right" onClick={() => handleSort('score')}>
                          TOTAL <SortIcon field="score" />
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors text-right hidden sm:table-cell" onClick={() => handleSort('lcScore')}>
                          L/C <SortIcon field="lcScore" />
                        </th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors text-right hidden sm:table-cell" onClick={() => handleSort('rcScore')}>
                          R/C <SortIcon field="rcScore" />
                        </th>
                        <th className="px-4 py-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {searchedResults.map(r => (
                        <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-tech text-xs text-slate-500">
                            {r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-xs">{r.examName}</td>
                          <td className="px-4 py-3 text-xs">{r.company || '-'}</td>
                          <td className="px-4 py-3 font-tech tracking-wider">{r.registrationNo}</td>
                          <td className="px-4 py-3 font-medium text-white">{r.studentName}</td>
                          <td className="px-4 py-3 text-right font-tech font-bold text-cyan-400">{r.score}</td>
                          <td className="px-4 py-3 text-right font-tech text-slate-400 hidden sm:table-cell">{r.lcScore}</td>
                          <td className="px-4 py-3 text-right font-tech text-slate-400 hidden sm:table-cell">{r.rcScore}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 ml-auto">
                              <button 
                                onClick={() => handleOpenEdit(r)} 
                                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-200 transition-colors px-2 py-1 rounded bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/60 text-xs" 
                                title="응시자 정보 수정"
                              >
                                <Edit3 size={12} />
                                <span className="text-[11px] font-kor hidden sm:inline">수정</span>
                              </button>
                              <button 
                                onClick={() => handleDelete(r.id)} 
                                className="flex items-center gap-1 text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded bg-slate-900/50 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/60 text-xs" 
                                title="기록 삭제"
                              >
                                <Trash2 size={12} />
                                <span className="text-[11px] font-kor hidden sm:inline">삭제</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {searchedResults.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-slate-500 font-tech tracking-widest">
                            NO RECORDS FOUND
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="absolute bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500 text-cyan-300 px-4 py-3 rounded shadow-2xl flex items-center gap-2 text-sm animate-fade-in">
            <CheckCircle2 size={18} className="text-cyan-400" />
            <span className="font-kor font-medium">{toastMsg.text}</span>
          </div>
        )}

        {/* Edit Candidate Modal */}
        {editingResult && (
          <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-slate-900 border border-cyan-500/80 rounded-sm shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
              <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500 flex items-center justify-center text-cyan-400">
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h3 className="font-tech font-bold text-white text-base tracking-wide">
                      EDIT CANDIDATE INFO
                    </h3>
                    <p className="text-[11px] font-kor text-slate-400">
                      외국인 근로자 응시 정보 직접 수정
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingResult(null)} 
                  className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 bg-slate-900/90 text-sm">
                {/* Quick Context Card */}
                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span className="font-tech text-[10px] tracking-wider uppercase">Exam Record</span>
                    <span className="font-tech text-cyan-400 font-bold">{editingResult.score} PT (LC: {editingResult.lcScore} / RC: {editingResult.rcScore})</span>
                  </div>
                  <div className="text-slate-500 font-tech text-[11px]">
                    {editingResult.timestamp?.toDate ? editingResult.timestamp.toDate().toLocaleString('ko-KR') : ''}
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-tech text-cyan-400 tracking-wider mb-1">
                      STUDENT NAME (성명 / 외국인 성함) <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={editForm.studentName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, studentName: e.target.value }))}
                      placeholder="예: NGUYEN VAN A / 홍길동"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-white font-kor text-sm outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">성/이름 순서 오류나 오탈자를 정확히 수정해주세요.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-tech text-cyan-400 tracking-wider mb-1">
                      REGISTRATION NO (수험번호 / 사번) <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={editForm.registrationNo}
                      onChange={(e) => setEditForm(prev => ({ ...prev, registrationNo: e.target.value }))}
                      placeholder="예: TM-001, K-01"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-white font-tech tracking-wider text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-tech text-cyan-400 tracking-wider mb-1">
                      ORGANIZATION / COMPANY (소속업체명)
                    </label>
                    <input 
                      type="text" 
                      value={editForm.company}
                      onChange={(e) => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="예: HD현대삼호 / 협력사명"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-3 py-2 text-white font-kor text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-tech text-cyan-400 tracking-wider mb-1">
                      EXAM SLOT (응시 모의고사 회차)
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
                  onClick={() => setEditingResult(null)}
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
                    <span>저장 중...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>정보 저장하기</span>
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
