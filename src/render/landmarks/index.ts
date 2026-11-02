import type { Archetype } from '../../world/sectors';
import { bonds } from './bonds';
import { centralBank } from './centralBank';
import { commodities } from './commodities';
import { consumer } from './consumer';
import { crypto } from './crypto';
import { energy } from './energy';
import { equity } from './equity';
import { finance } from './finance';
import { fx } from './fx';
import { government } from './government';
import { industry } from './industry';
import { memory } from './memory';
import { organization } from './organization';
import { realEstate } from './realEstate';
import type { LandmarkBuilder } from './shared';
import { semiconductor } from './semiconductor';
import { shippingLane } from './shippingLane';
import { tech } from './tech';
import { trade } from './trade';

export type { Landmark, LandmarkBuilder } from './shared';

export const LANDMARKS: Record<Archetype, LandmarkBuilder> = {
  'central-bank': centralBank,
  government,
  trade,
  equity,
  bonds,
  fx,
  finance,
  energy,
  commodities,
  industry,
  tech,
  semiconductor,
  memory,
  'real-estate': realEstate,
  consumer,
  crypto,
  'shipping-lane': shippingLane,
  organization,
};
