"""
Shared DouZero inference logic for the server adapter contract.

Used by both:
  - douzero-infer.py   : process-per-move CLI (smoke / low concurrency).
  - douzero-server.py  : long-lived HTTP service that loads the three models once.

This module is intentionally a pure library: it defines model loading, InfoSet
reconstruction, and the official DeepAgent forward pass, but does no I/O. The
InfoSet reconstruction and forward pass are kept verbatim from the original
validated wrapper so the training-side value alignment (ground_truth_seed123,
max diff <5e-7) still holds.

Env (read lazily by the helpers below):
  DOUZERO_DOUZERO_REPO        checkout of kwai/DouZero (for douzero.* imports).
  DOUZERO_LANDLORD_CKPT
  DOUZERO_LANDLORD_UP_CKPT
  DOUZERO_LANDLORD_DOWN_CKPT  paths to the three identity checkpoints.
  DOUZERO_CKPT_DIR            optional root; used when per-position paths unset.
  DOUZERO_MODEL_ID            optional subdir under DOUZERO_CKPT_DIR (ckpt switch).
"""
import importlib.util
import os
import sys

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

POSITIONS = ("landlord", "landlord_up", "landlord_down")
INITIAL = {"landlord": 20, "landlord_up": 17, "landlord_down": 17}


def load_ckpt_paths():
    """Read the three identity checkpoint paths from the environment.

    Precedence (LRM-310 ckpt switch scaffold):
      1. Explicit DOUZERO_LANDLORD[_UP|_DOWN]_CKPT
      2. DOUZERO_CKPT_DIR[/DOUZERO_MODEL_ID]/{position}.ckpt
    """
    model_id = (os.environ.get("DOUZERO_MODEL_ID") or "").strip()
    ckpt_dir = (os.environ.get("DOUZERO_CKPT_DIR") or "").strip()
    base = os.path.join(ckpt_dir, model_id) if ckpt_dir and model_id else (ckpt_dir or None)

    def pick(env_key, filename):
        explicit = (os.environ.get(env_key) or "").strip()
        if explicit:
            return explicit
        if base:
            return os.path.join(base, filename)
        raise KeyError(env_key)

    return {
        "landlord": pick("DOUZERO_LANDLORD_CKPT", "landlord.ckpt"),
        "landlord_up": pick("DOUZERO_LANDLORD_UP_CKPT", "landlord_up.ckpt"),
        "landlord_down": pick("DOUZERO_LANDLORD_DOWN_CKPT", "landlord_down.ckpt"),
    }


class ModelCache:
    """Lazily loads and caches the three DouZero models on CPU.

    A single cache is all a process needs: the CLI loads one model per process,
    the HTTP server preloads all three once at startup and reuses them.
    """

    def __init__(self, ckpt_paths=None):
        self.ckpt_paths = ckpt_paths or load_ckpt_paths()
        self._models = {}

    def get(self, position):
        if position not in self._models:
            model = model_dict[position]()
            state = model.state_dict()
            pretrained = torch.load(self.ckpt_paths[position], map_location="cpu")
            pretrained = {k: v for k, v in pretrained.items() if k in state}
            state.update(pretrained)
            model.load_state_dict(state)
            model.eval()
            self._models[position] = model
        return self._models[position]

    def preload_all(self):
        for p in POSITIONS:
            self.get(p)
        return self


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
    """Reconstruct a DouZero InfoSet from a DouZeroPlayState (or raw fixture)."""
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


def forward_values(model, info):
    """Official DeepAgent forward pass -> 1D numpy array of per-action values."""
    obs = get_obs(info)
    z = torch.from_numpy(obs["z_batch"]).float()
    x = torch.from_numpy(obs["x_batch"]).float()
    with torch.no_grad():
        y = model.forward(z, x, return_value=True)["values"]
    return y.detach().cpu().numpy().reshape(-1)


def score(info, legal, models):
    """Return (best_action, values, dbg) for the acting position.

    `values` is a list of floats aligned 1:1 with `legal`. `dbg` carries the
    shapes/values useful for alignment fixtures.
    """
    model = models.get(info.player_position)
    raw = forward_values(model, info)
    # Full-precision values for ranking + alignment (round only in the debug dump
    # below, so /infer can be compared against training-side fixtures at <5e-7).
    vals = [float(v) for v in raw]
    best = int(np.argmax(raw, axis=0)) if len(legal) > 1 else 0
    dbg = {
        "position": info.player_position,
        "num_legal_actions": len(legal),
        "obs_z_shape": list(get_obs(info)["z_batch"].shape),
        "obs_x_shape": list(get_obs(info)["x_batch"].shape),
        "values": [round(v, 6) for v in vals],
        "legal_actions": [[int(c) for c in a] for a in legal],
    }
    return [int(c) for c in legal[best]], vals, dbg


def top_n(legal, vals, n):
    """Top-N (action, value) pairs by value, descending. Stable on tie."""
    order = sorted(range(len(legal)), key=lambda i: vals[i], reverse=True)
    if n is not None and n > 0:
        order = order[:n]
    return [{"action": [int(c) for c in legal[i]], "value": float(vals[i])} for i in order]
