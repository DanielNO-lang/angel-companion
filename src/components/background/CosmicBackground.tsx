import React, { useEffect, useRef } from 'react';

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Star dust particles
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.02 + 0.005,
    }));

    let time = 0;

    const render = () => {
      if (!prefersReducedMotion) {
        time += 0.008;
      }

      ctx.clearRect(0, 0, width, height);

      // Deep base background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#070815');
      bgGrad.addColorStop(0.5, '#0b0d21');
      bgGrad.addColorStop(1, '#050611');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Cosmic Light Ribbons / Ambient Glowing Nebulae matching the reference layout
      // 1. Top Center / Emblem Glow
      const centerGlow = ctx.createRadialGradient(width * 0.5, height * 0.2, 50, width * 0.5, height * 0.2, width * 0.45);
      centerGlow.addColorStop(0, 'rgba(99, 102, 241, 0.22)');
      centerGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.12)');
      centerGlow.addColorStop(1, 'rgba(7, 8, 21, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Right Side Companion Aura
      const rightAura = ctx.createRadialGradient(width * 0.85, height * 0.25, 40, width * 0.85, height * 0.25, width * 0.35);
      rightAura.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      rightAura.addColorStop(0.6, 'rgba(99, 102, 241, 0.12)');
      rightAura.addColorStop(1, 'rgba(7, 8, 21, 0)');
      ctx.fillStyle = rightAura;
      ctx.fillRect(0, 0, width, height);

      // 3. Lower Left Activity Ribbon Glow
      const leftLowerGlow = ctx.createRadialGradient(width * 0.1, height * 0.8, 30, width * 0.2, height * 0.8, width * 0.3);
      leftLowerGlow.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
      leftLowerGlow.addColorStop(0.7, 'rgba(59, 130, 246, 0.08)');
      leftLowerGlow.addColorStop(1, 'rgba(7, 8, 21, 0)');
      ctx.fillStyle = leftLowerGlow;
      ctx.fillRect(0, 0, width, height);

      // Light Trail Sweeps matching original reference visual paths
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
      ctx.beginPath();
      
      const waveY1 = height * 0.18 + Math.sin(time) * 15;
      const waveY2 = height * 0.28 + Math.cos(time * 0.8) * 20;

      ctx.moveTo(0, waveY1);
      ctx.bezierCurveTo(width * 0.3, waveY1 - 40, width * 0.7, waveY2 + 50, width, waveY2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.moveTo(width * 0.2, height * 0.05);
      ctx.bezierCurveTo(width * 0.5, height * 0.35 + Math.sin(time * 1.2) * 10, width * 0.8, height * 0.15, width, height * 0.4);
      ctx.stroke();
      ctx.restore();

      // Twinkling Starfield
      stars.forEach((star) => {
        if (!prefersReducedMotion) {
          star.alpha += Math.sin(time * star.speed * 100) * 0.02;
          if (star.alpha > 1) star.alpha = 1;
          if (star.alpha < 0.2) star.alpha = 0.2;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 w-full h-full"
    />
  );
};
