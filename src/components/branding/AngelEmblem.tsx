import React, { useId, useMemo } from 'react';
import { getLogoMotionProfile } from '../../utils/logoMotion';

interface AngelEmblemProps {
  size?: number;
  className?: string;
  glow?: boolean;
  seed?: string;
  rotationSpeed?: number;
  tiltOnHover?: boolean;
}

interface TrefoilSegment {
  key: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  zMid: number;
  bodyStroke: string;
  rimStroke: string;
  specOpacity: number;
}

/**
 * Generates back-to-front depth-sorted segments sampled directly from the same
 * parametric 3D TrefoilCurve as AngelEmblem3D:
 *   x(τ) = sin(τ) + 2sin(2τ)
 *   y(τ) = cos(τ) - 2cos(2τ)
 *   z(τ) = -sin(3τ)
 */
function buildCanonicalTrefoilSegments(segmentCount = 72): TrefoilSegment[] {
  const samplePoint = (t: number) => {
    const tau = t * Math.PI * 2;
    const rx = (Math.sin(tau) + 2 * Math.sin(2 * tau)) * 0.5;
    const ry = (Math.cos(tau) - 2 * Math.cos(2 * tau)) * 0.5;
    const rz = -Math.sin(3 * tau) * 0.6;

    // Slight 3D perspective pitch/yaw so interwoven over-under crossings read crisply
    const yaw = 0.24;
    const pitch = 0.18;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const xYaw = rx * cosY - rz * sinY;
    const zYaw = rx * sinY + rz * cosY;

    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const yRot = ry * cosP - zYaw * sinP;
    const zRot = ry * sinP + zYaw * cosP;

    const persp = 1 + zRot * 0.14;
    return {
      sx: Number((50 + xYaw * 24.5 * persp).toFixed(2)),
      sy: Number((50 - yRot * 24.5 * persp).toFixed(2)),
      z: zRot,
    };
  };

  const segments: TrefoilSegment[] = [];
  const step = 1 / segmentCount;
  const overlap = step * 0.22;

  for (let i = 0; i < segmentCount; i++) {
    const t0 = i * step;
    const t1 = (i + 1) * step + overlap;
    const p0 = samplePoint(t0);
    const p1 = samplePoint(t1);
    const zMid = (p0.z + p1.z) * 0.5;
    const xNorm = ((p0.sx + p1.sx) * 0.5 - 50) / 36; // [-1, 1]
    const depthNorm = Math.max(0, Math.min(1, (zMid + 0.72) / 1.44));

    // Metallic chrome shading with subtle cyan left rim & violet right rim
    const r = Math.round(200 + depthNorm * 52 - (xNorm < 0 ? Math.abs(xNorm) * 40 : 0));
    const g = Math.round(212 + depthNorm * 40 - (xNorm > 0 ? xNorm * 38 : 0));
    const b = Math.round(234 + depthNorm * 21);
    const bodyStroke = `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)})`;

    const rimStroke =
      depthNorm < 0.36
        ? '#0f172a'
        : xNorm < 0
          ? '#1e3a5f'
          : '#312e81';

    segments.push({
      key: i,
      x1: p0.sx,
      y1: p0.sy,
      x2: p1.sx,
      y2: p1.sy,
      zMid,
      bodyStroke,
      rimStroke,
      specOpacity: Number((0.18 + depthNorm * 0.68).toFixed(2)),
    });
  }

  return segments.sort((a, b) => a.zMid - b.zMid);
}

const CANONICAL_TREFOIL_SEGMENTS = buildCanonicalTrefoilSegments(72);

/**
 * Canonical GPU-composited metallic chrome 3D trefoil emblem.
 * Uses the exact parametric TrefoilCurve silhouette and depth-sorted crossings of AngelEmblem3D
 * with deterministic circular orbital motion and multi-axis rotation for compact surfaces.
 */
export const AngelEmblem: React.FC<AngelEmblemProps> = ({
  size = 36,
  className = '',
  glow = true,
  seed = 'emblem-compact',
  rotationSpeed = 14,
  tiltOnHover = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const profile = useMemo(() => getLogoMotionProfile(seed, rotationSpeed), [seed, rotationSpeed]);
  const orbitRadius = Math.max(1.5, Math.min(4.5, Math.round(size * 0.09)));

  const orbitStyle = {
    '--angel-orbit-r': `${orbitRadius}px`,
    '--angel-orbit-dur': `${profile.orbitDurationSec}s`,
    '--angel-orbit-delay': `${profile.phaseDelaySec}s`,
    '--angel-spin-dur': `${profile.spinDurationSec}s`,
    '--angel-spin-dir': profile.direction === 1 ? 'normal' : 'reverse',
  } as React.CSSProperties;

  return (
    <div
      data-angel-emblem="true"
      data-motion-seed={profile.seedKey}
      data-motion-mode="svg-orbit"
      className={`angel-emblem-orbit relative inline-flex items-center justify-center shrink-0 select-none ${
        tiltOnHover ? 'transition-transform duration-300 hover:scale-110' : ''
      } ${className}`}
      style={{ width: size, height: size, perspective: '220px', transformStyle: 'preserve-3d', ...orbitStyle }}
    >
      {/* Subtle aura glow */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-60 animate-pulse-glow pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(56, 189, 248, 0.5) 0%, rgba(168, 85, 247, 0.32) 55%, transparent 80%)',
          }}
        />
      )}

      {/* Continuous 3D-rotating canonical TrefoilCurve silhouette */}
      <svg
        viewBox="0 0 100 100"
        className="angel-emblem-spin relative w-full h-full drop-shadow-[0_2px_10px_rgba(56,189,248,0.45)]"
        style={{ transformStyle: 'preserve-3d' }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`chromeOverlay-${uid}`} x1="6%" y1="6%" x2="94%" y2="94%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.32" />
          </linearGradient>
        </defs>

        <g>
          {CANONICAL_TREFOIL_SEGMENTS.map((seg) => (
            <g key={seg.key}>
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={seg.rimStroke}
                strokeWidth="10.8"
                strokeLinecap="round"
              />
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={seg.bodyStroke}
                strokeWidth="8.2"
                strokeLinecap="round"
              />
              <line
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke="#ffffff"
                strokeOpacity={seg.specOpacity}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>

        <circle
          cx="50"
          cy="50"
          r="38"
          fill={`url(#chromeOverlay-${uid})`}
          opacity="0.16"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
};
