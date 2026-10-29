import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-offline');
const distDir = path.join(rootDir, 'dist');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

// 1. Build with `vite build --mode offline` so Tailwind CSS is compiled by @tailwindcss/vite
const viteBin = path.join(rootDir, 'node_modules', '.bin', 'vite');
execFileSync(viteBin, ['build', '--mode', 'offline', '--outDir', outDir], {
  cwd: rootDir,
  stdio: 'inherit',
});

// 2. Inline compiled CSS and JS assets into the single index.html so it opens with no network
const htmlPath = path.join(outDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(
  /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
  (_match, href) => {
    const assetPath = path.resolve(outDir, href.replace(/^\.\//, ''));
    const css = fs.readFileSync(assetPath, 'utf8');
    return `<style>${css}</style>`;
  }
);

html = html.replace(
  /<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,
  (_match, src) => {
    const assetPath = path.resolve(outDir, src.replace(/^\.\//, ''));
    const js = fs.readFileSync(assetPath, 'utf8').replace(/<\/script>/gi, '<\\/script>');
    return `<script type="module">${js}</script>`;
  }
);

fs.writeFileSync(htmlPath, html, 'utf8');
fs.rmSync(path.join(outDir, 'assets'), { recursive: true, force: true });

// 3. Emit canonical v5.3 README.txt
const readmeText = `LAST LOCAL: A Liminal Subway Horror Game
========================================

A first-person liminal horror ride on the NYC G train, from Hoyt–Schermerhorn to Court Square, 13 stops, with your parents. Notice what changes in the car, hide that you noticed, and learn which doors are safe.

How to play
-----------
1. Notice. When something in the car changes, look at it and hold Flag. Flags are private.
2. Don't show it. Staring at something wrong, or whipping your head around, while a parent is looking at you raises their suspicion. When they talk to you, answer like nothing is wrong.
3. Read the doors. At every stop you can stay on or step off. Stepping off is usually a trap.

After the Safe Haven, Dad gives you his old tape recorder. Tune it and you'll pick up voices, and some carriers that are only tones. What it hears has nothing to do with what's wrong in the car, and holding it up where your parents can see is a reaction too.

Offline Launch
--------------
Open index.html directly in any modern desktop or mobile browser. No internet connection or local server is required.
`;

const readmePath = path.join(outDir, 'README.txt');
fs.writeFileSync(readmePath, readmeText, 'utf8');

// 4. Package index.html + README.txt into Last-Local-offline.zip
const rootZipPath = path.join(rootDir, 'Last-Local-offline.zip');
const distZipPath = path.join(distDir, 'Last-Local-offline.zip');

if (fs.existsSync(rootZipPath)) fs.unlinkSync(rootZipPath);
if (fs.existsSync(distZipPath)) fs.unlinkSync(distZipPath);

execFileSync('zip', ['-q', '-j', rootZipPath, htmlPath, readmePath]);
fs.copyFileSync(rootZipPath, distZipPath);

console.log(
  `Built offline package: ${rootZipPath} (${(fs.statSync(rootZipPath).size / 1024).toFixed(1)} KB)`
);

