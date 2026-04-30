"""
StoraChain AI Scoring Service
Flask micro-service on port 5001.

Endpoints:
  POST /score-providers   — rank provider candidates by weighted metrics
  POST /compute-rewards   — calculate SCT reward for a provider's contribution
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np

app = Flask(__name__)
CORS(app)


# ─── Config ─────────────────────────────────────────────────────────────────

SCT_PER_POINT = 5.0   # base SCT minted per reward‑point earned

# Weights for /score-providers (must sum to 1.0)
WEIGHTS = {
    "uptime":      0.30,
    "capacity":    0.25,
    "latency":     0.20,   # inverted: lower latency → higher score
    "reputation":  0.15,
    "region":      0.10,
}


# ─── Helpers ────────────────────────────────────────────────────────────────

def _safe_normalise(values: list[float]) -> np.ndarray:
    """Min-max normalise; returns 0.5 for all-equal arrays."""
    arr = np.array(values, dtype=float)
    lo, hi = arr.min(), arr.max()
    if hi == lo:
        return np.full_like(arr, 0.5)
    return (arr - lo) / (hi - lo)


# ─── Routes ─────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "storachain-ai"})


@app.route("/score-providers", methods=["POST"])
def score_providers():
    """
    Request body:
      { "providers": [ { "id": "...", "uptime": 99.5, "capacityGB": 500,
                         "latencyMs": 40, "reputationScore": 4.2,
                         "region": "eu-west" }, ... ] }

    Response:
      { "ranked": [ { ...original fields..., "score": 0.87 }, ... ] }
      Sorted descending by score.
    """
    data = request.get_json(force=True, silent=True) or {}
    providers = data.get("providers", [])
    if not providers:
        return jsonify({"ranked": []}), 200

    n = len(providers)

    uptimes     = [float(p.get("uptime", 0))           for p in providers]
    capacities  = [float(p.get("capacityGB", 0))        for p in providers]
    latencies   = [float(p.get("latencyMs", 9999))      for p in providers]
    reputations = [float(p.get("reputationScore", 0))   for p in providers]

    # Unique regions → diversity bonus: more unique regions = higher score for each member
    regions = [str(p.get("region", "unknown")) for p in providers]
    unique_regions = len(set(regions))
    region_norm = min(unique_regions / max(n, 1), 1.0)
    region_scores = np.full(n, region_norm)

    norm_uptime     = _safe_normalise(uptimes)
    norm_capacity   = _safe_normalise(capacities)
    norm_latency    = 1.0 - _safe_normalise(latencies)   # invert: lower is better
    norm_reputation = _safe_normalise(reputations)

    scores = (
        WEIGHTS["uptime"]     * norm_uptime
        + WEIGHTS["capacity"]   * norm_capacity
        + WEIGHTS["latency"]    * norm_latency
        + WEIGHTS["reputation"] * norm_reputation
        + WEIGHTS["region"]     * region_scores
    )

    ranked = []
    for i, p in enumerate(providers):
        ranked.append({**p, "score": round(float(scores[i]), 4)})

    ranked.sort(key=lambda x: x["score"], reverse=True)
    return jsonify({"ranked": ranked}), 200


@app.route("/compute-rewards", methods=["POST"])
def compute_rewards():
    """
    Request body:
      {
        "providers": [
          {
            "id": "...",
            "storageHoursGB": 720,    // GB-hours stored this period
            "bandwidthGB":    50,     // GB served as downloads
            "uptime":         99.9,   // percentage 0-100
            "replicas":       3,      // number of replicas maintained
            "daysActive":     30      // days since provider first came online
          },
          ...
        ]
      }

    Response:
      { "rewards": [ { "id": "...", "rewardSCT": 132.5 }, ... ] }

    Formula (per provider):
      base_points = storageHoursGB*0.35 + bandwidthGB*0.20
                    + (uptime/100)*0.25 + replicas*0.10
                    + normalised_daysActive*0.10
      bonus/penalty:
        uptime > 99 % → ×1.5
        uptime < 80 % → ×0.7
      rewardSCT = base_points × SCT_PER_POINT
    """
    data = request.get_json(force=True, silent=True) or {}
    providers = data.get("providers", [])
    if not providers:
        return jsonify({"rewards": []}), 200

    days_values = [float(p.get("daysActive", 0)) for p in providers]
    norm_days = _safe_normalise(days_values)

    rewards = []
    for i, p in enumerate(providers):
        # Supports both older and newer backend payload keys.
        storage_hrs  = float(p.get("storageHoursGB", p.get("storageGB", 0) * 24))
        bandwidth    = float(p.get("bandwidthGB", 0))
        uptime       = float(p.get("uptime", p.get("uptimePct", 0)))
        replicas     = float(p.get("replicas", 1))
        effective_price = float(p.get("pricePerGB", 1))

        base = (
            storage_hrs * 0.35
            + bandwidth * 0.20
            + (uptime / 100.0) * 0.25
            + replicas * 0.10
            + float(norm_days[i]) * 0.10
        )

        if uptime > 99.0:
            base *= 1.5
        elif uptime < 80.0:
            base *= 0.7

        reward_sct = round(base * SCT_PER_POINT * max(0.5, min(2.0, effective_price)), 4)
        rewards.append({
            "id": p.get("id", p.get("providerId", str(i))),
            "providerId": p.get("providerId", p.get("id", str(i))),
            "rewardSCT": reward_sct,
        })

    return jsonify({"rewards": rewards}), 200


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
