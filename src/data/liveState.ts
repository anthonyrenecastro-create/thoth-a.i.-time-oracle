/**
 * Live data layer for the AI Ecosystem twins.
 *
 * Loads the snapshot produced by scripts/ingest_live_data.py
 * (public/data/live-state.json) and builds an AIEcosystemState whose model
 * twins carry real values: real model names, real context windows, real
 * inference prices (OpenRouter), real open-model parameter counts and
 * downloads (Hugging Face).
 *
 * Scores that have no public live feed (reasoning, safety, hallucination...)
 * are MODELED: a transparent composite of the live cohort, documented in
 * docs/live-data-plan.md and labeled as modeled in the GUI. They are a
 * ranking signal, not benchmark results.
 */

import {
  buildCapabilityProfile,
  createInitialAIEcosystemState,
  deriveIndicators,
} from '../engine/aiEcosystem';
import { AIEcosystemState, AISystemTwin } from '../types/aiEcosystem';

export interface LiveSource {
  id: string;
  name: string;
  url: string;
  status: 'ok' | 'degraded' | string;
  fetchedAt: string;
  detail: string;
  feeds: string;
}

export interface LiveFrontierModel {
  id: string;
  label: string;
  provider: string;
  contextTokens: number | null;
  blendedUsdPer1k: number | null;
  promptUsdPer1k: number | null;
  completionUsdPer1k: number | null;
  created: number | null;
}

export interface LiveOpenModel {
  id: string;
  label: string;
  provider: string;
  paramsB: number | null;
  downloads: number | null;
  likes: number | null;
  contextTokens: number | null;
  blendedUsdPer1k: number | null;
  openrouterId: string | null;
}

export interface LiveSnapshot {
  schemaVersion: number;
  generatedAt: string;
  sources: LiveSource[];
  frontierModels: LiveFrontierModel[];
  openModels: LiveOpenModel[];
  aggregates: {
    catalogModels: number | null;
    maxContextTokens: number | null;
    medianCatalogBlendedUsdPer1k: number | null;
    frontierCount: number | null;
  };
  provenance: { live: string[]; modeled: string[] };
}

