#!/usr/bin/env python3
"""
DouZero inference CLI (process-per-move) for the server adapter contract.

stdin  : one DouZeroPlayState JSON (see apps/server/src/game/douzeroAdapter.ts)
stdout : a DouZero action as a JSON array of numeric card codes, e.g. [3,3,3,4]
         (the adapter also accepts {"action":[...]})

This is the one-shot path: the TS adapter spawnSyncs it once per robot move, so
each move pays torch import + ckpt load. It is kept for smoke / low-concurrency
dev and for the e2e subprocess contract. For production latency use the resident
`douzero-server.py` (loads the three models once).

Env:
  DOUZERO_LANDLORD_CKPT / DOUZERO_LANDLORD_UP_CKPT / DOUZERO_LANDLORD_DOWN_CKPT
  DOUZERO_DOUZERO_REPO  : path to a checkout of kwai/DouZero.
  DOUZERO_DEBUG=1       : emit a JSON debug object (values/shapes) on stderr.

Any error here -> non-zero exit -> the TS adapter falls back to the minimal bot.
"""
import json
import sys

import douzero_lib as lib


def main():
    raw = sys.stdin.read()
    try:
        st = json.loads(raw)
    except Exception as e:  # noqa: BLE001
        print(f"invalid JSON: {e}", file=sys.stderr)
        return 2
    try:
        info, legal = lib.build_infoset(st)
        models = lib.ModelCache()
        action, vals, dbg = lib.score(info, legal, models)
    except Exception:  # noqa: BLE001
        import traceback
        traceback.print_exc(file=sys.stderr)
        return 3  # non-zero -> TS adapter falls back
    import os
    if os.environ.get("DOUZERO_DEBUG"):
        sys.stderr.write(json.dumps(dbg, separators=(",", ":")) + "\n")
        sys.stderr.flush()
    sys.stdout.write(json.dumps([int(c) for c in action]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
