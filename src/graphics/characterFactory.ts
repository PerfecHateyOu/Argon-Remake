import * as THREE from 'three';
import type { PassengerArchetype } from '../types';

export interface CharacterActorRig {
  id: string;
  label: string;
  archetype: PassengerArchetype;
  carId: 'A' | 'B' | 'C';
  isParent: boolean;
  isCrowdExtra: boolean;
  root: THREE.Group;
  headGroup: THREE.Group;
  baseWorldX: number;
  baseWorldZ: number;
  baseFacingYaw: number;
  targetLocalYaw: number;
  targetLocalPitch: number;
  leftPupil?: THREE.Mesh;
  rightPupil?: THREE.Mesh;
  eyelids?: THREE.Mesh[];
}

export interface CharacterMeshPool {
  root: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  allActors: CharacterActorRig[];
  skinWarmMat: THREE.MeshStandardMaterial;
  skinPaleMat: THREE.MeshStandardMaterial;
  skinDeepMat: THREE.MeshStandardMaterial;
  momSkinMat: THREE.MeshStandardMaterial;
  hairDarkMat: THREE.MeshStandardMaterial;
  hairSaltPepperMat: THREE.MeshStandardMaterial;
  momCoatMat: THREE.MeshStandardMaterial;
  momScarfMat: THREE.MeshStandardMaterial;
  dadJacketMat: THREE.MeshStandardMaterial;
  glassesMetalMat: THREE.MeshStandardMaterial;
  mtaNavyMat: THREE.MeshStandardMaterial;
  mtaHiVisMat: THREE.MeshStandardMaterial;
  mtaHardHatMat: THREE.MeshStandardMaterial;
  burgundyCoatMat: THREE.MeshStandardMaterial;
  canvasToteMat: THREE.MeshStandardMaterial;
  pufferTealMat: THREE.MeshStandardMaterial;
  hoodieNavyMat: THREE.MeshStandardMaterial;
  beanieMat: THREE.MeshStandardMaterial;
  whitePlasticMat: THREE.MeshStandardMaterial;
  overcoatBlackMat: THREE.MeshStandardMaterial;
  officeShirtMat: THREE.MeshStandardMaterial;
  darkPantsMat: THREE.MeshStandardMaterial;
  phoneScreenMat: THREE.MeshStandardMaterial;
  hardHatCrownGeo: THREE.CylinderGeometry;
  hardHatBrimGeo: THREE.BoxGeometry;
  pillboxHatGeo: THREE.CylinderGeometry;
  toteBagGeo: THREE.BoxGeometry;
  headphoneBandGeo: THREE.BoxGeometry;
  headphoneCupGeo: THREE.CylinderGeometry;
  glassesFrameGeo: THREE.BoxGeometry;
  backpackGeo: THREE.BoxGeometry;
  phoneGeo: THREE.BoxGeometry;
  newspaperGeo: THREE.BoxGeometry;
  createSeatedCharacter: (config: {
    id: string;
    label: string;
    archetype: PassengerArchetype;
    carId: 'A' | 'B' | 'C';
    worldX: number;
    worldZ: number;
    facingYaw: number;
    torsoMat: THREE.Material;
    skinMat: THREE.Material;
    hairMat: THREE.Material;
    isParent?: boolean;
    isCrowdExtra?: boolean;
  }) => CharacterActorRig;
  createStandingCharacter: (config: {
    id: string;
    label: string;
    archetype: PassengerArchetype;
    carId: 'A' | 'B' | 'C';
    worldX: number;
    worldZ: number;
    facingYaw: number;
    torsoMat: THREE.Material;
    skinMat: THREE.Material;
    hairMat: THREE.Material;
    isCrowdExtra?: boolean;
  }) => CharacterActorRig;
}

