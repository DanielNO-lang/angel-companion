import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EmblemSkeleton } from '../ui/Skeleton';
import { RenderLoopController } from '../../utils/renderLoopVisibility';
import { getLogoMotionProfile } from '../../utils/logoMotion';
import { getDevicePerformanceProfile } from '../../utils/devicePerformance';
import { AngelEmblem } from './AngelEmblem';

interface AngelEmblem3DProps {
  size?: number;
  className?: string;
  rotationSpeed?: number; // Seconds per revolution
  tiltOnHover?: boolean;
  pointerTracking?: boolean;
  seed?: string;
  renderMode?: 'auto' | '3d' | 'svg';
}

let cachedStudioEnvTexture: THREE.CanvasTexture | null = null;

function getSharedChromeEnvTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedStudioEnvTexture) return cachedStudioEnvTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Deep cosmic backdrop with bright studio softboxes + cyan/violet rim bands
  const bg = ctx.createLinearGradient(0, 0, 0, 64);
  bg.addColorStop(0, '#e0f2fe');
  bg.addColorStop(0.32, '#1e293b');
  bg.addColorStop(0.58, '#0b1026');
  bg.addColorStop(1, '#312e81');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 64);

  // Soft studio highlight panels for crisp silver-chrome speculars
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(10, 6, 36, 12);
  ctx.fillRect(78, 10, 32, 10);

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 28, 42, 8);

  ctx.fillStyle = '#c084fc';
  ctx.fillRect(82, 26, 46, 9);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(46, 46, 36, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedStudioEnvTexture = tex;
  return tex;
}

