import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CompanionOrbState } from '../../types/angel';

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
  const [webGlFailed, setWebGlFailed] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebGlFailed(true);
      return;
    }

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    // Studio Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
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

    // Render loop and state animation logic with reduced-motion and FPS cap
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let animationFrameId = 0;
    const clock = new THREE.Clock();
    let lastRenderTime = 0;
    const minFrameIntervalMs = 1000 / 30;
    let firstFrameRendered = false;

    const animate = (nowArg?: number) => {
      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(animate);
      }
      const now = typeof nowArg === 'number' ? nowArg : performance.now();
      if (firstFrameRendered && !prefersReducedMotion && now - lastRenderTime < minFrameIntervalMs) {
        return;
      }
      lastRenderTime = now;

      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Base Floating Motion
        orbGroup.position.y = Math.sin(elapsed * 1.2) * 0.12;
      }

      // State-Driven Behavior
      if (state === 'idle') {
        coreMat.emissive.setHex(0x38bdf8);
        coreLight.color.setHex(0x38bdf8);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.015;
          particleSystem.rotation.y += 0.008;
          coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 2) * 0.03);
        }
      } else if (state === 'listening') {
        coreMat.emissive.setHex(0x06b6d4);
        coreLight.color.setHex(0x06b6d4);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.03;
          particleSystem.rotation.y += 0.015;
          const pulse = 1.0 + Math.sin(elapsed * 6) * 0.12;
          coreMesh.scale.setScalar(pulse);
        }
      } else if (state === 'thinking') {
        coreMat.emissive.setHex(0xa855f7);
        coreLight.color.setHex(0xa855f7);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.08;
          ringMesh.rotation.y += 0.04;
          particleSystem.rotation.y += 0.05;
          coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 10) * 0.08);
        }
      } else if (state === 'speaking') {
        coreMat.emissive.setHex(0xec4899);
        coreLight.color.setHex(0xec4899);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.035;
          particleSystem.rotation.y += 0.02;
          const wave = 1.0 + Math.abs(Math.sin(elapsed * 8)) * 0.18;
          coreMesh.scale.setScalar(wave);
        }
      } else if (state === 'attention') {
        coreMat.emissive.setHex(0xf59e0b);
        coreLight.color.setHex(0xf59e0b);
        if (!prefersReducedMotion) {
          ringMesh.rotation.z += 0.05;
          const alertPulse = 1.0 + Math.sin(elapsed * 12) * 0.15;
          coreMesh.scale.setScalar(alertPulse);
        }
      }

      renderer.render(scene, camera);
      firstFrameRendered = true;
    };

    animate(performance.now());

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
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
  }, [state, size]);

  const stateLabels: Record<CompanionOrbState, string> = {
    idle: 'Idle',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    attention: 'Attention Signal',
    sleeping: 'Sleeping Resting',
  };

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

        {/* State Badge */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/85 border border-indigo-500/35 backdrop-blur-md text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 shadow-xl">
          <span className={`w-2 h-2 rounded-full ${
            state === 'idle' ? 'bg-cyan-400' :
            state === 'listening' ? 'bg-blue-400 animate-pulse' :
            state === 'thinking' ? 'bg-purple-400 animate-spin' :
            state === 'speaking' ? 'bg-pink-400 animate-bounce' :
            'bg-amber-400 animate-ping'
          }`} />
          <span>{stateLabels[state]}</span>
        </div>
      </div>

      {/* State Switcher Micro Controls */}
      {showControls && onStateChange && (
        <div className="mt-3 flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md text-[10px]">
          {(['idle', 'listening', 'thinking', 'speaking', 'attention'] as CompanionOrbState[]).map((s) => (
            <button
              key={s}
              onClick={() => onStateChange(s)}
              className={`px-2 py-0.5 rounded-lg capitalize transition-all ${
                state === s
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
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
