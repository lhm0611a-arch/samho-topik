import React, { useState } from 'react';
import { GlassCard, PremiumButton, Input } from '../components/ui';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';

export const QrModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [url, setUrl] = useState(window.location.href);

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <GlassCard className="p-8 text-center max-w-sm w-full border-t-cyan-500 rounded-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-tech text-cyan-400 mb-2 tracking-widest">SCAN TO ACCESS</h3>
        <p className="text-xs text-slate-400 font-kor mb-6">스마트폰 카메라로 아래 QR 코드를 스캔하세요.</p>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} className="text-xs mb-6 text-center" placeholder="https://..." />
        <div className="flex justify-center mb-6">
          <div className="border-4 border-cyan-500 shadow-[0_0_20px_rgba(0,229,255,0.4)] bg-white p-3 rounded-sm">
            <QRCodeSVG value={url} size={200} fgColor="#030712" />
          </div>
        </div>
        <PremiumButton onClick={onClose} className="w-full py-3 font-tech text-sm tracking-widest rounded-sm">CLOSE</PremiumButton>
      </GlassCard>
    </div>
  );
};

export const AdminAuthModal: React.FC<{ onClose: () => void, onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [pwd, setPwd] = useState('');

  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!pwd) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        alert("접근 권한이 없습니다. (비밀번호 오류)");
        setPwd('');
      }
    } catch (e) {
      alert("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <GlassCard className="rounded-sm p-6 max-w-xs w-full text-center shadow-2xl border-t-amber-500" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-amber-900/30 border border-amber-500 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-tech font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]">🔒</div>
        <h3 className="text-xs font-tech text-white mb-2 tracking-widest">ADMIN AUTHENTICATION</h3>
        <p className="text-slate-400 font-kor mb-5 text-[11px] leading-snug break-keep">시스템 관리자 비밀번호를 입력하세요.</p>
        <Input 
          type="password" 
          value={pwd} 
          onChange={e => setPwd(e.target.value)} 
          className="mb-5 text-center" 
          placeholder="PASSWORD" 
          onKeyDown={e => e.key === 'Enter' && verify()} 
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-800 border border-slate-700 text-slate-400 font-tech py-3 rounded-sm text-xs tracking-widest hover:bg-slate-700 transition-colors">CANCEL</button>
          <button onClick={verify} disabled={loading} className="flex-1 bg-amber-600 border border-amber-500 text-white py-3 rounded-sm text-xs font-tech tracking-widest hover:bg-amber-500 transition-colors disabled:opacity-50">{loading ? 'VERIFYING...' : 'UNLOCK'}</button>
        </div>
      </GlassCard>
    </div>
  );
};
