import * as THREE from 'three';
import { CAR_CENTERS_X } from '../constants';
import { computeParentTargetHeadAngles } from '../game/passengerBehavior';
import type { ActiveAnomalyInstance, PassengerArchetype } from '../types';

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

export interface CarCharactersRig {
  root: THREE.Group;
  mom: CharacterActorRig;
  dad: CharacterActorRig;
  mtaMan: CharacterActorRig;
  coatWoman: CharacterActorRig;
  pufferStanding: CharacterActorRig;
  additionalPassenger: CharacterActorRig;
  allActors: CharacterActorRig[];
  step: (
    dtSec: number,
    elapsedSec: number,
    playerX: number,
    playerZ: number,
    watchingParent: 'Mom' | 'Dad' | null
  ) => void;
  setSegmentDensity: (options: { thin?: boolean; crowd?: boolean }) => void;
  setMomFixedAnomaly: (active: boolean) => void;
  setMtaStaringAnomaly: (active: boolean) => void;
  setCoatNeckTwistAnomaly: (active: boolean) => void;
  setPufferRelocatedAnomaly: (active: boolean) => void;
  setAdditionalPassengerAnomaly: (active: boolean) => void;
  setEmptyCarAnomaly: (active: boolean) => void;
  applyCharacterAnomaly: (anomaly: ActiveAnomalyInstance | null) => void;
  resetAnomalies: () => void;
  dispose: () => void;
}

const _targetQuat = new THREE.Quaternion();
const _headEuler = new THREE.Euler(0, 0, 0, 'YXZ');

