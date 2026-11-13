import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EmblemSkeleton } from '../ui/Skeleton';

interface AngelEmblem3DProps {
  size?: number;
  className?: string;
  rotationSpeed?: number; // Seconds per revolution
  tiltOnHover?: boolean;
  pointerTracking?: boolean;
}

export const AngelEmblem3D: React.FC<AngelEmblem3DProps> = ({
  size = 130,
  className = '',
  rotationSpeed = 24,
  tiltOnHover = false,
  pointerTracking = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGlError, setHasWebGlError] = useState(false);
  const [isFirstFrameReady, setIsFirstFrameReady] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setHasWebGlError(true);
      setIsFirstFrameReady(true);
      return;
    }

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    // Studio Environment Reflection Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    pmremGenerator.dispose();

    // Lighting Rig with Blue & Violet Environmental Highlights
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 5, 8);
    scene.add(keyLight);

    const blueLight = new THREE.PointLight(0x38bdf8, 4, 15);
    blueLight.position.set(-6, 3, 4);
    scene.add(blueLight);

    const violetLight = new THREE.PointLight(0xa855f7, 4, 15);
    violetLight.position.set(6, -3, 4);
    scene.add(violetLight);

    const hemiLight = new THREE.HemisphereLight(0xe0e7ff, 0x070815, 1.2);
    scene.add(hemiLight);

    // Group for the 3D Metallic Intertwined Trefoil Emblem
    const emblemGroup = new THREE.Group();

    // Custom Trefoil Curve Math for 3D Intertwined Knot
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

    const path = new TrefoilCurve(1.5);
    const tubeGeometry = new THREE.TubeGeometry(path, 128, 0.22, 24, true);

    // Authentic Polished Chrome PBR Material matching angel_logo.png
    const chromeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf0f5ff,
      metalness: 0.98,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
      ior: 1.9,
    });

    const emblemMesh = new THREE.Mesh(tubeGeometry, chromeMaterial);
    emblemGroup.add(emblemMesh);

    scene.add(emblemGroup);

    // Animation Loop with performance.now() timing, reduced-motion, and FPS capping
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId = 0;
    let lastTime = performance.now();
    let lastRenderTime = 0;
    const minFrameIntervalMs = 1000 / 32;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let frameSignaled = false;
    let isVisibleInViewport = true;

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              isVisibleInViewport = entries[0]?.isIntersecting ?? true;
            },
            { threshold: 0.05 }
          )
        : null;
    observer?.observe(container);

    const handleMouseMove = (e: MouseEvent | PointerEvent) => {
      if (!tiltOnHover && !pointerTracking) return;
      const rect = container.getBoundingClientRect();
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
      window.addEventListener('pointermove', handleMouseMove);
    } else if (tiltOnHover) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    const animate = (nowArg?: number) => {
      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(animate);
      }

      const now = typeof nowArg === 'number' ? nowArg : performance.now();
      if (
        frameSignaled &&
        !prefersReducedMotion &&
        (document.hidden || !isVisibleInViewport || now - lastRenderTime < minFrameIntervalMs)
      ) {
        return;
      }
      lastRenderTime = now;

      const delta = Math.min((now - lastTime) * 0.001, 0.1);
      const elapsed = now * 0.001;
      lastTime = now;

      if (!prefersReducedMotion) {
        // Dynamic multi-axis organic motion (horizontal, vertical, diagonal tumbling)
        const baseSpeed = (Math.PI * 2 / rotationSpeed);
        emblemGroup.rotation.y += baseSpeed * delta;
        emblemGroup.rotation.x += Math.sin(elapsed * 0.85) * 0.7 * baseSpeed * delta;
        emblemGroup.rotation.z += Math.cos(elapsed * 0.65) * 0.5 * baseSpeed * delta;

        // Smooth interactive mouse tilt interpolation
        currentTiltX += (targetTiltX - currentTiltX) * 0.1;
        currentTiltY += (targetTiltY - currentTiltY) * 0.1;

        emblemMesh.rotation.x = currentTiltX;
        emblemMesh.rotation.z = currentTiltY * 0.5;

        // Pulsing environmental lights reflecting electric blue & violet specular hues
        blueLight.intensity = 3.2 + Math.sin(elapsed * 2.2) * 1.2;
        violetLight.intensity = 3.2 + Math.cos(elapsed * 2.2) * 1.2;
      }

      renderer.render(scene, camera);

      if (!frameSignaled) {
        frameSignaled = true;
        setIsFirstFrameReady(true);
      }
    };

    animate(performance.now());

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer?.disconnect();
      if (pointerTracking) {
        window.removeEventListener('pointermove', handleMouseMove);
      } else if (tiltOnHover) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      roomEnv.dispose();
      scene.environment?.dispose();
      tubeGeometry.dispose();
      chromeMaterial.dispose();
      renderer.dispose();
    };
  }, [size, rotationSpeed, tiltOnHover, pointerTracking]);

  if (hasWebGlError) {
    // 2D Canvas Fallback
    return (
      <div 
        className={`relative inline-flex items-center justify-center shrink-0 ${className}`} 
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#38bdf8" strokeWidth="4" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="#a855f7" strokeWidth="4" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
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
