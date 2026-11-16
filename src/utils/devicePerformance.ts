/**
 * Adaptive device capability & performance tier classification.
 * Combines WebGL availability, software-rasterizer detection, hardware concurrency,
 * device memory, viewport size, and reduced-motion preference so visuals scale gracefully
 * without sacrificing clarity or interactivity.
 */

export type DevicePerformanceTier = 'high' | 'mid' | 'low';

export interface DeviceCapabilitySignals {
  prefersReducedMotion: boolean;
  webglSupported: boolean;
  rendererString?: string;
  hardwareConcurrency?: number | null;
  deviceMemoryGb?: number | null;
  viewportWidth?: number;
}

export interface DevicePerformanceProfile {
  tier: DevicePerformanceTier;
  prefersReducedMotion: boolean;
  webglSupported: boolean;
  isSoftwareRenderer: boolean;
  useWebGlForPrimaryEmblems: boolean;
  maxDpr: number;
  targetFps: number;
  starCount: number;
  maxCelestialBodies: number;
  cloudCount: number;
  emblemTubeSegments: number;
  emblemRadialSegments: number;
  allowBackdropHeavyBlur: boolean;
}

const SOFTWARE_GL_REGEX = /SwiftShader|llvmpipe|softpipe|Software Adapter|Microsoft Basic Render/i;

export function evaluateDevicePerformanceTier(
  signals: DeviceCapabilitySignals
): DevicePerformanceProfile {
  const renderer = signals.rendererString || '';
  const isSoftwareRenderer = SOFTWARE_GL_REGEX.test(renderer);
  const cores = typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency > 0
    ? signals.hardwareConcurrency
    : null;
  const mem = typeof signals.deviceMemoryGb === 'number' && signals.deviceMemoryGb > 0
    ? signals.deviceMemoryGb
    : null;
  const isNarrowViewport = typeof signals.viewportWidth === 'number' && signals.viewportWidth > 0 && signals.viewportWidth < 768;

  let tier: DevicePerformanceTier = 'high';

  if (
    signals.prefersReducedMotion ||
    !signals.webglSupported ||
    isSoftwareRenderer ||
    (cores !== null && cores <= 2) ||
    (mem !== null && mem <= 2)
  ) {
    tier = 'low';
  } else if (
    isNarrowViewport ||
    (cores !== null && cores <= 4) ||
    (mem !== null && mem <= 4)
  ) {
    tier = 'mid';
  }

  if (tier === 'low') {
    return {
      tier,
      prefersReducedMotion: signals.prefersReducedMotion,
      webglSupported: signals.webglSupported,
      isSoftwareRenderer,
      useWebGlForPrimaryEmblems: signals.webglSupported && !signals.prefersReducedMotion,
      maxDpr: 1,
      targetFps: signals.prefersReducedMotion ? 0 : isSoftwareRenderer ? 20 : 18,
      starCount: 60,
      maxCelestialBodies: 1,
      cloudCount: 4,
      emblemTubeSegments: 44,
      emblemRadialSegments: 12,
      allowBackdropHeavyBlur: false,
    };
  }

  if (tier === 'mid') {
    return {
      tier,
      prefersReducedMotion: signals.prefersReducedMotion,
      webglSupported: signals.webglSupported,
      isSoftwareRenderer,
      useWebGlForPrimaryEmblems: signals.webglSupported,
      maxDpr: 1.5,
      targetFps: 26,
      starCount: 110,
      maxCelestialBodies: 2,
      cloudCount: 6,
      emblemTubeSegments: 64,
      emblemRadialSegments: 14,
      allowBackdropHeavyBlur: true,
    };
  }

  return {
    tier,
    prefersReducedMotion: signals.prefersReducedMotion,
    webglSupported: signals.webglSupported,
    isSoftwareRenderer,
    useWebGlForPrimaryEmblems: signals.webglSupported,
    maxDpr: 2,
    targetFps: 34,
    starCount: 165,
    maxCelestialBodies: 2,
    cloudCount: 9,
    emblemTubeSegments: 84,
    emblemRadialSegments: 18,
    allowBackdropHeavyBlur: true,
  };
}

let cachedBrowserSignals: {
  webglSupported: boolean;
  rendererString: string;
} | null = null;

function probeBrowserWebGlOnce(): { webglSupported: boolean; rendererString: string } {
  if (cachedBrowserSignals) return cachedBrowserSignals;
  if (typeof document === 'undefined') {
    cachedBrowserSignals = { webglSupported: false, rendererString: '' };
    return cachedBrowserSignals;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      cachedBrowserSignals = { webglSupported: false, rendererString: '' };
      return cachedBrowserSignals;
    }

    let rendererString = '';
    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        rendererString = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
    } catch {
      rendererString = '';
    }

    // Release temporary probe context cleanly
    try {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // Ignore if unsupported
    }

    cachedBrowserSignals = { webglSupported: true, rendererString };
    return cachedBrowserSignals;
  } catch {
    cachedBrowserSignals = { webglSupported: false, rendererString: '' };
    return cachedBrowserSignals;
  }
}

export function getDevicePerformanceProfile(): DevicePerformanceProfile {
  if (typeof window === 'undefined') {
    return evaluateDevicePerformanceTier({
      prefersReducedMotion: false,
      webglSupported: false,
    });
  }

  const prefersReducedMotion = Boolean(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  const webgl = probeBrowserWebGlOnce();
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;

  return evaluateDevicePerformanceTier({
    prefersReducedMotion,
    webglSupported: webgl.webglSupported,
    rendererString: webgl.rendererString,
    hardwareConcurrency: nav?.hardwareConcurrency ?? null,
    deviceMemoryGb: nav?.deviceMemory ?? null,
    viewportWidth: window.innerWidth,
  });
}

export function resetDevicePerformanceCacheForTests(): void {
  cachedBrowserSignals = null;
}
