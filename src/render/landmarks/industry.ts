import { factory, type LandmarkBuilder } from './shared';

/** 製造與工業：紅屋頂廠房、三支煙囪。 */
export const industry: LandmarkBuilder = ({ plot }) => factory(plot, '#c0583c', 3);
