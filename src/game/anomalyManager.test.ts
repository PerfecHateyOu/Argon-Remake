import assert from 'node:assert/strict';
import test from 'node:test';
import { SEGMENT_TABLE } from '../constants';
import {
  buildActiveAnomalyInstance,
  computeCameraAngleToTarget,
  computeManifestationAngleThreshold,
  isLookingAtAnomaly,
  selectAnomalyIdForStretch,
  shouldAnomalyManifest,
  stepFlagHoldProgress,
} from './anomalyManager';
import {
  createMisprintHeadline,
  formatAnomalyReportDescription,
  PSYCH_IDS,
  PSYCH_LOG_CATALOG,
} from './psychLog';

test('psychLog defines all 13 canonical anomalies with verbatim v5.3 titles and Case File notes', () => {
  assert.equal(PSYCH_IDS.length, 13);
  assert.equal(PSYCH_LOG_CATALOG.misprint.title, 'The Misprint');
  assert.equal(
    PSYCH_LOG_CATALOG.misprint.caseFileNote,
    'One letter in an overhead ad changed while you weren’t looking. Small enough to doubt.'
  );
  assert.equal(PSYCH_LOG_CATALOG.mom_fixed.title, 'Mom, Fixed');
  assert.equal(PSYCH_LOG_CATALOG.mom_fixed.psychClass, 'IV');
  assert.equal(
    PSYCH_LOG_CATALOG.empty_car.caseFileNote,
    'Every stranger was gone at once. Your parents didn’t mention it.'
  );

  // Single-letter swap on GREENPOINT SAVINGS swaps E->F ("GRFENPOINT SAVINGS")
  const swapped = createMisprintHeadline('GREENPOINT SAVINGS');
  assert.notEqual(swapped, 'GREENPOINT SAVINGS');
  assert.equal(swapped.length, 'GREENPOINT SAVINGS'.length);
  assert.equal(
    formatAnomalyReportDescription({
      id: 'misprint',
      adHeadline: 'GREENPOINT SAVINGS',
      adSwappedHeadline: swapped,
    }),
    `The GREENPOINT SAVINGS ad had a typo: "${swapped}"`
  );
});

test('computeManifestationAngleThreshold narrows from 0.7 rad to 0.35 rad after 8s and 0.2 rad in final 3s', () => {
  assert.equal(computeManifestationAngleThreshold(2.0, 20.0), 0.7);
  assert.equal(computeManifestationAngleThreshold(8.5, 20.0), 0.35);
  assert.equal(computeManifestationAngleThreshold(17.5, 20.0), 0.2);
});

test('shouldAnomalyManifest requires off-gaze angle > threshold and <5m for close-up anomalies', () => {
  const misprint = buildActiveAnomalyInstance('misprint', () => 0.5);
  // Target is at (0, 2.15, -1.4). Camera at seat (0, 1.24, 0.85) looking straight at target:
  const directPitch = Math.atan2(2.15 - 1.24, 0.85 - -1.4);
  const directAngle = computeCameraAngleToTarget(
    0,
    1.24,
    0.85,
    0,
    directPitch,
    misprint.targetX,
    misprint.targetY,
    misprint.targetZ
  );
  assert.ok(directAngle < 0.05);

  // Looking directly at the ad -> must NOT manifest
  assert.equal(
    shouldAnomalyManifest({
      anomaly: misprint,
      cameraX: 0,
      cameraY: 1.24,
      cameraZ: 0.85,
      yaw: 0,
      pitch: directPitch,
      stretchElapsedSec: 3.0,
      stretchDurationSec: 20.0,
    }),
    false
  );

  // Looking away (yaw = 1.2 rad to the left) -> MUST manifest
  assert.equal(
    shouldAnomalyManifest({
      anomaly: misprint,
      cameraX: 0,
      cameraY: 1.24,
      cameraZ: 0.85,
      yaw: 1.2,
      pitch: 0,
      stretchElapsedSec: 3.0,
      stretchDurationSec: 20.0,
    }),
    true
  );

  // Walking > 5 m away into Car A (x = -15) blocks close-up manifestation
  assert.equal(
    shouldAnomalyManifest({
      anomaly: misprint,
      cameraX: -15,
      cameraY: 1.65,
      cameraZ: 0,
      yaw: 1.2,
      pitch: 0,
      stretchElapsedSec: 3.0,
      stretchDurationSec: 20.0,
    }),
    false
  );
});

test('selectAnomalyIdForStretch enforces forced stops (6b, 10, 12) and blocks Class IV before stop 10', () => {
  const seg6b = SEGMENT_TABLE.find((s) => s.id === '6b')!;
  assert.equal(
    selectAnomalyIdForStretch({
      segmentRule: seg6b,
      sanityTier: 'High',
    }),
    'route_map_error'
  );

  const seg10 = SEGMENT_TABLE.find((s) => s.id === '10')!;
  const stop10Pick = selectAnomalyIdForStretch({
    segmentRule: seg10,
    sanityTier: 'Medium',
    randomFn: () => 0.1,
  });
  assert.ok(stop10Pick === 'mom_fixed' || stop10Pick === 'dad_answering');

  const seg12 = SEGMENT_TABLE.find((s) => s.id === '12')!;
  const stop12Pick = selectAnomalyIdForStretch({
    segmentRule: seg12,
    sanityTier: 'High',
    randomFn: () => 0.9,
  });
  assert.equal(stop12Pick, 'empty_car');

  // Stop 4 with Critical sanity still blocks tier 3 (Class IV) because stopNumber < 10
  const seg4 = SEGMENT_TABLE.find((s) => s.id === '4')!;
  const stop4Pick = selectAnomalyIdForStretch({
    segmentRule: seg4,
    sanityTier: 'Critical',
    randomFn: () => 0.2,
  });
  assert.ok(stop4Pick);
  assert.ok(PSYCH_LOG_CATALOG[stop4Pick].tierIndex < 3);
});

test('stepFlagHoldProgress completes catch after 0.7s when looking at manifested anomaly', () => {
  const mta = buildActiveAnomalyInstance('man_across_aisle');
  mta.manifested = true;

  assert.equal(isLookingAtAnomaly(mta, 0, 1.24, 0.85, 0, -0.04), true);

  const step1 = stepFlagHoldProgress({
    isHolding: true,
    currentProgress: 0,
    dtSec: 0.35,
    lookingAtActiveAnomaly: true,
  });
  assert.equal(step1.completedCatch, false);
  assert.ok(step1.nextProgress > 0.45 && step1.nextProgress < 0.55);

  const step2 = stepFlagHoldProgress({
    isHolding: true,
    currentProgress: step1.nextProgress,
    dtSec: 0.4,
    lookingAtActiveAnomaly: true,
  });
  assert.equal(step2.completedCatch, true);
  assert.equal(step2.completedFalseFlag, false);
  assert.equal(step2.nextProgress, 0);
});
