import * as THREE from 'three';
import {
  FORWARD_X,
  STATION_PLATFORM_LENGTH,
  STATION_PLATFORM_WIDTH,
  STATION_PLATFORM_Z,
  TUNNEL_HALF_SPAN,
  TUNNEL_RING_COUNT,
  TUNNEL_RING_SPACING,
} from '../constants';
import {
  createStationSignTexture,
  createStationTileWallTexture,
} from './textureGenerator';

/**
 * Pure helper for recycling pooled tunnel ring X coordinates in [-halfSpan, +halfSpan).
 * Train travels toward -x (FORWARD_X = -1); scenery streams toward +x.
 */
export function wrapTunnelRingX(x: number, halfSpan = TUNNEL_HALF_SPAN): number {
  const span = halfSpan * 2;
  let wrapped = ((x + halfSpan) % span);
  if (wrapped < 0) wrapped += span;
  return wrapped - halfSpan;
}

interface PooledTunnelRing {
  group: THREE.Group;
  negZFixturesGroup: THREE.Group;
  wallPosZ: THREE.Mesh;
  ceilingBeam: THREE.Mesh;
}

export interface TunnelAndStationRig {
  root: THREE.Group;
  stationGroup: THREE.Group;
  step: (
    dtSec: number,
    trainSpeedMps: number,
    stationDistanceM: number,
    isOpenAir: boolean
  ) => void;
  setStationInfo: (
    stopName: string,
    routeLabel: string,
    bulletColor: string,
    isOpenAir: boolean
  ) => void;
  dispose: () => void;
}

