# Thoth A.I. Time Oracle — Live Data Plan

Status: v1 implemented 2026-11-22. Owner directive: put real data in so the
forecasts run on the live AI ecosystem instead of hand-written seed values.

## The problem this fixes

Before v1, every twin in `createInitialAIEcosystemState()` was a typed-in
literal ("Frontier Model A, 950B parameters, $0.009/1k tokens, hallucination
rate 0.18"). The five headline indices were computed from invented inputs, so
the "forecast" described a fictional ecosystem frozen in July 2026.

## Design principles

1. **One seam.** All ecosystem state enters through
   `createInitialAIEcosystemState()` (called from `src/engine/state.ts`).
   Live data plugs in there: a registered live seed replaces the static seed;
   if no live snapshot loads, the app falls back to the seed state and says so.
2. **Proposals, not mutation.** Ingestion happens outside the runtime, on a
   schedule, and produces a versioned snapshot file. The runtime never fetches
   the network mid-simulation; determinism and replay are preserved.
3. **Honesty by construction.** Every field is either LIVE (measured from a
   named source at a recorded time) or MODELED (a transparent estimate). The
   GUI labels which is which, per source and per model twin. Missing data is
   never silently replaced with a favorable invented value: a failed feed
   degrades the snapshot's source status, not its numbers.
4. **No keys, no cost.** v1 uses only public, key-free APIs so the refresh can
   run unattended in CI.

## v1 live sources (verified working 2026-11-22)

| Source | Endpoint | Feeds | Fields |
|---|---|---|---|
| OpenRouter model catalog | `GET https://openrouter.ai/api/v1/models` | Frontier + open model twins; cost & capability signals | Real context-window sizes, real prompt/completion prices for ~470 listed models; catalog size; newest-model dates |
| Hugging Face Hub API | `GET https://huggingface.co/api/models/{id}` | Open-weight twins | Real parameter counts (safetensors totals), real download counts |

### What is LIVE vs MODELED in v1

- **LIVE:** model roster (real model names/providers), context capacity,
  inference cost per 1k tokens (blended prompt/completion price), open-model
  parameter counts, open-model download momentum, catalog size, max context.
- **MODELED (labeled as such in the GUI):** reasoning/tool-use/autonomy
  scores (a documented composite of the live price/context cohort — a ranking
  signal, *not* a benchmark result), safety controls, hallucination rate,
  reliability, and the organization / policy / human-response / risk twins,
  which have no clean public live feed yet.

### Feeds tested and rejected for v1

- **arXiv API** — the `submittedDate` range filter returns inconsistent
  totals (a one-day window and a 30-day window returned near-identical
  counts), so submission-rate signals would be fiction. Revisit if a
  trustworthy counting method appears.
- **AI Incident Database / Vast.ai** — unreachable from the build sandbox
  (connection failure). Promising for the risk twin and GPU-availability
  signals in v2, pending a reachability check from CI.

## Pipeline

```
GitHub Action (daily 11:17 UTC + manual dispatch)
  -> python3 scripts/ingest_live_data.py
       fetches OpenRouter + Hugging Face (stdlib only, no keys)
       writes public/data/live-state.json  (snapshot + provenance)
  -> commits the snapshot if it changed
Vercel serves the static snapshot with the app
Browser: App fetches /data/live-state.json on load
  -> src/data/liveState.ts builds an AIEcosystemState from the snapshot
  -> setLiveEcosystemSeed() registers it with the engine
  -> runtime.reset() re-initializes the twins from real data
  -> if the fetch fails, the seed state runs and the GUI shows SEED DATA
```

Snapshot schema (v1): `schemaVersion`, `generatedAt`, `sources[]`
(id, name, url, status, detail), `frontierModels[]`, `openModels[]`,
`aggregates` (catalog size, max context, median frontier price),
`provenance` notes. The git history of the snapshot file is the audit trail.

## GUI changes (v1)

- Header shows a **LIVE DATA** badge with the snapshot's as-of time when a
  live snapshot is active (amber **SEED DATA** badge otherwise).
- The AI Ecosystem Twin tab is the landing view.
- Forecast panel: the five indices as large, plain-English gauge cards —
  what each index means in one sentence, a gradient meter, and the live
  inputs underneath.
- **Data sources panel**: every source, what it feeds, its status, and when
  it was last fetched; plus an explicit list of what is still modeled.
- Model twin cards show real context size and real $/1k cost, with LIVE /
  MODELED tags; open twins show real parameter counts and downloads.

## Phase 2 (not in v1)

- **Forecast scoring:** the explanation ledger already records forecasts with
  probabilities; once daily snapshots accumulate, grade matured forecasts
  against the next snapshots (Brier-style) and show a calibration track record.
- **More feeds:** AI Incident Database (risk twin), a GPU spot-price source
  (infrastructure twin), benchmark suites with public APIs (to replace the
  modeled capability composite with measured scores).
- **History view:** index sparklines from the snapshot archive in git.
