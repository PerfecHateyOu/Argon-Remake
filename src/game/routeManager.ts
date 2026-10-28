import { ROUTE_METADATA } from '../constants';
import type { RollsignBanner, RouteLineId } from '../types';

export interface RouteLineSpec {
  id: RouteLineId;
  name: string;
  description: string;
  stops: readonly string[];
  bulletColor: string;
  origin: string;
  originShort: string;
  terminus: string;
  opposite: string;
  street: string;
  area: string;
}

const ROUTE_SPECS: Record<RouteLineId, RouteLineSpec> = {
  G: {
    ...ROUTE_METADATA.G,
    origin: 'Hoyt–Schermerhorn',
    originShort: 'Hoyt',
    terminus: 'Court Sq',
    opposite: 'Church Av',
    street: 'Jackson Ave',
    area: 'Long Island City',
  },
  L: {
    ...ROUTE_METADATA.L,
    origin: '8th Av',
    originShort: '8th Av',
    terminus: 'Myrtle–Wyckoff Avs',
    opposite: '8th Av',
    street: 'Wyckoff Ave',
    area: 'Ridgewood',
  },
  '7': {
    ...ROUTE_METADATA['7'],
    origin: 'Times Sq–42nd St',
    originShort: 'Times Sq',
    terminus: 'Terminal Echo',
    opposite: 'Times Sq',
    street: 'a street none of you can name',
    area: 'a neighborhood none of you recognize',
  },
};

export function getRouteSpec(line: RouteLineId): RouteLineSpec {
  return ROUTE_SPECS[line];
}

export function getStopName(line: RouteLineId, stationIndex: number): string {
  const stops = ROUTE_SPECS[line].stops;
  return stops[stationIndex] ?? `Track Marker ${stationIndex + 1}`;
}

export function isElevatedOpenAirStop(line: RouteLineId, stationIndex: number): boolean {
  // 21 St (Stop 12, stationIndex 11) on the G line is the open-air/elevated variant
  return line === 'G' && stationIndex === 11;
}

export function getChapterRollsign(
  chapterNumber: 1 | 2 | 3,
  line: RouteLineId
): RollsignBanner {
  const spec = getRouteSpec(line);
  if (chapterNumber === 1) {
    return {
      chapterNumber: 1,
      title: 'CHAPTER I — THE DESCENT',
      subtitle: `${spec.stops[0]} to ${spec.stops[4]}`,
    };
  }
  if (chapterNumber === 2) {
    return {
      chapterNumber: 2,
      title: 'CHAPTER II — SIGNAL DRIFT',
      subtitle: `${spec.stops[5]} to ${spec.stops[9]}`,
    };
  }
  return {
    chapterNumber: 3,
    title:
      line === 'G'
        ? 'CHAPTER III — OPERATION SKYWARD'
        : 'CHAPTER III — THE LAST STRETCH',
    subtitle: `${spec.stops[10]} to ${spec.terminus}`,
  };
}
