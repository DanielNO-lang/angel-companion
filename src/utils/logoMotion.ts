import { useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';

/**
 * Unified logo motion & animation utility for Angel Companion emblems.
 * - Preserves deterministic `getLogoMotionProfile` for seeded calculations/tests.
 * - Provides per-instance randomized circular orbit + 3D spin profiles and CSS/hook
 *   utilities wired directly to `.angel-emblem-orbit` and `.angel-emblem-spin` in index.css.
 */

export const ANGEL_LOGO_ANIMATION_CLASSES = {
  orbit: 'angel-emblem-orbit',
  spin: 'angel-emblem-spin',
} as const;

export interface LogoMotionProfile {
  seedKey: string;
  direction: 1 | -1;
  spinDurationSec: number;
  orbitDurationSec: number;
  orbitRadiusPx: number;
  orbitPhaseRad: number;
  tiltAngleDeg: number;
  phaseDelaySec: number;
  tiltAxisRatio: number;
}

export interface RandomizedLogoMotionProfile extends LogoMotionProfile {
  orbitDirection: 'normal' | 'reverse';
  spinDirection: 'normal' | 'reverse';
  orbitDelaySec: number;
  spinDelaySec: number;
  instanceSalt: string;
}

export interface RandomLogoInstanceFactors {
  orbitDirUnit: number;
  spinDirUnit: number;
  orbitDurationUnit: number;
  spinDurationUnit: number;
  orbitPhaseUnit: number;
  spinPhaseUnit: number;
  orbitRadiusUnit: number;
  tiltUnit: number;
  instanceSalt: string;
}

export interface UnifiedLogoAnimationConfig {
  seed?: string | number;
  rotationSpeed?: number;
  size?: number;
  className?: string;
  spinClassName?: string;
  tiltOnHover?: boolean;
  profile?: RandomizedLogoMotionProfile;
}

export type AngelLogoCssVars = CSSProperties & {
  '--angel-orbit-r'?: string;
  '--angel-orbit-dur'?: string;
  '--angel-orbit-delay'?: string;
  '--angel-orbit-dir'?: string;
  '--angel-spin-dur'?: string;
  '--angel-spin-delay'?: string;
  '--angel-spin-dir'?: string;
};

export interface UnifiedLogoAnimationResult {
  profile: RandomizedLogoMotionProfile;
  orbitClassName: string;
  spinClassName: string;
  orbitStyle: AngelLogoCssVars;
  spinStyle: CSSProperties;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitFloat(seedInt: number, salt: number): number {
  const mixed = Math.imul(seedInt ^ (salt * 0x9e3779b9), 0x85ebca6b) >>> 0;
  return (mixed % 10000) / 10000;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(0.9999, value));
}

export function getLogoMotionProfile(
  seed: string | number = 'angel-default',
  baseSpinDurationSec: number = 18
): LogoMotionProfile {
  const seedKey = String(seed);
  const h = hashSeed(seedKey);

  const dirUnit = unitFloat(h, 1);
  const speedUnit = unitFloat(h, 2);
  const orbitDurUnit = unitFloat(h, 3);
  const orbitRadUnit = unitFloat(h, 4);
  const phaseUnit = unitFloat(h, 5);
  const tiltUnit = unitFloat(h, 6);

  const clampedBase = Math.max(4, Math.min(48, baseSpinDurationSec));
  const spinDurationSec = Number((clampedBase * (0.78 + speedUnit * 0.44)).toFixed(2));
  const orbitDurationSec = Number((5.2 + orbitDurUnit * 3.8).toFixed(2));
  const orbitRadiusPx = Number((2.2 + orbitRadUnit * 2.8).toFixed(2));
  const orbitPhaseRad = Number((phaseUnit * Math.PI * 2).toFixed(3));
  const tiltAngleDeg = Number((8 + tiltUnit * 10).toFixed(1));
  const phaseDelaySec = Number((-phaseUnit * orbitDurationSec).toFixed(2));
  const tiltAxisRatio = Number((0.45 + tiltUnit * 0.45).toFixed(2));

  return {
    seedKey,
    direction: dirUnit >= 0.5 ? 1 : -1,
    spinDurationSec,
    orbitDurationSec,
    orbitRadiusPx,
    orbitPhaseRad,
    tiltAngleDeg,
    phaseDelaySec,
    tiltAxisRatio,
  };
}

export function createRandomInstanceFactors(
  randomFn: () => number = Math.random
): RandomLogoInstanceFactors {
  const rawId = Math.floor(clampUnit(randomFn()) * 0xffffff)
    .toString(36)
    .padStart(4, '0');
  return {
    orbitDirUnit: clampUnit(randomFn()),
    spinDirUnit: clampUnit(randomFn()),
    orbitDurationUnit: clampUnit(randomFn()),
    spinDurationUnit: clampUnit(randomFn()),
    orbitPhaseUnit: clampUnit(randomFn()),
    spinPhaseUnit: clampUnit(randomFn()),
    orbitRadiusUnit: clampUnit(randomFn()),
    tiltUnit: clampUnit(randomFn()),
    instanceSalt: rawId,
  };
}

/**
 * Generates an independent randomized circular orbit + 3D spin profile for a logo instance.
 * Combines base seed properties with per-instance random factors so every mounted logo
 * rotates and orbits at its own independent phase, speed, direction, and radius.
 */
export function createRandomizedLogoMotionProfile(
  seed: string | number = 'angel-default',
  baseSpinDurationSec: number = 18,
  sizePx?: number,
  randomFn: () => number = Math.random,
  fixedFactors?: RandomLogoInstanceFactors
): RandomizedLogoMotionProfile {
  const seedKey = String(seed);
  const seedHash = hashSeed(seedKey);
  const factors = fixedFactors ?? createRandomInstanceFactors(randomFn);

  // Blend per-instance randomness with seed-derived entropy to guarantee distinctness
  const orbitDirMix = (factors.orbitDirUnit + unitFloat(seedHash, 11)) % 1;
  const spinDirMix = (factors.spinDirUnit + unitFloat(seedHash, 13)) % 1;
  const orbitDurMix = clampUnit((factors.orbitDurationUnit * 0.8 + unitFloat(seedHash, 17) * 0.2));
  const spinDurMix = clampUnit((factors.spinDurationUnit * 0.82 + unitFloat(seedHash, 19) * 0.18));
  const orbitPhaseMix = clampUnit(factors.orbitPhaseUnit);
  const spinPhaseMix = clampUnit(factors.spinPhaseUnit);
  const radiusMix = clampUnit(factors.orbitRadiusUnit);
  const tiltMix = clampUnit(factors.tiltUnit);

  const clampedBase = Math.max(4, Math.min(48, baseSpinDurationSec));
  const spinDurationSec = Number((clampedBase * (0.68 + spinDurMix * 0.68)).toFixed(2));
  const orbitDurationSec = Number((4.4 + orbitDurMix * 4.8).toFixed(2));

  const baseRadiusPx =
    typeof sizePx === 'number' && Number.isFinite(sizePx)
      ? Math.max(1.5, Math.min(4.6, sizePx * 0.082))
      : 2.8;
  const orbitRadiusPx = Number(
    Math.max(1.4, Math.min(5.2, baseRadiusPx * (0.75 + radiusMix * 0.55))).toFixed(2)
  );

  // Negative delays start both circular orbit & 3D spin mid-cycle immediately at random phases
  const orbitDelaySec = Number((-orbitPhaseMix * orbitDurationSec).toFixed(2));
  const spinDelaySec = Number((-spinPhaseMix * spinDurationSec).toFixed(2));

  const orbitDirection: 'normal' | 'reverse' = orbitDirMix >= 0.5 ? 'normal' : 'reverse';
  const spinDirection: 'normal' | 'reverse' = spinDirMix >= 0.5 ? 'normal' : 'reverse';

  return {
    seedKey,
    direction: spinDirection === 'normal' ? 1 : -1,
    spinDurationSec,
    orbitDurationSec,
    orbitRadiusPx,
    orbitPhaseRad: Number((orbitPhaseMix * Math.PI * 2).toFixed(3)),
    tiltAngleDeg: Number((8 + tiltMix * 12).toFixed(1)),
    phaseDelaySec: orbitDelaySec,
    orbitDelaySec,
    spinDelaySec,
    orbitDirection,
    spinDirection,
    tiltAxisRatio: Number((0.42 + tiltMix * 0.48).toFixed(2)),
    instanceSalt: factors.instanceSalt,
  };
}

export function buildUnifiedLogoAnimation({
  seed = 'angel-default',
  rotationSpeed = 18,
  size,
  className = '',
  spinClassName = '',
  tiltOnHover = false,
  profile: explicitProfile,
}: UnifiedLogoAnimationConfig = {}): UnifiedLogoAnimationResult {
  const profile =
    explicitProfile ?? createRandomizedLogoMotionProfile(seed, rotationSpeed, size);

  const orbitClassName = [
    ANGEL_LOGO_ANIMATION_CLASSES.orbit,
    'relative inline-flex items-center justify-center shrink-0 select-none',
    tiltOnHover ? 'transition-[scale] duration-300 hover:scale-110' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedSpinClassName = [
    ANGEL_LOGO_ANIMATION_CLASSES.spin,
    spinClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const orbitStyle: AngelLogoCssVars = {
    ...(typeof size === 'number' ? { width: size, height: size } : {}),
    perspective: '220px',
    transformStyle: 'preserve-3d',
    '--angel-orbit-r': `${profile.orbitRadiusPx}px`,
    '--angel-orbit-dur': `${profile.orbitDurationSec}s`,
    '--angel-orbit-delay': `${profile.orbitDelaySec}s`,
    '--angel-orbit-dir': profile.orbitDirection,
    '--angel-spin-dur': `${profile.spinDurationSec}s`,
    '--angel-spin-delay': `${profile.spinDelaySec}s`,
    '--angel-spin-dir': profile.spinDirection,
  };

  const spinStyle: CSSProperties = {
    transformStyle: 'preserve-3d',
  };

  return {
    profile,
    orbitClassName,
    spinClassName: resolvedSpinClassName,
    orbitStyle,
    spinStyle,
  };
}

/**
 * React hook returning stable per-mount randomized `.angel-emblem-orbit` and
 * `.angel-emblem-spin` classes & CSS variable styles for any Angel logo component.
 */
export function useAngelLogoAnimation({
  seed = 'angel-default',
  rotationSpeed = 18,
  size,
  className = '',
  spinClassName = '',
  tiltOnHover = false,
  profile: externalProfile,
}: UnifiedLogoAnimationConfig = {}): UnifiedLogoAnimationResult {
  const factorsRef = useRef<RandomLogoInstanceFactors | null>(null);
  if (!factorsRef.current) {
    factorsRef.current = createRandomInstanceFactors();
  }

  const profile = useMemo(
    () =>
      externalProfile ??
      createRandomizedLogoMotionProfile(
        seed,
        rotationSpeed,
        size,
        Math.random,
        factorsRef.current ?? undefined
      ),
    [externalProfile, seed, rotationSpeed, size]
  );

  return useMemo(
    () =>
      buildUnifiedLogoAnimation({
        seed,
        rotationSpeed,
        size,
        className,
        spinClassName,
        tiltOnHover,
        profile,
      }),
    [seed, rotationSpeed, size, className, spinClassName, tiltOnHover, profile]
  );
}
