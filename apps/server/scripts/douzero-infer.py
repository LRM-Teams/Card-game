#!/usr/bin/env python3
"""
Real DouZero inference wrapper for the server adapter contract.

stdin  : one DouZeroPlayState JSON (see apps/server/src/game/douzeroAdapter.ts)
stdout : a DouZero action as a JSON array of numeric card codes, e.g. [3,3,3,4]
         (the adapter also accepts {"action":[...]})

It reconstructs a DouZero InfoSet purely from public information + the acting
player's hand (other_hand_cards = full deck - my hand - all played cards, which
is exactly the combined unseen cards the model expects), then calls the official
DeepAgent forward pass and returns the highest-value legal action.

Env:
  DOUZERO_LANDLORD_CKPT / DOUZERO_LANDLORD_UP_CKPT / DOUZERO_LANDLORD_DOWN_CKPT
      paths to the three identity checkpoints (do NOT mix identities).
  DOUZERO_DOUZERO_REPO  : path to a checkout of kwai/DouZero (for douzero.* imports).
  DOUZERO_INFER_TIMEOUT_MS : (read by the TS adapter, not here).

This process is spawned once per robot move, so it pays torch import + ckpt load
each call. Fine for a smoke / low concurrency; for production prefer a long-lived
inference server that loads the three models once. Any error here -> non-zero exit
-> the TS adapter falls back to the minimal legal bot.
"""
import importlib.util
import json
import os
import sys
from copy import deepcopy

REPO = os.environ.get("DOUZERO_DOUZERO_REPO", "")
if REPO:
    sys.path.insert(0, REPO)

import numpy as np  # noqa: E402
import torch  # noqa: E402

from douzero.env import move_detector as md  # noqa: E402
from douzero.env import move_selector as ms  # noqa: E402
from douzero.env.move_generator import MovesGener  # noqa: E402

# Load douzero.dmc.models directly to avoid the heavy douzero/dmc/__init__ import
# chain (training deps). models.py only needs torch.
_models_file = os.path.join(REPO, "douzero", "dmc", "models.py") if REPO else None
if _models_file and os.path.isfile(_models_file):
    _spec = importlib.util.spec_from_file_location("dz_models", _models_file)
    _models_mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_models_mod)
    model_dict = _models_mod.model_dict
else:
    from douzero.dmc.models import model_dict  # type: ignore

from douzero.env.env import get_obs  # noqa: E402

CKPT = {
    "landlord": os.environ["DOUZERO_LANDLORD_CKPT"],
    "landlord_up": os.environ["DOUZERO_LANDLORD_UP_CKPT"],
    "landlord_down": os.environ["DOUZERO_LANDLORD_DOWN_CKPT"],
}
INITIAL = {"landlord": 20, "landlord_up": 17, "landlord_down": 17}

_agents: dict = {}


def get_model(position: str):
    if position not in _agents:
        model = model_dict[position]()
        state = model.state_dict()
        pretrained = torch.load(CKPT[position], map_location="cpu")
        pretrained = {k: v for k, v in pretrained.items() if k in state}
        state.update(pretrained)
        model.load_state_dict(state)
        model.eval()
        _agents[position] = model
    return _agents[position]


def build_deck():
    deck = []
    for r in range(3, 15):  # 3..14 (A), each x4
        deck += [r] * 4
    deck += [17] * 4  # '2'
    deck += [20, 30]  # small joker, big joker
    return deck


DECK = build_deck()


def multiset_minus(base, sub):
    rest = list(base)
    for c in sub:
        try:
            rest.remove(c)
        except ValueError:
            pass
    return rest


def last_move_of(seq):
    if not seq:
        return []
    if len(seq[-1]) == 0:
        return seq[-2] if len(seq) >= 2 else []
    return seq[-1]


