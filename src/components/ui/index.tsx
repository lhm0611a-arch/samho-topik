import React from 'react';

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent<HTMLDivElement>) => void }> = ({ children, className = '', onClick }) => (
  <div className={`glass-card ${className}`} onClick={onClick}>
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input className={`system-input w-full p-3.5 font-eng text-base tracking-wider ${className}`} {...props} />
);

export const StartGradientButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...props }) => (
  <button className={`btn-start-gradient ${className}`} {...props}>
    {children}
  </button>
);

export const PremiumButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...props }) => (
  <button className={`btn-premium ${className}`} {...props}>
    {children}
  </button>
);
