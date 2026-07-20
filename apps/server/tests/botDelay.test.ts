import { describe, expect, it } from 'vitest';
import { GameRoom } from '../src/game/GameRoom';

describe('bot thinking delay (LRM-154)', () => {
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
});
