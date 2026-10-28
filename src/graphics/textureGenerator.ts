import * as THREE from 'three';
import { G_TRAIN_STOPS } from '../constants';
import type { AdCopyDefinition } from '../types';

/**
 * Runtime procedural CanvasTexture generator (no image files or external URLs).
 * Sets SRGBColorSpace and max anisotropy on all color textures.
 */

function finalizeCanvasTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.max(1, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

export function createAdTexture(
  ad: AdCopyDefinition,
  maxAnisotropy = 4,
  overrideHeadline?: string,
  overrideBgColor?: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(canvas, maxAnisotropy);

  const bg = overrideBgColor ?? ad.bgColor;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle top accent bar & border
  ctx.fillStyle = ad.accentColor;
  ctx.fillRect(14, 14, canvas.width - 28, 8);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Headline
  const headlineText = overrideHeadline ?? ad.headline;
  ctx.fillStyle = ad.textColor;
  ctx.font = 'bold 34px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(headlineText, 26, 38);

  // Tagline
  ctx.fillStyle = ad.accentColor;
  ctx.font = '600 22px sans-serif';
  ctx.fillText(ad.tagline, 26, 92);

  // Subtext
  ctx.fillStyle = 'rgba(244, 241, 234, 0.8)';
  ctx.font = '18px monospace';
  ctx.fillText(ad.subtext, 26, 138);

  return finalizeCanvasTexture(canvas, maxAnisotropy);
}

export function createRouteMapTexture(
  maxAnisotropy = 4,
  options?: {
    stops?: readonly string[];
    bulletLabel?: string;
    bulletColor?: string;
    hollowStAnomaly?: boolean;
  }
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(canvas, maxAnisotropy);

  const stops = options?.stops ?? G_TRAIN_STOPS;
  const bulletColor = options?.bulletColor ?? '#6cbe45';
  const bulletLabel = options?.bulletLabel ?? 'G';

  // Cream transit strip map background
  ctx.fillStyle = '#e9e4d8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top MTA header band
  ctx.fillStyle = '#181a1b';
  ctx.fillRect(0, 0, canvas.width, 48);

  // Line bullet circle
  ctx.beginPath();
  ctx.arc(34, 24, 16, 0, Math.PI * 2);
  ctx.fillStyle = bulletColor;
  ctx.fill();

  ctx.fillStyle = '#040504';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bulletLabel, 34, 25);

  ctx.fillStyle = '#f4f1ea';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BROOKLYN–QUEENS CROSSTOWN LOCAL', 62, 25);

  // Horizontal route line
  const startX = 56;
  const endX = canvas.width - 56;
  const lineY = 148;
  ctx.strokeStyle = bulletColor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(startX, lineY);
  ctx.lineTo(endX, lineY);
  ctx.stroke();

  // Station ticks & angled names
  const count = stops.length;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const x = startX + t * (endX - startX);

    ctx.beginPath();
    ctx.arc(x, lineY, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#181a1b';
    ctx.stroke();

    const label = options?.hollowStAnomaly && i === 6 ? 'Hollow St' : stops[i] ?? '';
    ctx.save();
    ctx.translate(x, lineY - 16);
    ctx.rotate(-0.42);
    ctx.fillStyle = '#141617';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  return finalizeCanvasTexture(canvas, maxAnisotropy);
}

export function createCarNumberPlateTexture(
  carLabel: string,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(canvas, maxAnisotropy);

  ctx.fillStyle = '#141715';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#6e736e';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.fillStyle = '#e6e2d8';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(carLabel, canvas.width / 2, 34);

  ctx.fillStyle = '#ffcf8a';
  ctx.font = '14px sans-serif';
  ctx.fillText('DO NOT LEAN ON DOOR', canvas.width / 2, 68);

  return finalizeCanvasTexture(canvas, maxAnisotropy);
}

export function createSpeckledFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(canvas, maxAnisotropy);

  ctx.fillStyle = '#181a18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Deterministic transit rubber floor flecks
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let i = 0; i < 900; i++) {
    const x = Math.floor(nextRand() * canvas.width);
    const y = Math.floor(nextRand() * canvas.height);
    const size = nextRand() > 0.75 ? 2 : 1;
    ctx.fillStyle = nextRand() > 0.5 ? '#2c302c' : '#101210';
    ctx.fillRect(x, y, size, size);
  }

  // Yellow safety threshold rib lines along edges
  ctx.fillStyle = '#b8923a';
  ctx.fillRect(0, 0, canvas.width, 4);
  ctx.fillRect(0, canvas.height - 4, canvas.width, 4);

  const tex = finalizeCanvasTexture(canvas, maxAnisotropy);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  return tex;
}

export function drawStationSignCanvas(
  canvas: HTMLCanvasElement,
  stopName: string,
  bulletLabel: string,
  bulletColor: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Classic NYC MTA black sign board with crisp white top stripe
  ctx.fillStyle = '#0e1010';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 14, canvas.width, 6);

  // Outer frame
  ctx.strokeStyle = '#3c403e';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  // Route bullet circle
  const circleX = 64;
  const circleY = 92;
  ctx.beginPath();
  ctx.arc(circleX, circleY, 32, 0, Math.PI * 2);
  ctx.fillStyle = bulletColor;
  ctx.fill();

  ctx.fillStyle = '#050605';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bulletLabel, circleX, circleY + 2);

  // Station name in bold condensed Helvetica/sans-serif style
  ctx.fillStyle = '#f5f2eb';
  const fontSize = stopName.length > 20 ? 36 : stopName.length > 15 ? 42 : 48;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(stopName, 114, circleY - 4);

  // Subtitle directional line
  ctx.fillStyle = '#a8a49a';
  ctx.font = '600 18px monospace';
  ctx.fillText('QUEENS & BROOKLYN LOCAL · NIGHT SERVICE', 114, 134);
}

export function createStationSignTexture(
  stopName: string,
  bulletLabel = 'G',
  bulletColor = '#6cbe45',
  maxAnisotropy = 4
): { texture: THREE.CanvasTexture; updateSign: (name: string, label: string, color: string) => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 168;
  drawStationSignCanvas(canvas, stopName, bulletLabel, bulletColor);
  const texture = finalizeCanvasTexture(canvas, maxAnisotropy);

  const updateSign = (name: string, label: string, color: string) => {
    drawStationSignCanvas(canvas, name, label, color);
    texture.needsUpdate = true;
  };

  return { texture, updateSign };
}

export function createStationTileWallTexture(
  accentStripeColor = '#6cbe45',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(canvas, maxAnisotropy);

  // Off-white aged subway ceramic tile background
  ctx.fillStyle = '#7e7c72';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grout lines (brick bond)
  ctx.strokeStyle = '#4c4b44';
  ctx.lineWidth = 2;
  const tileH = 32;
  const tileW = 64;
  for (let row = 0; row < canvas.height / tileH; row++) {
    const y = row * tileH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();

    const offset = (row % 2) * (tileW / 2);
    for (let col = 0; col <= canvas.width / tileW; col++) {
      const x = col * tileW + offset;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + tileH);
      ctx.stroke();
    }
  }

  // Top mosaic stripe & dark wainscot base
  ctx.fillStyle = '#181a18';
  ctx.fillRect(0, 24, canvas.width, 28);
  ctx.fillStyle = accentStripeColor;
  ctx.fillRect(0, 32, canvas.width, 12);

  ctx.fillStyle = '#252724';
  ctx.fillRect(0, canvas.height - 44, canvas.width, 44);

  const tex = finalizeCanvasTexture(canvas, maxAnisotropy);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(16, 1);
  return tex;
}

