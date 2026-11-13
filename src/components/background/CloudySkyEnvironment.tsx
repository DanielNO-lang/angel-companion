import React, { useEffect, useRef } from 'react';

interface CloudCluster {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
  layer: number;
  puffs: Array<{ dx: number; dy: number; r: number; shade: string }>;
}

export const CloudySkyEnvironment: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const createCloud = (index: number, total: number): CloudCluster => {
      const layer = index % 3;
      const scale = layer === 0 ? 0.72 : layer === 1 ? 1.0 : 1.32;
      const baseWidth = (220 + (index % 4) * 55) * scale;
      const baseHeight = (74 + (index % 3) * 18) * scale;

      const puffs = [
        { dx: -0.34, dy: 0.14, r: 0.34, shade: 'rgba(255, 255, 255, 0.88)' },
        { dx: -0.14, dy: -0.08, r: 0.44, shade: 'rgba(255, 255, 255, 0.95)' },
        { dx: 0.1, dy: -0.02, r: 0.4, shade: 'rgba(248, 250, 255, 0.92)' },
        { dx: 0.32, dy: 0.16, r: 0.31, shade: 'rgba(241, 245, 255, 0.84)' },
      ];

      return {
        x: (width / total) * index - 80,
        y: height * (0.1 + (layer * 0.22) + (index % 2) * 0.08),
        width: baseWidth,
        height: baseHeight,
        speed: (0.12 + layer * 0.11) * (index % 2 === 0 ? 1 : 0.85),
        opacity: layer === 0 ? 0.48 : layer === 1 ? 0.65 : 0.78,
        layer,
        puffs,
      };
    };

    const clouds: CloudCluster[] = Array.from({ length: 10 }, (_, idx) => createCloud(idx, 10));

    const drawFrame = (elapsedSec: number) => {
      ctx.clearRect(0, 0, width, height);

      // 1. Bright atmospheric daytime sky backdrop
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#bae6fd');
      skyGrad.addColorStop(0.32, '#dbeafe');
      skyGrad.addColorStop(0.68, '#eff6ff');
      skyGrad.addColorStop(1, '#f8fafc');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Soft sunlit radiance (top-right natural daylight)
      const sunX = width * 0.82;
      const sunY = height * 0.14;
      const sunGlow = ctx.createRadialGradient(
        sunX,
        sunY,
        10,
        sunX,
        sunY,
        Math.max(width, height) * 0.55
      );
      sunGlow.addColorStop(0, 'rgba(255, 252, 232, 0.92)');
      sunGlow.addColorStop(0.18, 'rgba(254, 249, 195, 0.42)');
      sunGlow.addColorStop(0.55, 'rgba(186, 230, 253, 0.18)');
      sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Subtle Angel ambient blue & violet atmospheric wash
      const ambientGrad = ctx.createRadialGradient(
        width * 0.25,
        height * 0.38,
        20,
        width * 0.25,
        height * 0.38,
        width * 0.55
      );
      ambientGrad.addColorStop(0, 'rgba(168, 85, 247, 0.08)');
      ambientGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.09)');
      ambientGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, width, height);

      // 4. Layered drifting volumetric clouds
      for (const cloud of clouds) {
        if (!prefersReducedMotion) {
          cloud.x += cloud.speed;
          if (cloud.x - cloud.width > width + 120) {
            cloud.x = -cloud.width - 100;
          }
        }

        const gentleBob = prefersReducedMotion ? 0 : Math.sin(elapsedSec * 0.4 + cloud.layer) * 4;
        const cx = cloud.x;
        const cy = cloud.y + gentleBob;

        ctx.save();
        ctx.globalAlpha = cloud.opacity;

        // Soft cloud shadow base
        const baseShadow = ctx.createRadialGradient(
          cx,
          cy + cloud.height * 0.26,
          cloud.width * 0.08,
          cx,
          cy + cloud.height * 0.26,
          cloud.width * 0.6
        );
        baseShadow.addColorStop(0, 'rgba(191, 219, 254, 0.45)');
        baseShadow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = baseShadow;
        ctx.beginPath();
        ctx.ellipse(cx, cy + cloud.height * 0.25, cloud.width * 0.52, cloud.height * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        for (const puff of cloud.puffs) {
          const px = cx + puff.dx * cloud.width;
          const py = cy + puff.dy * cloud.height;
          const pr = puff.r * cloud.width * 0.55;
          const puffGrad = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.25, pr * 0.1, px, py, pr);
          puffGrad.addColorStop(0, puff.shade);
          puffGrad.addColorStop(0.65, 'rgba(248, 250, 255, 0.72)');
          puffGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = puffGrad;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };

    let lastFrameTime = performance.now();
    const fpsInterval = 1000 / 28; // Gentle daylight drift with minimal GPU overhead

    const renderLoop = (nowTime: number) => {
      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(renderLoop);
      }
      if (document.hidden) return;
      const delta = nowTime - lastFrameTime;
      if (delta < fpsInterval) return;
      lastFrameTime = nowTime - (delta % fpsInterval);
      drawFrame(nowTime * 0.001);
    };

    drawFrame(0);
    if (!prefersReducedMotion) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      aria-label="Atmospheric Cloudy Daylight Sky Environment"
    />
  );
};