export function buildCarCharacters(): CarCharactersRig {
  const root = new THREE.Group();
  root.name = 'CarCharactersRoot';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const allActors: CharacterActorRig[] = [];

  // Shared Geometries
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

  // Shared Materials
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

    // Hair cap
    const hairCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.09, 0.23),
      hairMat
    );
    geometries.push(hairCap.geometry);
    hairCap.position.set(0, 0.1, -0.01);
    headGroup.add(hairCap);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.052, 0.012, 0.012);
    geometries.push(browGeo);
    const leftBrow = new THREE.Mesh(browGeo, hairMat);
    leftBrow.position.set(-0.048, 0.052, 0.114);
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeo, hairMat);
    rightBrow.position.set(0.048, 0.052, 0.114);
    headGroup.add(rightBrow);

    // Eyes facing local +Z (we orient characters so local +Z is their forward direction)
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

    // Nose & subtle mouth line
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

    // Seated torso on bench (bench seat top is y = 0.44)
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

  // ============================================================================
  // 1. MOM & DAD (Seated with the player on the +Z bench in Car B, facing -Z = Math.PI)
  // Note: Local +Z of each character is their forward direction; rotation.y = Math.PI points +Z toward world -Z.
  // ============================================================================
  const mom = createSeatedCharacter({
    id: 'mom',
    label: 'Mom',
    archetype: 'mom',
    carId: 'B',
    worldX: -0.76,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: momCoatMat,
    skinMat: skinWarmMat,
    hairMat: hairDarkMat,
    isParent: true,
  });
  const momScarf = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.08, 0.26),
    momScarfMat
  );
  geometries.push(momScarf.geometry);
  momScarf.position.set(0, 1.01, 0.02);
  mom.root.add(momScarf);

  const dad = createSeatedCharacter({
    id: 'dad',
    label: 'Dad',
    archetype: 'dad',
    carId: 'B',
    worldX: 0.76,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: dadJacketMat,
    skinMat: skinWarmMat,
    hairMat: hairSaltPepperMat,
    isParent: true,
  });
  const dadGlasses = new THREE.Mesh(glassesFrameGeo, glassesMetalMat);
  dadGlasses.position.set(0, 0.02, 0.115);
  dad.headGroup.add(dadGlasses);

  // ============================================================================
  // 2. THE MAN ACROSS THE AISLE (archetype: mta — navy uniform, hi-vis vest, hard hat)
  // Seated directly across the aisle on the -Z bench (z = -1.08, x = -0.35), facing +Z (0 rad)
  // ============================================================================
  const mtaMan = createSeatedCharacter({
    id: 'mta',
    label: 'The man across the aisle',
    archetype: 'mta',
    carId: 'B',
    worldX: -0.38,
    worldZ: -1.08,
    facingYaw: 0,
    torsoMat: mtaNavyMat,
    skinMat: skinDeepMat,
    hairMat: hairDarkMat,
  });
  // Hi-vis vest overlay & hard hat
  const hiVisVest = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.48, 0.255),
    mtaHiVisMat
  );
  geometries.push(hiVisVest.geometry);
  hiVisVest.position.set(0, 0.75, 0);
  mtaMan.root.add(hiVisVest);

  const hatCrown = new THREE.Mesh(hardHatCrownGeo, mtaHardHatMat);
  hatCrown.position.set(0, 0.14, 0);
  mtaMan.headGroup.add(hatCrown);

  const hatBrim = new THREE.Mesh(hardHatBrimGeo, mtaHardHatMat);
  hatBrim.position.set(0, 0.09, 0.02);
  mtaMan.headGroup.add(hatBrim);

  // ============================================================================
  // 3. THE WOMAN ON YOUR BENCH (archetype: coat — burgundy coat, small dark hat, canvas tote)
  // Seated on your +Z bench further left (x = -2.15, z = +1.08), facing -Z (Math.PI)
  // ============================================================================
  const coatWoman = createSeatedCharacter({
    id: 'coat',
    label: 'The woman on your bench',
    archetype: 'coat',
    carId: 'B',
    worldX: -2.15,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: burgundyCoatMat,
    skinMat: skinPaleMat,
    hairMat: hairDarkMat,
  });
  const smallHat = new THREE.Mesh(pillboxHatGeo, hairDarkMat);
  smallHat.position.set(0, 0.14, 0);
  coatWoman.headGroup.add(smallHat);

  const canvasTote = new THREE.Mesh(toteBagGeo, canvasToteMat);
  canvasTote.position.set(0.24, 0.34, 0.22);
  coatWoman.root.add(canvasTote);

  // ============================================================================
  // 4. THE STANDING PASSENGER (archetype: puffer — bulky puffer jacket, over-ear headphones)
  // Standing near grab pole in Car B (x = +1.62, z = -0.36), facing toward aisle (-X = -Math.PI/2)
  // ============================================================================
  const pufferStanding = createStandingCharacter({
    id: 'puffer',
    label: 'The standing passenger',
    archetype: 'puffer',
    carId: 'B',
    worldX: 1.62,
    worldZ: -0.36,
    facingYaw: -Math.PI / 2,
    torsoMat: pufferTealMat,
    skinMat: skinWarmMat,
    hairMat: hairDarkMat,
  });
  const hpBand = new THREE.Mesh(headphoneBandGeo, whitePlasticMat);
  hpBand.position.set(0, 0.14, 0);
  pufferStanding.headGroup.add(hpBand);
  for (const side of [-1, 1] as const) {
    const cup = new THREE.Mesh(headphoneCupGeo, whitePlasticMat);
    cup.position.set(side * 0.12, 0.02, 0);
    pufferStanding.headGroup.add(cup);
  }

  // ============================================================================
  // 5. THE ADDITIONAL PASSENGER (Seated at the far end of Car B, x = -7.0, z = -1.08)
  // Hidden until "The Additional Passenger" anomaly triggers!
  // ============================================================================
  const additionalPassenger = createSeatedCharacter({
    id: 'additional',
    label: 'The seat at the far end',
    archetype: 'overcoat',
    carId: 'B',
    worldX: -7.0,
    worldZ: -1.08,
    facingYaw: 0,
    torsoMat: overcoatBlackMat,
    skinMat: skinPaleMat,
    hairMat: hairDarkMat,
  });
  additionalPassenger.root.visible = false;

  // ============================================================================
  // 6. OTHER ARCHETYPES (hoodie, texter, overcoat, office) across Cars A, B, and C
  // ============================================================================
  const texterEnd = createStandingCharacter({
    id: 'texter_b',
    label: 'A passenger at the end',
    archetype: 'texter',
    carId: 'B',
    worldX: 6.4,
    worldZ: 0.38,
    facingYaw: -Math.PI / 2,
    torsoMat: mtaNavyMat,
    skinMat: skinWarmMat,
    hairMat: hairDarkMat,
  });
  const phoneMesh = new THREE.Mesh(phoneGeo, phoneScreenMat);
  phoneMesh.position.set(0, 1.12, 0.24);
  phoneMesh.rotation.x = -0.5;
  texterEnd.root.add(phoneMesh);

  const hoodieAisle = createStandingCharacter({
    id: 'hoodie_b',
    label: 'A passenger in the aisle',
    archetype: 'hoodie',
    carId: 'B',
    worldX: -3.4,
    worldZ: 0.35,
    facingYaw: Math.PI / 2,
    torsoMat: hoodieNavyMat,
    skinMat: skinDeepMat,
    hairMat: beanieMat,
    isCrowdExtra: true,
  });
  const backpack = new THREE.Mesh(backpackGeo, beanieMat);
  backpack.position.set(0, 1.06, -0.2);
  hoodieAisle.root.add(backpack);
  hoodieAisle.root.visible = false;

  const officeCrowd = createSeatedCharacter({
    id: 'office_b',
    label: 'An office commuter',
    archetype: 'office',
    carId: 'B',
    worldX: 2.2,
    worldZ: -1.08,
    facingYaw: 0,
    torsoMat: officeShirtMat,
    skinMat: skinWarmMat,
    hairMat: hairSaltPepperMat,
    isCrowdExtra: true,
  });
  const paper = new THREE.Mesh(newspaperGeo, whitePlasticMat);
  paper.position.set(0, 0.82, 0.26);
  paper.rotation.x = -0.35;
  officeCrowd.root.add(paper);
  officeCrowd.root.visible = false;

  // Car A (Lead) and Car C (Rear) sparse riders so walking through gangways feels inhabited
  createSeatedCharacter({
    id: 'office_car_a',
    label: 'Car A rider',
    archetype: 'office',
    carId: 'A',
    worldX: CAR_CENTERS_X.A - 0.5,
    worldZ: -1.08,
    facingYaw: 0,
    torsoMat: officeShirtMat,
    skinMat: skinPaleMat,
    hairMat: hairDarkMat,
  });

  createSeatedCharacter({
    id: 'overcoat_car_c',
    label: 'A passenger behind you',
    archetype: 'overcoat',
    carId: 'C',
    worldX: CAR_CENTERS_X.C + 0.4,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: overcoatBlackMat,
    skinMat: skinPaleMat,
    hairMat: hairDarkMat,
  });

  // Anomaly state flags
  let momFixedActive = false;
  let dadAnsweringActive = false;
  let mtaStaringActive = false;
  let coatNeckTwistActive = false;
  let emptyCarActive = false;
  let thinStretchActive = false;
  let crowdStretchActive = false;
  let lastCharacterAnomalyKey = '';

  const updateStrangerVisibility = (): void => {
    for (const actor of allActors) {
      if (actor.isParent || actor.id === 'additional') continue;
      if (emptyCarActive) {
        actor.root.visible = false;
        continue;
      }
      if (actor.isCrowdExtra) {
        actor.root.visible = crowdStretchActive;
      } else if (thinStretchActive && (actor.id === 'texter_b' || actor.carId !== 'B')) {
        actor.root.visible = false;
      } else {
        actor.root.visible = true;
      }
    }
  };

  const setSegmentDensity = (options: { thin?: boolean; crowd?: boolean }): void => {
    thinStretchActive = Boolean(options.thin);
    crowdStretchActive = Boolean(options.crowd);
    updateStrangerVisibility();
  };

  const setMomFixedAnomaly = (active: boolean): void => {
    momFixedActive = active;
    const scale = active ? 2.15 : 1.0;
    if (mom.leftPupil && mom.rightPupil) {
      mom.leftPupil.scale.set(scale, scale, 1);
      mom.rightPupil.scale.set(scale, scale, 1);
    }
  };

  const setMtaStaringAnomaly = (active: boolean): void => {
    mtaStaringActive = active;
    if (active && mtaMan.eyelids) {
      for (const lid of mtaMan.eyelids) lid.visible = false;
    }
  };

  const setCoatNeckTwistAnomaly = (active: boolean): void => {
    coatNeckTwistActive = active;
  };

  const setPufferRelocatedAnomaly = (active: boolean): void => {
    if (active) {
      // Abruptly standing at the far doors (x = -5.0, z = -0.82)
      pufferStanding.root.position.set(-5.0, 0, -0.82);
      pufferStanding.root.rotation.y = 0;
    } else {
      pufferStanding.root.position.set(
        pufferStanding.baseWorldX,
        0,
        pufferStanding.baseWorldZ
      );
      pufferStanding.root.rotation.y = pufferStanding.baseFacingYaw;
    }
  };

  const setAdditionalPassengerAnomaly = (active: boolean): void => {
    additionalPassenger.root.visible = active && !emptyCarActive;
  };

  const setEmptyCarAnomaly = (active: boolean): void => {
    emptyCarActive = active;
    updateStrangerVisibility();
    if (active) {
      additionalPassenger.root.visible = false;
    }
  };

  const resetAnomalies = (): void => {
    dadAnsweringActive = false;
    setMomFixedAnomaly(false);
    setMtaStaringAnomaly(false);
    setCoatNeckTwistAnomaly(false);
    setPufferRelocatedAnomaly(false);
    setAdditionalPassengerAnomaly(false);
    setEmptyCarAnomaly(false);
  };

  const applyCharacterAnomaly = (anomaly: ActiveAnomalyInstance | null): void => {
    const active = anomaly && anomaly.manifested && !anomaly.caught ? anomaly : null;
    const key = active ? `${active.id}:${active.variantKey}` : 'none';
    if (key === lastCharacterAnomalyKey) return;
    lastCharacterAnomalyKey = key;

    resetAnomalies();
    if (!active) return;

    switch (active.id) {
      case 'man_across_aisle':
        setMtaStaringAnomaly(true);
        break;
      case 'relocated_passenger':
        setPufferRelocatedAnomaly(true);
        break;
      case 'additional_passenger':
        setAdditionalPassengerAnomaly(true);
        break;
      case 'woman_on_bench':
        setCoatNeckTwistAnomaly(true);
        break;
      case 'mom_fixed':
        setMomFixedAnomaly(true);
        break;
      case 'dad_answering':
        dadAnsweringActive = true;
        break;
      case 'empty_car':
        setEmptyCarAnomaly(true);
        break;
      default:
        break;
    }
  };

  const step = (
    dtSec: number,
    elapsedSec: number,
    playerX: number,
    playerZ: number,
    watchingParent: 'Mom' | 'Dad' | null
  ): void => {
    const slerpAlpha = 1 - Math.exp(-dtSec * 6.5);

    // 1. Mom & Dad head turns (slerped toward player when watching or during parent anomaly)
    const momAngles = computeParentTargetHeadAngles(
      'mom',
      mom.baseWorldX,
      mom.baseWorldZ,
      playerX,
      playerZ,
      watchingParent === 'Mom' || momFixedActive
    );
    _headEuler.set(momAngles.pitch, momAngles.yaw, 0, 'YXZ');
    _targetQuat.setFromEuler(_headEuler);
    mom.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);

    const dadAngles = computeParentTargetHeadAngles(
      'dad',
      dad.baseWorldX,
      dad.baseWorldZ,
      playerX,
      playerZ,
      watchingParent === 'Dad' || dadAnsweringActive
    );
    _headEuler.set(dadAngles.pitch, dadAngles.yaw, 0, 'YXZ');
    _targetQuat.setFromEuler(_headEuler);
    dad.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);

    // 2. The Man Across the Aisle (unblinking direct stare when mtaStaringActive)
    if (mtaStaringActive) {
      const dx = playerX - mtaMan.baseWorldX;
      const dz = playerZ - mtaMan.baseWorldZ;
      const stareYaw = Math.max(-1.1, Math.min(1.1, Math.atan2(dx, Math.max(0.2, dz))));
      _headEuler.set(-0.04, stareYaw, 0, 'YXZ');
      _targetQuat.setFromEuler(_headEuler);
      mtaMan.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);
    } else {
      // Subtle idle gaze + periodic blink (offset so eyes start open)
      const blinkWindow = ((elapsedSec + 2.1) % 4.3) < 0.13;
      if (mtaMan.eyelids) {
        for (const lid of mtaMan.eyelids) lid.visible = blinkWindow;
      }
      _headEuler.set(0.04, Math.sin(elapsedSec * 0.45) * 0.06, 0, 'YXZ');
      _targetQuat.setFromEuler(_headEuler);
      mtaMan.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);
    }

    // 3. The Woman on Your Bench (anatomical neck twist > 155 deg when coatNeckTwistActive)
    if (coatNeckTwistActive) {
      _headEuler.set(0.06, -2.72, 0.14, 'YXZ');
      _targetQuat.setFromEuler(_headEuler);
      coatWoman.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);
    } else {
      _headEuler.set(0.04, 0, 0, 'YXZ');
      _targetQuat.setFromEuler(_headEuler);
      coatWoman.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);
    }
  };

  const dispose = (): void => {
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
  };

  return {
    root,
    mom,
    dad,
    mtaMan,
    coatWoman,
    pufferStanding,
    additionalPassenger,
    allActors,
    step,
    setSegmentDensity,
    setMomFixedAnomaly,
    setMtaStaringAnomaly,
    setCoatNeckTwistAnomaly,
    setPufferRelocatedAnomaly,
    setAdditionalPassengerAnomaly,
    setEmptyCarAnomaly,
    applyCharacterAnomaly,
    resetAnomalies,
    dispose,
  };
}
