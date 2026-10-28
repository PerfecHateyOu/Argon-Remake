import type { RouteLineId, SegmentRule } from '../types';
import { getRouteSpec, getStopName } from './routeManager';

/**
 * Canonical v5.3 route text interpolation and PA announcement script builder.
 * Replaces {terminus}, {terminusSign}, {origin}, {originShort}, {opposite}, {line},
 * {s4}, {s5}, {s7}, {s10}, {s11}, {bait}, {street}, and {area} with the active line's strings.
 */
export function formatRouteText(template: string, line: RouteLineId): string {
  const spec = getRouteSpec(line);
  const replacements: Record<string, string> = {
    terminus: spec.terminus,
    terminusSign: spec.terminus,
    origin: spec.origin,
    originShort: spec.originShort,
    opposite: spec.opposite,
    line: spec.id,
    s4: getStopName(line, 3),
    s5: getStopName(line, 4),
    s7: getStopName(line, 6),
    s10: getStopName(line, 9),
    s11: getStopName(line, 10),
    bait: getStopName(line, 11),
    street: spec.street,
    area: spec.area,
  };

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    return replacements[key] ?? match;
  });
}

export function getBoardingPaText(line: RouteLineId): string {
  return formatRouteText('This is the Last Local. {terminus}–bound {line} train.', line);
}

export function getDeparturePaText(): string {
  return 'Stand clear of the closing doors, please.';
}

export function getNextStopPaText(line: RouteLineId, stationIndex: number): string {
  const stop = getStopName(line, stationIndex);
  return `The next stop is ${stop}.`;
}

export function getArrivalPaText(line: RouteLineId, segment: SegmentRule): string {
  if (segment.paLie) {
    return segment.paLie;
  }
  if (segment.stopType === 'final') {
    return formatRouteText('{terminus}. This is the last stop on this train.', line);
  }
  const stop = getStopName(line, segment.stationIndex);
  return `This is ${stop}.`;
}

export const GARBLED_TRANSIT_PA_LINES: readonly string[] = [
  '…stand clear of the closing doors…',
  '…next stop… transfer available…',
  '…held momentarily by the dispatcher…',
];
