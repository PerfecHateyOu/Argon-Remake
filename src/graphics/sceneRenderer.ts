import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AMBER_ACCENT_COLOR,
  CAMERA_FAR,
  CAMERA_FOV_LANDSCAPE,
  CAMERA_NEAR,
  CAR_CENTERS_X,
  FLUORESCENT_LIGHT_COLOR,
  FLUORESCENT_LIGHT_DECAY,
  FLUORESCENT_LIGHT_DISTANCE,
  PLAYER_EYE_HEIGHT_SEATED,
  PLAYER_SEAT_X,
  PLAYER_SEAT_Z,
  ROUTE_METADATA,
  TONE_MAPPING_EXPOSURE,
  TUNNEL_FOG_COLOR,
  TUNNEL_FOG_FAR,
  TUNNEL_FOG_NEAR,
} from '../constants';
import { gameEngine } from '../game/gameState';
import { playerController } from '../input/keyLook';
import { settingsStore } from '../settings';
import type { RouteLineId } from '../types';
import { buildCarCharacters, type CarCharactersRig } from './characterBuilder';
import { buildPassingTrain, type PassingTrainRig } from './passingTrain';
import { buildSubwayConsist, type SubwayConsistRig } from './subwayCarBuilder';
import { buildTunnelAndStations, type TunnelAndStationRig } from './tunnelBuilder';

/**
 * Compute vertical FOV for PerspectiveCamera:
 * 68 deg in landscape; scaled smoothly for portrait viewports so horizontal framing remains readable.
 */
export function computeCameraVerticalFov(aspect: number): number {
  if (aspect >= 1) {
    return CAMERA_FOV_LANDSCAPE;
  }
  const radH = THREE.MathUtils.degToRad(CAMERA_FOV_LANDSCAPE);
  const radV = 2 * Math.atan(Math.tan(radH / 2) / Math.max(0.45, aspect));
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(radV), CAMERA_FOV_LANDSCAPE, 98);
}

