import { ADS_ACROSS_AISLE } from '../constants';
import type { ActiveAnomalyInstance, AnomalyId } from '../types';
import {
  createMisprintHeadline,
  DAD_ANSWERING_ANOMALY_LINES,
  formatAnomalyReportDescription,
  PSYCH_LOG_CATALOG,
} from './psychLog';

const SHIFTED_AD_BG_COLORS: readonly string[] = [
  '#3b182e',
  '#193632',
  '#3d2b14',
  '#251b3d',
  '#1d3319',
];

/**
 * Builds a complete ActiveAnomalyInstance with 3D target coordinates (< 5 m from seat for close-up ones)
 * and canonical report description.
 */
export function buildActiveAnomalyInstance(
  id: AnomalyId,
  randomFn: () => number = Math.random
): ActiveAnomalyInstance {
  const def = PSYCH_LOG_CATALOG[id];

  // Across-the-aisle ads in Car B sit at x in [-3.2, 0, 3.2], y = 2.15, z = -1.405 (all < 4.1 m from seat)
  const closeAdSlots: ReadonlyArray<{ meshSlotIndex: number; worldX: number }> = [
    { meshSlotIndex: 1, worldX: -3.2 },
    { meshSlotIndex: 2, worldX: 0 },
    { meshSlotIndex: 3, worldX: 3.2 },
  ];
  const chosenAdSlot =
    closeAdSlots[Math.floor(randomFn() * closeAdSlots.length)] ?? closeAdSlots[1]!;
  const chosenAd =
    ADS_ACROSS_AISLE[chosenAdSlot.meshSlotIndex % ADS_ACROSS_AISLE.length] ??
    ADS_ACROSS_AISLE[0]!;

  switch (id) {
    case 'misprint': {
      const swapped = createMisprintHeadline(chosenAd.headline);
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: chosenAdSlot.worldX,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: `ad_${chosenAdSlot.meshSlotIndex}`,
        adIndex: chosenAdSlot.meshSlotIndex,
        adSwappedHeadline: swapped,
        reportDescription: formatAnomalyReportDescription({
          id: 'misprint',
          adHeadline: chosenAd.headline,
          adSwappedHeadline: swapped,
        }),
      };
    }

    case 'window_residue': {
      const variant: 'sticker' | 'stain' = randomFn() < 0.5 ? 'sticker' : 'stain';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: -0.95,
        targetY: 1.44,
        targetZ: -1.41,
        manifested: false,
        caught: false,
        variantKey: variant,
        reportDescription: formatAnomalyReportDescription({
          id: 'window_residue',
          windowResidueVariant: variant,
        }),
      };
    }

    case 'cold_panel': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: -2.1,
        targetY: 2.38,
        targetZ: -0.96,
        manifested: false,
        caught: false,
        variantKey: 'cold_blue',
        reportDescription: formatAnomalyReportDescription({ id: 'cold_panel' }),
      };
    }

    case 'man_across_aisle': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -0.38,
        targetY: 1.16,
        targetZ: -1.08,
        manifested: false,
        caught: false,
        variantKey: 'staring',
        reportDescription: formatAnomalyReportDescription({ id: 'man_across_aisle' }),
      };
    }

    case 'route_map_error': {
      const variant: 'hollow_st' | 'wrong_color' =
        randomFn() < 0.65 ? 'hollow_st' : 'wrong_color';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: -1.6,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: variant,
        reportDescription: formatAnomalyReportDescription({
          id: 'route_map_error',
          routeMapVariant: variant,
        }),
      };
    }

    case 'color_drift': {
      const shiftedBg =
        SHIFTED_AD_BG_COLORS[
          Math.floor(randomFn() * SHIFTED_AD_BG_COLORS.length)
        ] ?? '#3b182e';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: chosenAdSlot.worldX,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: `color_${chosenAdSlot.meshSlotIndex}`,
        adIndex: chosenAdSlot.meshSlotIndex,
        adShiftedBgColor: shiftedBg,
        reportDescription: formatAnomalyReportDescription({
          id: 'color_drift',
          adHeadline: chosenAd.headline,
        }),
      };
    }

    case 'relocated_passenger': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -5.0,
        targetY: 1.35,
        targetZ: -0.82,
        manifested: false,
        caught: false,
        variantKey: 'far_doors',
        reportDescription: formatAnomalyReportDescription({
          id: 'relocated_passenger',
        }),
      };
    }

    case 'additional_passenger': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -4.05,
        targetY: 1.16,
        targetZ: -1.08,
        manifested: false,
        caught: false,
        variantKey: 'far_seat',
        reportDescription: formatAnomalyReportDescription({
          id: 'additional_passenger',
        }),
      };
    }

    case 'warped_copy': {
      const warped = chosenAd.warpedHeadline ?? 'GREENPOINT SAVES US';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: chosenAdSlot.worldX,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: `warp_${chosenAdSlot.meshSlotIndex}`,
        adIndex: chosenAdSlot.meshSlotIndex,
        adSwappedHeadline: warped,
        reportDescription: formatAnomalyReportDescription({
          id: 'warped_copy',
          adHeadline: chosenAd.headline,
          adWarpedHeadline: warped,
        }),
      };
    }

    case 'woman_on_bench': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -1.65,
        targetY: 1.16,
        targetZ: 1.08,
        manifested: false,
        caught: false,
        variantKey: 'neck_twist',
        reportDescription: formatAnomalyReportDescription({ id: 'woman_on_bench' }),
      };
    }

    case 'mom_fixed': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -0.76,
        targetY: 1.16,
        targetZ: 1.08,
        manifested: false,
        caught: false,
        variantKey: 'dilated_eyes',
        reportDescription: formatAnomalyReportDescription({ id: 'mom_fixed' }),
      };
    }

    case 'dad_answering': {
      const dadLine =
        DAD_ANSWERING_ANOMALY_LINES[
          Math.floor(randomFn() * DAD_ANSWERING_ANOMALY_LINES.length)
        ] ?? DAD_ANSWERING_ANOMALY_LINES[0]!;
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: 0.76,
        targetY: 1.16,
        targetZ: 1.08,
        manifested: false,
        caught: false,
        variantKey: 'unspoken_reply',
        dadLine,
        reportDescription: formatAnomalyReportDescription({
          id: 'dad_answering',
          dadLine,
        }),
      };
    }

    case 'empty_car': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -0.38,
        targetY: 1.16,
        targetZ: -1.08,
        manifested: false,
        caught: false,
        variantKey: 'vanished',
        reportDescription: formatAnomalyReportDescription({ id: 'empty_car' }),
      };
    }
  }
}