export function createCharacterMeshPool(root: THREE.Group): CharacterMeshPool {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const allActors: CharacterActorRig[] = [];

  const torsoSeatedGeo = new THREE.BoxGeometry(0.38, 0.52, 0.24);
  const torsoStandingGeo = new THREE.BoxGeometry(0.42, 0.58, 0.28);
  const lapThighsGeo = new THREE.BoxGeometry(0.36, 0.14, 0.38);
  const lowerLegsSeatedGeo = new THREE.BoxGeometry(0.32, 0.44, 0.16);
  const legsStandingGeo = new THREE.BoxGeometry(0.34, 0.78, 0.2);
  const headGeo = new THREE.BoxGeometry(0.21, 0.25, 0.22);
  const neckGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.09, 8);
  const eyeWhiteGeo = new THREE.BoxGeometry(0.042, 0.026, 0.01);
  const pupilGeo = new THREE.BoxGeometry(0.02, 0.02, 0.012);
  const eyelidGeo = new THREE.BoxGeometry(0.046, 0.028, 0.014);
  const armSeatedGeo = new THREE.BoxGeometry(0.11, 0.42, 0.14);
  const hardHatCrownGeo = new THREE.CylinderGeometry(0.12, 0.13, 0.11, 12);
  const hardHatBrimGeo = new THREE.BoxGeometry(0.26, 0.02, 0.29);
  const pillboxHatGeo = new THREE.CylinderGeometry(0.115, 0.12, 0.08, 12);
  const toteBagGeo = new THREE.BoxGeometry(0.12, 0.32, 0.28);
  const headphoneBandGeo = new THREE.BoxGeometry(0.24, 0.03, 0.04);
  const headphoneCupGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10);
  headphoneCupGeo.rotateZ(Math.PI / 2);
  const glassesFrameGeo = new THREE.BoxGeometry(0.18, 0.035, 0.02);
  const backpackGeo = new THREE.BoxGeometry(0.32, 0.4, 0.16);
  const phoneGeo = new THREE.BoxGeometry(0.08, 0.14, 0.015);
  const newspaperGeo = new THREE.BoxGeometry(0.28, 0.22, 0.02);

  geometries.push(
    torsoSeatedGeo,
    torsoStandingGeo,
    lapThighsGeo,
    lowerLegsSeatedGeo,
    legsStandingGeo,
    headGeo,
    neckGeo,
    eyeWhiteGeo,
    pupilGeo,
    eyelidGeo,
    armSeatedGeo,
    hardHatCrownGeo,
    hardHatBrimGeo,
    pillboxHatGeo,
    toteBagGeo,
    headphoneBandGeo,
    headphoneCupGeo,
    glassesFrameGeo,
    backpackGeo,
    phoneGeo,
    newspaperGeo
  );

  const makeMat = (color: number, roughness = 0.78, metalness = 0.06, emissive = 0x000000) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
    });
    materials.push(m);
    return m;
  };

  const skinWarmMat = makeMat(0xc89d7c, 0.68);
  const skinPaleMat = makeMat(0xbfa08a, 0.7);
  const skinDeepMat = makeMat(0x7c563e, 0.68);
  const momSkinMat = makeMat(0xc89d7c, 0.68);
  const eyeWhiteMat = makeMat(0xf2efe9, 0.3);
  const pupilDarkMat = makeMat(0x090a0a, 0.2);
  const hairDarkMat = makeMat(0x1b1918, 0.85);
  const hairSaltPepperMat = makeMat(0x52504c, 0.82);

  const momCoatMat = makeMat(0x634b3d, 0.78);
  const momScarfMat = makeMat(0x8c6d53, 0.8);
  const dadJacketMat = makeMat(0x333e3a, 0.76);
  const glassesMetalMat = makeMat(0xb8b2a6, 0.3, 0.8);

  const mtaNavyMat = makeMat(0x1b2738, 0.75);
  const mtaHiVisMat = makeMat(0xc4df26, 0.52, 0.1, 0x1d2404);
  const mtaHardHatMat = makeMat(0xe5b522, 0.38, 0.15);

  const burgundyCoatMat = makeMat(0x561d28, 0.74);
  const canvasToteMat = makeMat(0xd6ceba, 0.85);

  const pufferTealMat = makeMat(0x23363b, 0.58, 0.12);
  const hoodieNavyMat = makeMat(0x1e2636, 0.82);
  const beanieMat = makeMat(0x2c2e30, 0.86);
  const whitePlasticMat = makeMat(0xe4e2dc, 0.35);
  const overcoatBlackMat = makeMat(0x141618, 0.76);
  const officeShirtMat = makeMat(0x9ca2a6, 0.72);
  const darkPantsMat = makeMat(0x1e2226, 0.82);
  const phoneScreenMat = makeMat(0x9ec5eb, 0.2, 0.1, 0x4b79a6);

  function buildHeadRig(
    skinMat: THREE.Material,
    hairMat: THREE.Material,
    yPos: number
  ): {
    headGroup: THREE.Group;
    leftPupil: THREE.Mesh;
    rightPupil: THREE.Mesh;
    eyelids: THREE.Mesh[];
  } {
    const headGroup = new THREE.Group();
    headGroup.position.set(0, yPos, 0);

    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, -0.13, 0);
    headGroup.add(neck);

    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(headMesh);

    const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.23), hairMat);
    geometries.push(hairCap.geometry);
    hairCap.position.set(0, 0.1, -0.01);
    headGroup.add(hairCap);

    const browGeo = new THREE.BoxGeometry(0.052, 0.012, 0.012);
    geometries.push(browGeo);
    const leftBrow = new THREE.Mesh(browGeo, hairMat);
    leftBrow.position.set(-0.048, 0.052, 0.114);
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeo, hairMat);
    rightBrow.position.set(0.048, 0.052, 0.114);
    headGroup.add(rightBrow);

    const leftEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    leftEye.position.set(-0.048, 0.02, 0.114);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    rightEye.position.set(0.048, 0.02, 0.114);
    headGroup.add(rightEye);

    const leftPupil = new THREE.Mesh(pupilGeo, pupilDarkMat);
    leftPupil.position.set(-0.048, 0.02, 0.12);
    headGroup.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeo, pupilDarkMat);
    rightPupil.position.set(0.048, 0.02, 0.12);
    headGroup.add(rightPupil);

    const eyelidL = new THREE.Mesh(eyelidGeo, skinMat);
    eyelidL.position.set(-0.048, 0.02, 0.124);
    eyelidL.visible = false;
    headGroup.add(eyelidL);

    const eyelidR = new THREE.Mesh(eyelidGeo, skinMat);
    eyelidR.position.set(0.048, 0.02, 0.124);
    eyelidR.visible = false;
    headGroup.add(eyelidR);

    const noseGeo = new THREE.BoxGeometry(0.026, 0.046, 0.024);
    const mouthGeo = new THREE.BoxGeometry(0.056, 0.01, 0.012);
    geometries.push(noseGeo, mouthGeo);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, -0.01, 0.118);
    headGroup.add(nose);

    const mouth = new THREE.Mesh(mouthGeo, hairDarkMat);
    mouth.position.set(0, -0.062, 0.114);
    headGroup.add(mouth);

    return {
      headGroup,
      leftPupil,
      rightPupil,
      eyelids: [eyelidL, eyelidR],
    };
  }

  function createSeatedCharacter(config: {
    id: string;
    label: string;
    archetype: PassengerArchetype;
    carId: 'A' | 'B' | 'C';
    worldX: number;
    worldZ: number;
    facingYaw: number;
    torsoMat: THREE.Material;
    skinMat: THREE.Material;
    hairMat: THREE.Material;
    isParent?: boolean;
    isCrowdExtra?: boolean;
  }): CharacterActorRig {
    const actorRoot = new THREE.Group();
    actorRoot.name = `Actor_${config.id}`;
    actorRoot.position.set(config.worldX, 0, config.worldZ);
    actorRoot.rotation.y = config.facingYaw;

    const torso = new THREE.Mesh(torsoSeatedGeo, config.torsoMat);
    torso.position.set(0, 0.74, 0);
    actorRoot.add(torso);

    const thighs = new THREE.Mesh(lapThighsGeo, darkPantsMat);
    thighs.position.set(0, 0.48, 0.12);
    actorRoot.add(thighs);

    const lowerLegs = new THREE.Mesh(lowerLegsSeatedGeo, darkPantsMat);
    lowerLegs.position.set(0, 0.22, 0.26);
    actorRoot.add(lowerLegs);

    for (const side of [-1, 1] as const) {
      const arm = new THREE.Mesh(armSeatedGeo, config.torsoMat);
      arm.position.set(side * 0.23, 0.72, 0.05);
      actorRoot.add(arm);
    }

    const { headGroup, leftPupil, rightPupil, eyelids } = buildHeadRig(
      config.skinMat,
      config.hairMat,
      1.16
    );
    actorRoot.add(headGroup);
    root.add(actorRoot);

    const rig: CharacterActorRig = {
      id: config.id,
      label: config.label,
      archetype: config.archetype,
      carId: config.carId,
      isParent: Boolean(config.isParent),
      isCrowdExtra: Boolean(config.isCrowdExtra),
      root: actorRoot,
      headGroup,
      baseWorldX: config.worldX,
      baseWorldZ: config.worldZ,
      baseFacingYaw: config.facingYaw,
      targetLocalYaw: 0,
      targetLocalPitch: 0,
      leftPupil,
      rightPupil,
      eyelids,
    };

    allActors.push(rig);
    return rig;
  }

  function createStandingCharacter(config: {
    id: string;
    label: string;
    archetype: PassengerArchetype;
    carId: 'A' | 'B' | 'C';
    worldX: number;
    worldZ: number;
    facingYaw: number;
    torsoMat: THREE.Material;
    skinMat: THREE.Material;
    hairMat: THREE.Material;
    isCrowdExtra?: boolean;
  }): CharacterActorRig {
    const actorRoot = new THREE.Group();
    actorRoot.name = `Actor_${config.id}`;
    actorRoot.position.set(config.worldX, 0, config.worldZ);
    actorRoot.rotation.y = config.facingYaw;

    const legs = new THREE.Mesh(legsStandingGeo, darkPantsMat);
    legs.position.set(0, 0.39, 0);
    actorRoot.add(legs);

    const torso = new THREE.Mesh(torsoStandingGeo, config.torsoMat);
    torso.position.set(0, 1.06, 0);
    actorRoot.add(torso);

    for (const side of [-1, 1] as const) {
      const arm = new THREE.Mesh(armSeatedGeo, config.torsoMat);
      arm.position.set(side * 0.25, 1.05, 0.04);
      actorRoot.add(arm);
    }

    const { headGroup, leftPupil, rightPupil, eyelids } = buildHeadRig(
      config.skinMat,
      config.hairMat,
      1.52
    );
    actorRoot.add(headGroup);
    root.add(actorRoot);

    const rig: CharacterActorRig = {
      id: config.id,
      label: config.label,
      archetype: config.archetype,
      carId: config.carId,
      isParent: false,
      isCrowdExtra: Boolean(config.isCrowdExtra),
      root: actorRoot,
      headGroup,
      baseWorldX: config.worldX,
      baseWorldZ: config.worldZ,
      baseFacingYaw: config.facingYaw,
      targetLocalYaw: 0,
      targetLocalPitch: 0,
      leftPupil,
      rightPupil,
      eyelids,
    };

    allActors.push(rig);
    return rig;
  }

  return {
    root,
    geometries,
    materials,
    allActors,
    skinWarmMat,
    skinPaleMat,
    skinDeepMat,
    momSkinMat,
    hairDarkMat,
    hairSaltPepperMat,
    momCoatMat,
    momScarfMat,
    dadJacketMat,
    glassesMetalMat,
    mtaNavyMat,
    mtaHiVisMat,
    mtaHardHatMat,
    burgundyCoatMat,
    canvasToteMat,
    pufferTealMat,
    hoodieNavyMat,
    beanieMat,
    whitePlasticMat,
    overcoatBlackMat,
    officeShirtMat,
    darkPantsMat,
    phoneScreenMat,
    hardHatCrownGeo,
    hardHatBrimGeo,
    pillboxHatGeo,
    toteBagGeo,
    headphoneBandGeo,
    headphoneCupGeo,
    glassesFrameGeo,
    backpackGeo,
    phoneGeo,
    newspaperGeo,
    createSeatedCharacter,
    createStandingCharacter,
  };
}
