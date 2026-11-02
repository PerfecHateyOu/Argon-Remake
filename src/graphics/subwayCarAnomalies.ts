import * as THREE from 'three';
import {
  ADS_ACROSS_AISLE,
  ADS_NEAR_SEAT,
  CAR_HEIGHT,
  CAR_LENGTH,
  CAR_WIDTH,
  DOOR_TUBE_IDX,
  FLUORESCENT_LIGHT_COLOR,
  GANGWAY_HEIGHT,
  GANGWAY_LENGTH,
  GANGWAY_WIDTH,
} from '../constants';
import type { ActiveAnomalyInstance, RouteLineId } from '../types';
import {
  createAdTexture,
  createRouteMapTexture,
  createSpeckledFloorTexture,
  createWindowResidueTexture,
} from './textureGenerator';

export interface ConsistSharedAssets {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
  floorMat: THREE.MeshStandardMaterial;
  ceilingMat: THREE.MeshStandardMaterial;
  wallMelamineMat: THREE.MeshStandardMaterial;
  lowerWallTrimMat: THREE.MeshStandardMaterial;
  stainlessSteelMat: THREE.MeshStandardMaterial;
  benchShellMat: THREE.MeshStandardMaterial;
  doorMetalMat: THREE.MeshStandardMaterial;
  windowGlassMat: THREE.MeshStandardMaterial;
  tubeWarmMat: THREE.MeshStandardMaterial;
  doorTubeMat: THREE.MeshStandardMaterial;
  tubeColdBlueMat: THREE.MeshStandardMaterial;
  bellowsRubberMat: THREE.MeshStandardMaterial;
  routeMapMat: THREE.MeshStandardMaterial;
  residueMat: THREE.MeshStandardMaterial;
  stickerTex: THREE.Texture;
  stainTex: THREE.Texture;
  acrossAdMaterials: Array<{ ad: (typeof ADS_ACROSS_AISLE)[number]; mat: THREE.MeshStandardMaterial }>;
  nearAdMaterials: Array<{ ad: (typeof ADS_NEAR_SEAT)[number]; mat: THREE.MeshStandardMaterial }>;
  floorGeo: THREE.BoxGeometry;
  ceilingGeo: THREE.BoxGeometry;
  lowerWallEndGeo: THREE.BoxGeometry;
  lowerWallMidGeo: THREE.BoxGeometry;
  upperHeaderWallGeo: THREE.BoxGeometry;
  windowPillarGeo: THREE.BoxGeometry;
  windowGlassGeo: THREE.PlaneGeometry;
  sideDoorLeafGeo: THREE.BoxGeometry;
  bulkheadWallGeo: THREE.BoxGeometry;
  bulkheadHeaderGeo: THREE.BoxGeometry;
  gangwayDoorLeafGeo: THREE.BoxGeometry;
  benchBaseGeo: THREE.BoxGeometry;
  benchBackGeo: THREE.BoxGeometry;
  poleVertGeo: THREE.CylinderGeometry;
  poleHorizGeo: THREE.CylinderGeometry;
  tubeDiffuserGeo: THREE.BoxGeometry;
  adPlaneGeo: THREE.PlaneGeometry;
  routeMapPlaneGeo: THREE.PlaneGeometry;
  numberPlateGeo: THREE.PlaneGeometry;
  bellowsRibGeo: THREE.BoxGeometry;
  gangwayFloorGeo: THREE.BoxGeometry;
  residueGeo: THREE.PlaneGeometry;
}

export function createConsistMaterialsAndGeometries(maxAnisotropy: number): ConsistSharedAssets {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

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
  const doorTubeMat = new THREE.MeshStandardMaterial({
    color: FLUORESCENT_LIGHT_COLOR,
    emissive: FLUORESCENT_LIGHT_COLOR,
    emissiveIntensity: 1.45,
    roughness: 0.28,
  });
  const tubeColdBlueMat = new THREE.MeshStandardMaterial({
    color: 0xd9f2ff,
    emissive: 0x6ec6ff,
    emissiveIntensity: 1.9,
    roughness: 0.2,
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
    doorMetalMat,
    windowGlassMat,
    tubeWarmMat,
    doorTubeMat,
    tubeColdBlueMat,
    bellowsRubberMat
  );

  const floorGeo = new THREE.BoxGeometry(CAR_LENGTH, 0.08, CAR_WIDTH);
  const ceilingGeo = new THREE.BoxGeometry(CAR_LENGTH, 0.08, CAR_WIDTH);
  const lowerWallEndGeo = new THREE.BoxGeometry(3.12, 0.9, 0.06);
  const lowerWallMidGeo = new THREE.BoxGeometry(8.64, 0.9, 0.06);
  const upperHeaderWallGeo = new THREE.BoxGeometry(CAR_LENGTH, 0.5, 0.06);
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
  const tubeDiffuserGeo = new THREE.BoxGeometry(2.4, 0.045, 0.2);
  const adPlaneGeo = new THREE.PlaneGeometry(1.42, 0.38);
  const routeMapPlaneGeo = new THREE.PlaneGeometry(2.15, 0.38);
  const numberPlateGeo = new THREE.PlaneGeometry(0.56, 0.22);
  const bellowsRibGeo = new THREE.BoxGeometry(0.14, GANGWAY_HEIGHT + 0.16, GANGWAY_WIDTH + 0.24);
  const gangwayFloorGeo = new THREE.BoxGeometry(GANGWAY_LENGTH + 0.2, 0.08, GANGWAY_WIDTH + 0.12);
  const residueGeo = new THREE.PlaneGeometry(0.42, 0.42);

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
    gangwayFloorGeo,
    residueGeo
  );

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

  return {
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
  };
}

export interface CarAnomalyContext {
  adMeshes: THREE.Mesh[];
  ceilingTubes: THREE.Mesh[];
  lightSegs: THREE.Mesh[];
  windowResidueMesh: THREE.Mesh;
  residueMat: THREE.MeshStandardMaterial;
  stickerTex: THREE.Texture;
  stainTex: THREE.Texture;
  tubeWarmMat: THREE.MeshStandardMaterial;
  doorTubeMat: THREE.MeshStandardMaterial;
  tubeColdBlueMat: THREE.MeshStandardMaterial;
  maxAnisotropy: number;
  textures: THREE.Texture[];
  materials: THREE.Material[];
  updateRouteMaps: (
    route: RouteLineId,
    hollowStAnomaly?: boolean,
    overrideBulletColor?: string
  ) => void;
}

export function applyCarAnomalyToMeshes(
  ctx: CarAnomalyContext,
  anomaly: ActiveAnomalyInstance | null,
  route: RouteLineId
): void {
  const {
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
  } = ctx;

  const active = anomaly && anomaly.manifested && !anomaly.caught ? anomaly : null;

  for (const mesh of adMeshes) {
    if (mesh.userData.carId === 'B' && mesh.userData.baseMaterial) {
      mesh.material = mesh.userData.baseMaterial as THREE.Material;
    }
  }
  windowResidueMesh.visible = false;
  for (const tube of ceilingTubes) {
    tube.material = tube === lightSegs[DOOR_TUBE_IDX] ? doorTubeMat : tubeWarmMat;
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
          Math.abs(Number(tube.userData.tubeX) - -2.1) < 0.2 &&
          tube !== lightSegs[DOOR_TUBE_IDX]
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
}
