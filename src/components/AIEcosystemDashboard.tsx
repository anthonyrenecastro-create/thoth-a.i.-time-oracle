import React from 'react';
import { HRMWorldState } from '../types/hrm';
import { AISystemTwin } from '../types/aiEcosystem';
import { LiveSnapshot, LiveOpenModel } from '../data/liveState';

interface AIEcosystemDashboardProps {
  state: HRMWorldState;
  liveSnapshot?: LiveSnapshot | null;
}

function asPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

function fmtCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
}

function fmtCost(v: number): string {
  return `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const INDEX_META: Array<{
  key: 'capabilityFrontierIndex' | 'safetyReadinessIndex' | 'infrastructureStressIndex' | 'governanceCoordinationIndex' | 'ecosystemVolatilityIndex';
  name: string;
  meaning: string;
  bar: string;
  text: string;
  invert?: boolean;
}> = [
  {
    key: 'capabilityFrontierIndex',
    name: 'Capability Frontier',
    meaning: 'How capable the strongest AI systems are right now, overall.',
    bar: 'from-sky-500 to-sky-300',
    text: 'text-sky-300',
  },
  {
    key: 'safetyReadinessIndex',
    name: 'Safety Readiness',
    meaning: 'How well safety controls and reliability keep up with capability.',
    bar: 'from-emerald-500 to-emerald-300',
    text: 'text-emerald-300',
  },
  {
    key: 'infrastructureStressIndex',
    name: 'Infrastructure Stress',
    meaning: 'How strained compute supply, energy and chip chains are. Higher = more strain.',
    bar: 'from-amber-500 to-amber-300',
    text: 'text-amber-300',
    invert: true,
  },
  {
    key: 'governanceCoordinationIndex',
    name: 'Governance Coordination',
    meaning: 'How aligned global rules, transparency and oversight are.',
    bar: 'from-cyan-500 to-cyan-300',
    text: 'text-cyan-300',
  },
  {
    key: 'ecosystemVolatilityIndex',
    name: 'Ecosystem Volatility',
    meaning: 'How unpredictable competition and failure risk are at the moment.',
    bar: 'from-rose-500 to-rose-300',
    text: 'text-rose-300',
    invert: true,
  },
];

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{asPct(value)}</span>
      </div>
      <div className="h-1.5 mt-1 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, value * 100)}%` }} />
      </div>
    </div>
  );
}

