/**
 * 对局音效编排（LRM-176）：根据服务端事件触发 SFX / 语音。
 * 不在此做牌型合法性裁决；hand.type / result 均来自服务端。
 */
import { HandType, type GameResult, type Hand } from '@card-game/rules';
import { audio } from './audio';

export function onPlayedFx(hand: Hand): void {
  if (hand.type === HandType.BOMB) {
    audio.playSfx('bomb');
    audio.playVoice('bomb');
    return;
  }
  if (hand.type === HandType.ROCKET) {
    audio.playSfx('rocket');
    audio.playVoice('rocket');
    return;
  }
  audio.playSfx('play');
}

export function onPassedFx(): void {
  audio.playSfx('pass');
  audio.playVoice('pass');
}

/**
 * 春天启发：地主胜且两农民仍满手 17 张（一张未出）。
 * 服务端尚未单独下发 spring 字段时的客户端展示用启发式。
 */
export function detectSpring(
  result: GameResult,
  handSizes: [number, number, number] | number[],
): boolean {
  if (result.winnerSide !== 'landlord') return false;
  const landlord = result.landlordSeat;
  for (let seat = 0; seat < 3; seat++) {
    if (seat === landlord) continue;
    if ((handSizes[seat] ?? 0) !== 17) return false;
  }
  return true;
}

export function onSettledFx(
  result: GameResult,
  mySeat: number | null,
  handSizes: [number, number, number] | number[],
): void {
  const myWin =
    mySeat != null &&
    ((result.winnerSide === 'landlord' && mySeat === result.landlordSeat) ||
      (result.winnerSide === 'farmer' && mySeat !== result.landlordSeat));

  const spring = detectSpring(result, handSizes);
  if (spring) audio.playVoice('spring');

  if (myWin) audio.playSfx('win');
  else audio.playSfx('lose');

  // 春天语音与胜负语音错开，避免 SpeechSynthesis 互相 cancel。
  const delay = spring ? 700 : 0;
  window.setTimeout(() => {
    audio.playVoice(myWin ? 'win' : 'lose');
  }, delay);
}
