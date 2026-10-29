import {
  POLAROID_GAZE_THRESHOLD_RAD,
} from '../constants';
import type {
  ActiveAnomalyInstance,
  ConsistLocationLabel,
  PolaroidPhotoRecord,
  RouteLineId,
} from '../types';
import { isAnomalyFramed } from './anomalyManager';

/**
 * Pure check for whether an active manifested anomaly is framed inside the
 * Polaroid 600 square viewfinder when the shutter is snapped.
 */
export function isAnomalyFramedInViewfinder(params: {
  activeAnomaly: ActiveAnomalyInstance | null;
  playerX: number;
  playerEyeY: number;
  playerZ: number;
  playerYaw: number;
  playerPitch: number;
}): boolean {
  const { activeAnomaly, playerX, playerEyeY, playerZ, playerYaw, playerPitch } = params;
  return isAnomalyFramed(
    activeAnomaly,
    playerX,
    playerEyeY,
    playerZ,
    playerYaw,
    playerPitch,
    POLAROID_GAZE_THRESHOLD_RAD
  );
}

/**
 * Maps HUD consist location labels to the canonical Polaroid Evidence Log car strings:
 * "Car A (Lead)", "Car B (Mid)", "Car C (Rear)".
 */
export function formatCarLocationForPolaroid(
  carLocation: ConsistLocationLabel
): 'Car A (Lead)' | 'Car B (Mid)' | 'Car C (Rear)' {
  if (carLocation === 'CAR A (LEAD)') return 'Car A (Lead)';
  if (carLocation === 'CAR C (REAR)') return 'Car C (Rear)';
  return 'Car B (Mid)';
}

/**
 * Captures a 1:1 square Polaroid 600 frame from the active WebGL canvas (or generates
 * a procedural silver-halide emulsion print in headless/unit-test environments).
 */
export function captureSquarePolaroidDataUrl(params: {
  sourceCanvas?: HTMLCanvasElement | null;
  stopNumber: number;
  stationName: string;
  anomalyTitle: string | null;
}): string {
  const { sourceCanvas, stopNumber, stationName, anomalyTitle } = params;

  if (typeof document === 'undefined') {
    const label = encodeURIComponent(anomalyTitle ?? `Stop ${stopNumber} ${stationName}`);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%23181a18"/><text x="20" y="128" fill="%23ffcf8a" font-family="monospace" font-size="14">${label}</text></svg>`;
  }

  const size = 256;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  if (!ctx) {
    return '';
  }

  ctx.fillStyle = '#141715';
  ctx.fillRect(0, 0, size, size);

  if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
    const minDim = Math.min(sourceCanvas.width, sourceCanvas.height);
    const sx = Math.floor((sourceCanvas.width - minDim) / 2);
    const sy = Math.floor((sourceCanvas.height - minDim) / 2);
    try {
      ctx.drawImage(sourceCanvas, sx, sy, minDim, minDim, 0, 0, size, size);
    } catch {
      // Fallback if WebGL context cannot be drawn
    }
  } else {
    // Procedural subway interior silhouette fallback
    ctx.fillStyle = '#1e2420';
    ctx.fillRect(16, 24, size - 32, size - 48);
    ctx.fillStyle = '#fff0d4';
    ctx.fillRect(36, 36, size - 72, 10);
  }

  // Subtle Polaroid 600 warm silver-halide tint & vignette
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.25,
    size / 2,
    size / 2,
    size * 0.72
  );
  grad.addColorStop(0, 'rgba(255, 240, 212, 0.04)');
  grad.addColorStop(1, 'rgba(8, 10, 9, 0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return out.toDataURL('image/jpeg', 0.86);
}

/**
 * Builds a PolaroidPhotoRecord from the current ride state.
 */
export function buildPolaroidPhotoRecord(params: {
  photoIndex: number;
  stopNumber: number;
  stationName: string;
  carLocation: ConsistLocationLabel;
  routeId: RouteLineId;
  capturedAnomaly: ActiveAnomalyInstance | null;
  dataUrl: string;
  capturedAtSec: number;
  developed?: boolean;
}): PolaroidPhotoRecord {
  const {
    photoIndex,
    stopNumber,
    stationName,
    carLocation,
    routeId,
    capturedAnomaly,
    dataUrl,
    capturedAtSec,
    developed = false,
  } = params;

  return {
    id: `polaroid_${photoIndex}_${stopNumber}`,
    stopNumber,
    stationName,
    carLocation,
    routeId,
    dataUrl,
    anomalyId: capturedAnomaly ? capturedAnomaly.id : null,
    anomalyTitle: capturedAnomaly ? capturedAnomaly.title : null,
    psychClass: capturedAnomaly ? capturedAnomaly.psychClass : null,
    reportDescription: capturedAnomaly ? capturedAnomaly.reportDescription : null,
    developed,
    capturedAtSec,
  };
}
