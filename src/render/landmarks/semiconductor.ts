import { factory, type LandmarkBuilder } from './shared';

/** 半導體：藍屋頂晶圓廠、兩支煙囪。 */
export const semiconductor: LandmarkBuilder = ({ plot }) => factory(plot, '#4f8fd6', 2);
