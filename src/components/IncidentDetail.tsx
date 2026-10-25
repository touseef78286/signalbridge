import React, { useState } from 'react';
import { Incident, ReviewStatus, CandidateDuplicateMatch } from '../types/incident.ts';
import { evaluateSourceUrlTrust } from '../server/validation.ts';
import {
  Clock,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  ExternalLink,
  GitMerge,
  UserCheck,
  Globe,
  Database,
  User,
  Radio,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface IncidentDetailProps {
  incident: Incident | null;
  duplicateCandidates: CandidateDuplicateMatch[];
  allIncidents: Incident[];
  onUpdateReviewStatus: (
    incidentId: string,
    newStatus: ReviewStatus,
    reviewerName: string,
    notes: string
  ) => void;
  onOpenDuplicateModal: (targetIncident: Incident, candidateIncident: Incident) => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({
  incident,
  duplicateCandidates,
  allIncidents,
  onUpdateReviewStatus,
  onOpenDuplicateModal,
}) => {
  if (!incident) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center h-full flex flex-col items-center justify-center">
        <Layers className="w-12 h-12 text-slate-700 mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No Incident Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Select an incident from the operational queue on the left to inspect evidence grounding, origin provenance, and duplicate candidates.
        </p>
      </div>
    );
  }

  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>(incident.reviewStatus);
  const [reviewerName, setReviewerName] = useState(incident.reviewedBy || 'Field Reviewer (Operator 12)');
  const [auditNotes, setAuditNotes] = useState(incident.reviewerNotes || '');
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [highlightedSpan, setHighlightedSpan] = useState<string | null>(null);

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateReviewStatus(incident.id, selectedStatus, reviewerName, auditNotes);
    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 2500);
  };

  const hasCoords = incident.analysis.extractedLocation.coordinates !== undefined;
  const isCoordsReliable = incident.analysis.extractedLocation.hasReliableCoords;
  const hasConflict = incident.conflictStatus !== 'none';
  const urlTrust = evaluateSourceUrlTrust(incident.primaryReport.sourceUrl);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-full overflow-hidden">
      {/* Top Banner / Title Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            {/* Origin Badge */}
            {incident.originType === 'live_feed' ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                <Radio className="w-3 h-3 text-indigo-400" />
                <span>LIVE FEED ({incident.feedProvenance?.adapterId?.toUpperCase()})</span>
              </span>
            ) : incident.originType === 'user_submission' ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700">
                <User className="w-3 h-3 text-cyan-400" />
                <span>USER SUBMISSION</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-800">
                <Database className="w-3 h-3 text-amber-400" />
                <span>SYNTHETIC DEMO FIXTURE</span>
              </span>
            )}

            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
              {incident.analysis.category.replace('_', ' ')}
            </span>

            <span className="text-xs font-mono text-slate-500">
              ID: {incident.id}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {incident.reviewStatus === 'verified_by_reviewer' ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified by Reviewer</span>
              </span>
            ) : incident.reviewStatus === 'under_review' ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Under Review</span>
              </span>
            ) : incident.reviewStatus === 'rejected' ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Rejected</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Unreviewed Record</span>
              </span>
            )}
          </div>
        </div>

        <h2 className="text-lg font-bold text-white tracking-tight">{incident.title}</h2>

        {/* Live Feed Provenance Ribbon */}
        {incident.feedProvenance && (
          <div className="mt-2 p-2 rounded bg-indigo-950/40 border border-indigo-900/60 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-indigo-300">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Source: {incident.feedProvenance.attribution}</span>
              <span className="text-indigo-500">•</span>
              <span>License: {incident.feedProvenance.license}</span>
            </div>
            {incident.feedProvenance.externalUrl && (
              <a
                href={incident.feedProvenance.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline flex items-center space-x-1"
              >
                <span>Official Feed Eventpage</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {incident.originType === 'synthetic_demo' && (
          <div className="mt-2 p-2 rounded bg-amber-950/30 border border-amber-800/40 text-xs font-mono text-amber-300/90 flex items-center space-x-2">
            <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Synthetic Demo Record: Offline benchmark test fixture. Does not represent live operational sensor events.
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Conflicting Claims Alert Banner */}
        {hasConflict && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-3.5 text-xs text-red-200">
            <div className="flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-red-300">
                  Conflict Warning: Discrepant Incident Claims Detected
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-red-300/90 text-xs">
                  {incident.analysis.conflictingClaims.map((claim, idx) => (
                    <li key={idx}>{claim}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Human Review Decision Panel */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Human Reviewer Audit Control
              </span>
            </div>
            {showSavedFeedback && (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 animate-fadeIn">
                Audit Decision Recorded
              </span>
            )}
          </div>

          <form onSubmit={handleSaveReview} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Set Audit Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as ReviewStatus)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="unreviewed">Unreviewed (Pending)</option>
                  <option value="under_review">Under Review (Investigating)</option>
                  <option value="verified_by_reviewer">Verified by Reviewer</option>
                  <option value="rejected">Rejected (False Alarm / Invalid)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reviewer Name / ID:</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Inspector Vance (ID: 409)"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-xs">Audit Notes & Field Justification:</label>
              <textarea
                rows={2}
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="Document independent corroboration, sensor dispatch code, or rejection rationale..."
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Save Review Decision
              </button>
            </div>
          </form>
        </div>

        {/* Grounded Summary */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Evidence-Grounded Summary (Strict Extraction)
          </span>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 leading-relaxed font-sans">
            {incident.analysis.conciseSummary}
          </div>
          <p className="text-[10px] text-slate-500">
            Rule 3 Notice: Summaries strictly summarize extracted statements without introducing uncorroborated external facts.
          </p>
        </div>

        {/* Location & Temporal Split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Location & Physical Scope */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Extracted Location</span>
              </span>
              <div className="flex items-center space-x-1">
                <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                  Scope: {incident.analysis.extractedLocation.spatialScope || 'local'}
                </span>
                {isCoordsReliable ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                    GPS Grounded
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">
                    Unverified GPS
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-200 font-medium">
              {incident.analysis.extractedLocation.normalizedName}
            </div>

            {hasCoords ? (
              <div className="text-[11px] font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800">
                Coordinates: {incident.analysis.extractedLocation.coordinates?.lat.toFixed(4)},{' '}
                {incident.analysis.extractedLocation.coordinates?.lng.toFixed(4)}
                <div className="text-[10px] text-slate-500 mt-1">
                  {incident.analysis.extractedLocation.confidenceNote}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-amber-400/90 italic bg-amber-950/30 p-2 rounded border border-amber-900/50">
                No reliable coordinates detected in source report. Coordinates were not fabricated.
              </div>
            )}
          </div>

          {/* Temporal Separation: Event Occurrence vs Source Publication */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Temporal Separation</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Semantic Distinction
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] block">Reported Event Occurrence Time:</span>
                  {incident.analysis.eventTime.isEventOccurrenceTimeKnown ? (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1 rounded">Known</span>
                  ) : (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-1 rounded">Unspecified</span>
                  )}
                </div>
                <span className="font-semibold text-slate-200 block mt-0.5">
                  {incident.analysis.eventTime.reportedTimeText}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {incident.analysis.eventTime.confidenceNote}
                </span>
              </div>

              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Source Publication / Reception Time:</span>
                <span className="font-semibold text-slate-200">
                  {new Date(incident.primaryReport.sourcePublicationTime).toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block">
                  Channel: {incident.primaryReport.sourceType.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Impact Assessment with Attributed Source Breakdown (Anti-Double-Counting) */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Reported Impacts & Reconciled Claims
            </span>
            <span className="text-[10px] font-mono text-cyan-400">
              Anti-Double-Counting Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Reconciled Fatalities:</span>
              <span className="text-sm font-bold font-mono text-slate-100">
                {incident.analysis.impactAssessment.casualties.count !== null
                  ? incident.analysis.impactAssessment.casualties.count
                  : 'Unknown / Not specified'}
              </span>
              <span className="text-[10px] text-slate-400 block capitalize">
                Status: {incident.analysis.impactAssessment.casualties.status}
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Reported Injuries:</span>
              <span className="text-sm font-bold font-mono text-slate-100">
                {incident.analysis.impactAssessment.injuries.count !== null
                  ? incident.analysis.impactAssessment.injuries.count
                  : 'Unknown / Not specified'}
              </span>
              <span className="text-[10px] text-slate-400 block capitalize">
                Status: {incident.analysis.impactAssessment.injuries.status}
              </span>
            </div>
          </div>

          {/* Attributed claims provenance table if multiple sources merged */}
          {incident.analysis.impactAssessment.casualties.claimsBreakdown &&
            incident.analysis.impactAssessment.casualties.claimsBreakdown.length > 1 && (
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">
                  Preserved Source Claims Breakdown (Not Summed):
                </span>
                <div className="space-y-1">
                  {incident.analysis.impactAssessment.casualties.claimsBreakdown.map((claim, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-slate-300 font-mono bg-slate-950 p-1.5 rounded">
                      <span>• {claim.publisher}: {claim.count ?? 'Unknown'} ({claim.scopeDescription})</span>
                      <span className="text-slate-500">{new Date(claim.reportedAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Verifiable Supporting Spans & Raw Report Interactive Inspector */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Verbatim Quote Grounding Inspector</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Extraction Faithfulness Check
            </span>
          </div>

          {/* Audit Rule 6 Notice */}
          <div className="bg-cyan-950/20 border border-cyan-900/40 p-2 rounded text-[11px] text-cyan-300/80 font-sans">
            Quote Grounding Notice: Verbatim substring matching confirms the model faithfully extracted phrases from the source report without hallucinating text. It does NOT independently prove the author&apos;s real-world claims are true.
          </div>

          <div className="space-y-2">
            {incident.analysis.supportingSpans.map((span, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHighlightedSpan(span.quoteSpan)}
                onMouseLeave={() => setHighlightedSpan(null)}
                className={`p-2.5 rounded border transition-colors cursor-pointer ${
                  highlightedSpan === span.quoteSpan
                    ? 'bg-slate-800 border-cyan-500'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-200">{span.statement}</span>
                  {span.exactQuoteInSourceText ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span>Verbatim in Source Text</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-800">
                      <XCircle className="w-3 h-3 text-red-400" />
                      <span>Unverified Quote</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-cyan-300/90 bg-slate-950 p-1.5 rounded border border-slate-800">
                  &ldquo;{span.quoteSpan}&rdquo;
                </div>
              </div>
            ))}
          </div>

          {/* Raw Report Verbatim Viewer */}
          <div className="mt-3">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Primary Source Text (Context Viewer):
            </span>
            <div className="bg-slate-900 p-3 rounded border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-text">
              {incident.primaryReport.rawReportText}
            </div>
          </div>
        </div>

        {/* Source URL & Provenance Security Check */}
        {incident.primaryReport.sourceUrl && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs font-mono">
            <span className="text-slate-400 uppercase text-[10px] block">
              Source URL Trust & Transport Analysis:
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 truncate max-w-[70%]">{incident.primaryReport.sourceUrl}</span>
              {urlTrust.isInstitutionalDomain ? (
                <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 text-[10px]">
                  Institutional Public Domain
                </span>
              ) : (
                <span className="text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 text-[10px]">
                  Third-Party Domain (HTTPS)
                </span>
              )}
            </div>
            {urlTrust.warning && (
              <p className="text-[10px] text-amber-500/90 font-sans mt-0.5">
                Notice: {urlTrust.warning}
              </p>
            )}
          </div>
        )}

        {/* Candidate Duplicate Linkages */}
        <div className="bg-slate-950 border border-indigo-900/40 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <GitMerge className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider font-mono">
                Candidate Duplicate Linkage ({duplicateCandidates.length})
              </span>
            </div>
            <span className="text-[10px] text-indigo-400 font-mono">
              Transparent Multi-Factor Engine
            </span>
          </div>

          {duplicateCandidates.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              No potential duplicate reports detected with score &ge; 50% across available files.
            </p>
          ) : (
            <div className="space-y-2">
              {duplicateCandidates.map((candidateMatch) => {
                const candidateIncident = allIncidents.find(
                  (i) => i.id === candidateMatch.candidateIncidentId
                );
                if (!candidateIncident) return null;

                const scorePct = Math.round(candidateMatch.overallScore * 100);

                return (
                  <div
                    key={candidateMatch.candidateIncidentId}
                    className="bg-slate-900 border border-slate-800 rounded p-3 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-slate-200 block">
                          {candidateIncident.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: #{candidateIncident.id.slice(0, 10)} • Publisher:{' '}
                          {candidateIncident.primaryReport.publisherOrCaller}
                        </span>
                      </div>

                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                          scorePct >= 70
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {scorePct}% Match
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-400">
                      <div>
                        Location:{' '}
                        {candidateMatch.locationProximity.distanceKm !== undefined
                          ? `${candidateMatch.locationProximity.distanceKm} km`
                          : 'Text Overlap'}
                      </div>
                      <div>
                        Basis: {candidateMatch.temporalProximity.comparisonBasis.replace(/_/g, ' ')}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-indigo-300 font-medium">
                        Recommendation: {candidateMatch.recommendation.replace(/_/g, ' ')}
                      </span>

                      <button
                        type="button"
                        onClick={() => onOpenDuplicateModal(incident, candidateIncident)}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <span>Inspect & Merge</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Source Provenance & Merged Reports Audit History */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Provenance Audit Trail ({incident.mergedReports.length + 1} Source Record{incident.mergedReports.length > 0 ? 's' : ''})
          </span>

          <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-200">
                Primary Source: {incident.primaryReport.id}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                Primary Ingest
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Publisher: {incident.primaryReport.publisherOrCaller} ({incident.primaryReport.sourceType})
            </div>
          </div>

          {incident.mergedReports.map((rec, idx) => (
            <div key={idx} className="bg-slate-900 p-2.5 rounded border border-indigo-900/50 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-indigo-300">
                  Merged Source: {rec.reportId}
                </span>
                <span className="text-[10px] font-mono text-indigo-400">
                  Merged {new Date(rec.mergedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Merged by: {rec.mergedByReviewer} • Reason: {rec.reason}
              </div>
              <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800">
                Original text: &ldquo;{rec.source.rawReportText}&rdquo;
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
