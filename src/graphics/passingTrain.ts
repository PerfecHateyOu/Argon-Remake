import * as THREE from 'three';
import {
  CAR_HEIGHT,
  CAR_LENGTH,
  FORWARD_X,
  PASSING_TRAIN_SPEED_MPS,
  PASSING_TRAIN_TRACK_Z,
} from '../constants';

export interface PassingTrainRig {
  root: THREE.Group;
  triggerPass: () => void;
  step: (dtSec: number, ownTrainSpeedMps: number) => void;
  isActive: () => boolean;
  dispose: () => void;
}

/**
 * Pooled 3-car exterior shell on the opposite track (+Z side, z = +3.25)
 * that streams past during mid-stretch cruise.
 */
export function buildPassingTrain(): PassingTrainRig {
  const root = new THREE.Group();
  root.name = 'PassingTrain';
  root.visible = false;
  root.position.set(-140, 0, PASSING_TRAIN_TRACK_Z);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x484d52,
    roughness: 0.42,
    metalness: 0.75,
  });

  const litWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: 0xffdf9e,
    emissiveIntensity: 1.55,
    roughness: 0.2,
  });

  const markerRedMat = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    emissive: 0xff261b,
    emissiveIntensity: 2.1,
  });

  materials.push(bodyMat, litWindowMat, markerRedMat);

  const carShellGeo = new THREE.BoxGeometry(CAR_LENGTH, CAR_HEIGHT, 2.65);
  const litWindowGeo = new THREE.PlaneGeometry(1.65, 0.86);
  const markerLightGeo = new THREE.BoxGeometry(0.08, 0.18, 0.18);

  geometries.push(carShellGeo, litWindowGeo, markerLightGeo);

  const carOffsets = [-19.5, 0, 19.5];
  const windowXs = [-6.8, -3.4, 0, 3.4, 6.8];

  for (const cx of carOffsets) {
    const carGroup = new THREE.Group();
    carGroup.position.set(cx, 0, 0);

    const shell = new THREE.Mesh(carShellGeo, bodyMat);
    shell.position.set(0, CAR_HEIGHT / 2, 0);
    carGroup.add(shell);

    for (const wx of windowXs) {
      const win = new THREE.Mesh(litWindowGeo, litWindowMat);
      win.position.set(wx, 1.42, -1.34);
      win.rotation.y = Math.PI;
      carGroup.add(win);
    }

    root.add(carGroup);
  }

  // Red tail marker lamps on the rear end of the passing train
  for (const mz of [-0.95, 0.95]) {
    const marker = new THREE.Mesh(markerLightGeo, markerRedMat);
    marker.position.set(28.4, 1.15, mz);
    root.add(marker);
  }

  let active = false;

  const triggerPass = (): void => {
    active = true;
    root.visible = true;
    // Starts ahead at -120m and streams toward +120m
    root.position.x = -120;
  };

  const step = (dtSec: number, ownTrainSpeedMps: number): void => {
    if (!active) return;
    const relativeSpeed = ownTrainSpeedMps + PASSING_TRAIN_SPEED_MPS;
    root.position.x += -FORWARD_X * relativeSpeed * dtSec;

    if (root.position.x > 130) {
      active = false;
      root.visible = false;
    }
  };

  const dispose = (): void => {
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
  };

  return {
    root,
    triggerPass,
    step,
    isActive: () => active,
    dispose,
  };
}
