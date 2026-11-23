/**
 * HRM Ecology: A Resilient World-Model Runtime
 * Main Application Workbench
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HRMEcologyRuntime } from './engine/runtime';
import { setLiveEcosystemSeed } from './engine/aiEcosystem';
import { loadLiveSnapshot, buildLiveEcosystemState, LiveSnapshot } from './data/liveState';
import { TopologyCanvas } from './components/TopologyCanvas';
import { CommitInspector } from './components/CommitInspector';
import { LedgerView } from './components/LedgerView';
import { ReplayControls } from './components/ReplayControls';
import { ResourceMonitor } from './components/ResourceMonitor';
import { PerturbationPanel } from './components/PerturbationPanel';
import { PythonCodeExporter } from './components/PythonCodeExporter';
import { GeminiTriPathConsole } from './components/GeminiTriPathConsole';
import { SimulationScenario } from './engine/environment';
import { SubstrateHealthAndReputation } from './components/SubstrateHealthAndReputation';
import { CognitiveMemoryConsole } from './components/CognitiveMemoryConsole';
import { AIEcosystemDashboard } from './components/AIEcosystemDashboard';
import {
  Cpu,
  Activity,
  FileText,
  Terminal,
  ShieldCheck,
  Zap,
  Sparkles,
  Layers,
  HelpCircle,
  BookOpen,
  Brain,
  Award,
  Database
} from 'lucide-react';

export default function App() {
  const [seed, setSeed] = useState(42);
  const [scenario, setScenario] = useState<SimulationScenario>('ai_ecosystem');

  // Initialize HRM Engine Runtime Singleton
  const runtime = useMemo(() => new HRMEcologyRuntime(seed, 12, scenario), [seed, scenario]);

  const [worldState, setWorldState] = useState(runtime.getState());
  const [history, setHistory] = useState(runtime.getHistory());
  const [ledger, setLedger] = useState(runtime.getLedger());
  const [isRunning, setIsRunning] = useState(runtime.getIsRunning());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gemini' | 'ecosystem' | 'topology' | 'health' | 'memory' | 'proposals' | 'ledger' | 'python'>('ecosystem');
  const [liveMeta, setLiveMeta] = useState<LiveSnapshot | null>(null);
  const [liveStatus, setLiveStatus] = useState<'loading' | 'live' | 'seed'>('loading');
  const liveAppliedRef = useRef(false);

  // Load the live-data snapshot (public/data/live-state.json) once available and
  // rebuild the ecosystem twins from real data. Falls back to seed data.
  useEffect(() => {
    let cancelled = false;
    loadLiveSnapshot().then(snap => {
      if (cancelled) return;
      if (snap) {
        setLiveEcosystemSeed(buildLiveEcosystemState(snap));
        setLiveMeta(snap);
        setLiveStatus('live');
        if (!liveAppliedRef.current) {
          liveAppliedRef.current = true;
          runtime.reset(seed, 12, scenario);
        }
      } else {
        setLiveStatus('seed');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [runtime]);
  const [selectedStepForLedger, setSelectedStepForLedger] = useState(0);

  useEffect(() => {
    const unsubscribe = runtime.subscribe(() => {
      const state = runtime.getState();
      setWorldState(state);
      setHistory([...runtime.getHistory()]);
      setLedger([...runtime.getLedger()]);
      setIsRunning(runtime.getIsRunning());
      setSelectedStepForLedger(state.metadata.step);
    });
    return () => unsubscribe();
  }, [runtime]);

  const currentStep = worldState.metadata.step;
  const maxStep = history.length - 1;

  const currentLedgerEntry = useMemo(() => {
    return ledger.find(e => e.step === currentStep) || (ledger.length > 0 ? ledger[ledger.length - 1] : null);
  }, [ledger, currentStep]);

  const handlePlayPause = () => {
    if (isRunning) {
      runtime.stop();
    } else {
      runtime.start(750);
    }
  };

  const handleStepForward = () => {
    runtime.step();
  };

  const handleStepBackward = () => {
    if (currentStep > 0) {
      runtime.replayToStep(currentStep - 1);
    }
  };

  const handleSeek = (step: number) => {
    runtime.replayToStep(step);
  };

  const handleReset = (newSeed = 42, newScenario?: SimulationScenario) => {
    if (newScenario) setScenario(newScenario);
    setSeed(newSeed);
    runtime.reset(newSeed, 12, newScenario || scenario);
    setSelectedNodeId(null);
  };

  const handleSplitNodeRequest = (nodeId: string) => {
    runtime.injectSplitNode(nodeId);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col">
      {/* Navbar Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-600/20 border border-sky-500/40 rounded-xl text-sky-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Thoth A.I. Time Oracle
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-400">
                v1.0.0 Runtime
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              AI ecosystem digital twin on the HRM Ecology substrate
            </p>
          </div>
        </div>

        {/* Quick Runtime Metrics */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {liveStatus === 'live' && liveMeta ? (
            <div className="bg-emerald-950 px-3 py-1.5 rounded-lg border border-emerald-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-bold">LIVE DATA</span>
              <span className="text-emerald-500">as of {new Date(liveMeta.generatedAt).toLocaleDateString()}</span>
            </div>
          ) : liveStatus === 'seed' ? (
            <div className="bg-amber-950 px-3 py-1.5 rounded-lg border border-amber-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-300 font-bold">SEED DATA</span>
              <span className="text-amber-500">live snapshot unavailable</span>
            </div>
          ) : (
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="text-slate-500">CHECKING DATA…</span>
            </div>
          )}

          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <span className="text-slate-500">Hash:</span>
            <span className="text-sky-300 font-bold">{worldState.metadata.stateHash}</span>
          </div>

          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <span className="text-slate-500">Step:</span>
            <span className="text-emerald-400 font-bold">{currentStep}</span>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'gemini'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-300" /> Gemini Tri-Path Orchestrator
          </button>

          <button
            onClick={() => setActiveTab('ecosystem')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'ecosystem'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-300" /> AI Ecosystem Twin
          </button>

          <button
            onClick={() => setActiveTab('topology')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'topology'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" /> Substrate Visualizer
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'health'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-400" /> Health & Reputation
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'memory'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-purple-400" /> Cognitive Memory
          </button>

          <button
            onClick={() => setActiveTab('proposals')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'proposals'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Singular Commit & Proposals
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" /> Explanation Ledger
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'python'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" /> Python 3.12+ Source Code
          </button>
        </div>

        {/* Tab 0: Gemini Tri-Path Orchestrator */}
        {activeTab === 'gemini' && (
          <div className="space-y-4">
            <ReplayControls
              currentStep={currentStep}
              maxStep={maxStep}
              isRunning={isRunning}
              stateHash={worldState.metadata.stateHash}
              seed={seed}
              scenario={scenario}
              onPlayPause={handlePlayPause}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSeek={handleSeek}
              onReset={handleReset}
            />

            <GeminiTriPathConsole
              runtime={runtime}
              state={worldState}
              currentLedgerEntry={currentLedgerEntry}
            />

            <TopologyCanvas
              state={worldState}
              environment={runtime.getEnvironment()}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onSplitNodeRequest={handleSplitNodeRequest}
            />
          </div>
        )}

        {activeTab === 'ecosystem' && (
          <div className="space-y-4">
            <ReplayControls
              currentStep={currentStep}
              maxStep={maxStep}
              isRunning={isRunning}
              stateHash={worldState.metadata.stateHash}
              seed={seed}
              scenario={scenario}
              onPlayPause={handlePlayPause}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSeek={handleSeek}
              onReset={handleReset}
            />
            <AIEcosystemDashboard state={worldState} liveSnapshot={liveMeta} />
          </div>
        )}

        {/* Tab 1: Substrate Visualizer */}
        {activeTab === 'topology' && (
          <div className="space-y-4">
            <ReplayControls
              currentStep={currentStep}
              maxStep={maxStep}
              isRunning={isRunning}
              stateHash={worldState.metadata.stateHash}
              seed={seed}
              scenario={scenario}
              onPlayPause={handlePlayPause}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSeek={handleSeek}
              onReset={handleReset}
            />

            <TopologyCanvas
              state={worldState}
              environment={runtime.getEnvironment()}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onSplitNodeRequest={handleSplitNodeRequest}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResourceMonitor state={worldState} />
              <PerturbationPanel runtime={runtime} />
            </div>
          </div>
        )}

        {/* Tab 1b: Substrate Health & Reputation */}
        {activeTab === 'health' && (
          <div className="space-y-4">
            <ReplayControls
              currentStep={currentStep}
              maxStep={maxStep}
              isRunning={isRunning}
              stateHash={worldState.metadata.stateHash}
              seed={seed}
              scenario={scenario}
              onPlayPause={handlePlayPause}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSeek={handleSeek}
              onReset={handleReset}
            />

            <SubstrateHealthAndReputation
              runtime={runtime}
              state={worldState}
            />
          </div>
        )}

        {/* Tab 1c: Cognitive Memory Console */}
        {activeTab === 'memory' && (
          <div className="space-y-4">
            <ReplayControls
              currentStep={currentStep}
              maxStep={maxStep}
              isRunning={isRunning}
              stateHash={worldState.metadata.stateHash}
              seed={seed}
              scenario={scenario}
              onPlayPause={handlePlayPause}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSeek={handleSeek}
              onReset={handleReset}
            />

            <CognitiveMemoryConsole
              state={worldState}
            />
          </div>
        )}

        {/* Tab 2: Singular Commit Proposals */}
        {activeTab === 'proposals' && (
          <div className="space-y-4">
            <ReplayControls
              currentStep={currentStep}
              maxStep={maxStep}
              isRunning={isRunning}
              stateHash={worldState.metadata.stateHash}
              seed={seed}
              scenario={scenario}
              onPlayPause={handlePlayPause}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSeek={handleSeek}
              onReset={handleReset}
            />

            <CommitInspector
              currentLedgerEntry={currentLedgerEntry}
              stepNumber={currentStep}
            />
          </div>
        )}

        {/* Tab 3: Explanation Ledger */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <LedgerView
              ledger={ledger}
              selectedStep={selectedStepForLedger}
              onSelectStep={step => {
                setSelectedStepForLedger(step);
                runtime.replayToStep(step);
              }}
            />
          </div>
        )}

        {/* Tab 4: Python Code Exporter */}
        {activeTab === 'python' && (
          <div className="space-y-4">
            <PythonCodeExporter />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 text-center text-xs text-slate-500">
        Thoth A.I. Time Oracle • HRM Ecology substrate • Live-data digital twin of the AI ecosystem
      </footer>
    </div>
  );
}
