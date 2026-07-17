#!/usr/bin/env python3
"""
Resident DouZero inference HTTP service.

Loads the three identity models ONCE at startup and serves inference requests
over HTTP, so per-move latency drops to a single forward pass (no torch import
or ckpt reload per move). This is the production path for LRM-136; the TS adapter
points at it via `DOUZERO_INFER_URL`.

Contract:
  POST /infer
    body : DouZeroPlayState JSON (+ optional integer `topN`)
    200  : {"action":[...]}                          # best action
           {"action":[...], "top":[{"action":[...],"value":float}, ...]}   # when topN given
    500  : {"error": "..."}                          # TS adapter falls back to the bot
  GET /health
    200  : {"status":"ok","models":["landlord","landlord_up","landlord_down"]}

Run:
  python douzero-server.py --host 127.0.0.1 --port 8080
  # env: DOUZERO_DOUZERO_REPO, DOUZERO_LANDLORD_CKPT, DOUZERO_LANDLORD_UP_CKPT,
  #      DOUZERO_LANDLORD_DOWN_CKPT

The forward pass is serialized with a lock: torch models are not safe for
concurrent forward on the same object. A single game server issues moves
sequentially, so this never contends in practice.
"""
import argparse
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Make sibling douzero_lib.py importable when run as a script.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import douzero_lib as lib  # noqa: E402

_MODELS = None  # set in main()
_FORWARD_LOCK = threading.Lock()


class _Handler(BaseHTTPRequestHandler):
    server_version = "DouZeroInfer/1.0"

    def log_message(self, fmt, *args):  # silence default stderr access logging
        pass

    def _send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok", "models": list(lib.POSITIONS)})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/infer":
            self._send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            st = json.loads(raw)
            info, legal = lib.build_infoset(st)
            top_n_n = st.get("topN")
            with _FORWARD_LOCK:
                action, vals, _dbg = lib.score(info, legal, _MODELS)
            response = {"action": [int(c) for c in action]}
            if isinstance(top_n_n, int) and top_n_n > 0:
                response["top"] = lib.top_n(legal, vals, top_n_n)
            self._send_json(200, response)
        except Exception:  # noqa: BLE001
            import traceback
            traceback.print_exc(file=sys.stderr)
            self._send_json(500, {"error": "inference failed"})


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Resident DouZero inference HTTP service")
    p.add_argument("--host", default=os.environ.get("DOUZERO_SERVER_HOST", "127.0.0.1"))
    p.add_argument("--port", type=int, default=int(os.environ.get("DOUZERO_SERVER_PORT", "8080")))
    return p.parse_args(argv)


def main(argv=None):
    global _MODELS
    args = parse_args(argv)
    print(f"[douzero-server] loading checkpoints from env...", flush=True)
    _MODELS = lib.ModelCache().preload_all()
    print(f"[douzero-server] models loaded: {list(lib.POSITIONS)}", flush=True)
    httpd = ThreadingHTTPServer((args.host, args.port), _Handler)
    print(f"[douzero-server] serving on http://{args.host}:{args.port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
