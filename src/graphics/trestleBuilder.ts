import * as THREE from 'three';
import { FORWARD_X } from '../constants';
import { wrapTunnelRingX } from './tunnelBuilder';

export interface TrestleRig {
  group: THREE.Group;
  update: (
    dtSec: number,
    elapsedSec: number,
    speedMps: number,
    active: boolean
  ) => void;
  dispose: () => void;
}

const TRESTLE_BENT_COUNT = 20;
const TRESTLE_BENT_SPACING_M = 6.0;
const TRESTLE_HALF_SPAN_M = (TRESTLE_BENT_COUNT * TRESTLE_BENT_SPACING_M) / 2; // 60m

function createSkylineWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Deterministic procedural city window grid
    for (let row = 2; row < 28; row++) {
      for (let col = 1; col < 15; col++) {
        const hash = ((row * 37 + col * 19) * 73) % 100;
        if (hash < 32) {
          ctx.fillStyle = hash < 14 ? '#ffd796' : '#9ab8d9';
          ctx.fillRect(col * 16 + 3, row * 8 + 2, 8, 4);
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the procedural open-air Newtown Creek steel trestle (Stop 11 -> Stop 12 on G):
 * - Gradient sky shader (violet -> navy -> sodium horizon haze, fog: false)
 * - Distant skyline silhouettes with lit windows and blinking red beacons (fog: false)
 * - Newtown Creek dark water with amber sodium reflections
 * - Pooled steel bents, girders, side catwalks, and sodium pier lamps streaming toward +X
 * - Diagonal rain strips streaking across the car windows
 */
export function buildNewtownCreekTrestle(): TrestleRig {
  const group = new THREE.Group();
  group.name = 'NewtownCreekTrestle';
  group.visible = false;

  const disposableGeometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];
  const disposableTextures: THREE.Texture[] = [];

  const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMaterials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposableTextures.push(t);
    return t;
  };

  // 1. Gradient Sky Shader (violet zenith -> navy mid -> warm sodium horizon haze; ignores fog)
  const skyShaderMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenithColor: { value: new THREE.Color(0x1f1438) },
        uMidColor: { value: new THREE.Color(0x0b152c) },
        uHorizonColor: { value: new THREE.Color(0x382226) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenithColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp((vWorldPos.y + 8.0) / 52.0, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.38, h));
          col = mix(col, uZenithColor, smoothstep(0.38, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );

  const skyBox = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(190, 110, 140)),
    skyShaderMat
  );
  skyBox.position.set(0, 24, 0);
  skyBox.renderOrder = -10;
  group.add(skyBox);

  // 2. Newtown Creek Water Plane & Sodium Reflections (y = -11.5, fog: false)
  const waterMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x050912,
      fog: false,
    })
  );
  const waterPlane = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(180, 130)),
    waterMat
  );
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.set(0, -11.5, 0);
  group.add(waterPlane);

  const waterGlintMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffa64d,
      transparent: true,
      opacity: 0.22,
      fog: false,
    })
  );
  const waterGlintGeom = trackGeom(new THREE.PlaneGeometry(16, 1.6));
  for (let i = -3; i <= 3; i++) {
    for (const zSide of [-1, 1]) {
      const glint = new THREE.Mesh(waterGlintGeom, waterGlintMat);
      glint.rotation.x = -Math.PI / 2;
      glint.position.set(i * 22, -11.42, zSide * (18 + Math.abs(i) * 3));
      group.add(glint);
    }
  }

  // 3. Skyline Silhouettes & Red Aviation Beacons (Materials ignore fog)
  const skylineTex = trackTex(createSkylineWindowTexture());
  const skylineMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: skylineTex,
      fog: false,
    })
  );
  const beaconMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xff2a2a,
      fog: false,
    })
  );
  const beaconGeom = trackGeom(new THREE.SphereGeometry(0.42, 8, 8));
  const beaconMeshes: THREE.Mesh[] = [];

  const buildingSpecs: ReadonlyArray<{
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    hasBeacon: boolean;
  }> = [
    { x: -42, z: -48, w: 9, h: 32, d: 7, hasBeacon: true },
    { x: -28, z: -52, w: 11, h: 24, d: 8, hasBeacon: false },
    { x: -12, z: -46, w: 8, h: 38, d: 7, hasBeacon: true },
    { x: 4, z: -50, w: 12, h: 27, d: 8, hasBeacon: false },
    { x: 20, z: -47, w: 9, h: 35, d: 7, hasBeacon: true },
    { x: 36, z: -52, w: 10, h: 22, d: 8, hasBeacon: false },
    { x: -35, z: 48, w: 10, h: 29, d: 7, hasBeacon: true },
    { x: -16, z: 52, w: 12, h: 21, d: 8, hasBeacon: false },
    { x: 2, z: 47, w: 9, h: 34, d: 7, hasBeacon: true },
    { x: 22, z: 50, w: 11, h: 26, d: 8, hasBeacon: false },
    { x: 38, z: 48, w: 8, h: 31, d: 7, hasBeacon: true },
  ];

  for (const b of buildingSpecs) {
    const bMesh = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(b.w, b.h, b.d)),
      skylineMat
    );
    bMesh.position.set(b.x, -11.5 + b.h / 2, b.z);
    group.add(bMesh);

    if (b.hasBeacon) {
      const beacon = new THREE.Mesh(beaconGeom, beaconMat);
      beacon.position.set(b.x, -11.5 + b.h + 0.65, b.z);
      group.add(beacon);
      beaconMeshes.push(beacon);
    }
  }

  // 4. Pooled Steel Trestle Bents, Cross-Bracing, Side Catwalks & Sodium Lamps
  const steelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      roughness: 0.65,
      metalness: 0.55,
      fog: false,
    })
  );
  const sodiumBulbMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffb35c,
      fog: false,
    })
  );

  const bentPostGeom = trackGeom(new THREE.BoxGeometry(0.24, 15.2, 0.24));
  const overheadBeamGeom = trackGeom(new THREE.BoxGeometry(0.24, 0.28, 7.6));
  const diagBraceGeom = trackGeom(new THREE.BoxGeometry(0.1, 2.2, 0.1));
  const catwalkRailGeom = trackGeom(
    new THREE.BoxGeometry(TRESTLE_BENT_SPACING_M, 0.08, 0.08)
  );
  const sodiumBulbGeom = trackGeom(new THREE.BoxGeometry(0.32, 0.12, 0.22));

  const bentGroups: THREE.Group[] = [];
  for (let i = 0; i < TRESTLE_BENT_COUNT; i++) {
    const bent = new THREE.Group();
    const xPos = -TRESTLE_HALF_SPAN_M + i * TRESTLE_BENT_SPACING_M;
    bent.position.set(xPos, 0, 0);

    for (const zSide of [-1, 1]) {
      const post = new THREE.Mesh(bentPostGeom, steelMat);
      post.position.set(0, -3.8, zSide * 3.55);
      bent.add(post);

      // Diagonal gusset braces near top
      const brace = new THREE.Mesh(diagBraceGeom, steelMat);
      brace.position.set(0, 2.8, zSide * 2.95);
      brace.rotation.x = zSide * 0.65;
      bent.add(brace);

      // Side catwalk guardrail spans
      const topRail = new THREE.Mesh(catwalkRailGeom, steelMat);
      topRail.position.set(0, 1.05, zSide * 3.45);
      bent.add(topRail);

      const midRail = new THREE.Mesh(catwalkRailGeom, steelMat);
      midRail.position.set(0, 0.55, zSide * 3.45);
      bent.add(midRail);
    }

    // Overhead steel portal cross-beam
    const crossBeam = new THREE.Mesh(overheadBeamGeom, steelMat);
    crossBeam.position.set(0, 3.65, 0);
    bent.add(crossBeam);

    // Every 2nd bent has a warm sodium trestle lamp
    if (i % 2 === 0) {
      const bulb = new THREE.Mesh(sodiumBulbGeom, sodiumBulbMat);
      bulb.position.set(0, 3.45, -3.2);
      bent.add(bulb);
    }

    group.add(bent);
    bentGroups.push(bent);
  }

  // Two pooled warm sodium point lights illuminating the trestle girders outside Car B
  const sodiumLightLeft = new THREE.PointLight(0xffa94d, 1.35, 18, 1.4);
  sodiumLightLeft.position.set(-2.5, 2.8, -3.2);
  group.add(sodiumLightLeft);

  const sodiumLightRight = new THREE.PointLight(0xffa94d, 1.35, 18, 1.4);
  sodiumLightRight.position.set(2.5, 2.8, 3.2);
  group.add(sodiumLightRight);

  // 5. Rain Strips on Windows (streaking diagonally across Car B windows at z = ±1.48)
  const rainGroup = new THREE.Group();
  group.add(rainGroup);

  const rainMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x9ec4e8,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      fog: false,
    })
  );
  const rainStripGeom = trackGeom(new THREE.PlaneGeometry(0.018, 0.28));

  interface RainStreak {
    mesh: THREE.Mesh;
    baseX: number;
    baseY: number;
    speed: number;
    phase: number;
  }
  const rainStreaks: RainStreak[] = [];

  for (const zSide of [-1, 1]) {
    for (let i = 0; i < 36; i++) {
      const mesh = new THREE.Mesh(rainStripGeom, rainMat);
      const baseX = -7.2 + (i % 18) * 0.82;
      const baseY = 1.08 + Math.floor(i / 18) * 0.45;
      mesh.position.set(baseX, baseY, zSide * 1.47);
      mesh.rotation.y = zSide > 0 ? Math.PI : 0;
      mesh.rotation.z = zSide * 0.38;
      rainGroup.add(mesh);
      rainStreaks.push({
        mesh,
        baseX,
        baseY,
        speed: 1.8 + (i % 5) * 0.35,
        phase: i * 0.41,
      });
    }
  }

  return {
    group,
    update(
      dtSec: number,
      elapsedSec: number,
      speedMps: number,
      active: boolean
    ) {
      if (!active) {
        group.visible = false;
        return;
      }

      group.visible = true;

      // Stream steel trestle bents toward +X (-FORWARD_X)
      const streamDeltaX = -FORWARD_X * speedMps * dtSec;
      for (const bent of bentGroups) {
        bent.position.x = wrapTunnelRingX(
          bent.position.x + streamDeltaX,
          TRESTLE_HALF_SPAN_M
        );
      }

      // Blink red aviation beacons on distant skyline towers
      const beaconPulse = 0.55 + 0.45 * Math.sin(elapsedSec * 3.4);
      beaconMat.color.setRGB(beaconPulse, 0.08 * beaconPulse, 0.08 * beaconPulse);
      for (let i = 0; i < beaconMeshes.length; i++) {
        const mesh = beaconMeshes[i]!;
        const s = 0.85 + 0.25 * Math.sin(elapsedSec * 3.4 + i * 1.1);
        mesh.scale.setScalar(s);
      }

      // Animate rain strips streaking across the car windows
      for (const r of rainStreaks) {
        const cycle = (elapsedSec * r.speed + r.phase) % 1.0;
        r.mesh.position.x = r.baseX + cycle * 0.42;
        r.mesh.position.y = 1.82 - cycle * 0.78;
      }
    },
    dispose() {
      for (const g of disposableGeometries) g.dispose();
      for (const m of disposableMaterials) m.dispose();
      for (const t of disposableTextures) t.dispose();
    },
  };
}
