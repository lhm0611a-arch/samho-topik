import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { GlassCard } from './ui';
import { Activity, X, Users, CheckCircle2, Clock } from 'lucide-react';

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

  useEffect(() => {
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
                    {isWaiting && <span className="bg-amber-900/30 text-amber-500 border border-amber-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest">STANDBY</span>}
                    {isTesting && <span className="bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span> IN_PROGRESS</span>}
                    {isSubmitted && <span className="bg-green-900/30 text-[#00b050] border border-green-800 px-2 py-0.5 rounded-sm text-[9px] font-tech tracking-widest">COMPLETED</span>}
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
      </GlassCard>
    </div>
  );
};