export const AIEcosystemDashboard: React.FC<AIEcosystemDashboardProps> = ({ state, liveSnapshot }) => {
  if (!state.aiEcosystem) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-sm text-slate-400">
        AI ecosystem twins are inactive for this scenario. Switch domain to AI Ecosystem Twin.
      </div>
    );
  }

  const eco = state.aiEcosystem;
  const indicators = eco.indicators;
  const recent = eco.recentContributions.slice(0, 6);
  const systems: AISystemTwin[] = Object.values(eco.aiSystems) as AISystemTwin[];
  const openByLabel = new Map<string, LiveOpenModel>((liveSnapshot?.openModels ?? []).map(m => [m.label, m] as [string, LiveOpenModel]));
  const frontierLabels = new Set((liveSnapshot?.frontierModels ?? []).map(m => m.label));

  return (
    <div className="space-y-4">
      {/* Forecast gauges */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-slate-100">AI Ecosystem Forecast</h3>
          <span className="text-xs font-mono text-slate-500">Step {state.metadata.step}</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Five plain-language gauges for where the AI ecosystem stands. They are computed from the digital twins
          below{liveSnapshot ? ' — which are built from live data (see sources)' : ''}.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {INDEX_META.map(meta => {
            const v = indicators[meta.key];
            return (
              <div key={meta.key} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{meta.name}</p>
                <p className={`text-3xl font-bold mt-1.5 ${meta.text}`}>{asPct(v)}</p>
                <div className="h-2 mt-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${meta.bar}`}
                    style={{ width: `${Math.max(3, v * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] leading-snug text-slate-500 mt-2.5">{meta.meaning}</p>
              </div>
            );
          })}
        </div>
        {liveSnapshot?.aggregates && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-[11px] font-mono text-slate-500">
            <span>Live catalog: <span className="text-slate-300">{liveSnapshot.aggregates.catalogModels ?? '—'} models</span></span>
            <span>Largest context: <span className="text-slate-300">{liveSnapshot.aggregates.maxContextTokens ? fmtTokens(liveSnapshot.aggregates.maxContextTokens) + ' tokens' : '—'}</span></span>
            <span>Median price: <span className="text-slate-300">{liveSnapshot.aggregates.medianCatalogBlendedUsdPer1k ? fmtCost(liveSnapshot.aggregates.medianCatalogBlendedUsdPer1k) + ' / 1K tokens' : '—'}</span></span>
            <span>Snapshot: <span className="text-slate-300">{fmtWhen(liveSnapshot.generatedAt)}</span></span>
          </div>
        )}
      </div>

      {/* Model twins */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-semibold text-slate-200">Model Twins {liveSnapshot ? '— built from live data' : '— seed data'}</h4>
          <span className="text-[11px] text-slate-500">Prices, context windows and open-model sizes are measured. Scores are modeled — see Data Sources.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {systems.map(system => {
            const open = openByLabel.get(system.label);
            const isLiveFrontier = frontierLabels.has(system.label);
            const isLive = Boolean(open) || isLiveFrontier;
            return (
              <div key={system.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-100 leading-snug">{system.label}</p>
                  {isLive ? (
                    <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">LIVE</span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300">SEED</span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-slate-500 mt-0.5">{system.modelFamily}</p>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-slate-900 rounded-lg py-1.5">
                    <p className="text-slate-200 font-semibold">{fmtTokens(system.contextCapacityTokens)}</p>
                    <p className="text-[10px] text-slate-500">context {isLive ? '· live' : ''}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg py-1.5">
                    <p className="text-slate-200 font-semibold">{fmtCost(system.inferenceCostPer1kTokensUsd)}</p>
                    <p className="text-[10px] text-slate-500">per 1K tokens {isLive ? '· live' : ''}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg py-1.5">
                    <p className="text-slate-200 font-semibold">
                      {open?.paramsB ? `${open.paramsB.toFixed(0)}B` : isLiveFrontier ? '—' : `${system.parameterScaleB.toFixed(0)}B`}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {open?.paramsB ? 'parameters · live' : isLiveFrontier ? 'parameters · undisclosed' : 'parameters'}
                    </p>
                  </div>
                </div>
                {open?.downloads ? (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Hugging Face downloads (live): <span className="text-slate-200 font-mono">{fmtCount(open.downloads)}</span>
                  </p>
                ) : null}

                <div className="space-y-2 mt-3">
                  <ScoreBar label="Reasoning (modeled)" value={system.reasoningPerformance} color="bg-sky-400" />
                  <ScoreBar label="Autonomy (modeled)" value={system.autonomyLevel} color="bg-violet-400" />
                  <ScoreBar label="Safety controls (modeled)" value={system.safetyControls} color="bg-emerald-400" />
                  <ScoreBar label="Hallucination (modeled)" value={system.hallucinationRate} color="bg-rose-400" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Data sources */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-1">Where the data comes from</h4>
          {liveSnapshot ? (
            <>
              <p className="text-[11px] text-slate-500 mb-3">
                Snapshot generated {fmtWhen(liveSnapshot.generatedAt)} by the ingestion script in this repo
                (<span className="font-mono">scripts/ingest_live_data.py</span>), refreshed daily.
              </p>
              <div className="space-y-2">
                {liveSnapshot.sources.map(src => (
                  <div key={src.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <a href={src.url} target="_blank" rel="noreferrer" className="font-semibold text-sky-300 hover:underline">
                        {src.name}
                      </a>
                      <span className={`flex items-center gap-1.5 text-[11px] font-mono ${src.status === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}>
                        <span className={`w-2 h-2 rounded-full ${src.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {src.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-1">{src.detail}</p>
                    <p className="text-slate-500 mt-1">Feeds: {src.feeds}</p>
                    <p className="text-slate-600 mt-0.5 font-mono text-[11px]">Fetched {fmtWhen(src.fetchedAt)}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-[11px]">
                <div className="bg-slate-950 border border-emerald-900/60 rounded-lg p-3">
                  <p className="font-semibold text-emerald-300 mb-1.5">Measured live</p>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside">
                    {liveSnapshot.provenance.live.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
                <div className="bg-slate-950 border border-amber-900/60 rounded-lg p-3">
                  <p className="font-semibold text-amber-300 mb-1.5">Still modeled (honest label)</p>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside">
                    {liveSnapshot.provenance.modeled.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              No live snapshot could be loaded, so the twins are running on the built-in seed values
              (hand-written estimates). When <span className="font-mono text-slate-300">/data/live-state.json</span> is
              present — produced by <span className="font-mono text-slate-300">scripts/ingest_live_data.py</span> from the
              OpenRouter catalog and Hugging Face — the twins rebuild themselves from real model names, prices,
              context windows and parameter counts, and this panel lists every source with its fetch time.
            </p>
          )}
        </div>

        {/* Recent forecasts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Recent Mechanism Forecasts</h4>
          <div className="space-y-2 text-xs">
            {recent.length === 0 && (
              <p className="text-slate-400">No accepted AI ecosystem contributions yet. Press play or step forward to run forecast cycles.</p>
            )}
            {recent.map((item, i) => (
              <div key={`${item.mechanismId}-${i}`} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-200 font-semibold">{item.mechanismId}</p>
                  <p className="text-slate-500 uppercase tracking-wide">{item.mechanismType}</p>
                </div>
                <p className="text-slate-300 mt-1">{item.summary}</p>
                <div className="flex items-center gap-4 mt-2 text-slate-400">
                  <span>Confidence: {asPct(item.confidence)}</span>
                  <span>Disagreement: {asPct(item.disagreement)}</span>
                  <span>Changes: {item.changes.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
