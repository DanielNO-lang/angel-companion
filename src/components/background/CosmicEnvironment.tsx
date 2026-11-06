import React, { useEffect, useRef } from 'react';

interface CelestialObject {
  id: number;
  type: 'sun' | 'saturn' | 'earth' | 'moon' | 'satellite' | 'spacerock';
  x: number;
  y: number;
  baseRadius: number;
  currentScale: number;
  targetScale: number;
  scaleSpeed: number;
  alpha: number;
  targetAlpha: number;
  fadeSpeed: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  lifespan: number;
  age: number;
  flarePhase: number;
}

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const CosmicEnvironment: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Processed Transparent Space Object Canvases (Background-Free)
    const spaceCanvases: Record<CelestialObject['type'], HTMLCanvasElement | HTMLImageElement | null> = {
      sun: null,
      saturn: null,
      earth: null,
      moon: null,
      satellite: null,
      spacerock: null,
    };

    let realStarCanvas: HTMLCanvasElement | HTMLImageElement | null = null;

    const imageSources: Record<string, string> = {
      sun: '/assets/space/sun.jpg',
      saturn: '/assets/space/saturn.jpg',
      earth: '/assets/space/earth.jpg',
      moon: '/assets/space/moon.jpg',
      satellite: '/assets/space/satellite.jpg',
      spacerock: '/assets/space/satellite.jpg', // Satellite image utilized for high-res space rock/station
    };

    const processImageBackground = (type: CelestialObject['type'], src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = img.width;
          offCanvas.height = img.height;
          const offCtx = offCanvas.getContext('2d');
          if (!offCtx) {
            spaceCanvases[type] = img;
            return;
          }
          offCtx.drawImage(img, 0, 0);
          const imgData = offCtx.getImageData(0, 0, img.width, img.height);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (brightness < 36) {
              const alphaFactor = Math.max(0, Math.min(1, (brightness / 36) ** 1.8));
              data[i + 3] = Math.round(data[i + 3] * alphaFactor);
            }
          }
          offCtx.putImageData(imgData, 0, 0);
          spaceCanvases[type] = offCanvas;
        } catch {
          spaceCanvases[type] = img;
        }
      };
    };

    Object.entries(imageSources).forEach(([type, src]) => {
      processImageBackground(type as CelestialObject['type'], src);
    });

    // Load Real Star Sprite Texture
    const starImg = new Image();
    starImg.src = '/assets/space/star.jpg';
    starImg.onload = () => {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = starImg.width;
        offCanvas.height = starImg.height;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) {
          realStarCanvas = starImg;
          return;
        }
        offCtx.drawImage(starImg, 0, 0);
        const imgData = offCtx.getImageData(0, 0, starImg.width, starImg.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          if (brightness < 30) {
            const alphaFactor = Math.max(0, Math.min(1, (brightness / 30) ** 1.6));
            data[i + 3] = Math.round(data[i + 3] * alphaFactor);
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        realStarCanvas = offCanvas;
      } catch {
        realStarCanvas = starImg;
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // 1. Realistic Background Stars Array
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.85 ? Math.random() * 3 + 1.5 : Math.random() * 6 + 3,
      baseAlpha: Math.random() * 0.6 + 0.3,
      twinkleSpeed: Math.random() * 0.025 + 0.008,
      phase: Math.random() * Math.PI * 2,
      driftX: (Math.random() - 0.5) * 0.05,
      driftY: (Math.random() - 0.5) * 0.05,
    }));

    // 2. Shooting Stars Array
    let shootingStars: ShootingStar[] = [];
    let nextShootingStarTimer = Math.floor(Math.random() * 200 + 100);

    const spawnShootingStar = () => {
      const startX = Math.random() * width * 0.8;
      const startY = Math.random() * height * 0.4;
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.2;
      const speed = Math.random() * 8 + 6;
      shootingStars.push({
        id: Date.now() + Math.random(),
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: Math.random() * 80 + 50,
        alpha: 1.0,
        life: 0,
        maxLife: Math.floor(Math.random() * 35 + 25),
      });
    };

    // 3. Multi-Celestial Bodies System (Max 2-3 unique types simultaneously)
    const activeCelestialBodies: CelestialObject[] = [];

    const createCelestialBody = (id: number, existingTypes: string[]): CelestialObject | null => {
      const allTypes: CelestialObject['type'][] = ['saturn', 'earth', 'sun', 'moon', 'satellite', 'spacerock'];
      const availableTypes = allTypes.filter((t) => !existingTypes.includes(t));
      if (availableTypes.length === 0) return null;

      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

      const spawnMode = Math.random();
      let startX = 0, startY = 0, vx = 0, vy = 0;

      if (spawnMode < 0.35) {
        const fromLeft = Math.random() > 0.5;
        startX = fromLeft ? -220 : width + 220;
        startY = Math.random() * height;
        vx = (fromLeft ? 1 : -1) * (Math.random() * 0.35 + 0.15);
        vy = (Math.random() - 0.5) * 0.12;
      } else if (spawnMode < 0.7) {
        const fromTop = Math.random() > 0.5;
        startX = Math.random() * width;
        startY = fromTop ? -220 : height + 220;
        vx = (Math.random() - 0.5) * 0.12;
        vy = (fromTop ? 1 : -1) * (Math.random() * 0.35 + 0.15);
      } else {
        const fromLeft = Math.random() > 0.5;
        const fromTop = Math.random() > 0.5;
        startX = fromLeft ? -220 : width + 220;
        startY = fromTop ? -220 : height + 220;
        vx = (fromLeft ? 1 : -1) * (Math.random() * 0.4 + 0.15);
        vy = (fromTop ? 1 : -1) * (Math.random() * 0.4 + 0.15);
      }

      const baseRadii: Record<CelestialObject['type'], number> = {
        sun: 80,
        saturn: 75,
        earth: 60,
        moon: 42,
        satellite: 34,
        spacerock: 28,
      };

      return {
        id,
        type,
        x: startX,
        y: startY,
        baseRadius: baseRadii[type],
        currentScale: 0.05, // Starts at 0.05 minimization on entry
        targetScale: Math.random() * 0.7 + 0.5,
        scaleSpeed: Math.random() * 0.0025 + 0.001,
        alpha: 0,
        targetAlpha: Math.random() * 0.75 + 0.25,
        fadeSpeed: Math.random() * 0.0035 + 0.0015,
        vx,
        vy,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
        lifespan: Math.random() * 1800 + 1200,
        age: 0,
        flarePhase: Math.random() * Math.PI * 2,
      };
    };

    // Initial 2 celestial bodies
    const body1 = createCelestialBody(1, []);
    if (body1) activeCelestialBodies.push(body1);
    const body2 = createCelestialBody(2, activeCelestialBodies.map((b) => b.type));
    if (body2) activeCelestialBodies.push(body2);

    let lastFrameTime = performance.now();
    const fpsInterval = 1000 / 35; // Throttled to ~35 FPS max for zero GPU lag

    let time = 0;

    const render = (nowTime: number) => {
      animationFrameId = requestAnimationFrame(render);

      // Pause completely if tab is hidden/unfocused to save GPU
      if (document.hidden) return;

      const delta = nowTime - lastFrameTime;
      if (delta < fpsInterval) return;
      lastFrameTime = nowTime - (delta % fpsInterval);

      time += 0.01;

      ctx.clearRect(0, 0, width, height);

      // Deep Space Base Gradient
      const spaceGrad = ctx.createRadialGradient(
        width * 0.5, height * 0.4, 60,
        width * 0.5, height * 0.5, Math.max(width, height)
      );
      spaceGrad.addColorStop(0, '#060a1e');
      spaceGrad.addColorStop(0.5, '#030511');
      spaceGrad.addColorStop(1, '#010207');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // Ambient Nebulae Clouds
      const nebAX = width * 0.4 + Math.sin(time * 0.2) * 35;
      const nebAY = height * 0.3 + Math.cos(time * 0.2) * 20;
      const nebAGrad = ctx.createRadialGradient(nebAX, nebAY, 30, nebAX, nebAY, width * 0.5);
      nebAGrad.addColorStop(0, 'rgba(124, 58, 237, 0.08)');
      nebAGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.03)');
      nebAGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebAGrad;
      ctx.fillRect(0, 0, width, height);

      // LAYER 1: STARS (BEHIND PLANETS)
      stars.forEach((s) => {
        s.x += s.driftX;
        s.y += s.driftY;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        const twinkleFactor = Math.sin(time * 40 * s.twinkleSpeed + s.phase);
        const currentAlpha = Math.max(0.1, Math.min(1, s.baseAlpha + twinkleFactor * 0.45));
        const currentSize = s.size * (1 + twinkleFactor * 0.18);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = currentAlpha;

        if (realStarCanvas) {
          ctx.drawImage(realStarCanvas, s.x - currentSize, s.y - currentSize, currentSize * 2, currentSize * 2);
        } else {
          ctx.fillStyle = '#bae6fd';
          ctx.beginPath();
          ctx.arc(s.x, s.y, currentSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // LAYER 2: SHOOTING STARS (METEORS)
      nextShootingStarTimer--;
      if (nextShootingStarTimer <= 0) {
        spawnShootingStar();
        nextShootingStarTimer = Math.floor(Math.random() * 250 + 150);
      }

      shootingStars.forEach((ss, idx) => {
        ss.life++;
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.alpha = 1 - ss.life / ss.maxLife;

        if (ss.life >= ss.maxLife) {
          shootingStars.splice(idx, 1);
          return;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0, ss.alpha);
        const tailX = ss.x - ss.vx * 4;
        const tailY = ss.y - ss.vy * 4;
        const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#38bdf8');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.restore();
      });

      // LAYER 3: CELESTIAL BODIES (IN FRONT OF STARS)
      for (let i = activeCelestialBodies.length - 1; i >= 0; i--) {
        const obj = activeCelestialBodies[i];
        obj.age++;
        obj.x += obj.vx;
        obj.y += obj.vy;
        obj.rotation += obj.rotationSpeed;
        obj.flarePhase += 0.02;

        const progress = obj.age / obj.lifespan;
        if (progress < 0.35) {
          obj.currentScale += (obj.targetScale - obj.currentScale) * obj.scaleSpeed;
          obj.alpha = Math.min(obj.targetAlpha, obj.alpha + obj.fadeSpeed);
        } else if (progress > 0.7) {
          // Minimization down to 0.05 on exit as requested
          obj.currentScale += (0.05 - obj.currentScale) * obj.scaleSpeed;
          obj.alpha = Math.max(0, obj.alpha - obj.fadeSpeed);
        } else {
          obj.alpha = Math.min(obj.targetAlpha, obj.alpha + obj.fadeSpeed);
        }

        const isOutOfBounds =
          obj.x < -320 || obj.x > width + 320 || obj.y < -320 || obj.y > height + 320;

        if (obj.age >= obj.lifespan || (obj.alpha <= 0.005 && obj.age > 80) || isOutOfBounds) {
          activeCelestialBodies.splice(i, 1);
          // Spawn next unique celestial body if under max limit 2
          const existingTypes = activeCelestialBodies.map((b) => b.type);
          const newBody = createCelestialBody(Date.now(), existingTypes);
          if (newBody) activeCelestialBodies.push(newBody);
          continue;
        }

        const spaceCanvas = spaceCanvases[obj.type];
        const radius = obj.baseRadius * obj.currentScale;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0, Math.min(1, obj.alpha));
        ctx.translate(obj.x, obj.y);

        // 3D Solar Flare Eruption Halo for Sun
        if (obj.type === 'sun') {
          const flareRadius = radius * (1.1 + Math.sin(obj.flarePhase * 3) * 0.08);
          const sunGlow = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, flareRadius * 1.5);
          sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.6)');
          sunGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.3)');
          sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = sunGlow;
          ctx.beginPath();
          ctx.arc(0, 0, flareRadius * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.rotate(obj.rotation);

        if (spaceCanvas) {
          ctx.drawImage(spaceCanvas, -radius, -radius, radius * 2, radius * 2);
        } else {
          const orbGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
          orbGrad.addColorStop(0, '#38bdf8');
          orbGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = orbGrad;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};
