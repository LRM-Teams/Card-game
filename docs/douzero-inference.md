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

## Real wrapper

`apps/server/scripts/douzero-infer.py` is the real inference wrapper (replaces the
`.example.py` placeholder). It reconstructs a DouZero `InfoSet` purely from public
info + the acting player's hand (`other_hand_cards = full_deck - my_hand - all_played`),
generates canonical legal actions via DouZero's own `MovesGener`, runs the official
`DeepAgent` forward pass, and prints the best action. Required env on the inference
host:

```bash
export DOUZERO_DOUZERO_REPO=/path/to/kwai/DouZero          # douzero.* imports
export DOUZERO_LANDLORD_CKPT=.../landlord_weights.ckpt
export DOUZERO_LANDLORD_UP_CKPT=.../landlord_up_weights.ckpt
export DOUZERO_LANDLORD_DOWN_CKPT=.../landlord_down_weights.ckpt
export DOUZERO_INFER_COMMAND='python /path/to/douzero-infer.py'
```

Runtime deps on the inference host: Python 3, `torch`, `numpy`, `gitpython` (the
`douzero.dmc` package import pulls `git`). CPU torch works (~2s/move for one
forward pass); GPU is preferred for production.

### Known caveats (2026-07-16 smoke on 146)

1. **Process-per-move cost.** The TS adapter `spawnSync`s this command once per
   robot move, so each move pays torch import + ckpt load (~2s on CPU). Fine for a
   smoke / low concurrency; for production use a long-lived inference server that
   loads the three models once.
2. **Rule-grammar alignment.** DouZero's move grammar is a strict superset of
   common 斗地主体 rules in places — e.g. it allows plane (飞机) wings of the same
   rank, which our `@card-game/rules` engine rejects (wings must be distinct
   ranks). A 0.77亿-frame ckpt smoke returned
   `[3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,7]`, which `identifyHand` flags invalid. The
   adapter's filter remains defensive: it only feeds model scoring with actions
   that pass our engine's legality check, so AI output stays legal while the rule
   engine remains the single source of truth.
3. **Adapter `legalActions`.** The adapter now generates structured legal actions
   from rank patterns instead of enumerating the full power set. This keeps the
   server payload tractable for real 17–20 card hands and matches the rule-engine
   candidate set expected by the wrapper.

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

### 2026-07-16 smoke result

A live smoke on 146 with `ground_truth_seed123_frame77430400.json` turn0 confirmed the wrapper now matches the training-side fixture on all 61 scored actions. The worst per-action value delta was below `5e-7`, and the wrapper produced the same best action `[3,3,4,4,5,5,6,6]`.

## Current Blocker

At the time this document was added, this workspace does not contain the official DouZero Python package or pretrained checkpoint files, so a real model inference smoke cannot be completed locally. The server-side configuration seam is ready; model artifact acquisition/deployment remains required before LRM-120 can be marked done.
