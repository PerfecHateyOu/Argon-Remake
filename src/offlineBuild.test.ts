import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('offline build generates self-contained index.html, canonical README.txt, and Last-Local-offline.zip', () => {
  const rootDir = process.cwd();
  execFileSync(process.execPath, [path.join(rootDir, 'scripts/build-offline.mjs')], {
    stdio: 'pipe',
  });

  const htmlPath = path.join(rootDir, 'dist-offline/index.html');
  const readmePath = path.join(rootDir, 'dist-offline/README.txt');
  const zipPath = path.join(rootDir, 'Last-Local-offline.zip');

  assert.ok(fs.existsSync(htmlPath), 'dist-offline/index.html must exist');
  assert.ok(fs.existsSync(readmePath), 'dist-offline/README.txt must exist');
  assert.ok(fs.existsSync(zipPath), 'Last-Local-offline.zip must exist');

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('LAST LOCAL: A Liminal Subway Horror Game'));
  assert.equal(/<script[^>]+src=/i.test(html), false, 'offline index.html must not have external script src');
  assert.equal(/<link[^>]+href=/i.test(html), false, 'offline index.html must not have external link href');

  const readme = fs.readFileSync(readmePath, 'utf8');
  assert.ok(
    readme.includes(
      'A first-person liminal horror ride on the NYC G train, from Hoyt–Schermerhorn to Court Square, 13 stops, with your parents. Notice what changes in the car, hide that you noticed, and learn which doors are safe.'
    )
  );
  assert.ok(readme.includes('1. Notice.'));
  assert.ok(readme.includes("2. Don't show it."));
  assert.ok(readme.includes('3. Read the doors.'));

  const zipEntries = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
  assert.ok(zipEntries.includes('index.html'));
  assert.ok(zipEntries.includes('README.txt'));
});

