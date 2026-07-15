import { GamePhase } from '@card-game/rules';
import type { Seat } from '@card-game/rules';
import { botBid, botChoosePlay } from '../src/game/bot';
import { GameRoom } from '../src/game/GameRoom';

const room = new GameRoom('local-sim');
const humanSeat: Seat = 0;

function ensureOk(label: string, result: ReturnType<GameRoom['start']>): void {
  if (!result.ok) {
    throw new Error(`${label} failed: ${result.code} ${result.message}`);
  }
}

ensureOk('join', room.addHuman('Local tester'));
ensureOk('start', room.start());

for (let guard = 0; guard < 1000 && room.phase !== GamePhase.SETTLED; guard++) {
  if (room.phase === GamePhase.BIDDING && room.bid?.order[room.bid.index] === humanSeat) {
    ensureOk('bid', room.handleBid(humanSeat, botBid(room.players[humanSeat]!.hand)));
    continue;
  }

  if (room.phase === GamePhase.PLAYING && room.turnSeat === humanSeat) {
    const prev = room.lastPlay?.hand ?? null;
    const cards = botChoosePlay(room.players[humanSeat]!.hand, prev);
    if (cards?.length) {
      ensureOk('play', room.handlePlay(humanSeat, cards.map((card) => card.id)));
    } else if (prev === null) {
      ensureOk('lead fallback', room.handlePlay(humanSeat, [room.players[humanSeat]!.hand[0]!.id]));
    } else {
      ensureOk('pass', room.handlePass(humanSeat));
    }
    continue;
  }

  // Bot turns are advanced inside GameRoom; reaching here means the room waits for no local action.
  break;
}

if (room.phase !== GamePhase.SETTLED || !room.result) {
  throw new Error(`simulation did not settle; phase=${room.phase} turn=${room.turnSeat}`);
}

console.log('[server simulate] one authoritative game completed');
console.log(`room=${room.roomId} landlord=${room.result.landlordSeat} winner=${room.result.winnerSeat}`);
console.log(`winnerSide=${room.result.winnerSide} multiplier=${room.result.multiplier} unit=${room.result.unit}`);
console.log(`scores=${room.result.scores.join(',')}`);