export async function loadLiveSnapshot(): Promise<LiveSnapshot | null> {
  try {
    const res = await fetch('/data/live-state.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const snap = (await res.json()) as LiveSnapshot;
    if (snap.schemaVersion !== 1 || !Array.isArray(snap.frontierModels) || snap.frontierModels.length === 0) {
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Log-scale min-max normalization of a value within its cohort. */
function logNorm(value: number | null, cohort: Array<number | null>): number {
  const vals = cohort.filter((v): v is number => typeof v === 'number' && v > 0).map(v => Math.log10(v));
  if (value === null || value <= 0 || vals.length === 0) return 0.5;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (max - min < 1e-9) return 0.5;
  return clamp01((Math.log10(value) - min) / (max - min));
}

export function buildLiveEcosystemState(snapshot: LiveSnapshot): AIEcosystemState {
  // Template from the static seed (called before any live seed is registered,
  // so this returns the seed state): organizations, policies, human responses
  // and risks stay modeled in v1.
  const template = createInitialAIEcosystemState(0);

  const frontier = snapshot.frontierModels;
  const open = [...snapshot.openModels].sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));

  const priceCohort = [...frontier, ...open].map(m => m.blendedUsdPer1k);
  const ctxCohort = [...frontier, ...open].map(m => m.contextTokens);
  const dlCohort = open.map(m => m.downloads);
  const medianCost =
    snapshot.aggregates.medianCatalogBlendedUsdPer1k && snapshot.aggregates.medianCatalogBlendedUsdPer1k > 0
      ? snapshot.aggregates.medianCatalogBlendedUsdPer1k
      : 0.002;

  const aiSystems: Record<string, AISystemTwin> = {};

  frontier.forEach((m, i) => {
    const priceScore = logNorm(m.blendedUsdPer1k, priceCohort);
    const ctxScore = logNorm(m.contextTokens, ctxCohort);
    const reasoning = clamp01(0.45 + 0.28 * priceScore + 0.17 * ctxScore);
    aiSystems[i === 0 ? 'model_frontier_a' : `live_frontier_${m.provider.replace(/[^a-z0-9]/gi, '_')}`] = {
      id: i === 0 ? 'model_frontier_a' : `live_frontier_${m.provider.replace(/[^a-z0-9]/gi, '_')}`,
      label: m.label,
      modelFamily: m.provider,
      architecture: 'proprietary — undisclosed',
      // Closed-model parameter counts are not published; this placeholder is
      // modeled (the GUI shows "undisclosed") and feeds no indicator.
      parameterScaleB: Math.round(300 + 700 * priceScore),
      contextCapacityTokens: m.contextTokens ?? 128000,
      trainingMethod: 'undisclosed',
      inferenceCostPer1kTokensUsd: m.blendedUsdPer1k ?? medianCost,
      reasoningPerformance: reasoning,
      toolUseAbility: clamp01(reasoning - 0.05 + 0.03 * ctxScore),
      memoryArchitecture: 'undisclosed',
      autonomyLevel: clamp01(reasoning * 0.62),
      safetyControls: 0.62,
      reliability: clamp01(0.58 + 0.3 * priceScore),
      hallucinationRate: clamp01(0.3 - 0.14 * priceScore),
      deploymentEnvironment: 'cloud',
      capabilityImprovementRate: 0.015,
      capabilities: buildCapabilityProfile(clamp01(reasoning - 0.14)),
    };
  });

  open.slice(0, 3).forEach((m, i) => {
    const priceScore = logNorm(m.blendedUsdPer1k, priceCohort);
    const ctxScore = logNorm(m.contextTokens, ctxCohort);
    const dlScore = logNorm(m.downloads, dlCohort);
    const reasoning = clamp01(0.42 + 0.26 * priceScore + 0.16 * ctxScore + 0.08 * dlScore);
    const id = i === 0 ? 'model_open_b' : `live_open_${i}`;
    aiSystems[id] = {
      id,
      label: m.label,
      modelFamily: 'open_weight',
      architecture: 'transformer (open weights)',
      parameterScaleB: m.paramsB ?? 200,
      contextCapacityTokens: m.contextTokens ?? 128000,
      trainingMethod: 'open weights — see model card',
      inferenceCostPer1kTokensUsd: m.blendedUsdPer1k ?? medianCost,
      reasoningPerformance: reasoning,
      toolUseAbility: clamp01(reasoning - 0.04 + 0.03 * ctxScore),
      memoryArchitecture: 'retrieval_augmented',
      autonomyLevel: clamp01(reasoning * 0.58),
      safetyControls: 0.48,
      reliability: clamp01(0.55 + 0.25 * priceScore),
      hallucinationRate: clamp01(0.32 - 0.12 * priceScore),
      deploymentEnvironment: 'cloud',
      capabilityImprovementRate: 0.017,
      capabilities: buildCapabilityProfile(clamp01(reasoning - 0.14)),
    };
  });

  // One live-derived data-ecosystem field: availability scales with the real
  // size of the listed model catalog.
  const dataEcosystems = structuredClone(template.dataEcosystems) as AIEcosystemState['dataEcosystems'];
  const corpus = dataEcosystems.global_training_corpus;
  if (corpus && snapshot.aggregates.catalogModels) {
    corpus.dataAvailabilityIndex = clamp01(0.45 + 0.1 * Math.log10(snapshot.aggregates.catalogModels));
  }

  const state: AIEcosystemState = {
    ...template,
    aiSystems,
    dataEcosystems,
    recentContributions: [],
  };
  state.indicators = deriveIndicators(
    state.aiSystems,
    state.infrastructure,
    state.organizations,
    state.policies,
    state.risks
  );
  return state;
}
