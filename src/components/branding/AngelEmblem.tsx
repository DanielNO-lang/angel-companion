import React from 'react';

interface AngelEmblemProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export const AngelEmblem: React.FC<AngelEmblemProps> = ({ size = 36, className = '', glow = true }) => {
  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background radial aura glow */}
      {glow && (
        <div 
          className="absolute inset-0 rounded-full blur-md opacity-70 animate-pulse-glow"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.6) 0%, rgba(168, 85, 247, 0.4) 50%, transparent 80%)'
          }}
        />
      )}

      {/* SVG Chrome Trefoil / Metallic Double Ring */}
      <svg 
        viewBox="0 0 100 100" 
        className="relative w-full h-full drop-shadow-[0_4px_12px_rgba(99,102,241,0.5)]"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="chromeGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="75%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <linearGradient id="chromeGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="40%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>

          <filter id="metallicGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Orbit Light Ring */}
        <circle 
          cx="50" 
          cy="50" 
          r="44" 
          stroke="url(#chromeGradient1)" 
          strokeWidth="1.5" 
          strokeDasharray="4 8" 
          className="animate-spin-slow opacity-60" 
        />

        {/* Outer Metallic Ring Path */}
        <path 
          d="M 50 15 C 25 15 15 35 30 55 C 45 75 65 85 80 65 C 95 45 75 15 50 15 Z" 
          stroke="url(#chromeGradient1)" 
          strokeWidth="6" 
          strokeLinecap="round"
          filter="url(#metallicGlow)"
        />

        {/* Inner Counter Ring Path */}
        <path 
          d="M 50 85 C 75 85 85 65 70 45 C 55 25 35 15 20 35 C 5 55 25 85 50 85 Z" 
          stroke="url(#chromeGradient2)" 
          strokeWidth="6" 
          strokeLinecap="round"
          filter="url(#metallicGlow)"
        />

        {/* Center Metallic Interlock Knot */}
        <path 
          d="M 35 35 C 50 20 65 35 50 65 C 35 35 65 35 50 20" 
          stroke="#ffffff" 
          strokeWidth="3" 
          strokeLinecap="round" 
          opacity="0.95"
        />

        {/* Shiny Highlight Sparks */}
        <circle cx="32" cy="28" r="2.5" fill="#ffffff" className="animate-ping" style={{ animationDuration: '3s' }} />
        <circle cx="68" cy="72" r="2" fill="#38bdf8" />
        <circle cx="50" cy="50" r="3" fill="url(#chromeGradient1)" />
      </svg>
    </div>
  );
};
