#!/usr/bin/env python3
"""Example DouZero inference wrapper for DOUZERO_INFER_COMMAND.

It documents the stdin/stdout contract used by apps/server/src/game/douzeroAdapter.ts.
Replace the marked section with the official DouZero model loading/inference code once
pretrained checkpoints are present on the deploy host.
"""
import json
import os
import sys

CKPT_ENV = {
    "landlord": "DOUZERO_LANDLORD_CKPT",
    "landlord_up": "DOUZERO_LANDLORD_UP_CKPT",
    "landlord_down": "DOUZERO_LANDLORD_DOWN_CKPT",
}


def main() -> int:
    try:
        state = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"invalid JSON input: {exc}", file=sys.stderr)
        return 2

    model_key = state.get("modelKey") or state.get("position")
    env_name = CKPT_ENV.get(model_key)
    if env_name is None:
        print(f"unknown DouZero modelKey: {model_key}", file=sys.stderr)
        return 2

    ckpt_path = os.environ.get(env_name)
    if not ckpt_path or not os.path.exists(ckpt_path):
        print(f"missing checkpoint env/path: {env_name}={ckpt_path!r}", file=sys.stderr)
        return 2

    legal_actions = state.get("legalActions") or []
    if not legal_actions:
        print(json.dumps({"action": []}))
        return 0

    # TODO: Replace this placeholder with official DouZero model inference:
    # 1. Load the checkpoint selected by model_key / ckpt_path.
    # 2. Convert state into the official DouZero infoset format.
    # 3. Return the model-selected action as DouZero numeric card codes.
    # Until this is implemented, exit non-zero so the TypeScript server fallback is used.
    print("official DouZero inference is not wired in this example wrapper", file=sys.stderr)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
