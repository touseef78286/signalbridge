import React, { useState } from 'react';
import { Incident, CandidateDuplicateMatch, MatchingThresholds } from '../types/incident.ts';
import { compareIncidents, DEFAULT_MATCHING_THRESHOLDS } from '../server/duplicateEngine.ts';
import {
  X,
  GitMerge,
  AlertTriangle,
  Clock,
  Sliders,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  ShieldCheck
} from 'lucide-react';

interface DuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetIncident: Incident | null;
  candidateIncident: Incident | null;
  onConfirmMerge: (
    primaryId: string,
    secondaryId: string,
    reviewerName: string,
    reviewerNotes: string
  ) => void;
  onKeepSeparate: (
    primaryId: string,
    secondaryId: string,
    reviewerName: string,
    reviewerNotes: string
  ) => void;
  onMarkUncertain: (
    primaryId: string,
    secondaryId: string,
    reviewerName: string,
    reviewerNotes: string
  ) => void;
}

export const DuplicateReviewModal: React.FC<DuplicateReviewModalProps> = ({
  isOpen,
  onClose,
  targetIncident,
  candidateIncident,
  onConfirmMerge,
  onKeepSeparate,
  onMarkUncertain,
}) => {
  if (!isOpen || !targetIncident || !candidateIncident) return null;

  const [reviewerName, setReviewerName] = useState('Reviewer Alex Vance');
  const [reviewerNotes, setReviewerNotes] = useState(
    'Corroborated duplicate reporting same event impact.'
  );

  // Configurable thresholds state
  const [thresholds, setThresholds] = useState<MatchingThresholds>(DEFAULT_MATCHING_THRESHOLDS);
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);

  const comparison: CandidateDuplicateMatch = compareIncidents(
    targetIncident,
    candidateIncident,
    thresholds
  );

  const scorePct = Math.round(comparison.overallScore * 100);

  const handleMerge = () => {
    onConfirmMerge(
      targetIncident.id,
      candidateIncident.id,
      reviewerName,
      reviewerNotes
    );
    onClose();
  };

  const handleKeepSeparate = () => {
    onKeepSeparate(
      targetIncident.id,
      candidateIncident.id,
      reviewerName,
      reviewerNotes || 'Marked as distinct operational incidents.'
    );
    onClose();
  };

  const handleMarkUncertain = () => {
    onMarkUncertain(
      targetIncident.id,
      candidateIncident.id,
      reviewerName,
      reviewerNotes || 'Flagged for on-scene secondary verification.'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <GitMerge className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Candidate Duplicate Comparison & Resolution
              </h3>
              <p className="text-xs text-slate-400">
                Transparent multi-factor linkage analysis between Incident A and Incident B
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowThresholdConfig(!showThresholdConfig)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Config Thresholds</span>
              {showThresholdConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Configurable Thresholds Drawer */}
          {showThresholdConfig && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-slate-300 font-semibold">
                <span>Correlation Model Parameters (Rule D Thresholds)</span>
                <button
                  type="button"
                  onClick={() => setThresholds(DEFAULT_MATCHING_THRESHOLDS)}
                  className="text-cyan-400 hover:text-cyan-300 text-[10px] underline"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block">Localized Scope (km):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={thresholds.localizedDistanceKm}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, localizedDistanceKm: parseFloat(e.target.value) || 1.0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200 mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block">Regional Scope (km):</label>
                  <input
                    type="number"
                    step="5"
                    value={thresholds.regionalDistanceKm}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, regionalDistanceKm: parseFloat(e.target.value) || 25.0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200 mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block">Macro-Regional (km):</label>
                  <input
                    type="number"
                    step="25"
                    value={thresholds.macroRegionalDistanceKm}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, macroRegionalDistanceKm: parseFloat(e.target.value) || 150.0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200 mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block">Concurrency Window (h):</label>
                  <input
                    type="number"
                    step="1"
                    value={thresholds.concurrencyWindowHours}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, concurrencyWindowHours: parseFloat(e.target.value) || 3.0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-slate-200 mt-0.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Match Score & Recommendation Banner */}
          <div className="bg-slate-950 border border-indigo-900/50 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400 uppercase">
                  Multi-Factor Match Score:
                </span>
                <span className="text-lg font-mono font-bold text-indigo-300">
                  {scorePct}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {comparison.recommendation.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Temporal comparison basis: <strong className="text-cyan-400 font-mono">{comparison.temporalProximity.comparisonBasis.replace(/_/g, ' ')}</strong>.
              </p>
            </div>

            {comparison.conflictsDetected.length > 0 && (
              <div className="w-full bg-red-950/40 border border-red-500/40 rounded p-2.5 text-xs text-red-200 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-red-300">Discrepancy / Scope Analysis:</span>
                  <ul className="list-disc list-inside space-y-0.5 mt-0.5">
                    {comparison.conflictsDetected.map((conf, idx) => (
                      <li key={idx}>{conf}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Factor Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            {/* Category Factor */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">1. Category Match (25%)</span>
              <span className="text-slate-200 font-semibold mt-1 block">
                {comparison.categoryMatch.details}
              </span>
            </div>

            {/* Location Factor */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">2. Spatial Proximity (35%)</span>
              <span className="text-slate-200 font-semibold mt-1 block">
                {comparison.locationProximity.distanceKm !== undefined
                  ? `${comparison.locationProximity.distanceKm} km`
                  : 'Text Overlap'}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {comparison.locationProximity.note}
              </span>
            </div>

            {/* Temporal Factor */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">3. Temporal Delta (20%)</span>
              <span className="text-slate-200 font-semibold mt-1 block">
                {comparison.temporalProximity.hoursDifference !== undefined
                  ? `Δ ${comparison.temporalProximity.hoursDifference}h`
                  : 'Undetermined'}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {comparison.temporalProximity.note}
              </span>
            </div>

            {/* Keyword Factor */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase">4. Impact Overlap (20%)</span>
              <span className="text-slate-200 font-semibold mt-1 block">
                {comparison.textSimilarity.commonKeywords.length} shared keywords
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {comparison.textSimilarity.commonKeywords.join(', ') || 'None'}
              </span>
            </div>
          </div>

          {/* Side-by-Side Comparison Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Incident A */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-cyan-400">
                  Target Incident A (Primary)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  #{targetIncident.id.slice(0, 10)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Title & Origin</span>
                <h4 className="text-xs font-semibold text-white">{targetIncident.title}</h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  Origin: {targetIncident.originType} ({targetIncident.engineMode})
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Extracted Location</span>
                <p className="text-xs text-slate-200">
                  {targetIncident.analysis.extractedLocation.normalizedName}
                </p>
                <span className="text-[10px] text-slate-500">
                  Scope: {targetIncident.analysis.extractedLocation.spatialScope || 'local'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Event & Pub Time</span>
                <p className="text-xs text-slate-200">
                  Event: {targetIncident.analysis.eventTime.reportedTimeText}
                </p>
                <p className="text-[10px] text-slate-500">
                  Pub: {new Date(targetIncident.primaryReport.sourcePublicationTime).toLocaleString()}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Casualties & Impact</span>
                <p className="text-xs text-slate-200">
                  Fatalities: {targetIncident.analysis.impactAssessment.casualties.count ?? 'Unknown'} • Injuries:{' '}
                  {targetIncident.analysis.impactAssessment.injuries.count ?? 'Unknown'}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Raw Source Snippet</span>
                <p className="text-[11px] text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800 whitespace-pre-wrap">
                  {targetIncident.primaryReport.rawReportText}
                </p>
              </div>
            </div>

            {/* Candidate Incident B */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-indigo-400">
                  Candidate Incident B (To Merge)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  #{candidateIncident.id.slice(0, 10)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Title & Origin</span>
                <h4 className="text-xs font-semibold text-white">{candidateIncident.title}</h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  Origin: {candidateIncident.originType} ({candidateIncident.engineMode})
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Extracted Location</span>
                <p className="text-xs text-slate-200">
                  {candidateIncident.analysis.extractedLocation.normalizedName}
                </p>
                <span className="text-[10px] text-slate-500">
                  Scope: {candidateIncident.analysis.extractedLocation.spatialScope || 'local'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Event & Pub Time</span>
                <p className="text-xs text-slate-200">
                  Event: {candidateIncident.analysis.eventTime.reportedTimeText}
                </p>
                <p className="text-[10px] text-slate-500">
                  Pub: {new Date(candidateIncident.primaryReport.sourcePublicationTime).toLocaleString()}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Casualties & Impact</span>
                <p className="text-xs text-slate-200">
                  Fatalities: {candidateIncident.analysis.impactAssessment.casualties.count ?? 'Unknown'} • Injuries:{' '}
                  {candidateIncident.analysis.impactAssessment.injuries.count ?? 'Unknown'}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Raw Source Snippet</span>
                <p className="text-[11px] text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800 whitespace-pre-wrap">
                  {candidateIncident.primaryReport.rawReportText}
                </p>
              </div>
            </div>
          </div>

          {/* Merge Provenance Safeguard Notice */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs flex items-center space-x-2 text-slate-300 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Provenance Guarantee: Merging archives the secondary report into the primary record&apos;s audit trail. Casualty figures are reconciled with source breakdown without blind summing.
            </span>
          </div>

          {/* Reviewer Action Configuration */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <span className="text-xs font-semibold text-slate-300 block font-mono">
              Reviewer Audit Provenance Input:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Reviewer Name:</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reviewer Rationale & Audit Note:</label>
                <input
                  type="text"
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Reason for merge or separation decision..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleMarkUncertain}
              className="px-3 py-1.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs font-medium transition-colors cursor-pointer"
            >
              Mark Uncertain
            </button>

            <button
              type="button"
              onClick={handleKeepSeparate}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              Keep as Separate Incidents
            </button>

            <button
              type="button"
              onClick={handleMerge}
              className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <GitMerge className="w-4 h-4" />
              <span>Merge Reports (Preserve Provenance)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