def gen_legal_moves(hand, rival):
    """Mirror GameEnv.get_legal_card_play_actions using the acting player's hand."""
    mg = MovesGener(list(hand))
    rt = md.get_move_type(rival)
    rtype = rt["type"]
    rlen = rt.get("len", 1)
    moves = []
    if rtype == md.TYPE_0_PASS:
        moves = mg.gen_moves()
    elif rtype == md.TYPE_1_SINGLE:
        moves = ms.filter_type_1_single(mg.gen_type_1_single(), rival)
    elif rtype == md.TYPE_2_PAIR:
        moves = ms.filter_type_2_pair(mg.gen_type_2_pair(), rival)
    elif rtype == md.TYPE_3_TRIPLE:
        moves = ms.filter_type_3_triple(mg.gen_type_3_triple(), rival)
    elif rtype == md.TYPE_4_BOMB:
        moves = ms.filter_type_4_bomb(mg.gen_type_4_bomb() + mg.gen_type_5_king_bomb(), rival)
    elif rtype == md.TYPE_5_KING_BOMB:
        moves = []
    elif rtype == md.TYPE_6_3_1:
        moves = ms.filter_type_6_3_1(mg.gen_type_6_3_1(), rival)
    elif rtype == md.TYPE_7_3_2:
        moves = ms.filter_type_7_3_2(mg.gen_type_7_3_2(), rival)
    elif rtype == md.TYPE_8_SERIAL_SINGLE:
        moves = ms.filter_type_8_serial_single(mg.gen_type_8_serial_single(repeat_num=rlen), rival)
    elif rtype == md.TYPE_9_SERIAL_PAIR:
        moves = ms.filter_type_9_serial_pair(mg.gen_type_9_serial_pair(repeat_num=rlen), rival)
    elif rtype == md.TYPE_10_SERIAL_TRIPLE:
        moves = ms.filter_type_10_serial_triple(mg.gen_type_10_serial_triple(repeat_num=rlen), rival)
    elif rtype == md.TYPE_11_SERIAL_3_1:
        moves = ms.filter_type_11_serial_3_1(mg.gen_type_11_serial_3_1(repeat_num=rlen), rival)
    elif rtype == md.TYPE_12_SERIAL_3_2:
        moves = ms.filter_type_12_serial_3_2(mg.gen_type_12_serial_3_2(repeat_num=rlen), rival)
    elif rtype == md.TYPE_13_4_2:
        moves = ms.filter_type_13_4_2(mg.gen_type_13_4_2(), rival)
    elif rtype == md.TYPE_14_4_22:
        moves = ms.filter_type_14_4_22(mg.gen_type_14_4_22(), rival)

    if rtype not in [md.TYPE_0_PASS, md.TYPE_4_BOMB, md.TYPE_5_KING_BOMB]:
        moves = moves + mg.gen_type_4_bomb() + mg.gen_type_5_king_bomb()
    if len(rival) != 0:  # not leading -> pass is allowed
        moves = moves + [[]]
    for m in moves:
        m.sort()
    return moves


def count_bombs(seq):
    n = 0
    for a in seq:
        if len(a) == 4 and len(set(a)) == 1:
            n += 1
        elif set(a) == {20, 30}:
            n += 1
    return n


class InfoSet:
    pass


def build_infoset_from_fixture(raw):
    info = InfoSet()
    info.player_position = raw["player_position"]
    info.player_hand_cards = [int(c) for c in raw["player_hand_cards"]]
    info.other_hand_cards = [int(c) for c in raw["other_hand_cards"]]
    info.legal_actions = [[int(c) for c in a] for a in raw["legal_actions"]]
    info.last_move = [int(c) for c in raw.get("last_move", [])]
    info.last_two_moves = [[int(c) for c in a] for a in raw.get("last_two_moves", [[], []])]
    info.last_move_dict = raw.get("last_move_dict", {"landlord": [], "landlord_up": [], "landlord_down": []})
    info.played_cards = raw.get("played_cards", {"landlord": [], "landlord_up": [], "landlord_down": []})
    info.num_cards_left_dict = raw["num_cards_left_dict"]
    info.three_landlord_cards = [int(c) for c in raw.get("three_landlord_cards", [])]
    info.card_play_action_seq = [[int(c) for c in a] for a in raw.get("card_play_action_seq", [])]
    info.bomb_num = int(raw.get("bomb_num", 0))
    info.all_handcards = raw.get("all_handcards", {p: [] for p in INITIAL})
    info.last_pid = raw.get("last_pid", "landlord")
    return info, info.legal_actions


