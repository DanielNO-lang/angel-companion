import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getDevicePerformanceProfile } from '../../utils/devicePerformance';

export interface CosmicTelemetryData {
  title: string;
  type: string;
  prompt: string;
  detail: string;
}

export interface CosmicEnvironmentProps {
  onSelectSpaceObject?: (data: CosmicTelemetryData) => void;
}

type Planet3DType = 'sun' | 'saturn' | 'earth' | 'moon';

const isPlanet3DType = (type: CelestialObject['type']): type is Planet3DType =>
  type === 'sun' || type === 'saturn' || type === 'earth' || type === 'moon';

interface CelestialObject {
  id: number;
  type: 'sun' | 'saturn' | 'earth' | 'moon' | 'satellite' | 'spacerock';
  specificName?: string;
  x: number;
  y: number;
  baseRadius: number;
  currentScale: number;
  targetScale: number;
  scaleSpeed: number;
  alpha: number;
  targetAlpha: number;
  fadeSpeed: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  axialAngle: number;
  axialSpeed: number;
  lifespan: number;
  age: number;
  flarePhase: number;
}

const PLANET_SAMPLE_SPECS: Record<
  Planet3DType,
  { cx: number; cy: number; radius: number; sampleRotationRad: number }
> = {
  earth: { cx: 0.5, cy: 0.5, radius: 0.375, sampleRotationRad: 0 },
  moon: { cx: 0.5, cy: 0.5, radius: 0.395, sampleRotationRad: 0 },
  sun: { cx: 0.5, cy: 0.5, radius: 0.305, sampleRotationRad: 0 },
  saturn: { cx: 0.5, cy: 0.495, radius: 0.145, sampleRotationRad: -0.54 },
};

