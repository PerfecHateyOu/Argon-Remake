import * as THREE from 'three';
import { formatRouteText } from '../game/routeText';
import type { RouteLineId, TrialState } from '../types';

export const TRIAL_ROOM_ORIGIN_Y = -28;

export interface TrialRoomRig {
  group: THREE.Group;
  update: (
    elapsedSec: number,
    trialState: TrialState | null,
    route: RouteLineId
  ) => void;
  dispose: () => void;
}

function createDirectionalSignTexture(
  label: string,
  arrowDir: 'left' | 'right',
  bulletColor: string,
  lineLetter: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0c0e0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Classic MTA white top rule
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(0, 12, canvas.width, 4);

    // Arrow
    ctx.fillStyle = '#f2efe6';
    ctx.font = 'bold 42px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const arrowX = arrowDir === 'left' ? 46 : canvas.width - 46;
    ctx.fillText(arrowDir === 'left' ? '←' : '→', arrowX, 70);

    // Route bullet circle
    const bulletX = arrowDir === 'left' ? 102 : 54;
    ctx.fillStyle = bulletColor;
    ctx.beginPath();
    ctx.arc(bulletX, 70, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#080a08';
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.fillText(lineLetter, bulletX, 71);

    // Sign label text
    ctx.fillStyle = '#f4f1e8';
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, arrowDir === 'left' ? 140 : 92, 71);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the procedural 3D False Stop Trial room at y = TRIAL_ROOM_ORIGIN_Y.
 * Supports all 3 canonical trial stages:
 *   Stage 1: Directional signs ("To {terminusSign} trains" / "To {opposite} trains" — the signs lie)
 *   Stage 2: Three stairways (Left / Middle / Right stairs — follow steady light)
 *   Stage 3: Platform edge with two waiting trains ("Board the left train" / "Board the right train" — watch the lights when the chime plays)
 */
export function buildTrialRoom(): TrialRoomRig {
  const group = new THREE.Group();
  group.name = 'FalseStopTrialRoom';
  group.position.set(0, TRIAL_ROOM_ORIGIN_Y, 0);
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

  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b1e1b,
      roughness: 0.9,
      metalness: 0.08,
    })
  );
  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262b25,
      roughness: 0.85,
      metalness: 0.05,
    })
  );
  const pillarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c261e,
      roughness: 0.6,
      metalness: 0.4,
    })
  );
  const tactileMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc99e2c,
      roughness: 0.75,
      metalness: 0.1,
    })
  );

  // Main platform room shell (width 11m, height 3.4m, depth 9m)
  const floor = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(11, 0.2, 9)), floorMat);
  floor.position.set(0, -0.1, -1.5);
  group.add(floor);

  const ceiling = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(11, 0.2, 9)), wallMat);
  ceiling.position.set(0, 3.3, -1.5);
  group.add(ceiling);

  const backWall = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(11, 3.4, 0.25)), wallMat);
  backWall.position.set(0, 1.6, -5.8);
  group.add(backWall);

  const leftWall = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.25, 3.4, 9)), wallMat);
  leftWall.position.set(-5.4, 1.6, -1.5);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.25, 3.4, 9)), wallMat);
  rightWall.position.set(5.4, 1.6, -1.5);
  group.add(rightWall);

  // Yellow tactile edge strip along -Z platform edge
  const tactileStrip = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(10.5, 0.03, 0.36)),
    tactileMat
  );
  tactileStrip.position.set(0, 0.015, -3.1);
  group.add(tactileStrip);

  // Steel I-beam columns
  const colGeom = trackGeom(new THREE.BoxGeometry(0.22, 3.3, 0.22));
  for (const x of [-3.6, -1.4, 1.4, 3.6]) {
    const col = new THREE.Mesh(colGeom, pillarMat);
    col.position.set(x, 1.65, -2.6);
    group.add(col);
  }

  // Ambient dim sodium fill light inside Trial room
  const ambientTrialLight = new THREE.PointLight(0xffe4b5, 0.55, 14, 1.5);
  ambientTrialLight.position.set(0, 2.9, 0.4);
  group.add(ambientTrialLight);

  // Stage 1: Hanging directional signs ("To {terminusSign} trains" on left, "To {opposite} trains" on right)
  let currentSignRoute: RouteLineId | null = null;
  let leftSignTex = trackTex(
    createDirectionalSignTexture('To Court Sq trains', 'left', '#6cbe45', 'G')
  );
  let rightSignTex = trackTex(
    createDirectionalSignTexture('To Church Av trains', 'right', '#6cbe45', 'G')
  );

  const leftSignMat = trackMat(
    new THREE.MeshBasicMaterial({ map: leftSignTex })
  );
  const rightSignMat = trackMat(
    new THREE.MeshBasicMaterial({ map: rightSignTex })
  );

  const signGeom = trackGeom(new THREE.BoxGeometry(2.3, 0.56, 0.08));
  const leftSignMesh = new THREE.Mesh(signGeom, leftSignMat);
  leftSignMesh.position.set(-1.65, 2.38, -2.2);
  group.add(leftSignMesh);

  const rightSignMesh = new THREE.Mesh(signGeom, rightSignMat);
  rightSignMesh.position.set(1.65, 2.38, -2.2);
  group.add(rightSignMesh);

  // Stage 2: Three stairways (Left, Middle, Right) with overhead indicator bulbs
  const stairsGroup = new THREE.Group();
  group.add(stairsGroup);

  const stairPositionsX = [-2.8, 0, 2.8] as const;
  const stairBulbMats: THREE.MeshBasicMaterial[] = [];
  const stairLights: THREE.PointLight[] = [];

  const stairStepGeom = trackGeom(new THREE.BoxGeometry(1.45, 0.16, 0.35));
  const stairFrameGeom = trackGeom(new THREE.BoxGeometry(1.6, 2.2, 1.6));
  const stairBulbGeom = trackGeom(new THREE.BoxGeometry(0.7, 0.08, 0.16));

  for (let i = 0; i < 3; i++) {
    const sx = stairPositionsX[i]!;
    const frame = new THREE.Mesh(stairFrameGeom, pillarMat);
    frame.position.set(sx, 1.1, -4.4);
    stairsGroup.add(frame);

    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(stairStepGeom, floorMat);
      step.position.set(sx, 0.12 + s * 0.18, -3.5 - s * 0.32);
      stairsGroup.add(step);
    }

    const bulbMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfff0d4 }));
    stairBulbMats.push(bulbMat);
    const bulb = new THREE.Mesh(stairBulbGeom, bulbMat);
    bulb.position.set(sx, 2.65, -3.6);
    stairsGroup.add(bulb);

    const pt = new THREE.PointLight(0xfff0d4, 0.9, 6.5, 1.6);
    pt.position.set(sx, 2.45, -3.5);
    stairsGroup.add(pt);
    stairLights.push(pt);
  }

  // Stage 3: Two waiting train doorways across the platform edge (Left train x = -2.2, Right train x = +2.2)
  const trainsGroup = new THREE.Group();
  group.add(trainsGroup);

  const trainBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b4046,
      roughness: 0.45,
      metalness: 0.65,
    })
  );
  const trainInteriorMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xd8caa8 })
  );

  const trainSides: ReadonlyArray<{ side: 'left' | 'right'; x: number }> = [
    { side: 'left', x: -2.2 },
    { side: 'right', x: 2.2 },
  ];

  const trainBulbMats: Record<'left' | 'right', THREE.MeshBasicMaterial> = {
    left: trackMat(new THREE.MeshBasicMaterial({ color: 0xfff0d4 })),
    right: trackMat(new THREE.MeshBasicMaterial({ color: 0xfff0d4 })),
  };
  const trainLights: Record<'left' | 'right', THREE.PointLight> = {
    left: new THREE.PointLight(0xfff0d4, 1.1, 7.5, 1.5),
    right: new THREE.PointLight(0xfff0d4, 1.1, 7.5, 1.5),
  };

  const carFacadeGeom = trackGeom(new THREE.BoxGeometry(3.4, 2.55, 0.35));
  const openDoorwayGeom = trackGeom(new THREE.BoxGeometry(1.25, 2.05, 0.42));

  for (const item of trainSides) {
    const facade = new THREE.Mesh(carFacadeGeom, trainBodyMat);
    facade.position.set(item.x, 1.32, -4.15);
    trainsGroup.add(facade);

    const doorway = new THREE.Mesh(openDoorwayGeom, trainInteriorMat);
    doorway.position.set(item.x, 1.1, -4.1);
    trainsGroup.add(doorway);

    const bulb = new THREE.Mesh(stairBulbGeom, trainBulbMats[item.side]);
    bulb.position.set(item.x, 2.75, -3.55);
    trainsGroup.add(bulb);

    const light = trainLights[item.side];
    light.position.set(item.x, 2.5, -3.5);
    trainsGroup.add(light);
  }

  const updateRouteSigns = (route: RouteLineId) => {
    if (currentSignRoute === route) return;
    currentSignRoute = route;
    const bulletColor =
      route === 'G' ? '#6cbe45' : route === 'L' ? '#a7a9ac' : '#b933ad';
    const termLabel = formatRouteText('To {terminusSign} trains', route);
    const oppLabel = formatRouteText('To {opposite} trains', route);

    leftSignTex = trackTex(
      createDirectionalSignTexture(termLabel, 'left', bulletColor, route)
    );
    rightSignTex = trackTex(
      createDirectionalSignTexture(oppLabel, 'right', bulletColor, route)
    );
    leftSignMat.map = leftSignTex;
    leftSignMat.needsUpdate = true;
    rightSignMat.map = rightSignTex;
    rightSignMat.needsUpdate = true;
  };

  return {
    group,
    update(elapsedSec: number, trialState: TrialState | null, route: RouteLineId) {
      if (!trialState) {
        group.visible = false;
        return;
      }

      group.visible = true;
      updateRouteSigns(route);

      // Show Stage 2 stairways during Stages 1 and 2; show Stage 3 waiting trains during Stage 3
      stairsGroup.visible = trialState.stage !== 3;
      trainsGroup.visible = trialState.stage === 3;

      // Flicker pattern for trap stairways / trap train when chime plays
      const pulse = Math.sin(elapsedSec * 29) * Math.cos(elapsedSec * 17);
      const isFlickerDip = pulse > 0.35 || (elapsedSec % 1.8) < 0.22;
      const trapMult = isFlickerDip ? 0.12 : 0.78;

      for (let i = 0; i < 3; i++) {
        const isSteady = i === trialState.steadyStairIndex;
        const mult = isSteady ? 1.0 : trapMult;
        const light = stairLights[i];
        const mat = stairBulbMats[i];
        if (light) light.intensity = 1.05 * mult;
        if (mat) {
          mat.color.setRGB(1.0 * mult, 0.94 * mult, 0.83 * mult);
        }
      }

      for (const side of ['left', 'right'] as const) {
        const isSteady = side === trialState.steadyTrainSide;
        const mult = isSteady ? 1.0 : trapMult;
        trainLights[side].intensity = 1.25 * mult;
        trainBulbMats[side].color.setRGB(1.0 * mult, 0.94 * mult, 0.83 * mult);
      }
    },
    dispose() {
      for (const g of disposableGeometries) g.dispose();
      for (const m of disposableMaterials) m.dispose();
      for (const t of disposableTextures) t.dispose();
    },
  };
}