def build_infoset(st):
    if "infoset" in st:
        return build_infoset_from_fixture(st["infoset"])

    pos = st["position"]
    hand = [int(c) for c in st["hand"]]
    seq = [[int(x) for x in e.get("action", [])] for e in st.get("playHistory", [])]

    played = {"landlord": [], "landlord_up": [], "landlord_down": []}
    last_move_dict = {"landlord": [], "landlord_up": [], "landlord_down": []}
    last_pid = "landlord"
    for e in st.get("playHistory", []):
        p = e.get("position")
        a = [int(x) for x in e.get("action", [])]
        if p in last_move_dict:
            last_move_dict[p] = a
        if p in played and len(a) > 0:
            played[p] += a
            last_pid = p

    rival = last_move_of(seq)
    provided_legal = st.get("legalActions")
    if isinstance(provided_legal, list) and provided_legal:
        legal = [[int(c) for c in action] for action in provided_legal]
    else:
        legal = gen_legal_moves(hand, rival)
    all_played = []
    for v in played.values():
        all_played += v
    other = multiset_minus(DECK, hand + all_played)

    # three landlord cards still unplayed by landlord (DouZero removes them as
    # the landlord plays them)
    three = list(st.get("bottom", []))
    for c in played["landlord"]:
        if c in three:
            three.remove(c)

    num_left = {p: INITIAL[p] - len(played[p]) for p in INITIAL}

    info = InfoSet()
    info.player_position = pos
    info.player_hand_cards = hand
    info.other_hand_cards = other
    info.legal_actions = legal
    info.last_move = rival
    info.last_two_moves = (seq[-2:] + [[], []])[:2][::-1]
    info.last_move_dict = last_move_dict
    info.played_cards = played
    info.num_cards_left_dict = num_left
    info.three_landlord_cards = three
    info.card_play_action_seq = seq
    info.bomb_num = count_bombs(seq)
    info.all_handcards = {p: [] for p in INITIAL}  # not consumed by get_obs
    info.last_pid = last_pid
    return info, legal


def act(info, legal):
    model = get_model(info.player_position)
    obs = get_obs(info)
    z = torch.from_numpy(obs["z_batch"]).float()
    x = torch.from_numpy(obs["x_batch"]).float()
    with torch.no_grad():
        y = model.forward(z, x, return_value=True)["values"]
    y = y.detach().cpu().numpy()
    vals = [float(round(float(v), 6)) for v in y.reshape(-1)]
    best = int(np.argmax(y, axis=0)[0]) if len(legal) > 1 else 0
    dbg = {
        "position": info.player_position,
        "num_legal_actions": len(legal),
        "obs_z_shape": list(obs["z_batch"].shape),
        "obs_x_shape": list(obs["x_batch"].shape),
        "values": vals,
        "legal_actions": [[int(c) for c in a] for a in legal],
    }
    return legal[best], dbg


def main():
    raw = sys.stdin.read()
    try:
        st = json.loads(raw)
    except Exception as e:  # noqa: BLE001
        print(f"invalid JSON: {e}", file=sys.stderr)
        return 2
    try:
        info, legal = build_infoset(st)
        action, dbg = act(info, legal)
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc(file=sys.stderr)
        return 3  # non-zero -> TS adapter falls back
    if os.environ.get("DOUZERO_DEBUG"):
        sys.stderr.write(json.dumps(dbg, separators=(",", ":")) + "\n")
        sys.stderr.flush()
    sys.stdout.write(json.dumps([int(c) for c in action]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
