# DouZero Inference Deployment

This project now has a server-side DouZero adapter seam, but the official pretrained checkpoint files are not stored in git. Keep large model artifacts outside the repository and point the server to a local inference command.

## Checkpoint Path Convention

Recommended local layout on each deploy host:

```text
models/douzero/
  landlord.ckpt
  landlord_up.ckpt
  landlord_down.ckpt
```

These files are intentionally ignored by git via `models/` in `.gitignore`.

The three checkpoints must stay separate:

- `landlord` -> landlord model
- `landlord_up` -> farmer before landlord / landlord upstream model
- `landlord_down` -> farmer after landlord / landlord downstream model

## Server Configuration

`apps/server` enables external DouZero inference only when `DOUZERO_INFER_COMMAND` is set. Without it, the current minimal legal bot remains the fallback and the MVP game loop is unchanged.

Environment variables:

```bash
export DOUZERO_LANDLORD_CKPT=$PWD/models/douzero/landlord.ckpt
export DOUZERO_LANDLORD_UP_CKPT=$PWD/models/douzero/landlord_up.ckpt
export DOUZERO_LANDLORD_DOWN_CKPT=$PWD/models/douzero/landlord_down.ckpt
export DOUZERO_INFER_TIMEOUT_MS=1500
export DOUZERO_INFER_COMMAND='python3 apps/server/scripts/douzero-infer.example.py'
```

`DOUZERO_INFER_COMMAND` is called synchronously with a JSON `DouZeroPlayState` on stdin and must print either a raw DouZero action or an object with an `action` field:

```json
{"action":[3,3,3,4]}
```

Card encoding uses DouZero official rank values:

```text
3..10 = 3..10
J = 11
Q = 12
K = 13
A = 14
2 = 17
small joker = 20
big joker = 30
```

The payload includes `modelKey`, equal to one of `landlord`, `landlord_up`, or `landlord_down`, so the inference wrapper can choose the correct checkpoint.

## Adapter Contract

Input fields supplied by the server:

- `position` / `modelKey`: current robot identity and checkpoint key
- `hand`: current robot hand using DouZero numeric encoding
- `lastMove`: previous effective move, empty when leading
- `bottom`: three landlord bottom cards
- `handCounts`: remaining hand count per seat
- `playedCards`: all non-pass played cards
- `playHistory`: ordered played/pass history with positions
- `legalActions`: legal actions from the current state

Output validation is intentionally defensive:

1. The returned action must match one of `legalActions`.
2. The action is mapped back to real in-hand `Card` objects.
3. The result is revalidated by `canPlay`.
4. Any invalid output, timeout, non-zero exit, or missing command falls back to the minimal legal bot.

## Minimal Validation

Without official checkpoints, verify fallback and adapter contract:

```bash
apps/server/node_modules/.bin/vitest run apps/server
apps/server/node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit
```

After the official checkpoints and wrapper are installed, run a one-shot smoke command:

```bash
printf '%s' '{"modelKey":"landlord","position":"landlord","hand":[3,4,5],"lastMove":[],"bottom":[],"handCounts":{"0":3,"1":17,"2":17},"playedCards":[],"playHistory":[],"legalActions":[[3],[4],[5]]}' \
  | $DOUZERO_INFER_COMMAND
```

Then replace `apps/server/scripts/douzero-infer.example.py` with the official DouZero loader/inference implementation, start the server with the same environment, and play a bot turn. If the wrapper fails, the game must still proceed via fallback.

## Current Blocker

At the time this document was added, this workspace does not contain the official DouZero Python package or pretrained checkpoint files, so a real model inference smoke cannot be completed locally. The server-side configuration seam is ready; model artifact acquisition/deployment remains required before LRM-120 can be marked done.
