import * as THREE from 'three';
import {
  CAR_CENTERS_X,
  CAR_HEIGHT,
  CAR_LENGTH,
  CAR_WIDTH,
  DOOR_TUBE_IDX,
  GANGWAY_CENTERS_X,
  GANGWAY_DOOR_TRIGGER_DIST_X,
  GANGWAY_HEIGHT,
  GANGWAY_WIDTH,
  ROUTE_METADATA,
} from '../constants';
import type { ActiveAnomalyInstance, RouteLineId } from '../types';
import {
  applyCarAnomalyToMeshes,
  createConsistMaterialsAndGeometries,
} from './subwayCarAnomalies';
import {
  createCarNumberPlateTexture,
  createRouteMapTexture,
} from './textureGenerator';

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
  lightSegs: THREE.Mesh[];
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
 * Isolates `lightSegs[DOOR_TUBE_IDX]` (`DOOR_TUBE_IDX = 1` at `x = -4.5` in Car B) so arrival door-tick
 * flickers ONLY that single fluorescent tube nearest the doors while all other tubes stay steady.
 */
export function buildSubwayConsist(maxAnisotropy = 4): SubwayConsistRig {
  const root = new THREE.Group();
  const shared = createConsistMaterialsAndGeometries(maxAnisotropy);
  const {
    geometries,
    materials,
    textures,
    floorMat,
    ceilingMat,
    wallMelamineMat,
    lowerWallTrimMat,
    stainlessSteelMat,
    benchShellMat,
    doorMetalMat,
    windowGlassMat,
    tubeWarmMat,
    doorTubeMat,
    tubeColdBlueMat,
    bellowsRubberMat,
    routeMapMat,
    residueMat,
    stickerTex,
    stainTex,
    acrossAdMaterials,
    nearAdMaterials,
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
    gangwayFloorGeo,
    residueGeo,
  } = shared;

  const gangwayDoors: GangwayDoorRig[] = [];
  const sideDoorPairs: SideDoorPairRig[] = [];
  const sideDoorsLeft: THREE.Mesh[] = [];
  const sideDoorsRight: THREE.Mesh[] = [];
  const ceilingTubes: THREE.Mesh[] = [];
  const lightSegs: THREE.Mesh[] = [];
  const adMeshes: THREE.Mesh[] = [];
  const routeMapMeshes: THREE.Mesh[] = [];

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

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.04, 0);
    carGroup.add(floor);

    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.set(0, CAR_HEIGHT + 0.04, 0);
    carGroup.add(ceiling);

    for (const sideSign of [-1, 1] as const) {
      const wallZ = sideSign * (halfW - 0.03);

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

      const plate = new THREE.Mesh(numberPlateGeo, plateMat);
      plate.position.set(endX - endSign * 0.055, GANGWAY_HEIGHT + 0.16, 0);
      plate.rotation.y = endSign > 0 ? -Math.PI / 2 : Math.PI / 2;
      carGroup.add(plate);
    }

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

    // Ceiling Fluorescent Diffuser Tubes
    // In Car B, `lightSegs` holds the platform-side (-Z) tubes at [-7.2, -4.5, -2.1, 2.1, 6.2]
    // so `lightSegs[DOOR_TUBE_IDX]` (index 1) is at `x = -4.5` nearest the doors with its own `doorTubeMat`.
    const tubeXs = [-7.2, -4.5, -2.1, 2.1, 6.2];
    tubeXs.forEach((tx, tIdx) => {
      for (const tz of [-0.96, 0.96]) {
        const isDoorTube = carDef.id === 'B' && tIdx === DOOR_TUBE_IDX && tz < 0;
        const tube = new THREE.Mesh(tubeDiffuserGeo, isDoorTube ? doorTubeMat : tubeWarmMat);
        tube.position.set(tx, CAR_HEIGHT - 0.04, tz);
        tube.userData = { carId: carDef.id, tubeX: tx, tubeZ: tz, isDoorTube };
        carGroup.add(tube);
        ceilingTubes.push(tube);
        if (carDef.id === 'B' && tz < 0) {
          lightSegs.push(tube);
        }
      }
    });

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

  const windowResidueMesh = new THREE.Mesh(residueGeo, residueMat);
  windowResidueMesh.position.set(-0.95, 1.44, -(CAR_WIDTH / 2 - 0.078));
  windowResidueMesh.visible = false;
  root.add(windowResidueMesh);

  for (const gangwayX of GANGWAY_CENTERS_X) {
    const gangwayGroup = new THREE.Group();
    gangwayGroup.position.set(gangwayX, 0, 0);

    const gFloor = new THREE.Mesh(gangwayFloorGeo, floorMat);
    gFloor.position.set(0, -0.03, 0);
    gangwayGroup.add(gFloor);

    const ribOffsets = [-0.72, -0.44, -0.15, 0.15, 0.44, 0.72];
    for (const rx of ribOffsets) {
      const rib = new THREE.Mesh(bellowsRibGeo, bellowsRubberMat);
      rib.position.set(rx, GANGWAY_HEIGHT / 2, 0);
      gangwayGroup.add(rib);
    }

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

    applyCarAnomalyToMeshes(
      {
        adMeshes,
        ceilingTubes,
        lightSegs,
        windowResidueMesh,
        residueMat,
        stickerTex,
        stainTex,
        tubeWarmMat,
        doorTubeMat,
        tubeColdBlueMat,
        maxAnisotropy,
        textures,
        materials,
        updateRouteMaps,
      },
      anomaly,
      route
    );
  };

  // Single-tube door-tick isolation: ONLY `lightSegs[DOOR_TUBE_IDX]` (`doorTubeMat` at `x = -4.5`) flickers.
  // Every other ceiling tube in the car (`tubeWarmMat`) remains completely steady at 1.45.
  const setCeilingLightIntensity = (multiplier: number): void => {
    const clamped = Math.max(0.04, Math.min(1.6, multiplier));
    tubeWarmMat.emissiveIntensity = 1.45;
    doorTubeMat.emissiveIntensity = 1.45 * clamped;
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
    lightSegs,
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
