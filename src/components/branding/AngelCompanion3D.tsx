import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CompanionOrbState } from '../../types/angel';
import { RenderLoopController } from '../../utils/renderLoopVisibility';
import { getDevicePerformanceProfile } from '../../utils/devicePerformance';

interface AngelCompanion3DProps {
  state?: CompanionOrbState;
  onStateChange?: (newState: CompanionOrbState) => void;
  size?: number;
  className?: string;
  showControls?: boolean;
}

export const AngelCompanion3D: React.FC<AngelCompanion3DProps> = ({
  state = 'idle',
  onStateChange,
  size = 180,
  className = '',
  showControls = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<CompanionOrbState>(state);
  const [webGlFailed, setWebGlFailed] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const perf = getDevicePerformanceProfile();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: perf.tier !== 'low',
        alpha: true,
        powerPreference: perf.tier === 'high' ? 'high-performance' : 'default',
      });
    } catch {
      setWebGlFailed(true);
      return;
    }

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perf.maxDpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    // Studio Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    pmremGenerator.dispose();

    // Lighting
    const coreLight = new THREE.PointLight(0x38bdf8, 5, 10);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(4, 4, 6);
    scene.add(keyLight);

    // Group holding the entire Companion Orb setup
    const orbGroup = new THREE.Group();

    // 1. Core Energy Sphere
    const coreGeom = new THREE.SphereGeometry(0.8, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    orbGroup.add(coreMesh);

    // 2. Interior Core Particle Matrix
    const particleCount = 120;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 0.7 * Math.cbrt(Math.random());
      particlePositions[i] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i + 2] = r * Math.cos(phi);
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.04,
      transparent: true,
      opacity: 0.8,
    });
    const particleSystem = new THREE.Points(particleGeom, particleMat);
    orbGroup.add(particleSystem);

    // 3. Outer Crystal Glass Shell
    const shellGeom = new THREE.SphereGeometry(1.3, 48, 48);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.9,
      opacity: 1.0,
      transparent: true,
      ior: 1.5,
      thickness: 1.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.9,
    });
    const shellMesh = new THREE.Mesh(shellGeom, shellMat);
    orbGroup.add(shellMesh);

    // 4. Orbital Metallic Ring
    const ringGeom = new THREE.TorusGeometry(1.8, 0.04, 16, 64);
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      metalness: 0.95,
      roughness: 0.15,
      clearcoat: 1.0,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    orbGroup.add(ringMesh);

    // Satellite Orbiter
    const satGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const satMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.5,
    });
    const satellite = new THREE.Mesh(satGeom, satMat);
    ringMesh.add(satellite);
    satellite.position.set(1.8, 0, 0);

    scene.add(orbGroup);

    // Render loop controlled by RenderLoopController (pauses completely when hidden or offscreen)
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const startTimeMs = performance.now();
    let lastRenderTime = 0;
    const minFrameIntervalMs = 1000 / 30;
    let firstFrameRendered = false;

    const renderFrame = (nowArg: number) => {
      const now = typeof nowArg === 'number' ? nowArg : performance.now();
      if (firstFrameRendered && !prefersReducedMotion && now - lastRenderTime < minFrameIntervalMs) {
        return;
      }
      lastRenderTime = now;

      const elapsed = (now - startTimeMs) * 0.001;
      const activeState = stateRef.current;

      if (!prefersReducedMotion) {
        orbGroup.position.y = Math.sin(elapsed * 1.2) * 0.12;
      }

      if (activeState === 'idle') {
        coreMat.emissive.setHex(0x38bdf8);
        coreLight.color.setHex(0x38bdf8);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.015;
          particleSystem.rotation.y += 0.008;
          coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 2) * 0.03);
        }
      } else if (activeState === 'listening') {
        coreMat.emissive.setHex(0x06b6d4);
        coreLight.color.setHex(0x06b6d4);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.03;
          particleSystem.rotation.y += 0.015;
          coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 6) * 0.12);
        }
      } else if (activeState === 'thinking') {
        coreMat.emissive.setHex(0xa855f7);
        coreLight.color.setHex(0xa855f7);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.08;
          ringMesh.rotation.y += 0.04;
          particleSystem.rotation.y += 0.05;
          coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 10) * 0.08);
        }
      } else if (activeState === 'speaking') {
        coreMat.emissive.setHex(0xec4899);
        coreLight.color.setHex(0xec4899);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.035;
          particleSystem.rotation.y += 0.02;
          coreMesh.scale.setScalar(1.0 + Math.abs(Math.sin(elapsed * 8)) * 0.18);
        }
      } else if (activeState === 'attention') {
        coreMat.emissive.setHex(0xf59e0b);
        coreLight.color.setHex(0xf59e0b);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.05;
          coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 12) * 0.15);
        }
      }

      renderer.render(scene, camera);
      firstFrameRendered = true;
    };

    const loopController = new RenderLoopController({
      reducedMotion: Boolean(prefersReducedMotion),
      onFrame: renderFrame,
    });

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              loopController.setViewportVisible(entries[0]?.isIntersecting ?? true);
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

    // Render immediate first frame and start loop when visible
    renderFrame(performance.now());
    loopController.start();

    return () => {
      loopController.dispose();
      observer?.disconnect();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      roomEnv.dispose();
      scene.environment?.dispose();
      coreGeom.dispose();
      shellGeom.dispose();
      ringGeom.dispose();
      satGeom.dispose();
      particleGeom.dispose();
      coreMat.dispose();
      shellMat.dispose();
      ringMat.dispose();
      satMat.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* 3D Render Canvas Mount */}
      <div className="relative group cursor-pointer" title="Angel Companion Orb">
        {webGlFailed ? (
          <div className="w-32 h-32 rounded-full bg-indigo-900/40 border border-indigo-500/50 flex items-center justify-center text-xs font-bold text-indigo-300">
            Orb Fallback
          </div>
        ) : (
          <div ref={mountRef} />
        )}

      </div>
    </div>
  );
};