export function buildTunnelAndStations(maxAnisotropy = 4): TunnelAndStationRig {
  const root = new THREE.Group();
  root.name = 'TunnelAndStationRoot';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  // 1. Shared Tunnel Materials
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x181a19,
    roughness: 0.92,
    metalness: 0.08,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x222628,
    roughness: 0.55,
    metalness: 0.72,
  });

  const railHeadMat = new THREE.MeshStandardMaterial({
    color: 0x6e7478,
    roughness: 0.32,
    metalness: 0.88,
  });

  const lampAmberMat = new THREE.MeshStandardMaterial({
    color: 0xffcf8a,
    emissive: 0xffb35c,
    emissiveIntensity: 1.65,
    roughness: 0.3,
  });

  const signalGreenMat = new THREE.MeshStandardMaterial({
    color: 0x45d66b,
    emissive: 0x32c458,
    emissiveIntensity: 1.8,
  });

  const signalAmberMat = new THREE.MeshStandardMaterial({
    color: 0xffb84d,
    emissive: 0xffa324,
    emissiveIntensity: 1.8,
  });

  materials.push(
    concreteMat,
    darkSteelMat,
    railHeadMat,
    lampAmberMat,
    signalGreenMat,
    signalAmberMat
  );

  // 2. Shared Tunnel Ring Geometries
  const tunnelWallGeo = new THREE.BoxGeometry(TUNNEL_RING_SPACING - 0.12, 3.8, 0.25);
  const tunnelCeilingGeo = new THREE.BoxGeometry(TUNNEL_RING_SPACING - 0.18, 0.28, 11.4);
  const centerPierGeo = new THREE.BoxGeometry(0.24, 3.6, 0.24);
  const wallRibGeo = new THREE.BoxGeometry(0.22, 3.7, 0.18);
  const railGeo = new THREE.BoxGeometry(TUNNEL_RING_SPACING, 0.1, 0.08);
  const sconceFixtureGeo = new THREE.BoxGeometry(0.32, 0.14, 0.12);
  const signalBoxGeo = new THREE.BoxGeometry(0.24, 0.58, 0.24);
  const signalLensGeo = new THREE.BoxGeometry(0.04, 0.14, 0.14);

  geometries.push(
    tunnelWallGeo,
    tunnelCeilingGeo,
    centerPierGeo,
    wallRibGeo,
    railGeo,
    sconceFixtureGeo,
    signalBoxGeo,
    signalLensGeo
  );

  const pooledRings: PooledTunnelRing[] = [];
  const ringsRoot = new THREE.Group();
  ringsRoot.name = 'PooledTunnelRings';

  for (let i = 0; i < TUNNEL_RING_COUNT; i++) {
    const ringX = -TUNNEL_HALF_SPAN + i * TUNNEL_RING_SPACING;
    const group = new THREE.Group();
    group.position.set(ringX, 0, 0);

    // Group all -Z tunnel wall & wayside fixtures so they cleanly hide alongside the station platform
    const negZFixturesGroup = new THREE.Group();

    const wallNegZ = new THREE.Mesh(tunnelWallGeo, concreteMat);
    wallNegZ.position.set(0, 1.35, -5.5);
    negZFixturesGroup.add(wallNegZ);

    const ribNegZ = new THREE.Mesh(wallRibGeo, darkSteelMat);
    ribNegZ.position.set(0, 1.35, -2.15);
    negZFixturesGroup.add(ribNegZ);

    if (i % 2 === 0) {
      const sconceNeg = new THREE.Mesh(sconceFixtureGeo, lampAmberMat);
      sconceNeg.position.set(0, 2.1, -2.06);
      negZFixturesGroup.add(sconceNeg);
    }

    if (i % 6 === 0) {
      const sigBox = new THREE.Mesh(signalBoxGeo, darkSteelMat);
      sigBox.position.set(1.2, 1.48, -1.92);
      negZFixturesGroup.add(sigBox);

      const lens = new THREE.Mesh(
        signalLensGeo,
        i % 12 === 0 ? signalGreenMat : signalAmberMat
      );
      lens.position.set(1.33, 1.56, -1.92);
      negZFixturesGroup.add(lens);
    }

    group.add(negZFixturesGroup);

    const wallPosZ = new THREE.Mesh(tunnelWallGeo, concreteMat);
    wallPosZ.position.set(0, 1.35, 5.5);
    group.add(wallPosZ);

    // Overhead arch beam
    const ceilingBeam = new THREE.Mesh(tunnelCeilingGeo, concreteMat);
    ceilingBeam.position.set(0, 3.22, 0);
    group.add(ceilingBeam);

    // Center track divider steel I-beam pier
    const centerPier = new THREE.Mesh(centerPierGeo, darkSteelMat);
    centerPier.position.set(0, 1.35, 1.75);
    group.add(centerPier);

    if (i % 2 === 0) {
      const sconcePos = new THREE.Mesh(sconceFixtureGeo, lampAmberMat);
      sconcePos.position.set(0, 2.1, 1.85);
      group.add(sconcePos);
    }

    // Running rails for both tracks
    for (const rZ of [-0.72, 0.72, 2.53, 3.97]) {
      const rail = new THREE.Mesh(railGeo, railHeadMat);
      rail.position.set(0, -0.42, rZ);
      group.add(rail);
    }

    ringsRoot.add(group);
    pooledRings.push({
      group,
      negZFixturesGroup,
      wallPosZ,
      ceilingBeam,
    });
  }

  root.add(ringsRoot);

  // 3. Shared Station Platform Rig (reused across all 13 stops, including 21 St open-air variant)
  const stationGroup = new THREE.Group();
  stationGroup.name = 'SharedStationPlatform';
  stationGroup.visible = false;

  const platformDeckGeo = new THREE.BoxGeometry(
    STATION_PLATFORM_LENGTH,
    0.55,
    STATION_PLATFORM_WIDTH
  );
  const tactileStripGeo = new THREE.BoxGeometry(STATION_PLATFORM_LENGTH, 0.02, 0.24);
  const stationBackWallGeo = new THREE.BoxGeometry(STATION_PLATFORM_LENGTH, 2.9, 0.16);
  const stationCanopyGeo = new THREE.BoxGeometry(STATION_PLATFORM_LENGTH, 0.14, 3.9);
  const stationColumnGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.85, 10);
  const stationSignGeo = new THREE.PlaneGeometry(1.72, 0.42);
  const stationLightDiffuserGeo = new THREE.BoxGeometry(3.2, 0.06, 0.28);
  const elevatedRailingGeo = new THREE.BoxGeometry(STATION_PLATFORM_LENGTH, 1.15, 0.08);

  geometries.push(
    platformDeckGeo,
    tactileStripGeo,
    stationBackWallGeo,
    stationCanopyGeo,
    stationColumnGeo,
    stationSignGeo,
    stationLightDiffuserGeo,
    elevatedRailingGeo
  );

  const platformConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x3b3d3a,
    roughness: 0.85,
    metalness: 0.06,
  });

  const tactileYellowMat = new THREE.MeshStandardMaterial({
    color: 0xd4a428,
    emissive: 0x3a2a05,
    roughness: 0.65,
  });

  const tileWallTex = createStationTileWallTexture('#6cbe45', maxAnisotropy);
  textures.push(tileWallTex);
  const stationTileWallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileWallTex,
    roughness: 0.58,
    metalness: 0.08,
  });

  const stationColumnMat = new THREE.MeshStandardMaterial({
    color: 0x26382b,
    roughness: 0.48,
    metalness: 0.55,
  });

  const stationLightMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: 0xffe4b5,
    emissiveIntensity: 1.5,
  });

  const elevatedSkyBackdropMat = new THREE.MeshBasicMaterial({
    color: 0x161426,
    fog: false,
  });

  const signHelper = createStationSignTexture(
    'Hoyt–Schermerhorn',
    'G',
    '#6cbe45',
    maxAnisotropy
  );
  textures.push(signHelper.texture);

  const stationSignMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: signHelper.texture,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0xffffff,
    emissiveMap: signHelper.texture,
    emissiveIntensity: 0.36,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  materials.push(
    platformConcreteMat,
    tactileYellowMat,
    stationTileWallMat,
    stationColumnMat,
    stationLightMat,
    elevatedSkyBackdropMat,
    stationSignMat
  );

  // Platform slab & yellow tactile edge strip
  const platformDeck = new THREE.Mesh(platformDeckGeo, platformConcreteMat);
  platformDeck.position.set(0, -0.28, STATION_PLATFORM_Z);
  stationGroup.add(platformDeck);

  const tactileStrip = new THREE.Mesh(tactileStripGeo, tactileYellowMat);
  tactileStrip.position.set(0, 0.01, -1.72);
  stationGroup.add(tactileStrip);

  // Underground ceramic tile back wall (hidden in 21 St open-air mode)
  const undergroundBackWall = new THREE.Mesh(stationBackWallGeo, stationTileWallMat);
  undergroundBackWall.position.set(0, 1.42, -5.12);
  stationGroup.add(undergroundBackWall);

  // Open-air / Elevated variant elements for 21 St (Stop 12)
  const elevatedGroup = new THREE.Group();
  elevatedGroup.visible = false;

  const elevatedRailing = new THREE.Mesh(elevatedRailingGeo, darkSteelMat);
  elevatedRailing.position.set(0, 0.58, -5.08);
  elevatedGroup.add(elevatedRailing);

  const elevatedCanopy = new THREE.Mesh(stationCanopyGeo, darkSteelMat);
  elevatedCanopy.position.set(0, 2.78, STATION_PLATFORM_Z);
  elevatedGroup.add(elevatedCanopy);

  stationGroup.add(elevatedGroup);

  // Columns aligned with car window pillars so they never block window centers
  const columnXs = [-23.4, -19.5, -15.6, -6.1, -3.9, -1.9, 1.9, 3.9, 6.1, 15.6, 19.5, 23.4];
  for (const cx of columnXs) {
    const col = new THREE.Mesh(stationColumnGeo, stationColumnMat);
    col.position.set(cx, 1.4, -2.95);
    stationGroup.add(col);
  }

  // Place station signs centered cleanly inside the car windows and opposite the side doors
  const signXs = [-24.5, -20.45, -18.55, -14.5, -5.0, -0.95, 0.95, 5.0, 14.5, 18.55, 20.45, 24.5];
  for (const sx of signXs) {
    const signBoard = new THREE.Mesh(stationSignGeo, stationSignMat);
    signBoard.position.set(sx, 1.52, -2.42);
    stationGroup.add(signBoard);
  }

  const lightXs = [-19.5, -6.0, 0, 6.0, 19.5];
  for (const lx of lightXs) {
    const diffuser = new THREE.Mesh(stationLightDiffuserGeo, stationLightMat);
    diffuser.position.set(lx, 2.68, -2.55);
    stationGroup.add(diffuser);
  }

  // 2 Pooled station point lights to illuminate the platform and signs when doors open
  const platformLight1 = new THREE.PointLight(0xffe6ba, 1.15, 14, 1.5);
  platformLight1.position.set(-2.5, 2.45, -2.25);
  stationGroup.add(platformLight1);

  const platformLight2 = new THREE.PointLight(0xffe6ba, 1.15, 14, 1.5);
  platformLight2.position.set(2.5, 2.45, -2.25);
  stationGroup.add(platformLight2);

  root.add(stationGroup);

  const setStationInfo = (
    stopName: string,
    routeLabel: string,
    bulletColor: string,
    isOpenAir: boolean
  ): void => {
    signHelper.updateSign(stopName, routeLabel, bulletColor);
    undergroundBackWall.visible = !isOpenAir;
    elevatedGroup.visible = isOpenAir;

    const lightColor = isOpenAir ? 0xffb35c : 0xffe6ba;
    platformLight1.color.setHex(lightColor);
    platformLight2.color.setHex(lightColor);
    stationLightMat.emissive.setHex(lightColor);
  };

  const step = (
    dtSec: number,
    trainSpeedMps: number,
    stationDistanceM: number,
    isOpenAir: boolean
  ): void => {
    // Train travels toward -x (FORWARD_X = -1); scenery streams toward +x
    const streamDeltaX = -FORWARD_X * trainSpeedMps * dtSec;

    // Station is ahead in the direction of travel (-x), so its world X is -stationDistanceM
    const stationWorldX = FORWARD_X * stationDistanceM;
    const stationVisible = Math.abs(stationDistanceM) <= 85;
    stationGroup.visible = stationVisible;
    if (stationVisible) {
      stationGroup.position.x = stationWorldX;
    }

    const halfPlatform = STATION_PLATFORM_LENGTH / 2 - 1.0;

    for (const ring of pooledRings) {
      const nextX = wrapTunnelRingX(ring.group.position.x + streamDeltaX, TUNNEL_HALF_SPAN);
      ring.group.position.x = nextX;

      const overlapsStation =
        stationVisible && Math.abs(nextX - stationWorldX) < halfPlatform;
      ring.negZFixturesGroup.visible = !overlapsStation && !isOpenAir;
      ring.wallPosZ.visible = !isOpenAir;
      ring.ceilingBeam.visible = !isOpenAir;
    }
  };

  const dispose = (): void => {
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
    for (const tex of textures) tex.dispose();
  };

  return {
    root,
    stationGroup,
    step,
    setStationInfo,
    dispose,
  };
}
