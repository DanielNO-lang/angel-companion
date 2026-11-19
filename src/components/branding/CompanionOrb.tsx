import React, { useEffect, useRef } from 'react';
import { OrbState } from '../../types/angel';
import { RenderLoopController } from '../../utils/renderLoopVisibility';

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

  // Canvas particle animation guarded by RenderLoopController (pauses offscreen / hidden / reduced motion)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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

    const renderFrame = () => {
      if (!prefersReducedMotion) {
        time += 0.03;
      }
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
        if (!prefersReducedMotion) {
          p.x += p.speedX * (state === 'thinking' ? 2 : 1);
          p.y += p.speedY * (state === 'thinking' ? 2 : 1);

          if (p.x > radius || p.x < -radius) p.speedX *= -1;
          if (p.y > radius || p.y < -radius) p.speedY *= -1;
        }

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
    };

    const controller = new RenderLoopController({
      reducedMotion: Boolean(prefersReducedMotion),
      onFrame: renderFrame,
    });

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              controller.setViewportVisible(entries[0]?.isIntersecting ?? true);
            },
            { threshold: 0.05 }
          )
        : null;
    observer?.observe(canvas);

    const handleVisibilityChange = () => controller.handleVisibilityChange();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    renderFrame();
    controller.start();

    return () => {
      controller.dispose();
      observer?.disconnect();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [state, size]);

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Canvas Orb Rendering */}
      <div 
        className="relative cursor-pointer group"
        title="Click to cycle Angel Companion Orb state"
      >
        <canvas
          ref={canvasRef}
          width={size * 1.4}
          height={size * 1.4}
          className="drop-shadow-[0_10px_30px_rgba(99,102,241,0.4)] animate-float"
        />

      </div>
    </div>
  );
};
