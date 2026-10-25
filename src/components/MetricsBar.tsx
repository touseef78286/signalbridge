import React from 'react';
import { Incident } from '../types/incident.ts';
import { AlertTriangle, CheckCircle, Clock, CopyCheck, Layers } from 'lucide-react';

interface MetricsBarProps {
  incidents: Incident[];
  potentialDuplicatesCount: number;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  incidents,
  potentialDuplicatesCount,
}) => {
  const total = incidents.length;
  const unreviewed = incidents.filter((i) => i.reviewStatus === 'unreviewed').length;
  const verified = incidents.filter((i) => i.reviewStatus === 'verified_by_reviewer').length;
  const conflicts = incidents.filter((i) => i.conflictStatus !== 'none').length;
  const mergedTotal = incidents.reduce((acc, i) => acc + i.mergedReports.length, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Incidents</span>
          <Layers className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="mt-1 flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-white">{total}</span>
          <span className="text-xs text-slate-500 font-mono">active files</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-amber-500/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-300">Unreviewed Queue</span>
          <Clock className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-1 flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-amber-400">{unreviewed}</span>
          <span className="text-xs text-amber-500/80 font-mono">needs human audit</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-red-500/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-red-300">Flagged Conflicts</span>
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div className="mt-1 flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-red-400">{conflicts}</span>
          <span className="text-xs text-red-500/80 font-mono">casualty/claims</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-emerald-500/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-300">Reviewer Verified</span>
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-1 flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-emerald-400">{verified}</span>
          <span className="text-xs text-emerald-500/80 font-mono">human signed</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-indigo-500/20 rounded-lg p-3 col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-indigo-300">Duplicate Linkage</span>
          <CopyCheck className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="mt-1 flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-indigo-400">
            {potentialDuplicatesCount}
          </span>
          <span className="text-xs text-indigo-400/80 font-mono">
            candidates ({mergedTotal} merged)
          </span>
        </div>
      </div>
    </div>
  );
};
