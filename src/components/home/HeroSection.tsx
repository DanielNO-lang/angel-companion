import React, { useState, useRef } from 'react';
import { MessageSquare, Briefcase, CheckCircle2, Shuffle } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { CompanionOrbState } from '../../types/angel';

interface HeroSectionProps {
  orbState: CompanionOrbState;
  onOrbStateChange: (newState: CompanionOrbState) => void;
  onSelectQuickAction: (actionId: string) => void;
  activeChip: string | null;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  orbState,
  onOrbStateChange,
  onSelectQuickAction,
  activeChip,
}) => {
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);

  const quickActions = [
    { id: 'ask', label: 'Ask anything...', icon: MessageSquare },
    { id: 'plan-project', label: 'Plan a project', icon: Briefcase },
    { id: 'create-plan', label: 'Create a plan', icon: CheckCircle2 },
    { id: 'explore-studios', label: 'Explore Studios', icon: Shuffle },
  ];

  const handleAngelClick = () => {
    const greetings = [
      "Hello! I'm Angel, your personal companion.",
      "Ready to brainstorm or build whenever you are!",
      "All systems operational. What shall we create?",
      "I'm listening! Tell me what's on your mind."
    ];
    const picked = greetings[Math.floor(Math.random() * greetings.length)];
    setSpeechBubble(picked);
    onOrbStateChange('speaking');
    setTimeout(() => {
      onOrbStateChange('idle');
      setTimeout(() => setSpeechBubble(null), 3500);
    }, 2800);
  };

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number } | null>(null);
  const movedDistanceRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    movedDistanceRef.current = 0;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    movedDistanceRef.current = Math.hypot(dx, dy);
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    });
  };

  const handleRelease = (e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    dragStartRef.current = null;

    // Playful Snap-Back: Automatically return to original centered position (0, 0)
    setPosition({ x: 0, y: 0 });

    // Multi-click detection (Double-click to wake up, Triple-click to sleep)
    if (movedDistanceRef.current < 8) {
      clickCountRef.current += 1;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

      clickTimerRef.current = setTimeout(() => {
        const count = clickCountRef.current;
        clickCountRef.current = 0;

        if (count === 2) {
          // Double-Click: Wake Up Companion
          onOrbStateChange('speaking');
          setSpeechBubble("Angel is awake! Ready to assist.");
          setTimeout(() => {
            onOrbStateChange('idle');
            setTimeout(() => setSpeechBubble(null), 3000);
          }, 2400);
        } else if (count >= 3) {
          // Triple-Click: Put Companion to Sleep
          onOrbStateChange('sleeping');
          setSpeechBubble("Angel is now resting zZZ... Double-click to wake me up.");
          setTimeout(() => {
            setTimeout(() => setSpeechBubble(null), 4000);
          }, 3500);
        } else if (count === 1) {
          // Single Click Friendly Greeting
          handleAngelClick();
        }
      }, 300);
    }
  };

  return (
    <div className="w-full flex flex-col items-center text-center my-2 sm:my-4 select-none relative max-w-4xl mx-auto">
      {/* Speech bubble floating above central 3D emblem */}
      {speechBubble && (
        <div className={`absolute top-2 z-40 px-4 py-1.5 rounded-full border text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 flex items-center gap-2 ${
          orbState === 'sleeping' 
            ? 'bg-slate-950/90 border-indigo-500/50 text-indigo-300' 
            : 'bg-slate-950/80 border-cyan-400/40 text-cyan-200'
        }`}>
          <span className={`w-2 h-2 rounded-full ${orbState === 'sleeping' ? 'bg-indigo-400 animate-pulse' : 'bg-cyan-400 animate-ping'}`} />
          <span>{speechBubble}</span>
        </div>
      )}

      {/* Real 3D Rotating Chrome Trefoil Knot - Interactive Emblem with Playful Drag & Snap-Back */}
      <div 
        className="relative my-2 sm:my-3 flex justify-center items-center group cursor-grab active:cursor-grabbing touch-none z-30"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handleRelease}
        onPointerCancel={handleRelease}
        onPointerLeave={handleRelease}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        title="Angel 3D Emblem • Drag to move (snaps back on release) • Double-click to wake • Triple-click to sleep"
      >
        <div className={`relative z-10 transition-all duration-300 ${
          isDragging 
            ? 'scale-110 drop-shadow-[0_0_35px_rgba(56,189,248,0.8)]' 
            : orbState === 'sleeping'
            ? 'opacity-70 scale-95 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]'
            : 'group-hover:scale-105 drop-shadow-[0_0_25px_rgba(56,189,248,0.5)]'
        }`}>
          <AngelEmblem3D 
            size={typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 210} 
            rotationSpeed={isDragging ? 4 : orbState === 'sleeping' ? 48 : 12} 
            tiltOnHover={true}
            pointerTracking={true}
          />
        </div>
      </div>

      {/* Welcome Heading */}
      <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-white mb-3 sm:mb-5">
        Welcome to <span className="bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">ANGEL</span>
      </h1>

      {/* 4 Quick Action Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl">
        {quickActions.map((action) => {
          const Icon = action.icon;
          const isSelected = activeChip === action.id;

          return (
            <button
              key={action.id}
              onClick={() => onSelectQuickAction(action.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-600/50 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-105'
                  : 'bg-[#090e24]/40 hover:bg-[#12193b]/70 backdrop-blur-md text-slate-200 shadow-sm'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`} />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
