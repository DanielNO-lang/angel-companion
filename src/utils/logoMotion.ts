/**
 * Deterministic seeded motion profile for Angel Companion emblems.
 * Produces varied circular orbital paths and 3D rotation directions/speeds
 * that remain stable across React re-renders.
 */

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