function buildEquirectangularPlanetCanvas(
  img: HTMLImageElement,
  type: Planet3DType,
  texW: number,
  texH: number
): HTMLCanvasElement | null {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return null;
  srcCtx.drawImage(img, 0, 0, w, h);
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = texW;
  outCanvas.height = texH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return null;
  const outImg = outCtx.createImageData(texW, texH);
  const outData = outImg.data;

  const spec = PLANET_SAMPLE_SPECS[type];
  const cosRot = Math.cos(spec.sampleRotationRad);
  const sinRot = Math.sin(spec.sampleRotationRad);

  const sampleBilinear = (nx: number, ny: number): [number, number, number] => {
    const px = Math.max(0, Math.min(w - 1.001, nx * (w - 1)));
    const py = Math.max(0, Math.min(h - 1.001, ny * (h - 1)));
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = Math.min(w - 1, x0 + 1);
    const y1 = Math.min(h - 1, y0 + 1);
    const fx = px - x0;
    const fy = py - y0;

    const i00 = (y0 * w + x0) * 4;
    const i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4;
    const i11 = (y1 * w + x1) * 4;

    const r =
      srcData[i00] * (1 - fx) * (1 - fy) +
      srcData[i10] * fx * (1 - fy) +
      srcData[i01] * (1 - fx) * fy +
      srcData[i11] * fx * fy;
    const g =
      srcData[i00 + 1] * (1 - fx) * (1 - fy) +
      srcData[i10 + 1] * fx * (1 - fy) +
      srcData[i01 + 1] * (1 - fx) * fy +
      srcData[i11 + 1] * fx * fy;
    const b =
      srcData[i00 + 2] * (1 - fx) * (1 - fy) +
      srcData[i10 + 2] * fx * (1 - fy) +
      srcData[i01 + 2] * (1 - fx) * fy +
      srcData[i11 + 2] * fx * fy;

    return [r, g, b];
  };

  for (let y = 0; y < texH; y++) {
    const v = (y + 0.5) / texH;
    const theta = v * Math.PI; // 0 (north pole) -> PI (south pole)
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x < texW; x++) {
      const u = (x + 0.5) / texW;
      // Fold longitude smoothly across front/back hemispheres so zero seam & zero black borders
      const lon = (u - 0.5) * Math.PI * 2;
      const sx = sinTheta * Math.sin(lon);
      const sy = -cosTheta;

      // Mirror-compressed radial disc coord so limb stays strictly inside visible planetary disc
      const rDisc = Math.hypot(sx, sy);
      const scale = rDisc > 0.94 ? 0.94 / rDisc : 1;
      const discX = sx * scale;
      const discY = sy * scale;

      const rotX = discX * cosRot - discY * sinRot;
      const rotY = discX * sinRot + discY * cosRot;

      const sampleX = spec.cx + rotX * spec.radius;
      const sampleY = spec.cy + rotY * spec.radius;
      let [r, g, b] = sampleBilinear(sampleX, sampleY);

      if (type === 'earth' && r + g + b < 42) {
        // Ensure night-side corner pixels within earth disc retain rich oceanic blue
        r = Math.max(r, 14);
        g = Math.max(g, 38);
        b = Math.max(b, 84);
      }

      const outIdx = (y * texW + x) * 4;
      outData[outIdx] = Math.round(r);
      outData[outIdx + 1] = Math.round(g);
      outData[outIdx + 2] = Math.round(b);
      outData[outIdx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

function buildSaturnRingProfileCanvas(img: HTMLImageElement): HTMLCanvasElement | null {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return null;
  srcCtx.drawImage(img, 0, 0, w, h);
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const outW = 128;
  const outH = 8;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return null;
  const outImg = outCtx.createImageData(outW, outH);
  const outData = outImg.data;

  // Sample unshadowed upper-right ansa along the equatorial ring plane (-0.54 rad)
  const dirX = Math.cos(-0.54);
  const dirY = Math.sin(-0.54);

  for (let uIdx = 0; uIdx < outW; uIdx++) {
    const t = uIdx / (outW - 1);
    const rNorm = 0.215 + t * (0.41 - 0.215);
    const sx = Math.max(0, Math.min(w - 1, Math.round((0.5 + dirX * rNorm) * (w - 1))));
    const sy = Math.max(0, Math.min(h - 1, Math.round((0.495 + dirY * rNorm) * (h - 1))));
    const srcIdx = (sy * w + sx) * 4;

    const r = srcData[srcIdx];
    const g = srcData[srcIdx + 1];
    const b = srcData[srcIdx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const edgeTaper = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    const gapAlpha = lum < 24 ? (lum / 24) * 0.25 : Math.min(0.92, (lum / 210) * 0.92);
    const alpha = Math.round(Math.max(0, Math.min(255, gapAlpha * (0.35 + 0.65 * edgeTaper) * 255)));

    for (let yIdx = 0; yIdx < outH; yIdx++) {
      const outIdx = (yIdx * outW + uIdx) * 4;
      outData[outIdx] = r;
      outData[outIdx + 1] = g;
      outData[outIdx + 2] = b;
      outData[outIdx + 3] = alpha;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface CanvasRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

const SATELLITE_NAMES = [
  'International Space Station (ISS)',
  'James Webb Space Telescope (JWST)',
  'Hubble Space Telescope (HST)',
  'Voyager 1 Interstellar Probe',
];

export const getTelemetryForObject = (
  type: CelestialObject['type'] | 'shootingstar',
  specificName?: string
): CosmicTelemetryData => {
  if (type === 'moon') {
    return {
      title: "Earth's Moon (Luna)",
      type: "Lunar Body",
      prompt: "Tell me live astronomical and orbital details about the Moon passing by right now.",
      detail: "🌕 **Real-Time Lunar Telemetry & Scientific Overview**\n\n- **Orbital Distance**: ~384,400 km from Earth (1.28 light-seconds away).\n- **Orbital Velocity**: 1.022 km/s (3,679 km/h).\n- **Surface Environment**: Extreme temperature range from -130°C (-208°F) during lunar night to +120°C (+248°F) at lunar noon.\n- **Geological Structure**: Composed of a small metallic iron core, mantle rich in pyroxene/olivine, and a regolith crust heavily pitted by impact craters like Tycho and Copernicus.\n- **Tidal Locking**: The Moon is tidally locked to Earth, meaning the same face always points toward us while driving ocean tides across Earth's seas.\n- **Current Mission Context**: Artemis program lunar gateway operations are actively analyzing polar ice deposits in permanently shadowed craters at the South Pole!"
    };
  }

  if (type === 'sun') {
    return {
      title: "The Sun (Sol - Yellow Dwarf Star)",
      type: "Solar Star",
      prompt: "Give me real-time solar physics data and solar flare information about the Sun.",
      detail: "☀️ **Real-Time Solar Telemetry & Stellar Physics**\n\n- **Spectral Classification**: G2V Main-Sequence Yellow Dwarf Star.\n- **Core Temperature**: ~15.7 million °C (28 million °F), sustaining hydrogen-to-helium nuclear fusion.\n- **Surface Temperature**: ~5,500°C (9,932°F) across the photosphere.\n- **Solar Wind Velocity**: Streams outward at 400 to 750 km/s, carrying ionized coronal mass ejections (CMEs) across the heliosphere.\n- **Light Travel Time**: Photon emission takes approximately 8 minutes and 20 seconds to reach Earth.\n- **Solar Dynamics**: Currently in Solar Cycle 25 near peak solar maximum, exhibiting heightened sunspot activity, coronal loops, and intense UV solar flare eruptions!"
    };
  }

  if (type === 'saturn') {
    return {
      title: "Saturn & Ring System",
      type: "Gas Giant",
      prompt: "What are the fascinating real-time facts and astronomical data about Saturn?",
      detail: "🪐 **Real-Time Saturnian Telemetry & Planetary Analysis**\n\n- **Ring System Radius**: Extends up to 282,000 km from the planet, composed of 99% pure water ice particles ranging from micrometers to mountain-sized boulders.\n- **Moons**: 146 confirmed moons, headlined by **Titan** (with dense nitrogen atmosphere and liquid methane lakes) and **Enceladus** (with sub-surface liquid oceans venting ice geysers).\n- **Rotation Rate**: Rapid 10-hour 33-minute day creates strong centrifugal forces, flattening the poles and stretching the equator.\n- **Hexagonal Polar Wave**: A persistent 30,000 km-wide hexagonal jet-stream storm swirls at Saturn's north pole.\n- **Density**: Less dense than water—if a tub large enough existed, Saturn would float!"
    };
  }

  if (type === 'earth') {
    return {
      title: "Planet Earth (Terra)",
      type: "Terrestrial Planet",
      prompt: "Give me real-time planetary data and orbital telemetry for Planet Earth.",
      detail: "🌍 **Real-Time Planetary Telemetry — Planet Earth**\n\n- **Orbital Speed**: 29.78 km/s (107,200 km/h) around Sol.\n- **Atmospheric Shielding**: 78% Nitrogen, 21% Oxygen, protecting surface life via the ozone layer and greenhouse thermoregulation.\n- **Magnetosphere**: Generated by a liquid outer iron core dynamo, deflecting solar energetic particles and generating aurora borealis/australis light displays.\n- **Surface Composition**: 70.8% covered by liquid oceans, regulating global climate and supporting millions of biological ecosystems."
    };
  }

  if (type === 'satellite') {
    const sName = specificName || 'International Space Station (ISS)';
    if (sName.includes('James Webb')) {
      return {
        title: "James Webb Space Telescope (JWST)",
        type: "Space Telescope",
        prompt: "What real-time data and scientific breakthroughs do we have on the James Webb Space Telescope?",
        detail: "🔭 **Real-Time Telemetry — James Webb Space Telescope (JWST)**\n\n- **Position**: Stationed at Sun-Earth Lagrange Point L2 (~1.5 million km from Earth).\n- **Primary Mirror**: 6.5-meter diameter hexagonal beryllium mirror coated in 24-karat gold for ultra-sensitive infrared light collection.\n- **Sunshield**: 5-layer kapton sunshield maintaining cryo-temperatures below -233°C (-388°F).\n- **Scientific Capabilities**: Imaging the earliest galaxies formed 13.5 billion years ago shortly after the Big Bang, inspecting exoplanet atmospheric spectra, and probing star-forming nebulae in deep space."
      };
    }
    if (sName.includes('Hubble')) {
      return {
        title: "Hubble Space Telescope (HST)",
        type: "Space Telescope",
        prompt: "Tell me about the Hubble Space Telescope's current orbit and astronomical achievements.",
        detail: "📡 **Real-Time Telemetry — Hubble Space Telescope (HST)**\n\n- **Orbital Altitude**: ~535 km in Low Earth Orbit.\n- **Observation History**: Operating continuously since 1990, completing over 1.5 million deep space observations.\n- **Optics**: 2.4-meter primary mirror capturing high-resolution optical, ultraviolet, and near-infrared astronomy.\n- **Key Breakthroughs**: Pinpointing the rate of expansion of the universe (Hubble Constant), confirming supermassive black holes at galactic centers, and capturing iconic images like the Pillars of Creation."
      };
    }
    if (sName.includes('Voyager')) {
      return {
        title: "Voyager 1 Interstellar Probe",
        type: "Deep Space Probe",
        prompt: "Give me live telemetry on Voyager 1 as it travels through interstellar space.",
        detail: "🚀 **Live Telemetry — Voyager 1 Interstellar Spacecraft**\n\n- **Distance from Earth**: >24 billion km (>162 Astronomical Units), making it the most distant human-made object in history.\n- **Velocity**: Cruising through interstellar space at ~61,200 km/h (17 km/s).\n- **Golden Record**: Carrying a gold-plated copper phonograph record containing sounds, greetings in 55 languages, and encoded images of Earth.\n- **Interstellar Science**: Actively sending back direct measurements of interstellar plasma density, cosmic rays, and interstellar magnetic fields beyond the Sun's heliopause!"
      };
    }

    return {
      title: "International Space Station (ISS)",
      type: "Orbital Space Station",
      prompt: "Tell me live telemetry and orbital information about the International Space Station passing overhead.",
      detail: "🛰️ **Live Telemetry — International Space Station (ISS)**\n\n- **Orbital Altitude**: ~418 km above Earth's surface.\n- **Orbital Velocity**: ~27,600 km/h (7.66 km/s), completing a full orbit every 90 minutes (16 sunrises and sunsets per Earth day).\n- **Crew & Habitat**: Continuously occupied microgravity research laboratory with international astronaut crews conducting physics, biology, and materials science in low Earth orbit.\n- **Dimensions**: Spans 109 meters end-to-end (the size of an American football field) with over 2,400 square meters of solar array wings."
    };
  }

  if (type === 'spacerock') {
    return {
      title: "Near-Earth Asteroid / Space Rock",
      type: "Asteroid",
      prompt: "What real-time details can you share about passing space rocks and meteorites?",
      detail: "☄️ **Real-Time Orbital Dynamics — Near-Earth Space Rock**\n\n- **Classification**: Chondritic Silicate / Nickel-Iron Asteroid remnant from the early solar system 4.6 billion years ago.\n- **Orbital Velocity**: Varies between 11 km/s to 72 km/s relative to Earth.\n- **Composition**: Rich in silicates, nickel, iron, platinum-group metals, and primordial organic volatiles.\n- **Scientific Significance**: Studying near-Earth objects (NEOs) provides vital clues about planetary formation and planetary defense tracking."
    };
  }

  return {
    title: "Shooting Star (Meteor / Cometary Debris)",
    type: "Meteor Trail",
    prompt: "Tell me about that passing shooting star and meteor shower physics.",
    detail: "🌠 **Meteor Physics & Celestial Dynamics — Shooting Star**\n\n- **Atmospheric Entry**: Tiny dust grain or cometary debris entering Earth's upper mesosphere at 30 to 72 km/s.\n- **Incandescence**: Friction with atmospheric gas molecules at 80–110 km altitude heats the particle to over 1,650°C (3,000°F), ionizing surrounding gas into a bright streak of light.\n- **Meteor Showers**: Often originate from parent comets (e.g. Halley's Comet, Comet Swift-Tuttle) leaving debris trails along Earth's orbital path."
  };
};

export const CosmicEnvironment: React.FC<CosmicEnvironmentProps> = ({ onSelectSpaceObject }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeCelestialBodiesRef = useRef<CelestialObject[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const hoveredObjectIdRef = useRef<number | null>(null);
  const hoveredShootingStarIdRef = useRef<number | null>(null);
  const ripplesRef = useRef<CanvasRipple[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const perf = getDevicePerformanceProfile();
    const dpr = Math.min(window.devicePixelRatio || 1, perf.maxDpr);
    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Processed Transparent Space Object Canvases (Background-Free fallback & non-planetary sprites)
    const spaceCanvases: Record<CelestialObject['type'], HTMLCanvasElement | HTMLImageElement | null> = {
      sun: null,
      saturn: null,
      earth: null,
      moon: null,
      satellite: null,
      spacerock: null,
    };

    const isSoftwareGl = perf.isSoftwareRenderer;
    const glSize = isSoftwareGl ? 180 : perf.tier === 'low' ? 224 : 320;
    const sphereSegs = isSoftwareGl ? 24 : perf.tier === 'low' ? 32 : 48;
    const texW = isSoftwareGl ? 256 : 512;
    const texH = isSoftwareGl ? 128 : 256;

    interface Planet3DRig {
      scene: THREE.Scene;
      root: THREE.Group;
      planetMesh: THREE.Mesh;
      textures: THREE.Texture[];
      geometries: THREE.BufferGeometry[];
      materials: THREE.Material[];
    }

    let glRenderer: THREE.WebGLRenderer | null = null;
    let glCamera: THREE.OrthographicCamera | null = null;
    const planet3DRigs: Partial<Record<Planet3DType, Planet3DRig>> = {};
    let isDisposed = false;

    if (perf.webglSupported) {
      try {
        const glCanvas = document.createElement('canvas');
        glCanvas.width = glSize;
        glCanvas.height = glSize;
        glRenderer = new THREE.WebGLRenderer({
          canvas: glCanvas,
          alpha: true,
          antialias: !isSoftwareGl,
          powerPreference: 'default',
        });
        glRenderer.setPixelRatio(1);
        glRenderer.setSize(glSize, glSize, false);
        glRenderer.setClearColor(0x000000, 0);
        glRenderer.outputColorSpace = THREE.SRGBColorSpace;
        glCamera = new THREE.OrthographicCamera(-1.72, 1.72, 1.72, -1.72, 0.1, 20);
        glCamera.position.set(0, 0, 5);
        glCamera.lookAt(0, 0, 0);
      } catch {
        glRenderer = null;
        glCamera = null;
      }
    }

    const buildPlanet3DRig = (type: Planet3DType, img: HTMLImageElement) => {
      if (isDisposed || !glRenderer) return;
      const eqCanvas = buildEquirectangularPlanetCanvas(img, type, texW, texH);
      if (!eqCanvas) return;

      const scene = new THREE.Scene();
      const root = new THREE.Group();
      scene.add(root);

      const textures: THREE.Texture[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      const materials: THREE.Material[] = [];

      const sphereTex = new THREE.CanvasTexture(eqCanvas);
      sphereTex.colorSpace = THREE.SRGBColorSpace;
      sphereTex.wrapS = THREE.RepeatWrapping;
      sphereTex.wrapT = THREE.ClampToEdgeWrapping;
      sphereTex.needsUpdate = true;
      textures.push(sphereTex);

      const sphereRadius = type === 'saturn' ? 0.88 : 1.12;
      const sphereGeo = new THREE.SphereGeometry(sphereRadius, sphereSegs, Math.max(16, Math.round(sphereSegs * 0.75)));
      geometries.push(sphereGeo);

      let planetMat: THREE.Material;
      if (type === 'sun') {
        planetMat = new THREE.MeshBasicMaterial({ map: sphereTex });
      } else {
        // Multi-source studio-balanced lighting so >= 2/3 of the visible planet sphere stays sunlit & clear
        const ambient = new THREE.AmbientLight(0xffffff, 0.88);
        const hemi = new THREE.HemisphereLight(0xeef6ff, 0x334155, 0.65);
        const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.75);
        keyLight.position.set(3, 2, 4);
        const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.72);
        fillLight.position.set(-3, -1, 2.5);
        scene.add(ambient, hemi, keyLight, fillLight);

        planetMat = new THREE.MeshStandardMaterial({
          map: sphereTex,
          roughness: type === 'moon' ? 0.92 : type === 'saturn' ? 0.78 : 0.72,
          metalness: 0.04,
        });
      }
      materials.push(planetMat);

      const planetMesh = new THREE.Mesh(sphereGeo, planetMat);
      if (type === 'earth') {
        root.rotation.z = 0.28;
        root.rotation.x = 0.14;
      } else if (type === 'moon') {
        root.rotation.z = -0.15;
        root.rotation.x = 0.1;
      } else if (type === 'saturn') {
        root.rotation.x = 0.34;
        root.rotation.z = -0.42;

        const ringCanvas = buildSaturnRingProfileCanvas(img);
        if (ringCanvas) {
          const ringTex = new THREE.CanvasTexture(ringCanvas);
          ringTex.colorSpace = THREE.SRGBColorSpace;
          ringTex.wrapS = THREE.ClampToEdgeWrapping;
          ringTex.wrapT = THREE.ClampToEdgeWrapping;
          ringTex.needsUpdate = true;
          textures.push(ringTex);

          const innerR = 0.98;
          const outerR = 1.66;
          const ringGeo = new THREE.RingGeometry(innerR, outerR, isSoftwareGl ? 40 : 64, 1);
          const pos = ringGeo.attributes.position;
          const uv = ringGeo.attributes.uv;
          const v3 = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v3.fromBufferAttribute(pos, i);
            const r = Math.hypot(v3.x, v3.y);
            const uCoord = Math.max(0, Math.min(1, (r - innerR) / (outerR - innerR)));
            uv.setXY(i, uCoord, 0.5);
          }
          uv.needsUpdate = true;
          geometries.push(ringGeo);

          const ringMat = new THREE.MeshStandardMaterial({
            map: ringTex,
            side: THREE.DoubleSide,
            transparent: true,
            roughness: 0.82,
            metalness: 0.05,
            depthWrite: false,
          });
          materials.push(ringMat);

          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = Math.PI / 2;
          root.add(ringMesh);
        }
      }

      root.add(planetMesh);
      planet3DRigs[type] = {
        scene,
        root,
        planetMesh,
        textures,
        geometries,
        materials,
      };
    };

    let realStarCanvas: HTMLCanvasElement | HTMLImageElement | null = null;

    const imageSources: Record<string, string> = {
      sun: '/assets/space/sun.jpg',
      saturn: '/assets/space/saturn.jpg',
      earth: '/assets/space/earth.jpg',
      moon: '/assets/space/moon.jpg',
      satellite: '/assets/space/satellite.jpg',
      spacerock: '/assets/space/satellite.jpg',
    };

    const processImageBackground = (type: CelestialObject['type'], src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (isDisposed) return;

        if (isPlanet3DType(type) && glRenderer) {
          try {
            buildPlanet3DRig(type, img);
          } catch {
            // Keep Canvas2D processed sprite fallback if texture build fails
          }
        }

        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = img.width;
          offCanvas.height = img.height;
          const offCtx = offCanvas.getContext('2d');
          if (!offCtx) {
            spaceCanvases[type] = img;
            return;
          }
          offCtx.drawImage(img, 0, 0);
          const imgData = offCtx.getImageData(0, 0, img.width, img.height);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (brightness < 36) {
              const alphaFactor = Math.max(0, Math.min(1, (brightness / 36) ** 1.8));
              data[i + 3] = Math.round(data[i + 3] * alphaFactor);
            }
          }
          offCtx.putImageData(imgData, 0, 0);
          spaceCanvases[type] = offCanvas;
        } catch {
          spaceCanvases[type] = img;
        }
      };
    };

    Object.entries(imageSources).forEach(([type, src]) => {
      processImageBackground(type as CelestialObject['type'], src);
    });

    // Load Real Star Sprite Texture
    const starImg = new Image();
    starImg.src = '/assets/space/star.jpg';
    starImg.onload = () => {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = starImg.width;
        offCanvas.height = starImg.height;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) {
          realStarCanvas = starImg;
          return;
        }
        offCtx.drawImage(starImg, 0, 0);
        const imgData = offCtx.getImageData(0, 0, starImg.width, starImg.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          if (brightness < 30) {
            const alphaFactor = Math.max(0, Math.min(1, (brightness / 30) ** 1.6));
            data[i + 3] = Math.round(data[i + 3] * alphaFactor);
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        realStarCanvas = offCanvas;
      } catch {
        realStarCanvas = starImg;
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const currentDpr = Math.min(window.devicePixelRatio || 1, perf.maxDpr);
      canvas.width = Math.max(1, Math.floor(width * currentDpr));
      canvas.height = Math.max(1, Math.floor(height * currentDpr));
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // 1. Realistic Background Stars Array scaled by device performance tier
    const stars = Array.from({ length: perf.starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.85 ? Math.random() * 3 + 1.5 : Math.random() * 6 + 3,
      baseAlpha: Math.random() * 0.6 + 0.3,
      twinkleSpeed: Math.random() * 0.025 + 0.008,
      phase: Math.random() * Math.PI * 2,
      driftX: (Math.random() - 0.5) * 0.05,
      driftY: (Math.random() - 0.5) * 0.05,
    }));

    // 2. Shooting Stars Array
    let nextShootingStarTimer = Math.floor(Math.random() * 200 + 100);

    const spawnShootingStar = () => {
      const startX = Math.random() * width * 0.8;
      const startY = Math.random() * height * 0.4;
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.2;
      const speed = Math.random() * 8 + 6;
      shootingStarsRef.current.push({
        id: Date.now() + Math.random(),
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: Math.random() * 80 + 50,
        alpha: 1.0,
        life: 0,
        maxLife: Math.floor(Math.random() * 35 + 25),
      });
    };

    // 3. Multi-Celestial Bodies System (Max 2-3 unique types simultaneously)
    const createCelestialBody = (id: number, existingTypes: string[]): CelestialObject | null => {
      const allTypes: CelestialObject['type'][] = ['saturn', 'earth', 'sun', 'moon', 'satellite', 'spacerock'];
      const activeTypes = new Set([
        ...existingTypes,
        ...activeCelestialBodiesRef.current.map((b) => b.type),
      ]);
      const availableTypes = allTypes.filter((t) => !activeTypes.has(t));
      if (availableTypes.length === 0) return null;

      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      const specificName = type === 'satellite' ? SATELLITE_NAMES[Math.floor(Math.random() * SATELLITE_NAMES.length)] : undefined;

      const spawnMode = Math.random();
      let startX = 0, startY = 0, vx = 0, vy = 0;

      if (spawnMode < 0.35) {
        const fromLeft = Math.random() > 0.5;
        startX = fromLeft ? -220 : width + 220;
        startY = Math.random() * height;
        vx = (fromLeft ? 1 : -1) * (Math.random() * 0.35 + 0.15);
        vy = (Math.random() - 0.5) * 0.12;
      } else if (spawnMode < 0.7) {
        const fromTop = Math.random() > 0.5;
        startX = Math.random() * width;
        startY = fromTop ? -220 : height + 220;
        vx = (Math.random() - 0.5) * 0.12;
        vy = (fromTop ? 1 : -1) * (Math.random() * 0.35 + 0.15);
      } else {
        const fromLeft = Math.random() > 0.5;
        const fromTop = Math.random() > 0.5;
        startX = fromLeft ? -220 : width + 220;
        startY = fromTop ? -220 : height + 220;
        vx = (fromLeft ? 1 : -1) * (Math.random() * 0.4 + 0.15);
        vy = (fromTop ? 1 : -1) * (Math.random() * 0.4 + 0.15);
      }

      const baseRadii: Record<CelestialObject['type'], number> = {
        sun: 80,
        saturn: 75,
        earth: 60,
        moon: 42,
        satellite: 38,
        spacerock: 32,
      };

      const axialSpeeds: Record<CelestialObject['type'], number> = {
        saturn: 0.0068,
        sun: 0.0042,
        earth: 0.0052,
        moon: 0.0036,
        satellite: 0,
        spacerock: 0,
      };

      return {
        id,
        type,
        specificName,
        x: startX,
        y: startY,
        baseRadius: baseRadii[type],
        currentScale: 0.05,
        targetScale: Math.random() * 0.7 + 0.5,
        scaleSpeed: Math.random() * 0.0025 + 0.001,
        alpha: 0,
        targetAlpha: Math.random() * 0.75 + 0.25,
        fadeSpeed: Math.random() * 0.0035 + 0.0015,
        vx,
        vy,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
        axialAngle: Math.random() * Math.PI * 2,
        axialSpeed: axialSpeeds[type],
        lifespan: Math.random() * 1800 + 1200,
        age: 0,
        flarePhase: Math.random() * Math.PI * 2,
      };
    };

    // Reset active celestial bodies array on init to guarantee no leftover duplicates
    activeCelestialBodiesRef.current = [];

    // Initial unique celestial bodies scaled by device tier (1 on low, 2 on mid/high)
    const body1 = createCelestialBody(1, []);
    if (body1) activeCelestialBodiesRef.current.push(body1);
    if (perf.maxCelestialBodies > 1) {
      const body2 = createCelestialBody(2, activeCelestialBodiesRef.current.map((b) => b.type));
      if (body2) activeCelestialBodiesRef.current.push(body2);
    }

    // Mouse Interaction Handlers on Canvas
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let foundHovered = false;

      // Check celestial bodies
      for (const obj of activeCelestialBodiesRef.current) {
        const radius = Math.max(obj.baseRadius * obj.currentScale, 32);
        const dist = Math.hypot(mouseX - obj.x, mouseY - obj.y);
        if (dist <= radius * 1.5 && obj.alpha > 0.08) {
          foundHovered = true;
          hoveredObjectIdRef.current = obj.id;
          canvas.style.cursor = 'pointer';
          break;
        }
      }

      // Check shooting stars if no celestial body hovered
      if (!foundHovered) {
        for (const ss of shootingStarsRef.current) {
          const dist = Math.hypot(mouseX - ss.x, mouseY - ss.y);
          if (dist <= 45 && ss.alpha > 0.15) {
            foundHovered = true;
            hoveredShootingStarIdRef.current = ss.id;
            canvas.style.cursor = 'pointer';
            break;
          }
        }
      }

      if (!foundHovered) {
        hoveredObjectIdRef.current = null;
        hoveredShootingStarIdRef.current = null;
        canvas.style.cursor = 'default';
      }
    };

    const createRipple = (x: number, y: number) => {
      ripplesRef.current.push({
        x,
        y,
        radius: 10,
        maxRadius: 80,
        alpha: 1.0,
      });
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Check celestial bodies
      for (const obj of activeCelestialBodiesRef.current) {
        const radius = Math.max(obj.baseRadius * obj.currentScale, 32);
        const dist = Math.hypot(mouseX - obj.x, mouseY - obj.y);
        if (dist <= radius * 1.5 && obj.alpha > 0.05) {
          createRipple(obj.x, obj.y);
          const telemetry = getTelemetryForObject(obj.type, obj.specificName);
          if (onSelectSpaceObject) {
            onSelectSpaceObject(telemetry);
          }
          return;
        }
      }

      // Check shooting stars
      for (const ss of shootingStarsRef.current) {
        const dist = Math.hypot(mouseX - ss.x, mouseY - ss.y);
        if (dist <= 45 && ss.alpha > 0.1) {
          createRipple(ss.x, ss.y);
          const telemetry = getTelemetryForObject('shootingstar');
          if (onSelectSpaceObject) {
            onSelectSpaceObject(telemetry);
          }
          return;
        }
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    let lastFrameTime = performance.now();
    const effectiveFps = isSoftwareGl ? Math.min(12, perf.targetFps || 12) : perf.targetFps;
    const fpsInterval = effectiveFps > 0 ? 1000 / effectiveFps : 1000;
    let time = 0;

    const render = (nowTime: number) => {
      if (!perf.prefersReducedMotion && !document.hidden) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        animationFrameId = 0;
      }

      if (document.hidden && animationFrameId === 0) return;

      const delta = nowTime - lastFrameTime;
      if (delta < fpsInterval && lastFrameTime !== 0) return;
      lastFrameTime = nowTime - (delta % fpsInterval);

      time += 0.01;

      ctx.clearRect(0, 0, width, height);

      // Deep Space Base Gradient
      const spaceGrad = ctx.createRadialGradient(
        width * 0.5, height * 0.4, 60,
        width * 0.5, height * 0.5, Math.max(width, height)
      );
      spaceGrad.addColorStop(0, '#060a1e');
      spaceGrad.addColorStop(0.5, '#030511');
      spaceGrad.addColorStop(1, '#010207');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // Ambient Nebulae Clouds
      const nebAX = width * 0.4 + Math.sin(time * 0.2) * 35;
      const nebAY = height * 0.3 + Math.cos(time * 0.2) * 20;
      const nebAGrad = ctx.createRadialGradient(nebAX, nebAY, 30, nebAX, nebAY, width * 0.5);
      nebAGrad.addColorStop(0, 'rgba(124, 58, 237, 0.08)');
      nebAGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.03)');
      nebAGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebAGrad;
      ctx.fillRect(0, 0, width, height);

      // LAYER 1: STARS (BEHIND PLANETS)
      stars.forEach((s) => {
        s.x += s.driftX;
        s.y += s.driftY;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        const twinkleFactor = Math.sin(time * 40 * s.twinkleSpeed + s.phase);
        const currentAlpha = Math.max(0.1, Math.min(1, s.baseAlpha + twinkleFactor * 0.45));
        const currentSize = s.size * (1 + twinkleFactor * 0.18);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = currentAlpha;

        if (realStarCanvas) {
          ctx.drawImage(realStarCanvas, s.x - currentSize, s.y - currentSize, currentSize * 2, currentSize * 2);
        } else {
          ctx.fillStyle = '#bae6fd';
          ctx.beginPath();
          ctx.arc(s.x, s.y, currentSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // LAYER 2: SHOOTING STARS (METEORS)
      nextShootingStarTimer--;
      if (nextShootingStarTimer <= 0) {
        spawnShootingStar();
        nextShootingStarTimer = Math.floor(Math.random() * 250 + 150);
      }

      shootingStarsRef.current.forEach((ss, idx) => {
        ss.life++;
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.alpha = 1 - ss.life / ss.maxLife;

        if (ss.life >= ss.maxLife) {
          shootingStarsRef.current.splice(idx, 1);
          return;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0, ss.alpha);
        const tailX = ss.x - ss.vx * 4;
        const tailY = ss.y - ss.vy * 4;
        const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#38bdf8');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Hover effect for shooting stars
        if (hoveredShootingStarIdRef.current === ss.id) {
          ctx.beginPath();
          ctx.arc(ss.x, ss.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();
      });

      // LAYER 3: CELESTIAL BODIES (IN FRONT OF STARS) - Strictly unique characters only
      const seenTypesSet = new Set<string>();
      activeCelestialBodiesRef.current = activeCelestialBodiesRef.current.filter((b) => {
        if (seenTypesSet.has(b.type)) return false;
        seenTypesSet.add(b.type);
        return true;
      });

      for (let i = activeCelestialBodiesRef.current.length - 1; i >= 0; i--) {
        const obj = activeCelestialBodiesRef.current[i];
        obj.age++;
        obj.x += obj.vx;
        obj.y += obj.vy;
        obj.rotation += obj.rotationSpeed;
        obj.axialAngle += obj.axialSpeed;
        obj.flarePhase += 0.02;

        const progress = obj.age / obj.lifespan;
        if (progress < 0.35) {
          obj.currentScale += (obj.targetScale - obj.currentScale) * obj.scaleSpeed;
          obj.alpha = Math.min(obj.targetAlpha, obj.alpha + obj.fadeSpeed);
        } else if (progress > 0.7) {
          obj.currentScale += (0.05 - obj.currentScale) * obj.scaleSpeed;
          obj.alpha = Math.max(0, obj.alpha - obj.fadeSpeed);
        } else {
          obj.alpha = Math.min(obj.targetAlpha, obj.alpha + obj.fadeSpeed);
        }

        const isOutOfBounds =
          obj.x < -320 || obj.x > width + 320 || obj.y < -320 || obj.y > height + 320;

        if (obj.age >= obj.lifespan || (obj.alpha <= 0.005 && obj.age > 80) || isOutOfBounds) {
          activeCelestialBodiesRef.current.splice(i, 1);
          const existingTypes = activeCelestialBodiesRef.current.map((b) => b.type);
          const newBody = createCelestialBody(Date.now(), existingTypes);
          if (newBody) activeCelestialBodiesRef.current.push(newBody);
          continue;
        }

        const spaceCanvas = spaceCanvases[obj.type];
        const radius = obj.baseRadius * obj.currentScale;
        const rig3d = isPlanet3DType(obj.type) ? planet3DRigs[obj.type] : undefined;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0, Math.min(1, obj.alpha));
        ctx.translate(obj.x, obj.y);

        // 3D Solar Flare Eruption Halo for Sun
        if (obj.type === 'sun') {
          const flareRadius = radius * (1.1 + Math.sin(obj.flarePhase * 3) * 0.08);
          const sunGlow = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, flareRadius * 1.5);
          sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.6)');
          sunGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.3)');
          sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = sunGlow;
          ctx.beginPath();
          ctx.arc(0, 0, flareRadius * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (rig3d && glRenderer && glCamera) {
          rig3d.planetMesh.rotation.y = obj.axialAngle;
          glRenderer.clear();
          glRenderer.render(rig3d.scene, glCamera);
          // Orthographic frustum half-width is 1.72 while planet sphere radius is 1.12 (0.88 for saturn + 1.66 rings)
          const boxRadius = radius * 1.52;
          ctx.drawImage(glRenderer.domElement, -boxRadius, -boxRadius, boxRadius * 2, boxRadius * 2);
        } else {
          ctx.save();
          ctx.rotate(obj.rotation);
          if (spaceCanvas) {
            ctx.drawImage(spaceCanvas, -radius, -radius, radius * 2, radius * 2);
          } else {
            const orbGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
            orbGrad.addColorStop(0, '#38bdf8');
            orbGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
            ctx.fillStyle = orbGrad;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // HOVER TARGETING RING & LABEL FOR INTERACTION
        if (hoveredObjectIdRef.current === obj.id) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
          ctx.stroke();

          // Subtle Telemetry Intercept Label
          const displayLabel = obj.specificName || obj.type.toUpperCase();
          ctx.fillStyle = '#7dd3fc';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🔭 ${displayLabel}`, 0, radius * 1.7);
        }

        ctx.restore();
      }

      // LAYER 4: RIPPLE ANIMATIONS ON CLICK
      for (let r = ripplesRef.current.length - 1; r >= 0; r--) {
        const rip = ripplesRef.current[r];
        rip.radius += 3.5;
        rip.alpha -= 0.035;

        if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
          ripplesRef.current.splice(r, 1);
          continue;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0, rip.alpha);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };

    lastFrameTime = 0;
    if (perf.prefersReducedMotion) {
      // Draw one clean calm cosmic frame for reduced-motion users without starting continuous loop
      render(performance.now());
    } else if (!document.hidden) {
      animationFrameId = requestAnimationFrame(render);
    }

    const handleVisibilityChange = () => {
      if (perf.prefersReducedMotion) return;
      if (document.hidden) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = 0;
        }
      } else if (!animationFrameId) {
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);

      Object.values(planet3DRigs).forEach((rig) => {
        if (!rig) return;
        rig.geometries.forEach((g) => g.dispose());
        rig.materials.forEach((m) => m.dispose());
        rig.textures.forEach((t) => t.dispose());
      });
      if (glRenderer) {
        glRenderer.dispose();
        glRenderer = null;
      }
    };
  }, [onSelectSpaceObject]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-auto z-0"
      aria-label="Interactive Cosmic Space Environment"
    />
  );
};