export const AngelEmblem3D: React.FC<AngelEmblem3DProps> = ({
  size = 130,
  className = '',
  rotationSpeed = 24,
  tiltOnHover = false,
  pointerTracking = false,
  seed = 'emblem-3d',
  renderMode = 'auto',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGlError, setHasWebGlError] = useState(false);
  const [isFirstFrameReady, setIsFirstFrameReady] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);

  const profile = useMemo(
    () => getLogoMotionProfile(seed, rotationSpeed),
    [seed, rotationSpeed]
  );

  const perfProfile = useMemo(() => getDevicePerformanceProfile(), []);

  // Compact icons (<= 48px) render via GPU-composited AngelEmblem unless explicitly forced '3d'
  // and if WebGL is unsupported or blocked, cleanly fall back to 3D CSS-animated canonical SVG trefoil.
  const useCompactSvg =
    renderMode === 'svg' ||
    (renderMode === 'auto' && size <= 48) ||
    !perfProfile.webglSupported;

  useEffect(() => {
    if (useCompactSvg) return;
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: perfProfile.tier !== 'low',
        alpha: true,
        powerPreference: perfProfile.tier === 'high' ? 'high-performance' : 'default',
      });
    } catch {
      setHasWebGlError(true);
      setIsFirstFrameReady(true);
      return;
    }

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perfProfile.maxDpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.38;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setHasWebGlError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 8.2);

    const envTex = getSharedChromeEnvTexture();
    if (envTex) {
      scene.environment = envTex;
    }

    const ambientLight = new THREE.AmbientLight(0xe2e8f0, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(5, 6, 8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc7d2fe, 1.6);
    rimLight.position.set(-5, -4, 6);
    scene.add(rimLight);

    const blueLight = new THREE.PointLight(0x38bdf8, 4.5, 16);
    blueLight.position.set(-6, 3, 4);
    scene.add(blueLight);

    const violetLight = new THREE.PointLight(0xa855f7, 4.5, 16);
    violetLight.position.set(6, -3, 4);
    scene.add(violetLight);

    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x1e1b4b, 1.5);
    scene.add(hemiLight);

    const emblemGroup = new THREE.Group();
    // Apply deterministic starting phase rotation so every emblem starts cleanly oriented differently
    emblemGroup.rotation.y = profile.orbitPhaseRad;
    emblemGroup.rotation.x = Math.sin(profile.orbitPhaseRad) * 0.35;

    class TrefoilCurve extends THREE.Curve<THREE.Vector3> {
      scale: number;
      constructor(scale = 1.6) {
        super();
        this.scale = scale;
      }

      getPoint(t: number, optionalTarget = new THREE.Vector3()) {
        const tau = t * Math.PI * 2;
        const x = (Math.sin(tau) + 2 * Math.sin(2 * tau)) * 0.5 * this.scale;
        const y = (Math.cos(tau) - 2 * Math.cos(2 * tau)) * 0.5 * this.scale;
        const z = -Math.sin(3 * tau) * 0.6 * this.scale;
        return optionalTarget.set(x, y, z);
      }
    }

    const path = new TrefoilCurve(1.48);
    const tubeGeometry = new THREE.TubeGeometry(
      path,
      perfProfile.emblemTubeSegments,
      0.22,
      perfProfile.emblemRadialSegments,
      true
    );

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.9,
      roughness: 0.12,
      envMapIntensity: 1.65,
    });

    const emblemMesh = new THREE.Mesh(tubeGeometry, chromeMaterial);
    emblemGroup.add(emblemMesh);
    scene.add(emblemGroup);

    const prefersReducedMotion = perfProfile.prefersReducedMotion;

    let lastTime = performance.now();
    let lastRenderTime = 0;
    const minFrameIntervalMs =
      perfProfile.targetFps > 0 ? 1000 / Math.min(32, perfProfile.targetFps) : 1000 / 20;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let frameSignaled = false;

    const handleMouseMove = (e: MouseEvent | PointerEvent) => {
      if (!tiltOnHover && !pointerTracking) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (pointerTracking) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDist = Math.max(window.innerWidth, window.innerHeight) * 0.5;
        const dx = (e.clientX - centerX) / maxDist;
        const dy = -(e.clientY - centerY) / maxDist;
        targetTiltX = Math.max(-0.65, Math.min(0.65, dy * 0.7));
        targetTiltY = Math.max(-0.65, Math.min(0.65, dx * 0.7));
      } else {
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        targetTiltX = ny * 0.35;
        targetTiltY = nx * 0.35;
      }
    };

    const handleMouseLeave = () => {
      targetTiltX = 0;
      targetTiltY = 0;
    };

    if (pointerTracking) {
      window.addEventListener('pointermove', handleMouseMove, { passive: true });
    } else if (tiltOnHover) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    const baseSpeed = (Math.PI * 2) / profile.spinDurationSec;
    const orbitSpeed = (Math.PI * 2) / profile.orbitDurationSec;

    const renderFrame = (nowArg: number) => {
      const now = typeof nowArg === 'number' ? nowArg : performance.now();
      if (frameSignaled && !prefersReducedMotion && now - lastRenderTime < minFrameIntervalMs) {
        return;
      }
      lastRenderTime = now;

      const delta = Math.min((now - lastTime) * 0.001, 0.1);
      const elapsed = now * 0.001;
      lastTime = now;

      if (!prefersReducedMotion) {
        // Multi-axis 3D trefoil spin in seeded direction
        emblemGroup.rotation.y += profile.direction * baseSpeed * delta;
        emblemGroup.rotation.x +=
          Math.sin(elapsed * 0.85 + profile.orbitPhaseRad) * profile.tiltAxisRatio * baseSpeed * delta;
        emblemGroup.rotation.z +=
          Math.cos(elapsed * 0.65 + profile.orbitPhaseRad) * 0.55 * baseSpeed * delta;

        // Subtle circular orbital motion in XY plane inside Three.js camera space
        const orbitAngle = elapsed * orbitSpeed * profile.direction + profile.orbitPhaseRad;
        emblemGroup.position.x = Math.cos(orbitAngle) * 0.18;
        emblemGroup.position.y = Math.sin(orbitAngle) * 0.18;

        currentTiltX += (targetTiltX - currentTiltX) * 0.1;
        currentTiltY += (targetTiltY - currentTiltY) * 0.1;

        emblemMesh.rotation.x = currentTiltX;
        emblemMesh.rotation.z = currentTiltY * 0.5;

        blueLight.intensity = 3.8 + Math.sin(elapsed * 2.2 + profile.orbitPhaseRad) * 1.2;
        violetLight.intensity = 3.8 + Math.cos(elapsed * 2.2 + profile.orbitPhaseRad) * 1.2;
      }

      renderer.render(scene, camera);

      if (!frameSignaled) {
        frameSignaled = true;
        setIsFirstFrameReady(true);
      }
    };

    const loopController = new RenderLoopController({
      reducedMotion: Boolean(prefersReducedMotion),
      onFrame: renderFrame,
    });

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const visible = entries[0]?.isIntersecting ?? true;
              setIsInViewport(visible);
              loopController.setViewportVisible(visible);
            },
            { threshold: 0.05 }
          )
        : null;
    observer?.observe(container);

    const handleVisibilityChange = () => {
      loopController.handleVisibilityChange();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    renderFrame(performance.now());
    loopController.start();

    return () => {
      loopController.dispose();
      observer?.disconnect();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (pointerTracking) {
        window.removeEventListener('pointermove', handleMouseMove);
      } else if (tiltOnHover) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      tubeGeometry.dispose();
      chromeMaterial.dispose();
      renderer.dispose();
    };
  }, [useCompactSvg, size, tiltOnHover, pointerTracking, profile, perfProfile]);

  if (useCompactSvg || hasWebGlError) {
    return (
      <AngelEmblem
        size={size}
        seed={seed}
        rotationSpeed={rotationSpeed}
        tiltOnHover={tiltOnHover}
        className={className}
      />
    );
  }

  const orbitContainerStyle = {
    width: size,
    height: size,
    '--angel-orbit-r': `${profile.orbitRadiusPx}px`,
    '--angel-orbit-dur': `${profile.orbitDurationSec}s`,
    '--angel-orbit-delay': `${profile.phaseDelaySec}s`,
  } as React.CSSProperties;

  return (
    <div
      data-angel-emblem="true"
      data-motion-seed={profile.seedKey}
      data-motion-mode="webgl"
      data-motion-active={isInViewport ? 'true' : 'paused'}
      className={`angel-emblem-orbit relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={orbitContainerStyle}
    >
      {!isFirstFrameReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <EmblemSkeleton size={size} />
        </div>
      )}
      <div
        ref={mountRef}
        className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ${
          isFirstFrameReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
