import React, { useEffect, useRef } from 'react';
import { OrbState } from '../../types/angel';

interface CompanionOrbProps {
  state?: OrbState;
  onStateChange?: (newState: OrbState) => void;
  className?: string;
  size?: number;
}

export const CompanionOrb: React.FC<CompanionOrbProps> = ({
  state = 'idle',
  onStateChange,
  className = '',
  size = 200,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const particles: { x: number; y: number; size: number; speedX: number; speedY: number; opacity: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 120,
        y: (Math.random() - 0.5) * 120,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }

    const render = () => {
      time += 0.03;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = size * 0.38;

      // Outer Glow
      const glowGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.5);
      if (state === 'idle') {
        glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.2)');
        glowGrad.addColorStop(1, 'rgba(7, 8, 21, 0)');
      } else if (state === 'listening') {
        glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0.5)');
        glowGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
        glowGrad.addColorStop(1, 'rgba(7, 8, 21, 0)');
      } else if (state === 'thinking') {
        glowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.6)');
        glowGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
        glowGrad.addColorStop(1, 'rgba(7, 8, 21, 0)');
      } else if (state === 'speaking') {
        glowGrad.addColorStop(0, 'rgba(236, 72, 153, 0.5)');
        glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)');
        glowGrad.addColorStop(1, 'rgba(7, 8, 21, 0)');
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Core Glass Sphere
      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );
      sphereGrad.addColorStop(0, '#ffffff');
      sphereGrad.addColorStop(0.2, 'rgba(186, 230, 253, 0.9)');
      sphereGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.7)');
      sphereGrad.addColorStop(0.8, 'rgba(30, 27, 75, 0.85)');
      sphereGrad.addColorStop(1, 'rgba(7, 8, 21, 0.95)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Internal Core Pulses
      const pulseRadius = radius * (0.4 + Math.sin(time * (state === 'thinking' ? 4 : 1.5)) * 0.08);
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = state === 'thinking' ? 'rgba(216, 180, 254, 0.6)' : 'rgba(186, 230, 253, 0.5)';
      ctx.fill();

      // Core Particles inside sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
      ctx.clip();

      particles.forEach((p) => {
        p.x += p.speedX * (state === 'thinking' ? 2 : 1);
        p.y += p.speedY * (state === 'thinking' ? 2 : 1);

        if (p.x > radius || p.x < -radius) p.speedX *= -1;
        if (p.y > radius || p.y < -radius) p.speedY *= -1;

        ctx.fillStyle = state === 'speaking' ? 'rgba(244, 114, 182, 0.8)' : 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(centerX + p.x, centerY + p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Outer Orbital Metallic Rings
      const ringSpeed = state === 'thinking' ? 0.06 : 0.02;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * ringSpeed);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.35, radius * 0.45, Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(-time * ringSpeed * 1.5);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.25, radius * 0.35, -Math.PI / 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [state, size]);

  const stateLabels: Record<OrbState, string> = {
    idle: 'Idle',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
    attention: 'Attention Signal',
    sleeping: 'Sleeping Resting',
  };

  const nextStateMap: Record<OrbState, OrbState> = {
    idle: 'listening',
    listening: 'thinking',
    thinking: 'speaking',
    speaking: 'attention',
    attention: 'idle',
    sleeping: 'idle',
  };

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Canvas Orb Rendering */}
      <div 
        className="relative cursor-pointer group"
        onClick={() => onStateChange && onStateChange(nextStateMap[state])}
        title="Click to cycle Angel Companion Orb state"
      >
        <canvas
          ref={canvasRef}
          width={size * 1.4}
          height={size * 1.4}
          className="drop-shadow-[0_10px_30px_rgba(99,102,241,0.4)] animate-float"
        />

        {/* State Badge floating over Orb */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/80 border border-indigo-500/30 backdrop-blur-md text-[11px] font-medium tracking-wide text-indigo-200 flex items-center gap-1.5 shadow-lg group-hover:border-indigo-400 transition-all">
          <span className={`w-2 h-2 rounded-full ${
            state === 'idle' ? 'bg-cyan-400 animate-pulse' :
            state === 'listening' ? 'bg-blue-400 animate-ping' :
            state === 'thinking' ? 'bg-purple-400 animate-spin' :
            'bg-pink-400 animate-bounce'
          }`} />
          {stateLabels[state]}
        </div>
      </div>

      {/* State Switcher Micro Controls */}
      {onStateChange && (
        <div className="mt-2 flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm text-[10px]">
          {(['idle', 'listening', 'thinking', 'speaking'] as OrbState[]).map((s) => (
            <button
              key={s}
              onClick={() => onStateChange(s)}
              className={`px-2 py-0.5 rounded capitalize transition-all ${
                state === s
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
