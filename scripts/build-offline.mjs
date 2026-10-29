import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-offline');
const distDir = path.join(rootDir, 'dist');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

// 1. Bundle all TypeScript, React 19, and Three.js modules into a single inline IIFE/ESM script
const buildResult = await esbuild.build({
  entryPoints: [path.join(rootDir, 'src/main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2022'],
  jsx: 'automatic',
  write: false,
  loader: {
    '.css': 'empty',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

const bundledJs = buildResult.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
const rawCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');

// 2. Emit self-contained single-file index.html (zero external network or asset dependencies)
const singleFileHtml = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>LAST LOCAL: A Liminal Subway Horror Game</title>
    <meta name="description" content="Every stop takes you further from home. A first-person liminal horror ride on the NYC G train: spot subtle anomalies, keep your composure in front of your parents, and learn which doors are safe." />
    <style>${rawCss}</style>
  </head>
  <body class="bg-[#040504] text-[#e6e2d8] antialiased selection:bg-[#ffcf8a]/20 selection:text-[#fff0d4] overflow-hidden">
    <div id="root"></div>
    <script>${bundledJs}</script>
  </body>
</html>
`;

const htmlPath = path.join(outDir, 'index.html');
fs.writeFileSync(htmlPath, singleFileHtml, 'utf8');

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

