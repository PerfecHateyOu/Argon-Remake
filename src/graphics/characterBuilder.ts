import * as THREE from 'three';
import { CAR_CENTERS_X } from '../constants';
import { computeParentTargetHeadAngles } from '../game/passengerBehavior';
import type { ActiveAnomalyInstance, ActiveRestraintState } from '../types';
import {
  type CharacterActorRig,
  createCharacterMeshPool,
} from './characterFactory';

export type { CharacterActorRig };

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
  applyCharacterAnomaly: (
    anomaly: ActiveAnomalyInstance | null,
    restraint?: ActiveRestraintState | null
  ) => void;
  resetAnomalies: () => void;
  dispose: () => void;
}

const _targetQuat = new THREE.Quaternion();
const _headEuler = new THREE.Euler(0, 0, 0, 'YXZ');

export function buildCarCharacters(): CarCharactersRig {
  const root = new THREE.Group();
  root.name = 'CarCharactersRoot';

  const pool = createCharacterMeshPool(root);
  const {
    geometries,
    materials,
    allActors,
    createSeatedCharacter,
    createStandingCharacter,
  } = pool;

  const mom = createSeatedCharacter({
    id: 'mom',
    label: 'Mom',
    archetype: 'mom',
    carId: 'B',
    worldX: -0.76,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: pool.momCoatMat,
    skinMat: pool.momSkinMat,
    hairMat: pool.hairDarkMat,
    isParent: true,
  });
  const momScarf = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.08, 0.26),
    pool.momScarfMat
  );
  geometries.push(momScarf.geometry);
  momScarf.position.set(0, 1.01, 0.02);
  mom.root.add(momScarf);

  const momPhoneMesh = new THREE.Mesh(pool.phoneGeo, pool.phoneScreenMat);
  momPhoneMesh.position.set(0.14, 0.62, 0.2);
  momPhoneMesh.rotation.x = -0.55;
  mom.root.add(momPhoneMesh);

  const dad = createSeatedCharacter({
    id: 'dad',
    label: 'Dad',
    archetype: 'dad',
    carId: 'B',
    worldX: 0.76,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: pool.dadJacketMat,
    skinMat: pool.skinWarmMat,
    hairMat: pool.hairSaltPepperMat,
    isParent: true,
  });
  const dadGlasses = new THREE.Mesh(pool.glassesFrameGeo, pool.glassesMetalMat);
  dadGlasses.position.set(0, 0.02, 0.115);
  dad.headGroup.add(dadGlasses);

  const mtaMan = createSeatedCharacter({
    id: 'mta',
    label: 'The man across the aisle',
    archetype: 'mta',
    carId: 'B',
    worldX: -0.38,
    worldZ: -1.08,
    facingYaw: 0,
    torsoMat: pool.mtaNavyMat,
    skinMat: pool.skinDeepMat,
    hairMat: pool.hairDarkMat,
  });
  const hiVisVest = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.48, 0.255),
    pool.mtaHiVisMat
  );
  geometries.push(hiVisVest.geometry);
  hiVisVest.position.set(0, 0.75, 0);
  mtaMan.root.add(hiVisVest);

  const hatCrown = new THREE.Mesh(pool.hardHatCrownGeo, pool.mtaHardHatMat);
  hatCrown.position.set(0, 0.14, 0);
  mtaMan.headGroup.add(hatCrown);

  const hatBrim = new THREE.Mesh(pool.hardHatBrimGeo, pool.mtaHardHatMat);
  hatBrim.position.set(0, 0.09, 0.02);
  mtaMan.headGroup.add(hatBrim);

  const coatWoman = createSeatedCharacter({
    id: 'coat',
    label: 'The woman on your bench',
    archetype: 'coat',
    carId: 'B',
    worldX: -2.15,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: pool.burgundyCoatMat,
    skinMat: pool.skinPaleMat,
    hairMat: pool.hairDarkMat,
  });
  const smallHat = new THREE.Mesh(pool.pillboxHatGeo, pool.hairDarkMat);
  smallHat.position.set(0, 0.14, 0);
  coatWoman.headGroup.add(smallHat);

  const canvasTote = new THREE.Mesh(pool.toteBagGeo, pool.canvasToteMat);
  canvasTote.position.set(0.24, 0.34, 0.22);
  coatWoman.root.add(canvasTote);

  const pufferStanding = createStandingCharacter({
    id: 'puffer',
    label: 'The standing passenger',
    archetype: 'puffer',
    carId: 'B',
    worldX: 1.62,
    worldZ: -0.36,
    facingYaw: -Math.PI / 2,
    torsoMat: pool.pufferTealMat,
    skinMat: pool.skinWarmMat,
    hairMat: pool.hairDarkMat,
  });
  const hpBand = new THREE.Mesh(pool.headphoneBandGeo, pool.whitePlasticMat);
  hpBand.position.set(0, 0.14, 0);
  pufferStanding.headGroup.add(hpBand);
  for (const side of [-1, 1] as const) {
    const cup = new THREE.Mesh(pool.headphoneCupGeo, pool.whitePlasticMat);
    cup.position.set(side * 0.12, 0.02, 0);
    pufferStanding.headGroup.add(cup);
  }

  const additionalPassenger = createSeatedCharacter({
    id: 'additional',
    label: 'The seat at the far end',
    archetype: 'overcoat',
    carId: 'B',
    worldX: -7.0,
    worldZ: -1.08,
    facingYaw: 0,
    torsoMat: pool.overcoatBlackMat,
    skinMat: pool.skinPaleMat,
    hairMat: pool.hairDarkMat,
  });
  additionalPassenger.root.visible = false;

  const texterEnd = createStandingCharacter({
    id: 'texter_b',
    label: 'A passenger at the end',
    archetype: 'texter',
    carId: 'B',
    worldX: 6.4,
    worldZ: 0.38,
    facingYaw: -Math.PI / 2,
    torsoMat: pool.mtaNavyMat,
    skinMat: pool.skinWarmMat,
    hairMat: pool.hairDarkMat,
  });
  const phoneMesh = new THREE.Mesh(pool.phoneGeo, pool.phoneScreenMat);
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
    torsoMat: pool.hoodieNavyMat,
    skinMat: pool.skinDeepMat,
    hairMat: pool.beanieMat,
    isCrowdExtra: true,
  });
  const backpack = new THREE.Mesh(pool.backpackGeo, pool.beanieMat);
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
    torsoMat: pool.officeShirtMat,
    skinMat: pool.skinWarmMat,
    hairMat: pool.hairSaltPepperMat,
    isCrowdExtra: true,
  });
  const paper = new THREE.Mesh(pool.newspaperGeo, pool.whitePlasticMat);
  paper.position.set(0, 0.82, 0.26);
  paper.rotation.x = -0.35;
  officeCrowd.root.add(paper);
  officeCrowd.root.visible = false;

  createSeatedCharacter({
    id: 'office_car_a',
    label: 'Car A rider',
    archetype: 'office',
    carId: 'A',
    worldX: CAR_CENTERS_X.A - 0.5,
    worldZ: -1.08,
    facingYaw: 0,
    torsoMat: pool.officeShirtMat,
    skinMat: pool.skinPaleMat,
    hairMat: pool.hairDarkMat,
  });

  createSeatedCharacter({
    id: 'overcoat_car_c',
    label: 'A passenger behind you',
    archetype: 'overcoat',
    carId: 'C',
    worldX: CAR_CENTERS_X.C + 0.4,
    worldZ: 1.08,
    facingYaw: Math.PI,
    torsoMat: pool.overcoatBlackMat,
    skinMat: pool.skinPaleMat,
    hairMat: pool.hairDarkMat,
  });

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
    const scale = active ? 2.2 : 1.0;
    if (mom.leftPupil && mom.rightPupil) {
      mom.leftPupil.scale.set(scale, scale, 1);
      mom.rightPupil.scale.set(scale, scale, 1);
    }
    pool.momSkinMat.color.setHex(active ? 0xdfd9ce : 0xc89d7c);
    momPhoneMesh.visible = !active;
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

  const applyCharacterAnomaly = (
    anomaly: ActiveAnomalyInstance | null,
    restraint?: ActiveRestraintState | null
  ): void => {
    const active = anomaly && anomaly.manifested && !anomaly.caught ? anomaly : null;
    const restraintMomFrozen = Boolean(restraint?.active && restraint.momFrozen);
    const restraintStrangersVanished = Boolean(
      restraint?.active && restraint.strangersVanished
    );
    const key = `${active ? `${active.id}:${active.variantKey}` : 'none'}|rm:${restraintMomFrozen}|rs:${restraintStrangersVanished}`;
    if (key === lastCharacterAnomalyKey) return;
    lastCharacterAnomalyKey = key;

    resetAnomalies();

    if (active) {
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
    }

    if (restraintMomFrozen) {
      setMomFixedAnomaly(true);
    }
    if (restraintStrangersVanished) {
      setEmptyCarAnomaly(true);
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

    if (mtaStaringActive) {
      const dx = playerX - mtaMan.baseWorldX;
      const dz = playerZ - mtaMan.baseWorldZ;
      const stareYaw = Math.max(-1.1, Math.min(1.1, Math.atan2(dx, Math.max(0.2, dz))));
      _headEuler.set(-0.04, stareYaw, 0, 'YXZ');
      _targetQuat.setFromEuler(_headEuler);
      mtaMan.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);
    } else {
      const blinkWindow = ((elapsedSec + 2.1) % 4.3) < 0.13;
      if (mtaMan.eyelids) {
        for (const lid of mtaMan.eyelids) lid.visible = blinkWindow;
      }
      _headEuler.set(0.04, Math.sin(elapsedSec * 0.45) * 0.06, 0, 'YXZ');
      _targetQuat.setFromEuler(_headEuler);
      mtaMan.headGroup.quaternion.slerp(_targetQuat, slerpAlpha);
    }

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
