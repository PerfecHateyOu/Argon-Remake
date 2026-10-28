import assert from 'node:assert/strict';
import test from 'node:test';
import { SEGMENT_TABLE } from '../constants';
import { getChapterRollsign, getStopName, isElevatedOpenAirStop } from './routeManager';
import {
  formatRouteText,
  getArrivalPaText,
  getBoardingPaText,
  getDeparturePaText,
  getNextStopPaText,
} from './routeText';

test('routeManager returns canonical stop names and open-air status for 21 St on G', () => {
  assert.equal(getStopName('G', 0), 'Hoyt–Schermerhorn');
  assert.equal(getStopName('G', 11), '21 St');
  assert.equal(getStopName('G', 12), 'Court Sq');
  assert.equal(getStopName('L', 12), 'Myrtle–Wyckoff Avs');
  assert.equal(getStopName('7', 12), 'Terminal Echo');
  assert.equal(getStopName('G', 99), 'Track Marker 100');

  assert.equal(isElevatedOpenAirStop('G', 11), true);
  assert.equal(isElevatedOpenAirStop('G', 10), false);
  assert.equal(isElevatedOpenAirStop('L', 11), false);
});

test('getChapterRollsign returns OPERATION SKYWARD on G and THE LAST STRETCH on L/7', () => {
  const ch1 = getChapterRollsign(1, 'G');
  assert.equal(ch1.title, 'CHAPTER I — THE DESCENT');

  const ch2 = getChapterRollsign(2, 'G');
  assert.equal(ch2.title, 'CHAPTER II — SIGNAL DRIFT');

  const ch3G = getChapterRollsign(3, 'G');
  assert.equal(ch3G.title, 'CHAPTER III — OPERATION SKYWARD');

  const ch3L = getChapterRollsign(3, 'L');
  assert.equal(ch3L.title, 'CHAPTER III — THE LAST STRETCH');

  const ch3Ghost = getChapterRollsign(3, '7');
  assert.equal(ch3Ghost.title, 'CHAPTER III — THE LAST STRETCH');
});

test('routeText interpolates canonical placeholders and PA scripts', () => {
  assert.equal(
    getBoardingPaText('G'),
    'This is the Last Local. Court Sq–bound G train.'
  );
  assert.equal(
    getBoardingPaText('L'),
    'This is the Last Local. Myrtle–Wyckoff Avs–bound L train.'
  );
  assert.equal(getDeparturePaText(), 'Stand clear of the closing doors, please.');
  assert.equal(getNextStopPaText('G', 1), 'The next stop is Fulton St.');

  const seg2 = SEGMENT_TABLE.find((s) => s.id === '2')!;
  assert.equal(getArrivalPaText('G', seg2), 'This is Fulton St.');

  const seg9 = SEGMENT_TABLE.find((s) => s.id === '9')!;
  assert.equal(
    getArrivalPaText('G', seg9),
    'This is Court Square. Last stop. Everybody off the train.'
  );

  const seg13 = SEGMENT_TABLE.find((s) => s.id === '13')!;
  assert.equal(
    getArrivalPaText('G', seg13),
    'Court Sq. This is the last stop on this train.'
  );

  const evpSample = formatRouteText(
    '…{line} four-forty, hold at {s10}. Hold. Do not open the doors at {s10}…',
    'G'
  );
  assert.equal(
    evpSample,
    '…G four-forty, hold at Nassau Av. Hold. Do not open the doors at Nassau Av…'
  );
});
