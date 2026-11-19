import React, { useId } from 'react';
import {
  useAngelLogoAnimation,
  type RandomizedLogoMotionProfile,
} from '../../utils/logoMotion';

interface AngelEmblemProps {
  size?: number;
  className?: string;
  glow?: boolean;
  seed?: string;
  rotationSpeed?: number;
  tiltOnHover?: boolean;
  motionProfile?: RandomizedLogoMotionProfile;
}

interface TrefoilPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Samples points along the exact parametric 3D TrefoilCurve used in AngelEmblem3D:
 *   x(τ) = sin(τ) + 2sin(2τ)
 *   y(τ) = cos(τ) - 2cos(2τ)
 *   z(τ) = -sin(3τ)
 */
function sampleTrefoilPoint(t: number): TrefoilPoint {
  const tau = t * Math.PI * 2;
  const rx = (Math.sin(tau) + 2 * Math.sin(2 * tau)) * 0.5;
  const ry = (Math.cos(tau) - 2 * Math.cos(2 * tau)) * 0.5;
  const rz = -Math.sin(3 * tau) * 0.6;

  // Match live emblem camera angle so the symmetric 3-lobe intertwined knot reads cleanly
  const yaw = 0.22;
  const pitch = 0.16;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const xYaw = rx * cosY - rz * sinY;
  const zYaw = rx * sinY + rz * cosY;

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const yRot = ry * cosP - zYaw * sinP;
  const zRot = ry * sinP + zYaw * cosP;

  const persp = 1 + zRot * 0.13;
  return {
    x: Number((50 + xYaw * 24.8 * persp).toFixed(2)),
    y: Number((50 - yRot * 24.8 * persp).toFixed(2)),
    z: zRot,
  };
}

/**
 * Builds a smooth closed SVG quadratic-midpoint path from dense curve samples so there are zero
 * notched line-segment artifacts.
 */
function buildClosedSmoothPath(samples: number = 144): string {
  const pts: TrefoilPoint[] = [];
  for (let i = 0; i < samples; i++) {
    pts.push(sampleTrefoilPoint(i / samples));
  }
  const cmds: string[] = [];
  const startMidX = ((pts[samples - 1].x + pts[0].x) * 0.5).toFixed(2);
  const startMidY = ((pts[samples - 1].y + pts[0].y) * 0.5).toFixed(2);
  cmds.push(`M ${startMidX} ${startMidY}`);

  for (let i = 0; i < samples; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % samples];
    const midX = ((p.x + next.x) * 0.5).toFixed(2);
    const midY = ((p.y + next.y) * 0.5).toFixed(2);
    cmds.push(`Q ${p.x} ${p.y} ${midX} ${midY}`);
  }
  cmds.push('Z');
  return cmds.join(' ');
}

/**
 * Extracts the three continuous foreground over-crossing spans (z > 0.12) to give authentic
 * over-under glass-chrome knot depth without broken notches.
 */
function buildOverCrossingPaths(samples: number = 180): string[] {
  const pts: TrefoilPoint[] = [];
  for (let i = 0; i < samples; i++) {
    pts.push(sampleTrefoilPoint(i / samples));
  }

  const spans: TrefoilPoint[][] = [];
  let current: TrefoilPoint[] = [];
  for (let i = 0; i < samples; i++) {
    if (pts[i].z > 0.08) {
      current.push(pts[i]);
    } else if (current.length > 0) {
      spans.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    if (spans.length > 0 && pts[0].z > 0.08) {
      spans[0] = [...current, ...spans[0]];
    } else {
      spans.push(current);
    }
  }

  return spans
    .filter((s) => s.length >= 4)
    .map((span) => {
      const cmds = [`M ${span[0].x} ${span[0].y}`];
      for (let i = 1; i < span.length - 1; i++) {
        const midX = ((span[i].x + span[i + 1].x) * 0.5).toFixed(2);
        const midY = ((span[i].y + span[i + 1].y) * 0.5).toFixed(2);
        cmds.push(`Q ${span[i].x} ${span[i].y} ${midX} ${midY}`);
      }
      const last = span[span.length - 1];
      cmds.push(`L ${last.x} ${last.y}`);
      return cmds.join(' ');
    });
}

const CANONICAL_CLOSED_PATH = buildClosedSmoothPath(144);
const CANONICAL_OVER_SPANS = buildOverCrossingPaths(180);

/**
 * Canonical silver-chrome glass Angel emblem in SVG form.
 * Shares exact parametric TrefoilCurve silhouette and continuous ribbon speculars with AngelEmblem3D.
 */
export const AngelEmblem: React.FC<AngelEmblemProps> = ({
  size = 36,
  className = '',
  glow = false,
  seed = 'emblem-compact',
  rotationSpeed = 14,
  tiltOnHover = true,
  motionProfile,
}) => {
  const uid = useId().replace(/:/g, '');
  const { profile, orbitClassName, spinClassName, orbitStyle, spinStyle } = useAngelLogoAnimation({
    seed,
    rotationSpeed,
    size,
    className,
    spinClassName: 'relative w-full h-full drop-shadow-[0_2px_10px_rgba(224,242,254,0.35)]',
    tiltOnHover,
    profile: motionProfile,
  });

  return (
    <div
      data-angel-emblem="true"
      data-motion-seed={profile.seedKey}
      data-motion-instance={profile.instanceSalt}
      data-motion-mode="svg-orbit"
      className={orbitClassName}
      style={orbitStyle}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(224, 242, 254, 0.35) 0%, rgba(196, 181, 253, 0.2) 55%, transparent 80%)',
          }}
        />
      )}

      <svg
        viewBox="0 0 100 100"
        className={spinClassName}
        style={spinStyle}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`glassEdge-${uid}`} x1="8%" y1="6%" x2="92%" y2="94%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="35%" stopColor="#475569" />
            <stop offset="68%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id={`glassCore-${uid}`} x1="12%" y1="8%" x2="88%" y2="92%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="28%" stopColor="#e2e8f0" />
            <stop offset="56%" stopColor="#c7d2fe" />
            <stop offset="82%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>
          <linearGradient id={`glassSpec-${uid}`} x1="18%" y1="10%" x2="82%" y2="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
            <stop offset="50%" stopColor="#f8fafc" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.92" />
          </linearGradient>
        </defs>

        {/* Continuous smooth under-pass ribbon */}
        <path
          d={CANONICAL_CLOSED_PATH}
          stroke={`url(#glassEdge-${uid})`}
          strokeWidth="10.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={CANONICAL_CLOSED_PATH}
          stroke={`url(#glassCore-${uid})`}
          strokeWidth="8.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={CANONICAL_CLOSED_PATH}
          stroke={`url(#glassSpec-${uid})`}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Woven foreground over-crossing spans */}
        {CANONICAL_OVER_SPANS.map((spanPath, idx) => (
          <g key={idx}>
            <path
              d={spanPath}
              stroke="#1e293b"
              strokeOpacity="0.45"
              strokeWidth="11.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={spanPath}
              stroke={`url(#glassCore-${uid})`}
              strokeWidth="8.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={spanPath}
              stroke="#ffffff"
              strokeOpacity="0.92"
              strokeWidth="3.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
