#!/usr/bin/env python3
"""
Thoth A.I. Time Oracle - live data ingestion.

Fetches real AI-ecosystem data from public, key-free APIs and writes a
versioned snapshot to public/data/live-state.json. The web app loads that
snapshot at runtime and builds its digital twins from real values.

Sources (v1):
  - OpenRouter model catalog: real context windows and real prices for the
    full listed model catalog (~470 models).
  - Hugging Face Hub API: real parameter counts (safetensors totals) and
    download counts for flagship open-weight models.

Honesty rules:
  - If OpenRouter fails, the script exits non-zero and does NOT overwrite
    the previous snapshot (the last good snapshot stays live).
  - If a Hugging Face model fails, it is omitted and the source is marked
    "degraded" - never replaced with an invented value.

Stdlib only. Run: python3 scripts/ingest_live_data.py
"""

import json
import os
import statistics
import sys
import time
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "public", "data", "live-state.json")

UA = {"User-Agent": "thoth-time-oracle-ingest/1.0 (+https://github.com/anthonyrenecastro-create/thoth-a.i.-time-oracle)"}

# Providers whose flagship (highest-priced current) model becomes a frontier twin.
FRONTIER_PROVIDERS = ["openai", "anthropic", "google", "x-ai", "deepseek", "mistralai", "qwen", "moonshotai", "z-ai", "meta-llama"]

# Open-weight watchlist: Hugging Face id + the OpenRouter id prefix for the same family.
OPEN_WATCH = [
    {"hf": "deepseek-ai/DeepSeek-V3.2", "or_prefix": "deepseek/deepseek-v3.2"},
    {"hf": "Qwen/Qwen3-235B-A22B-Instruct-2507", "or_prefix": "qwen/qwen3-235b-a22b"},
    {"hf": "moonshotai/Kimi-K2-Instruct", "or_prefix": "moonshotai/kimi-k2"},
    {"hf": "meta-llama/Llama-4-Maverick-17B-128E-Instruct", "or_prefix": "meta-llama/llama-4-maverick"},
]


