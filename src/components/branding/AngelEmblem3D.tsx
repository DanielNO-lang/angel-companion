import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EmblemSkeleton } from '../ui/Skeleton';
import { RenderLoopController } from '../../utils/renderLoopVisibility';
import { useAngelLogoAnimation } from '../../utils/logoMotion';
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

class TrefoilCurve extends THREE.Curve<THREE.Vector3> {
  scale: number;
  constructor(scale = 1.5) {
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

  const { profile, orbitClassName, orbitStyle } = useAngelLogoAnimation({
    seed,
    rotationSpeed,
    size,
    className,
    tiltOnHover,
  });

  const perfProfile = useMemo(() => getDevicePerformanceProfile(), []);

  // Canonical WebGL MeshPhysicalMaterial + RoomEnvironment glass emblem is enabled when
  // renderMode is 'auto' (for primary marks >= 44px or explicit '3d') and WebGL is supported;
  // compact header/badge emblems <= 40px and renderMode="svg" use the matching smooth SVG glass trefoil.
  const useCompactSvg =
    renderMode === 'svg' ||
    !perfProfile.webglSupported ||
    (renderMode === 'auto' && size < 44);

  useEffect(() => {
    if (useCompactSvg) return;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = perfProfile.isSoftwareRenderer;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: isSoftwareGl ? 'default' : perfProfile.tier === 'high' ? 'high-performance' : 'default',
      });
    } catch {
      setHasWebGlError(true);
      setIsFirstFrameReady(true);
      return;
    }

    renderer.setSize(size, size);
    const compactDpr = size < 44 ? Math.max(window.devicePixelRatio || 1, 2) : window.devicePixelRatio || 1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(compactDpr, Math.max(perfProfile.maxDpr, size < 44 ? 2 : 1)));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setHasWebGlError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 8.2);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const pmremRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = pmremRenderTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 6, 8);
    scene.add(keyLight);

    const blueLight = new THREE.PointLight(0x38bdf8, 4, 16);
    blueLight.position.set(-5, 3, 5);
    scene.add(blueLight);

    const violetLight = new THREE.PointLight(0xa855f7, 4, 16);
    violetLight.position.set(5, -3, 5);
    scene.add(violetLight);

    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x1e1b4b, 1.4);
    scene.add(hemiLight);

    const emblemGroup = new THREE.Group();
    emblemGroup.rotation.y = profile.orbitPhaseRad;
    emblemGroup.rotation.x = Math.sin(profile.orbitPhaseRad) * 0.35;

    const path = new TrefoilCurve(1.5);
    const tubeSegs = isSoftwareGl ? Math.min(48, perfProfile.emblemTubeSegments) : perfProfile.emblemTubeSegments;
    const radialSegs = isSoftwareGl ? Math.min(12, perfProfile.emblemRadialSegments) : perfProfile.emblemRadialSegments;
    const tubeRadius = size < 44 ? 0.25 : 0.22;
    const tubeGeometry = new THREE.TubeGeometry(path, tubeSegs, tubeRadius, radialSegs, true);

    // Exact canonical live glass-chrome material specification
    const chromeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf0f4ff,
      metalness: 0.98,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      reflectivity: 1,
      ior: 1.9,
    });

    const emblemMesh = new THREE.Mesh(tubeGeometry, chromeMaterial);
    emblemGroup.add(emblemMesh);
    scene.add(emblemGroup);

    const prefersReducedMotion = false;

    let lastTime = performance.now();
    let lastRenderTime = 0;
    const minFrameIntervalMs = isSoftwareGl
      ? 1000 / 12
      : perfProfile.targetFps > 0
        ? 1000 / Math.min(32, perfProfile.targetFps)
        : 1000 / 20;
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
        emblemGroup.rotation.y += profile.direction * baseSpeed * delta;
        emblemGroup.rotation.x +=
          Math.sin(elapsed * 0.85 + profile.orbitPhaseRad) * profile.tiltAxisRatio * baseSpeed * delta;
        emblemGroup.rotation.z +=
          Math.cos(elapsed * 0.65 + profile.orbitPhaseRad) * 0.55 * baseSpeed * delta;

        const orbitAngle = elapsed * orbitSpeed * profile.direction + profile.orbitPhaseRad;
        emblemGroup.position.x = Math.cos(orbitAngle) * 0.16;
        emblemGroup.position.y = Math.sin(orbitAngle) * 0.16;

        currentTiltX += (targetTiltX - currentTiltX) * 0.1;
        currentTiltY += (targetTiltY - currentTiltY) * 0.1;

        emblemMesh.rotation.x = currentTiltX;
        emblemMesh.rotation.z = currentTiltY * 0.5;

        blueLight.intensity = 3.2 + Math.sin(elapsed * 2.2 + profile.orbitPhaseRad) * 0.9;
        violetLight.intensity = 3.2 + Math.cos(elapsed * 2.2 + profile.orbitPhaseRad) * 0.9;
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
      pmremRenderTarget.dispose();
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
        motionProfile={profile}
      />
    );
  }

  return (
    <div
      data-angel-emblem="true"
      data-motion-seed={profile.seedKey}
      data-motion-instance={profile.instanceSalt}
      data-motion-mode="webgl"
      data-motion-active={isInViewport ? 'true' : 'paused'}
      className={orbitClassName}
      style={orbitStyle}
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
