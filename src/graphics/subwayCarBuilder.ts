import * as THREE from 'three';
import {
  ADS_ACROSS_AISLE,
  ADS_NEAR_SEAT,
  CAR_CENTERS_X,
  CAR_HEIGHT,
  CAR_LENGTH,
  CAR_WIDTH,
  FLUORESCENT_LIGHT_COLOR,
  GANGWAY_CENTERS_X,
  GANGWAY_DOOR_TRIGGER_DIST_X,
  GANGWAY_HEIGHT,
  GANGWAY_LENGTH,
  GANGWAY_WIDTH,
} from '../constants';
import {
  createAdTexture,
  createCarNumberPlateTexture,
  createRouteMapTexture,
  createSpeckledFloorTexture,
  createWindowResidueTexture,
} from './textureGenerator';

import { ROUTE_METADATA } from '../constants';
import type { ActiveAnomalyInstance, RouteLineId } from '../types';

export interface GangwayDoorRig {
  centerX: number;
  leftLeaf: THREE.Mesh;
  rightLeaf: THREE.Mesh;
  openProgress: number; // 0 = closed, 1 = open
}

export interface SideDoorPairRig {
  carId: 'A' | 'B' | 'C';
  doorCenterX: number;
  sideSign: -1 | 1; // -1 = platform side (-Z, across from player seat), +1 = track side (+Z)
  leftLeaf: THREE.Mesh;
  rightLeaf: THREE.Mesh;
}

export interface SubwayConsistRig {
  root: THREE.Group;
  gangwayDoors: GangwayDoorRig[];
  sideDoorPairs: SideDoorPairRig[];
  sideDoorsLeft: THREE.Mesh[];
  sideDoorsRight: THREE.Mesh[];
  ceilingTubes: THREE.Mesh[];
  adMeshes: THREE.Mesh[];
  routeMapMeshes: THREE.Mesh[];
  updateGangwayDoors: (playerX: number, dtSec: number) => void;
  updateSideDoors: (openProgress: number, side?: 'platform' | 'both') => void;
  updateRouteMaps: (
    route: RouteLineId,
    hollowStAnomaly?: boolean,
    overrideBulletColor?: string
  ) => void;
  applyCarAnomaly: (anomaly: ActiveAnomalyInstance | null, route: RouteLineId) => void;
  setCeilingLightIntensity: (multiplier: number) => void;
  dispose: () => void;
}


/**
 * Builds the procedural 3-car consist:
 * - Car A (lead, x ≈ -19.5)
 * - Car B (mid, x ≈ 0)
 * - Car C (rear, x ≈ +19.5)
 * - 2 Gangway bellows & sliding doors between A↔B (x = -9.75) and B↔C (x = +9.75)
 * Shares geometries and materials across cars for minimal memory and draw calls.
 */