def fetch_json(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def blended_per_1k(pricing):
    """Average of prompt and completion price, expressed per 1k tokens."""
    try:
        p = float(pricing.get("prompt") or 0)
        c = float(pricing.get("completion") or 0)
    except (TypeError, ValueError):
        return None
    if p <= 0 and c <= 0:
        return None
    return ((p + c) / 2.0) * 1000.0


def pick_frontier(catalog):
    """Flagship per provider = highest prompt price, tie-broken by newest."""
    by_provider = {}
    for m in catalog:
        mid = m.get("id") or ""
        if "/" not in mid:
            continue
        provider = mid.split("/")[0]
        if provider not in FRONTIER_PROVIDERS:
            continue
        pricing = m.get("pricing") or {}
        try:
            prompt_price = float(pricing.get("prompt") or 0)
        except (TypeError, ValueError):
            prompt_price = 0
        if prompt_price <= 0:
            continue
        # Skip obvious non-flagship variants and priced-variant ids (":batch", ":free", ...).
        low = mid.lower()
        if ":" in mid or any(tag in low for tag in ["mini", "nano", "lite", "free", "preview-0", "turbo-instruct"]):
            continue
        key = (prompt_price, m.get("created") or 0)
        if provider not in by_provider or key > by_provider[provider][0]:
            by_provider[provider] = (key, m)
    frontier = []
    for provider, (_, m) in by_provider.items():
        frontier.append({
            "id": m["id"],
            "label": m.get("name") or m["id"],
            "provider": provider,
            "contextTokens": m.get("context_length"),
            "blendedUsdPer1k": blended_per_1k(m.get("pricing") or {}),
            "promptUsdPer1k": (float((m.get("pricing") or {}).get("prompt") or 0) * 1000.0) or None,
            "completionUsdPer1k": (float((m.get("pricing") or {}).get("completion") or 0) * 1000.0) or None,
            "created": m.get("created"),
        })
    frontier.sort(key=lambda f: (f["promptUsdPer1k"] or 0), reverse=True)
    return frontier[:6]


def main():
    now = datetime.now(timezone.utc).isoformat()
    sources = []

    # --- OpenRouter -------------------------------------------------------
    try:
        catalog_resp = fetch_json("https://openrouter.ai/api/v1/models")
        catalog = catalog_resp.get("data") or []
        if not catalog:
            raise ValueError("empty catalog")
    except Exception as e:
        print(f"FATAL: OpenRouter fetch failed: {e}", file=sys.stderr)
        return 1

    frontier = pick_frontier(catalog)
    contexts = [m.get("context_length") or 0 for m in catalog]
    priced = [blended_per_1k(m.get("pricing") or {}) for m in catalog]
    priced = [p for p in priced if p]
    sources.append({
        "id": "openrouter",
        "name": "OpenRouter model catalog",
        "url": "https://openrouter.ai/api/v1/models",
        "status": "ok",
        "fetchedAt": now,
        "detail": f"{len(catalog)} models listed with live prices and context windows",
        "feeds": "Frontier + open model twins: names, context capacity, inference cost",
    })

    # --- Hugging Face -----------------------------------------------------
    open_models = []
    hf_failures = 0
    for entry in OPEN_WATCH:
        try:
            d = fetch_json(f"https://huggingface.co/api/models/{entry['hf']}")
            total = ((d.get("safetensors") or {}).get("total")) or None
            or_match = None
            for m in catalog:
                if (m.get("id") or "").startswith(entry["or_prefix"]):
                    or_match = m
                    break
            open_models.append({
                "id": entry["hf"],
                "label": entry["hf"].split("/")[-1],
                "provider": entry["hf"].split("/")[0],
                "paramsB": (total / 1e9) if total else None,
                "downloads": d.get("downloads"),
                "likes": d.get("likes"),
                "contextTokens": (or_match or {}).get("context_length"),
                "blendedUsdPer1k": blended_per_1k((or_match or {}).get("pricing") or {}) if or_match else None,
                "openrouterId": (or_match or {}).get("id"),
            })
            time.sleep(0.3)
        except Exception as e:
            hf_failures += 1
            print(f"WARN: HF fetch failed for {entry['hf']}: {e}", file=sys.stderr)
    open_models = [m for m in open_models if m["paramsB"] or m["downloads"]]
    sources.append({
        "id": "huggingface",
        "name": "Hugging Face Hub",
        "url": "https://huggingface.co/api/models",
        "status": "ok" if hf_failures == 0 else "degraded",
        "fetchedAt": now,
        "detail": f"{len(open_models)} flagship open-weight models with real parameter counts and downloads"
                  + (f" ({hf_failures} fetch failures)" if hf_failures else ""),
        "feeds": "Open model twins: parameter scale, download momentum",
    })

    snapshot = {
        "schemaVersion": 1,
        "generatedAt": now,
        "sources": sources,
        "frontierModels": frontier,
        "openModels": open_models,
        "aggregates": {
            "catalogModels": len(catalog),
            "maxContextTokens": max(contexts) if contexts else None,
            "medianCatalogBlendedUsdPer1k": statistics.median(priced) if priced else None,
            "frontierCount": len(frontier),
        },
        "provenance": {
            "live": [
                "Model names and providers (OpenRouter)",
                "Context capacity in tokens (OpenRouter)",
                "Inference cost per 1k tokens, blended prompt/completion (OpenRouter)",
                "Open-model parameter counts in billions (Hugging Face safetensors totals)",
                "Open-model download counts (Hugging Face)",
            ],
            "modeled": [
                "Reasoning / tool-use / autonomy scores: a documented composite ranking within the live cohort, not a benchmark result",
                "Safety controls, hallucination rate, reliability: modeled estimates (no public live feed yet)",
                "Organization, policy, human-response and risk twins: modeled estimates",
            ],
        },
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(snapshot, f, indent=2)
    print(f"Wrote {OUT_PATH}")
    print(f"  frontier twins: {[m['id'] for m in frontier]}")
    print(f"  open twins: {[m['id'] for m in open_models]}")
    print(f"  catalog: {len(catalog)} models, max context {snapshot['aggregates']['maxContextTokens']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
