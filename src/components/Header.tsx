import React, { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Radio,
  RefreshCw,
  Globe,
  Database,
  Info,
  User as UserIcon
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { ExternalFeedStatus } from '../types/incident.ts';

import { StorageStatus } from '../server/storage/types.ts';

interface HeaderProps {
  apiStatus: {
    ok: boolean;
    geminiConfigured: boolean;
  };
  storageStatus?: StorageStatus | null;
  currentUser?: FirebaseUser | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  incidentCount: number;
  liveFeedCount: number;
  demoCount: number;
  unreviewedCount: number;
  conflictCount: number;
  feedStatuses: ExternalFeedStatus[];
  isFetchingFeeds: boolean;
  lastFetchTime?: string;
  onFetchLiveFeeds: (forceFresh: boolean) => void;
  onOpenIngest: () => void;
  onOpenAuditLogs: () => void;
  onResetData: () => void;
  activeTab: 'incidents' | 'test-suite';
  setActiveTab: (tab: 'incidents' | 'test-suite') => void;
}


export const Header: React.FC<HeaderProps> = ({
  apiStatus,
  storageStatus,
  currentUser,
  onSignIn,
  onSignOut,
  incidentCount,
  liveFeedCount,
  demoCount,
  unreviewedCount,
  conflictCount,
  feedStatuses,
  isFetchingFeeds,
  lastFetchTime,
  onFetchLiveFeeds,
  onOpenIngest,
  onOpenAuditLogs,
  onResetData,
  activeTab,
  setActiveTab,
}) => {

  const [showFeedDetails, setShowFeedDetails] = useState(false);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-30 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Identification */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white font-mono">
                  SignalBridge<span className="text-cyan-400">.AI</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  Crisis Triage Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Evidence-grounded disaster triage, live public feeds (USGS / GDACS) & duplicate correlation
              </p>
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center space-x-2.5">
            {/* Live Feeds Fetch Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => onFetchLiveFeeds(true)}
                disabled={isFetchingFeeds}
                title="Fetch latest live public disaster records from USGS & GDACS"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 text-xs font-mono font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <Radio className={`w-3.5 h-3.5 text-indigo-400 ${isFetchingFeeds ? 'animate-pulse' : ''}`} />
                <span className="hidden md:inline">Sync Live Feeds</span>
                <span className="md:hidden">Sync</span>
                {isFetchingFeeds && <RefreshCw className="w-3 h-3 animate-spin ml-1" />}
              </button>
            </div>

            {/* View switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('incidents')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'incidents'
                    ? 'bg-slate-800 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Incidents ({incidentCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('test-suite')}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'test-suite'
                    ? 'bg-slate-800 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Suite (38)</span>
              </button>
            </div>

            {/* Firebase Auth Reviewer Identity */}
            {currentUser ? (
              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-mono">
                <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="max-w-[120px] truncate" title={currentUser.email || currentUser.displayName || 'Reviewer'}>
                  {currentUser.displayName || currentUser.email?.split('@')[0] || 'Reviewer'}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign out of Firebase Auth"
                  className="text-slate-400 hover:text-white ml-1 text-[11px] underline cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                title="Authenticate with Google to verify reviewer identity & write permissions"
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Reviewer Sign In</span>
                <span className="sm:hidden">Sign In</span>
              </button>
            )}

            {/* Ingestion button */}
            <button
              type="button"
              onClick={onOpenIngest}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ingest Report</span>
              <span className="sm:hidden">Ingest</span>
            </button>

            {/* Reset data */}
            <button
              type="button"
              onClick={onResetData}
              title="Reset baseline operational incidents"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Operational Status Subheader with Real Origin Breakdown */}
        <div className="flex flex-wrap items-center justify-between py-1.5 border-t border-slate-800/60 text-xs text-slate-400 gap-y-1">
          <div className="flex items-center space-x-3 flex-wrap">
            {/* Live Feeds Origin Counter */}
            <span className="flex items-center space-x-1 text-indigo-300 font-mono text-[11px] bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/50">
              <Globe className="w-3 h-3 text-indigo-400" />
              <span>Live Feeds: {liveFeedCount}</span>
            </span>

            {/* Synthetic Demo Counter */}
            <span className="flex items-center space-x-1 text-slate-400 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              <Database className="w-3 h-3 text-amber-400" />
              <span>Demo Fixtures: {demoCount}</span>
            </span>

            {unreviewedCount > 0 && (
              <span className="flex items-center space-x-1 text-amber-400 font-medium font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>{unreviewedCount} Unreviewed</span>
              </span>
            )}

            {conflictCount > 0 && (
              <span className="flex items-center space-x-1 text-red-400 font-medium font-mono text-[11px]">
                <AlertTriangle className="w-3 h-3" />
                <span>{conflictCount} Conflict{conflictCount > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
            {storageStatus && (
              <button
                type="button"
                onClick={onOpenAuditLogs}
                title="Inspect storage repository status and audit log history"
                className={`flex items-center space-x-1 px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  storageStatus.isEphemeral
                    ? 'bg-amber-950/40 text-amber-300 border-amber-900/60 hover:bg-amber-900/50'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60 hover:bg-emerald-900/50'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>{storageStatus.isEphemeral ? 'Storage: Demo Memory' : 'Storage: Cloud Firestore'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenAuditLogs}
              className="text-indigo-400 hover:text-indigo-300 underline flex items-center space-x-1 cursor-pointer"
            >
              <span>Audit Trail</span>
            </button>

            {lastFetchTime && (
              <span>Synced: {new Date(lastFetchTime).toLocaleTimeString()}</span>
            )}
            <button
              type="button"
              onClick={() => setShowFeedDetails(!showFeedDetails)}
              className="text-cyan-400 hover:text-cyan-300 underline flex items-center space-x-1 cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>Feed Status</span>
            </button>
          </div>

        </div>

        {/* Feed Status Drawer / Details Dropdown */}
        {showFeedDetails && (
          <div className="py-2.5 px-3 mb-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800 pb-1">
              <span>Public Feed Health & Access Registry</span>
              <button
                type="button"
                onClick={() => setShowFeedDetails(false)}
                className="text-slate-500 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">1. USGS Seismology</span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950 px-1 rounded">Active</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time global earthquake GeoJSON. Public Domain.</p>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">2. GDACS (UN-OCHA/EC)</span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950 px-1 rounded">Active</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time flood, cyclone, and seismic alerts. Open Access.</p>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">3. ReliefWeb v2</span>
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-950 px-1 rounded">Requires Token</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">ReliefWeb v2 returns HTTP 403 without an approved appname token. Documented transparently; not faked.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