export function buildSubwayConsist(maxAnisotropy = 4): SubwayConsistRig {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const gangwayDoors: GangwayDoorRig[] = [];
  const sideDoorPairs: SideDoorPairRig[] = [];
  const sideDoorsLeft: THREE.Mesh[] = [];
  const sideDoorsRight: THREE.Mesh[] = [];
  const ceilingTubes: THREE.Mesh[] = [];
  const adMeshes: THREE.Mesh[] = [];
  const routeMapMeshes: THREE.Mesh[] = [];

  // Shared PBR Materials
  const floorTex = createSpeckledFloorTexture(maxAnisotropy);
  textures.push(floorTex);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex,
    roughness: 0.84,
    metalness: 0.08,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xd8d2c5,
    roughness: 0.62,
    metalness: 0.08,
  });

  const wallMelamineMat = new THREE.MeshStandardMaterial({
    color: 0xcbc4b4,
    roughness: 0.56,
    metalness: 0.1,
  });

  const lowerWallTrimMat = new THREE.MeshStandardMaterial({
    color: 0x262928,
    roughness: 0.72,
    metalness: 0.18,
  });

  const stainlessSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcfd4d8,
    roughness: 0.24,
    metalness: 0.88,
  });

  const benchShellMat = new THREE.MeshStandardMaterial({
    color: 0x2e4252,
    roughness: 0.48,
    metalness: 0.14,
  });

  const benchSeatDivideMat = new THREE.MeshStandardMaterial({
    color: 0x1e2c38,
    roughness: 0.58,
    metalness: 0.12,
  });

  const doorMetalMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    roughness: 0.36,
    metalness: 0.68,
  });

  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x06090b,
    roughness: 0.14,
    metalness: 0.25,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const tubeWarmMat = new THREE.MeshStandardMaterial({
    color: FLUORESCENT_LIGHT_COLOR,
    emissive: FLUORESCENT_LIGHT_COLOR,
    emissiveIntensity: 1.45,
    roughness: 0.28,
  });

  const bellowsRubberMat = new THREE.MeshStandardMaterial({
    color: 0x141615,
    roughness: 0.88,
    metalness: 0.06,
  });

  materials.push(
    floorMat,
    ceilingMat,
    wallMelamineMat,
    lowerWallTrimMat,
    stainlessSteelMat,
    benchShellMat,
    benchSeatDivideMat,
    doorMetalMat,
    windowGlassMat,
    tubeWarmMat,
    bellowsRubberMat
  );

  // Shared Geometries (with lower wall split around the two 1.36m side doorways at x = ±5.0)
  const floorGeo = new THREE.BoxGeometry(CAR_LENGTH, 0.08, CAR_WIDTH);
  const ceilingGeo = new THREE.BoxGeometry(CAR_LENGTH, 0.08, CAR_WIDTH);
  const lowerWallEndGeo = new THREE.BoxGeometry(3.12, 0.90, 0.06);
  const lowerWallMidGeo = new THREE.BoxGeometry(8.64, 0.90, 0.06);
  const upperHeaderWallGeo = new THREE.BoxGeometry(CAR_LENGTH, 0.50, 0.06);
  const windowPillarGeo = new THREE.BoxGeometry(0.28, 1.02, 0.06);
  const windowGlassGeo = new THREE.PlaneGeometry(1.75, 1.0);
  const sideDoorLeafGeo = new THREE.BoxGeometry(0.68, 1.92, 0.04);
  const bulkheadWallGeo = new THREE.BoxGeometry(0.09, CAR_HEIGHT, (CAR_WIDTH - GANGWAY_WIDTH) / 2);
  const bulkheadHeaderGeo = new THREE.BoxGeometry(0.09, CAR_HEIGHT - GANGWAY_HEIGHT, GANGWAY_WIDTH);
  const gangwayDoorLeafGeo = new THREE.BoxGeometry(0.05, GANGWAY_HEIGHT - 0.04, GANGWAY_WIDTH / 2 + 0.04);

  const benchBaseGeo = new THREE.BoxGeometry(3.4, 0.44, 0.48);
  const benchBackGeo = new THREE.BoxGeometry(3.4, 0.46, 0.08);
  const poleVertGeo = new THREE.CylinderGeometry(0.022, 0.022, CAR_HEIGHT - 0.08, 12);
  const poleHorizGeo = new THREE.CylinderGeometry(0.018, 0.018, CAR_LENGTH - 1.2, 10);
  poleHorizGeo.rotateZ(Math.PI / 2);

  const tubeDiffuserGeo = new THREE.BoxGeometry(2.6, 0.045, 0.2);
  const adPlaneGeo = new THREE.PlaneGeometry(1.42, 0.38);
  const routeMapPlaneGeo = new THREE.PlaneGeometry(2.15, 0.38);
  const numberPlateGeo = new THREE.PlaneGeometry(0.56, 0.22);

  const bellowsRibGeo = new THREE.BoxGeometry(0.14, GANGWAY_HEIGHT + 0.16, GANGWAY_WIDTH + 0.24);
  const gangwayFloorGeo = new THREE.BoxGeometry(GANGWAY_LENGTH + 0.2, 0.08, GANGWAY_WIDTH + 0.12);

  geometries.push(
    floorGeo,
    ceilingGeo,
    lowerWallEndGeo,
    lowerWallMidGeo,
    upperHeaderWallGeo,
    windowPillarGeo,
    windowGlassGeo,
    sideDoorLeafGeo,
    bulkheadWallGeo,
    bulkheadHeaderGeo,
    gangwayDoorLeafGeo,
    benchBaseGeo,
    benchBackGeo,
    poleVertGeo,
    poleHorizGeo,
    tubeDiffuserGeo,
    adPlaneGeo,
    routeMapPlaneGeo,
    numberPlateGeo,
    bellowsRibGeo,
    gangwayFloorGeo
  );

  // Pre-build Ad & Route Map Materials (with polygonOffset to prevent coplanar Z-fighting)
  const acrossAdMaterials = ADS_ACROSS_AISLE.map((ad) => {
    const tex = createAdTexture(ad, maxAnisotropy);
    textures.push(tex);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      roughness: 0.42,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materials.push(mat);
    return { ad, mat };
  });

  const nearAdMaterials = ADS_NEAR_SEAT.map((ad) => {
    const tex = createAdTexture(ad, maxAnisotropy);
    textures.push(tex);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      roughness: 0.42,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materials.push(mat);
    return { ad, mat };
  });

  const routeMapTex = createRouteMapTexture(maxAnisotropy);
  textures.push(routeMapTex);
  const routeMapMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: routeMapTex,
    roughness: 0.38,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  materials.push(routeMapMat);

  const carDefinitions: ReadonlyArray<{
    id: 'A' | 'B' | 'C';
    centerX: number;
    plateLabel: string;
  }> = [
    { id: 'A', centerX: CAR_CENTERS_X.A, plateLabel: 'CAR 4812 · A (LEAD)' },
    { id: 'B', centerX: CAR_CENTERS_X.B, plateLabel: 'CAR 4813 · B (MID)' },
    { id: 'C', centerX: CAR_CENTERS_X.C, plateLabel: 'CAR 4814 · C (REAR)' },
  ];

  const halfW = CAR_WIDTH / 2;
  const halfL = CAR_LENGTH / 2;

  for (const carDef of carDefinitions) {
    const carGroup = new THREE.Group();
    carGroup.name = `Car_${carDef.id}`;
    carGroup.position.set(carDef.centerX, 0, 0);

    // 1. Floor & Ceiling
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.04, 0);
    carGroup.add(floor);

    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.set(0, CAR_HEIGHT + 0.04, 0);
    carGroup.add(ceiling);

    // 2. Side Walls, Windows, and Side Doors (+Z and -Z)
    for (const sideSign of [-1, 1] as const) {
      const wallZ = sideSign * (halfW - 0.03);

      // Lower wall split into 3 segments so doorways at x = ±5.0 are completely open to floor level
      const lowerLeft = new THREE.Mesh(lowerWallEndGeo, lowerWallTrimMat);
      lowerLeft.position.set(-7.24, 0.45, wallZ);
      carGroup.add(lowerLeft);

      const lowerMid = new THREE.Mesh(lowerWallMidGeo, lowerWallTrimMat);
      lowerMid.position.set(0, 0.45, wallZ);
      carGroup.add(lowerMid);

      const lowerRight = new THREE.Mesh(lowerWallEndGeo, lowerWallTrimMat);
      lowerRight.position.set(7.24, 0.45, wallZ);
      carGroup.add(lowerRight);

      const upperWall = new THREE.Mesh(upperHeaderWallGeo, wallMelamineMat);
      upperWall.position.set(0, CAR_HEIGHT - 0.25, wallZ);
      carGroup.add(upperWall);

      // Pillars & window panes (strictly spanning y = 0.90 to y = 1.92 without overlapping upperWall)
      const pillarXs = [-8.2, -6.1, -3.9, -1.9, 0, 1.9, 3.9, 6.1, 8.2];
      for (const px of pillarXs) {
        const pillar = new THREE.Mesh(windowPillarGeo, wallMelamineMat);
        pillar.position.set(px, 1.41, wallZ - sideSign * 0.008);
        carGroup.add(pillar);
      }

      const windowCenterXs = [-7.15, -2.9, -0.95, 0.95, 2.9, 7.15];
      for (const wx of windowCenterXs) {
        const glass = new THREE.Mesh(windowGlassGeo, windowGlassMat);
        glass.position.set(wx, 1.41, wallZ - sideSign * 0.045);
        glass.rotation.y = sideSign > 0 ? Math.PI : 0;
        glass.renderOrder = 2;
        carGroup.add(glass);
      }

      // 2 Side Door pairs per car side (at x = -5.0 and x = +5.0), inset in a clean pocket
      for (const doorCenterX of [-5.0, 5.0]) {
        const leftLeaf = new THREE.Mesh(sideDoorLeafGeo, doorMetalMat);
        leftLeaf.position.set(doorCenterX - 0.34, 0.96, wallZ - sideSign * 0.055);
        carGroup.add(leftLeaf);

        const rightLeaf = new THREE.Mesh(sideDoorLeafGeo, doorMetalMat);
        rightLeaf.position.set(doorCenterX + 0.34, 0.96, wallZ - sideSign * 0.055);
        carGroup.add(rightLeaf);

        sideDoorPairs.push({
          carId: carDef.id,
          doorCenterX,
          sideSign,
          leftLeaf,
          rightLeaf,
        });

        if (sideSign < 0) {
          sideDoorsRight.push(leftLeaf, rightLeaf);
        } else {
          sideDoorsLeft.push(leftLeaf, rightLeaf);
        }
      }
    }

    // 3. End Bulkheads framing the Gangway Doorway (at x = -halfL and x = +halfL)
    const bulkheadSideOffsetZ = (GANGWAY_WIDTH + (CAR_WIDTH - GANGWAY_WIDTH) / 2) / 2;
    const plateTex = createCarNumberPlateTexture(carDef.plateLabel, maxAnisotropy);
    textures.push(plateTex);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plateTex,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materials.push(plateMat);

    for (const endSign of [-1, 1] as const) {
      const endX = endSign * (halfL - 0.045);

      for (const zSign of [-1, 1] as const) {
        const sideBulkhead = new THREE.Mesh(bulkheadWallGeo, wallMelamineMat);
        sideBulkhead.position.set(endX, CAR_HEIGHT / 2, zSign * bulkheadSideOffsetZ);
        carGroup.add(sideBulkhead);
      }

      const headerBulkhead = new THREE.Mesh(bulkheadHeaderGeo, wallMelamineMat);
      headerBulkhead.position.set(
        endX,
        GANGWAY_HEIGHT + (CAR_HEIGHT - GANGWAY_HEIGHT) / 2,
        0
      );
      carGroup.add(headerBulkhead);

      // Car number plate above the gangway doorway
      const plate = new THREE.Mesh(numberPlateGeo, plateMat);
      plate.position.set(endX - endSign * 0.055, GANGWAY_HEIGHT + 0.16, 0);
      plate.rotation.y = endSign > 0 ? -Math.PI / 2 : Math.PI / 2;
      carGroup.add(plate);
    }

    // 4. Molded Fiberglass Benches along both sides (between doors)
    const benchXs = [-7.0, 0, 7.0];
    for (const sideSign of [-1, 1] as const) {
      const seatZ = sideSign * (halfW - 0.32);
      const backZ = sideSign * (halfW - 0.11);
      for (const bx of benchXs) {
        const seat = new THREE.Mesh(benchBaseGeo, benchShellMat);
        seat.position.set(bx, 0.22, seatZ);
        carGroup.add(seat);

        const backrest = new THREE.Mesh(benchBackGeo, benchShellMat);
        backrest.position.set(bx, 0.65, backZ);
        carGroup.add(backrest);
      }
    }

    // 5. Stainless Steel Vertical Grab Poles & Overhead Horizontal Bars
    const poleXs = [-6.4, -3.4, -1.6, 1.6, 3.4, 6.4];
    for (const px of poleXs) {
      for (const pz of [-0.56, 0.56]) {
        const pole = new THREE.Mesh(poleVertGeo, stainlessSteelMat);
        pole.position.set(px, CAR_HEIGHT / 2, pz);
        carGroup.add(pole);
      }
    }

    for (const barZ of [-0.56, 0.56]) {
      const horizBar = new THREE.Mesh(poleHorizGeo, stainlessSteelMat);
      horizBar.position.set(0, 2.08, barZ);
      carGroup.add(horizBar);
    }

    // 6. Ceiling Fluorescent Diffuser Tubes
    const tubeXs = [-6.2, -2.1, 2.1, 6.2];
    for (const tx of tubeXs) {
      for (const tz of [-0.96, 0.96]) {
        const tube = new THREE.Mesh(tubeDiffuserGeo, tubeWarmMat);
        tube.position.set(tx, CAR_HEIGHT - 0.04, tz);
        tube.userData = { carId: carDef.id, tubeX: tx, tubeZ: tz };
        carGroup.add(tube);
        ceilingTubes.push(tube);
      }
    }

    // 7. Overhead Cove Advertisements & Strip Route Maps
    // Placed cleanly on the upper header panel (y = 2.15, z = ±(halfW - 0.08))
    const adXs = [-6.8, -3.2, 0, 3.2, 6.8];
    adXs.forEach((ax, idx) => {
      const acrossEntry = acrossAdMaterials[idx % acrossAdMaterials.length];
      if (acrossEntry) {
        const adMesh = new THREE.Mesh(adPlaneGeo, acrossEntry.mat);
        adMesh.position.set(ax, 2.15, -(halfW - 0.075));
        adMesh.userData = {
          carId: carDef.id,
          slotIndex: idx,
          adId: acrossEntry.ad.id,
          placement: 'across',
          baseMaterial: acrossEntry.mat,
        };
        carGroup.add(adMesh);
        adMeshes.push(adMesh);
      }

      const nearEntry = nearAdMaterials[idx % nearAdMaterials.length];
      if (nearEntry && idx < 4) {
        const nearMesh = new THREE.Mesh(adPlaneGeo, nearEntry.mat);
        nearMesh.position.set(ax, 2.15, halfW - 0.075);
        nearMesh.rotation.y = Math.PI;
        nearMesh.userData = {
          carId: carDef.id,
          slotIndex: idx,
          adId: nearEntry.ad.id,
          placement: 'near',
          baseMaterial: nearEntry.mat,
        };
        carGroup.add(nearMesh);
        adMeshes.push(nearMesh);
      }
    });

    // Route maps above side doors (plus a central strip map at x = -1.6 across from player seat)
    for (const sideSign of [-1, 1] as const) {
      const mapXs = sideSign === -1 ? [-5.0, -1.6, 5.0] : [-5.0, 5.0];
      for (const mapX of mapXs) {
        const mapMesh = new THREE.Mesh(routeMapPlaneGeo, routeMapMat);
        mapMesh.position.set(mapX, 2.15, sideSign * (halfW - 0.075));
        mapMesh.rotation.y = sideSign > 0 ? Math.PI : 0;
        mapMesh.userData = { carId: carDef.id, mapX, sideSign };
        carGroup.add(mapMesh);
        routeMapMeshes.push(mapMesh);
      }
    }

    root.add(carGroup);
  }

  // Cold sterile blue fluorescent material for "The Cold Panel" anomaly
  const tubeColdBlueMat = new THREE.MeshStandardMaterial({
    color: 0xd9f2ff,
    emissive: 0x6ec6ff,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });
  materials.push(tubeColdBlueMat);

  // Window residue decal mesh in Car B across from seat (x = -0.95, y = 1.44, z = -(CAR_WIDTH/2 - 0.078))
  const residueGeo = new THREE.PlaneGeometry(0.42, 0.42);
  geometries.push(residueGeo);
  const stickerTex = createWindowResidueTexture('sticker', maxAnisotropy);
  const stainTex = createWindowResidueTexture('stain', maxAnisotropy);
  textures.push(stickerTex, stainTex);
  const residueMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stickerTex,
    transparent: true,
    roughness: 0.35,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  materials.push(residueMat);
  const windowResidueMesh = new THREE.Mesh(residueGeo, residueMat);
  windowResidueMesh.position.set(-0.95, 1.44, -(CAR_WIDTH / 2 - 0.078));
  windowResidueMesh.visible = false;
  root.add(windowResidueMesh);

  // 8. Gangway Bellows & Sliding Gangway Doors between Cars A↔B (-9.75) and B↔C (+9.75)
  for (const gangwayX of GANGWAY_CENTERS_X) {
    const gangwayGroup = new THREE.Group();
    gangwayGroup.position.set(gangwayX, 0, 0);

    const gFloor = new THREE.Mesh(gangwayFloorGeo, floorMat);
    gFloor.position.set(0, -0.03, 0);
    gangwayGroup.add(gFloor);

    // Ribbed accordion bellows folds
    const ribOffsets = [-0.72, -0.44, -0.15, 0.15, 0.44, 0.72];
    for (const rx of ribOffsets) {
      const rib = new THREE.Mesh(bellowsRibGeo, bellowsRubberMat);
      rib.position.set(rx, GANGWAY_HEIGHT / 2, 0);
      gangwayGroup.add(rib);
    }

    // Sliding gangway door leaves
    const leftLeaf = new THREE.Mesh(gangwayDoorLeafGeo, doorMetalMat);
    leftLeaf.position.set(0, GANGWAY_HEIGHT / 2, -GANGWAY_WIDTH / 4);
    gangwayGroup.add(leftLeaf);

    const rightLeaf = new THREE.Mesh(gangwayDoorLeafGeo, doorMetalMat);
    rightLeaf.position.set(0, GANGWAY_HEIGHT / 2, GANGWAY_WIDTH / 4);
    gangwayGroup.add(rightLeaf);

    gangwayDoors.push({
      centerX: gangwayX,
      leftLeaf,
      rightLeaf,
      openProgress: 0,
    });

    root.add(gangwayGroup);
  }

  const updateGangwayDoors = (playerX: number, dtSec: number): void => {
    const closedOffsetZ = GANGWAY_WIDTH / 4;
    const openSlideZ = GANGWAY_WIDTH / 2 + 0.08;

    for (const door of gangwayDoors) {
      const dist = Math.abs(playerX - door.centerX);
      const targetOpen = dist <= GANGWAY_DOOR_TRIGGER_DIST_X ? 1 : 0;
      const speed = 4.5;
      door.openProgress += (targetOpen - door.openProgress) * Math.min(1, dtSec * speed);

      const offset = closedOffsetZ + door.openProgress * openSlideZ;
      door.leftLeaf.position.z = -offset;
      door.rightLeaf.position.z = offset;
    }
  };

  const updateSideDoors = (openProgress: number, side: 'platform' | 'both' = 'platform'): void => {
    const clamped = Math.max(0, Math.min(1, openProgress));
    const slideDistX = 0.62 * clamped;

    for (const pair of sideDoorPairs) {
      const shouldOpen = side === 'both' || pair.sideSign === -1;
      const offset = shouldOpen ? slideDistX : 0;
      pair.leftLeaf.position.x = pair.doorCenterX - 0.34 - offset;
      pair.rightLeaf.position.x = pair.doorCenterX + 0.34 + offset;
    }
  };

  const updateRouteMaps = (
    route: RouteLineId,
    hollowStAnomaly = false,
    overrideBulletColor?: string
  ): void => {
    const meta = ROUTE_METADATA[route];
    const nextTex = createRouteMapTexture(maxAnisotropy, {
      stops: meta.stops,
      bulletLabel: meta.id,
      bulletColor: overrideBulletColor ?? meta.bulletColor,
      hollowStAnomaly,
    });
    textures.push(nextTex);
    routeMapMat.map = nextTex;
    routeMapMat.needsUpdate = true;
  };

  let lastAppliedAnomalyKey = '';

  const applyCarAnomaly = (
    anomaly: ActiveAnomalyInstance | null,
    route: RouteLineId
  ): void => {
    const active = anomaly && anomaly.manifested && !anomaly.caught ? anomaly : null;
    const key = active
      ? `${active.id}:${active.variantKey}:${active.adIndex ?? ''}:${route}`
      : `none:${route}`;
    if (key === lastAppliedAnomalyKey) return;
    lastAppliedAnomalyKey = key;

    // 1. Reset Car B across-the-aisle ad materials, window residue, cold ceiling tube, and route map
    for (const mesh of adMeshes) {
      if (mesh.userData.carId === 'B' && mesh.userData.baseMaterial) {
        mesh.material = mesh.userData.baseMaterial as THREE.Material;
      }
    }
    windowResidueMesh.visible = false;
    for (const tube of ceilingTubes) {
      tube.material = tubeWarmMat;
    }
    updateRouteMaps(route, false);

    if (!active) return;

    switch (active.id) {
      case 'misprint':
      case 'warped_copy':
      case 'color_drift': {
        const slotIdx = active.adIndex ?? 2;
        const adDef =
          ADS_ACROSS_AISLE[slotIdx % ADS_ACROSS_AISLE.length] ?? ADS_ACROSS_AISLE[0]!;
        const targetMesh = adMeshes.find(
          (m) =>
            m.userData.carId === 'B' &&
            m.userData.placement === 'across' &&
            m.userData.slotIndex === slotIdx
        );
        if (targetMesh) {
          const overrideTex = createAdTexture(
            adDef,
            maxAnisotropy,
            active.adSwappedHeadline,
            active.adShiftedBgColor
          );
          textures.push(overrideTex);
          const overrideMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: overrideTex,
            roughness: 0.42,
            metalness: 0.06,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });
          materials.push(overrideMat);
          targetMesh.material = overrideMat;
        }
        break;
      }

      case 'window_residue': {
        residueMat.map = active.variantKey === 'stain' ? stainTex : stickerTex;
        residueMat.needsUpdate = true;
        windowResidueMesh.visible = true;
        break;
      }

      case 'cold_panel': {
        for (const tube of ceilingTubes) {
          if (
            tube.userData.carId === 'B' &&
            Math.abs(Number(tube.userData.tubeX) - -2.1) < 0.2
          ) {
            tube.material = tubeColdBlueMat;
          }
        }
        break;
      }

      case 'route_map_error': {
        if (active.variantKey === 'wrong_color') {
          updateRouteMaps(route, false, '#c84b9e');
        } else {
          updateRouteMaps(route, true);
        }
        break;
      }

      default:
        break;
    }
  };

  const setCeilingLightIntensity = (multiplier: number): void => {
    const clamped = Math.max(0.04, Math.min(1.6, multiplier));
    tubeWarmMat.emissiveIntensity = 1.45 * clamped;
  };

  const dispose = (): void => {
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
    for (const tex of textures) tex.dispose();
  };

  return {
    root,
    gangwayDoors,
    sideDoorPairs,
    sideDoorsLeft,
    sideDoorsRight,
    ceilingTubes,
    adMeshes,
    routeMapMeshes,
    updateGangwayDoors,
    updateSideDoors,
    updateRouteMaps,
    applyCarAnomaly,
    setCeilingLightIntensity,
    dispose,
  };
}

