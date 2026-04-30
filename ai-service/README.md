# StoraChain AI Scoring Service

Python 3.10+ Flask micro-service that provides provider scoring and reward computation for the StoraChain platform.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/score-providers` | Rank provider candidates by weighted metrics |
| POST | `/compute-rewards` | Calculate SCT token rewards for a set of providers |

## Setup

```bash
cd ai-service
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

## Run

```bash
python app.py
```

The service starts on **http://localhost:5001**.

## API Reference

### POST `/score-providers`

**Request:**
```json
{
  "providers": [
    {
      "id": "provider123",
      "uptime": 99.5,
      "capacityGB": 500,
      "latencyMs": 40,
      "reputationScore": 4.2,
      "region": "eu-west"
    }
  ]
}
```

**Response:**
```json
{
  "ranked": [
    {
      "id": "provider123",
      "uptime": 99.5,
      "capacityGB": 500,
      "latencyMs": 40,
      "reputationScore": 4.2,
      "region": "eu-west",
      "score": 0.8712
    }
  ]
}
```

Scoring weights:
- **Uptime** — 30%
- **Capacity** — 25%
- **Latency** (inverted: lower = better) — 20%
- **Reputation** — 15%
- **Region diversity** — 10%

All metrics are min-max normalised before weighting.

---

### POST `/compute-rewards`

**Request:**
```json
{
  "providers": [
    {
      "id": "provider123",
      "storageHoursGB": 720,
      "bandwidthGB": 50,
      "uptime": 99.9,
      "replicas": 3,
      "daysActive": 30
    }
  ]
}
```

**Response:**
```json
{
  "rewards": [
    { "id": "provider123", "rewardSCT": 1283.25 }
  ]
}
```

**Formula:**

```
base = storageHoursGB × 0.35
     + bandwidthGB    × 0.20
     + (uptime/100)   × 0.25
     + replicas       × 0.10
     + norm_daysActive × 0.10

multiplier:  uptime > 99% → ×1.5  |  uptime < 80% → ×0.7  |  else ×1.0

rewardSCT = base × multiplier × SCT_PER_POINT   (SCT_PER_POINT = 5.0)
```

---

## Notes

- The backend `scoringService.js` calls this service. If it is unreachable, the backend falls back to a local scoring formula.
- `SCT_PER_POINT` (default `5.0`) can be adjusted at the top of `app.py` to tune token emission rate.