function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class SceneRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private lastTimestamp = 0;
  private elapsedSec = 0;
  private disposed = false;
  private detachInput: (() => void) | null = null;
  private unsubPassingTrain: (() => void) | null = null;

  private consistRig: SubwayConsistRig;
  private tunnelRig: TunnelAndStationRig;
  private passingTrainRig: PassingTrainRig;
  private charactersRig: CarCharactersRig;
  private pooledFluorescentLights: THREE.PointLight[] = [];
  private gangwayAmberLights: THREE.PointLight[] = [];

  private lastSyncedStationKey = '';
  private lastSyncedRoute: RouteLineId = 'G';
  private lastSyncedSegmentId = '';

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareGl();

    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 720;
    const aspect = width / Math.max(1, height);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(TUNNEL_FOG_COLOR);
    this.scene.fog = new THREE.Fog(TUNNEL_FOG_COLOR, TUNNEL_FOG_NEAR, TUNNEL_FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(
      computeCameraVerticalFov(aspect),
      aspect,
      CAMERA_NEAR,
      CAMERA_FAR
    );
    this.camera.position.set(PLAYER_SEAT_X, PLAYER_EYE_HEIGHT_SEATED, PLAYER_SEAT_Z);
    _euler.set(-0.03, 0, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    this.renderer.shadowMap.enabled = false;

    const initialRatio = this.isSoftwareGl ? 1 : gameEngine.getSnapshot().pixelRatio;
    this.renderer.setPixelRatio(initialRatio);
    this.renderer.setSize(width, height);
    this.renderer.domElement.dataset.testid = 'game-canvas';
    this.renderer.domElement.className = 'block w-full h-full outline-none select-none';
    this.renderer.domElement.tabIndex = 0;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.consistRig = buildSubwayConsist(maxAnisotropy);
    this.scene.add(this.consistRig.root);

    this.tunnelRig = buildTunnelAndStations(maxAnisotropy);
    this.scene.add(this.tunnelRig.root);

    this.passingTrainRig = buildPassingTrain();
    this.scene.add(this.passingTrainRig.root);

    this.charactersRig = buildCarCharacters();
    this.scene.add(this.charactersRig.root);

    this.unsubPassingTrain = gameEngine.onPassingTrainTrigger(() => {
      this.passingTrainRig.triggerPass();
    });

    this.setupLightingPool();
    this.detachInput = playerController.attach(this.renderer.domElement);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
  }

  private setupLightingPool(): void {
    const hemiLight = new THREE.HemisphereLight(FLUORESCENT_LIGHT_COLOR, 0x0c0e12, 0.36);
    this.scene.add(hemiLight);

    const initialXOffsets = [-6.5, -2.2, 2.2, 6.5];
    for (const offset of initialXOffsets) {
      const light = new THREE.PointLight(
        FLUORESCENT_LIGHT_COLOR,
        1.15,
        FLUORESCENT_LIGHT_DISTANCE,
        FLUORESCENT_LIGHT_DECAY
      );
      light.position.set(offset, 2.24, 0);
      this.scene.add(light);
      this.pooledFluorescentLights.push(light);
    }

    for (const gx of [-9.75, 9.75]) {
      const amber = new THREE.PointLight(AMBER_ACCENT_COLOR, 0.48, 5.5, 1.8);
      amber.position.set(gx, 2.02, 0);
      this.scene.add(amber);
      this.gangwayAmberLights.push(amber);
    }
  }

  private updateLightPoolPositions(playerX: number, flickerMult: number): void {
    let centerAnchorX: number = CAR_CENTERS_X.B;
    if (playerX < -10.0) {
      centerAnchorX = CAR_CENTERS_X.A;
    } else if (playerX > 10.0) {
      centerAnchorX = CAR_CENTERS_X.C;
    }

    const offsets = [-6.2, -2.0, 2.0, 6.2];
    const targetIntensity = 1.15 * flickerMult;
    for (let i = 0; i < this.pooledFluorescentLights.length; i++) {
      const light = this.pooledFluorescentLights[i];
      const offset = offsets[i] ?? 0;
      if (light) {
        light.position.x = centerAnchorX + offset;
        light.intensity = targetIntensity;
      }
    }
  }

  private syncStationAndRouteSignage(): void {
    const snap = gameEngine.getSnapshot();
    if (snap.activeRoute !== this.lastSyncedRoute) {
      this.lastSyncedRoute = snap.activeRoute;
      this.consistRig.updateRouteMaps(snap.activeRoute);
    }

    if (snap.segmentId !== this.lastSyncedSegmentId) {
      this.lastSyncedSegmentId = snap.segmentId;
      const segRule = gameEngine.getCurrentSegmentRule();
      this.charactersRig.setSegmentDensity({
        thin: segRule.thin,
        crowd: segRule.crowd,
      });
    }

    const targetStationName =
      snap.phase === 'stop' || snap.rideSubPhase === 'departing'
        ? snap.currentStationName
        : snap.nextStationName;

    const stationKey = `${snap.activeRoute}:${targetStationName}:${snap.isOpenAirStation}`;
    if (stationKey !== this.lastSyncedStationKey) {
      this.lastSyncedStationKey = stationKey;
      const routeMeta = ROUTE_METADATA[snap.activeRoute];
      this.tunnelRig.setStationInfo(
        targetStationName,
        routeMeta.id,
        routeMeta.bulletColor,
        snap.isOpenAirStation
      );
    }
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth || 1280;
    const height = this.container.clientHeight || window.innerHeight || 720;
    const aspect = width / Math.max(1, height);

    this.camera.aspect = aspect;
    this.camera.fov = computeCameraVerticalFov(aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (timestamp: number): void => {
    if (this.disposed) return;

    const rawDtMs = this.lastTimestamp > 0 ? timestamp - this.lastTimestamp : 16.67;
    this.lastTimestamp = timestamp;
    const clampedDtSec = Math.min(rawDtMs / 1000, 0.05);

    const preSnap = gameEngine.getSnapshot();
    const reducedEffects = settingsStore.isReducedEffectsActive();

    if (!this.isSoftwareGl && !preSnap.paused) {
      const nextRatio = gameEngine.recordFrameDelta(rawDtMs);
      if (nextRatio !== null) {
        this.renderer.setPixelRatio(nextRatio);
      }
    }

    if (!preSnap.paused) {
      this.elapsedSec += clampedDtSec;
      gameEngine.stepRide(clampedDtSec);
    }

    const snap = gameEngine.getSnapshot();
    this.syncStationAndRouteSignage();

    if (!snap.paused) {
      if (snap.phase === 'menu') {
        const swayY = reducedEffects ? 0 : Math.sin(this.elapsedSec * 1.8) * 0.004;
        this.camera.position.set(PLAYER_SEAT_X, PLAYER_EYE_HEIGHT_SEATED + swayY, PLAYER_SEAT_Z);
        _euler.set(-0.03, 0, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);
        this.tunnelRig.step(clampedDtSec, 8.0, 200, false);
        this.consistRig.updateSideDoors(0);
        this.consistRig.setCeilingLightIntensity(1.0);
        this.updateLightPoolPositions(PLAYER_SEAT_X, 1.0);
        this.charactersRig.step(clampedDtSec, this.elapsedSec, PLAYER_SEAT_X, PLAYER_SEAT_Z, null);
      } else {
        const kin = playerController.step(clampedDtSec, snap.phase);
        const walkSpeed = Math.hypot(kin.vx, kin.vz);
        const speedNorm = Math.min(1, snap.trainSpeedMps / 15.5);

        const walkBobY =
          !reducedEffects && !kin.seated && walkSpeed > 0.1
            ? Math.sin(this.elapsedSec * 9.5) * 0.014 * Math.min(1, walkSpeed / 2.2)
            : 0;
        const railSwayY =
          reducedEffects ? 0 : Math.sin(this.elapsedSec * 2.5) * 0.0045 * speedNorm;
        const railSwayRoll =
          reducedEffects ? 0 : Math.cos(this.elapsedSec * 1.7) * 0.003 * speedNorm;

        this.camera.position.set(kin.x, kin.y + walkBobY + railSwayY, kin.z);
        _euler.set(kin.pitch, kin.yaw, railSwayRoll, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);

        this.consistRig.updateGangwayDoors(kin.x, clampedDtSec);
        this.consistRig.updateSideDoors(snap.doorOpenProgress, 'platform');
        this.consistRig.setCeilingLightIntensity(snap.lightFlickerIntensity);
        this.updateLightPoolPositions(kin.x, snap.lightFlickerIntensity);

        this.tunnelRig.step(
          clampedDtSec,
          snap.trainSpeedMps,
          snap.stationDistanceM,
          snap.isOpenAirStation
        );
        this.passingTrainRig.step(clampedDtSec, snap.trainSpeedMps);
        this.charactersRig.step(
          clampedDtSec,
          this.elapsedSec,
          kin.x,
          kin.z,
          snap.watchingParentLabel
        );

        gameEngine.syncPlayerPose(kin.x, kin.z, kin.yaw, kin.pitch);
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick(performance.now()));
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  };

  public start(): void {
    if (this.disposed) return;
    this.lastTimestamp = performance.now();
    if (this.isSoftwareGl) {
      this.tick(this.lastTimestamp);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public dispose(): void {
    this.disposed = true;
    window.removeEventListener('resize', this.handleResize);
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.detachInput?.();
    this.unsubPassingTrain?.();
    this.consistRig.dispose();
    this.tunnelRig.dispose();
    this.passingTrainRig.dispose();
    this.charactersRig.dispose();
    if (this.scene.environment) {
      this.scene.environment.dispose();
    }
    this.renderer.dispose();
  }
}
