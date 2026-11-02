import type { EntityId } from '../world/entities';
import type { Landmark } from './islands';
import type { ColorMode, Stage } from './scene';

export interface Effects {
  /** 依地標類型播放事件動畫（約 1.5s）；負面偏紅暗、正面偏亮。 */
  pulse(id: EntityId, sentiment: number): Promise<void>;
  /** 粒子沿弧線從 from 流到 to（約 2s），弧頂顯示 label；from === to 時改為原地環狀脈衝。 */
  flow(from: EntityId, to: EntityId, label: string): Promise<void>;
  /** 從目前焦點擴散到台灣證交所，顏色依 direction 與配色模式，並顯示摘要。 */
  ripple(direction: -1 | 0 | 1, summary: string): Promise<void>;
  /** 終幕：在對應地標插上旗幟；未確認者加「未確認」。 */
  showFlags(items: { entity: EntityId; text: string; confirmed: boolean }[]): void;
  /** 清除所有特效並讓進行中的 Promise 立即完成。 */
  clear(): void;
}

export interface EffectsCtx {
  stage: Stage;
  landmarks: Map<EntityId, Landmark>;
  colorMode(): ColorMode;
  focus(): EntityId | null;
}

/** Task 7 先提供不做事的實作，Task 8 補上。 */
export function createEffects(_ctx: EffectsCtx): Effects {
  return {
    pulse: async () => {},
    flow: async () => {},
    ripple: async () => {},
    showFlags: () => {},
    clear: () => {},
  };
}
