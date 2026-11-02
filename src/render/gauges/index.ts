import type { GaugeKind } from '../../world/indicators';
import { beam } from './beam';
import { flag } from './flag';
import { flame } from './flame';
import { flicker } from './flicker';
import { halo } from './halo';
import { haze } from './haze';
import { lightBand } from './lightBand';
import { stack } from './stack';
import type { Gauge } from './types';

export type { Gauge, GaugeHost } from './types';

export function createGauge(kind: GaugeKind): Gauge {
  switch (kind) {
    case 'flame': return flame();
    case 'beam': return beam();
    case 'stack': return stack();
    case 'lightBand': return lightBand();
    case 'halo': return halo();
    case 'flicker': return flicker();
    case 'flag': return flag();
    case 'haze': return haze();
  }
}
