import React, { useState } from 'react';
import { GlassCard, Input, StartGradientButton } from '../components/ui';
import { useExamStore } from '../store/useExamStore';
import { getTranslation } from '../lib/i18n';

export const IntroScreen: React.FC = () => {
  const { setScreen, selectedLang, setSelectedLang, setCandidate, activeExamName } = useExamStore();
  const [regNo, setRegNo] = useState('');
  const [company, setCompany] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const t = getTranslation(selectedLang);

  const formatRegNo = (value: string) => {
    if (value.includes('-')) return value;
    const match = value.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
    return value;
  };

  const handleStart = () => {
    if (!regNo.trim() || !company.trim() || !firstName.trim() || !lastName.trim()) {
      alert("모든 항목을 입력해주세요. (Please fill in all fields.)");
      return;
    }
    
    const formattedRegNo = formatRegNo(regNo.trim());
    const fullName = `${lastName.trim()} ${firstName.trim()}`.trim();

    setCandidate({ 
      regNo: formattedRegNo, 
      name: fullName, 
      company: company.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      lang: selectedLang 
    });
    setScreen('waiting');
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // When virtual mobile keyboard pops up, smoothly scroll input to center of viewport
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 280);
  };

  const langs = [
    { id: 'ko', label: 'KO' },
    { id: 'en', label: 'EN' },
    { id: 'id', label: 'ID' },
    { id: 'vi', label: 'VN' },
    { id: 'ne', label: 'NE' },
  ] as const;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-transparent relative z-10 px-3 py-3 sm:py-6 pb-64 sm:pb-16 no-scrollbar flex flex-col">
      <div className="min-h-full flex flex-col items-center justify-start my-auto w-full text-center">
        
        {/* Compact decorative icon for mobile */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-cyan-900/30 border border-cyan-500/50 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.2)] mb-3 sm:mb-5 relative glass-card shrink-0">
          <div className="absolute inset-0 border-2 border-cyan-400 rounded-xl sm:rounded-2xl border-t-transparent animate-[spin_3s_linear_infinite] opacity-50"></div>
          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </div>
        
        <h2 className="text-xl sm:text-2xl md:text-3xl font-tech font-bold text-white mb-1 tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          CANDIDATE <span className="text-cyan-400">INFO</span>
        </h2>
        <p className="text-cyan-400 font-kor font-bold tracking-widest text-xs md:text-sm mb-3 sm:mb-5 uppercase">{t.subtitle}</p>
        
        <div className="inline-flex items-center gap-2 bg-slate-900/80 text-cyan-400 px-3 py-1 rounded-sm font-tech text-xs mb-3.5 sm:mb-5 border border-cyan-900/50 tracking-widest shadow-inner glass-card">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>{activeExamName || "SYSTEM LOADING..."}</span>
        </div>
        
        <GlassCard className="w-full max-w-sm space-y-4 sm:space-y-5 animate-fade-in mx-auto p-4 sm:p-7 rounded-md shadow-2xl">
          <div className="text-left space-y-3.5 sm:space-y-4">
            <div className="group">
              <label className="block text-[10px] font-tech text-cyan-400 mb-1.5 tracking-[0.2em]">
                <span className="text-[#00b050] mr-1">▶</span> SELECT LANGUAGE
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                {langs.map(l => (
                  <label key={l.id} className="cursor-pointer flex-1 text-center">
                    <input type="radio" name="lang" value={l.id} checked={selectedLang === l.id} onChange={(e) => setSelectedLang(e.target.value as any)} className="peer sr-only" />
                    <div className="py-1.5 px-1 sm:p-2 border border-slate-700 rounded bg-slate-800/50 peer-checked:bg-cyan-900/40 peer-checked:border-cyan-400 transition-all opacity-50 peer-checked:opacity-100 font-tech text-xs sm:text-sm tracking-widest text-slate-300 peer-checked:text-cyan-300">
                      {l.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="group">
              <label className="block text-[10px] font-tech text-cyan-400 mb-1 tracking-[0.2em]">
                <span className="text-[#00b050] mr-1">▶</span> ORGANIZATION (소속업체명)
              </label>
              <Input 
                value={company} 
                onChange={(e) => setCompany(e.target.value)} 
                onFocus={handleInputFocus}
                placeholder="Ex. HD현대삼호" 
                className="text-center font-kor py-2.5 sm:py-3 text-sm sm:text-base" 
              />
            </div>

            <div className="group">
              <label className="block text-[10px] font-tech text-cyan-400 mb-1 tracking-[0.2em]">
                <span className="text-[#00b050] mr-1">▶</span> ID (응시번호)
              </label>
              <Input 
                value={regNo} 
                onChange={(e) => setRegNo(e.target.value)} 
                onFocus={handleInputFocus}
                placeholder="Ex. TM-001 or K-01" 
                className="text-center font-tech py-2.5 sm:py-3 text-sm sm:text-base" 
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="group">
                <label className="block text-[10px] font-tech text-cyan-400 mb-1 tracking-[0.2em]">
                  <span className="text-[#00b050] mr-1">▶</span> LAST NAME (성)
                </label>
                <Input 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  onFocus={handleInputFocus}
                  placeholder="Ex. Hong" 
                  className="text-center font-kor py-2.5 sm:py-3 text-sm sm:text-base" 
                />
              </div>
              
              <div className="group">
                <label className="block text-[10px] font-tech text-cyan-400 mb-1 tracking-[0.2em]">
                  <span className="text-[#00b050] mr-1">▶</span> FIRST NAME (이름)
                </label>
                <Input 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  onFocus={handleInputFocus}
                  placeholder="Ex. Gildong" 
                  className="text-center font-kor py-2.5 sm:py-3 text-sm sm:text-base" 
                />
              </div>
            </div>
          </div>

          <div className="pt-3 sm:pt-4 flex flex-col gap-2.5 sm:gap-3">
            <StartGradientButton onClick={handleStart} className="w-full font-tech tracking-[0.2em] py-3 sm:py-3.5 rounded-sm text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg">
              <span>CONNECT & VERIFY</span>
            </StartGradientButton>
            <button onClick={() => setScreen('main')} className="w-full bg-transparent border border-slate-700 text-slate-400 py-2.5 sm:py-3 rounded-sm font-tech text-xs tracking-widest hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center">
              <span>◀ BACK TO MAIN</span>
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
