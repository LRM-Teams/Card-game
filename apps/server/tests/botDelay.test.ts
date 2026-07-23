import { describe, expect, it } from 'vitest';
import { GameRoom } from '../src/game/GameRoom';
import { botThinkDelayMs } from '../src/game/botTiming';

describe('bot thinking delay (LRM-154 / LRM-523)', () => {
  it('drainBots 在机器人动作前下发带 botThinkingSeat 的 snapshot', async () => {
    const prevMin = process.env.BOT_THINK_MS_MIN;
    const prevMax = process.env.BOT_THINK_MS_MAX;
    process.env.BOT_THINK_MS_MIN = '1';
    process.env.BOT_THINK_MS_MAX = '1';

    const r = new GameRoom('delay-test');
    expect((await r.start(true)).ok).toBe(true);

    let sawThinking = false;
    await r.drainBots((events) => {
      for (const e of events) {
        if (e.scope === 'room' && e.event.type === 'snapshot' && e.event.state.botThinkingSeat !== null) {
          sawThinking = true;
        }
      }
    });

    expect(sawThinking).toBe(true);

    if (prevMin === undefined) delete process.env.BOT_THINK_MS_MIN;
    else process.env.BOT_THINK_MS_MIN = prevMin;
    if (prevMax === undefined) delete process.env.BOT_THINK_MS_MAX;
    else process.env.BOT_THINK_MS_MAX = prevMax;
  });

  it('默认硬顶 ≤2000ms，过大 MAX 被钳制（LRM-523 节奏）', () => {
    const prevMin = process.env.BOT_THINK_MS_MIN;
    const prevMax = process.env.BOT_THINK_MS_MAX;
    const prevCap = process.env.BOT_THINK_MS_CAP;
    process.env.BOT_THINK_MS_MIN = '1500';
    process.env.BOT_THINK_MS_MAX = '9000';
    delete process.env.BOT_THINK_MS_CAP;

    for (let i = 0; i < 20; i++) {
      const ms = botThinkDelayMs();
      expect(ms).toBeLessThanOrEqual(2000);
      expect(ms).toBeGreaterThanOrEqual(1500);
    }

    if (prevMin === undefined) delete process.env.BOT_THINK_MS_MIN;
    else process.env.BOT_THINK_MS_MIN = prevMin;
    if (prevMax === undefined) delete process.env.BOT_THINK_MS_MAX;
    else process.env.BOT_THINK_MS_MAX = prevMax;
    if (prevCap === undefined) delete process.env.BOT_THINK_MS_CAP;
    else process.env.BOT_THINK_MS_CAP = prevCap;
  });
});
