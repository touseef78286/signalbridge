/**
 * SignalBridge AI - Domain Types
 * Strict typing for incident triage, evidence grounding, candidate duplicate matching,
 * real-source adapters, and reviewer provenance.
 */

export type IncidentCategory =
  | 'flood'
  | 'wildfire'
  | 'earthquake'
  | 'structural_collapse'
  | 'hazmat_spill'
  | 'power_outage'
  | 'medical_emergency'
  | 'severe_weather'
  | 'transport_accident'
  | 'other';

export type SourceType =
  | 'first_responder'
  | 'citizen_call'
  | 'sensor_iot'
  | 'social_media'
  | 'field_agency'
  | 'news_wire'
  | 'official_agency_feed';

export type ReviewStatus =
  | 'unreviewed'
  | 'under_review'
  | 'verified_by_reviewer'
  | 'rejected';

export type ConflictStatus =
  | 'none'
  | 'suspected_conflict'
  | 'confirmed_conflict';

export type EvidenceCompleteness = 'low' | 'moderate' | 'high';

export type DataOriginType =
  | 'live_feed'       // Real external feed (e.g. USGS, GDACS)
  | 'user_submission' // Submitted by user via triage form
  | 'synthetic_demo'; // Hardcoded/heuristic test fixture for demonstrations

export type EngineMode =
  | 'gemini_live'     // Analyzed by live server-side Gemini 3.8 Flash
  | 'demo_fallback'   // Deterministic grounded mock fallback
  | 'external_feed';  // Direct structured ingest from official open APIs

export interface FeedProvenance {
  adapterId: 'usgs' | 'gdacs' | 'reliefweb' | 'manual';
  feedName: string;
  sourceId: string;
  externalUrl?: string;
  retrievedAt: string;
  attribution: string;
  license: string;
}

export interface ReportSource {
  id: string;
  sourceType: SourceType;
  publisherOrCaller: string;
  sourcePublicationTime: string; // ISO string when published/received
  sourceUrl?: string;
  rawReportText: string;
  isVerifiedSource: boolean; // Institutional/official vs unverified social
  contactInfo?: string;
}

export interface ExtractedLocation {
  rawText: string;
  normalizedName: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  hasReliableCoords: boolean;
  confidenceNote: string;
  spatialScope: 'point_localized' | 'neighborhood' | 'regional' | 'macro_regional';
}

export interface CasualtySourceClaim {
  reportId: string;
  publisher: string;
  count: number | null;
  status: 'confirmed' | 'estimated' | 'unknown' | 'none';
  reportedAt: string;
  scopeDescription: string; // e.g. "Hospital wing B", "East district cumulative"
}

export interface CasualtyData {
  count: number | null; // Reconciled primary estimate or null if disputed/unknown
  status: 'confirmed' | 'estimated' | 'unknown' | 'none';
  exactSpan: string;
  claimsBreakdown?: CasualtySourceClaim[]; // Provenance breakdown preventing double-counting
}

export interface ImpactAssessment {
  casualties: CasualtyData;
  injuries: CasualtyData;
  infrastructureImpact: string[];
  urgentNeeds: string[];
}

export interface SupportingTextSpan {
  statement: string;
  quoteSpan: string;
  exactQuoteInSourceText: boolean; // Confirms verbatim source substring; does NOT imply real-world claim truth
  verifiedInText?: boolean; // Backward-compatible alias for exactQuoteInSourceText
}

export interface EvidenceGroundedAnalysis {
  category: IncidentCategory;
  extractedLocation: ExtractedLocation;
  eventTime: {
    reportedTimeText: string;
    isoTimestamp?: string;
    confidenceNote: string;
    isEventOccurrenceTimeKnown: boolean;
  };
  sourcePublicationTime: string;
  impactAssessment: ImpactAssessment;
  supportingSpans: SupportingTextSpan[];
  missingInformation: string[];
  conflictingClaims: string[];
  conciseSummary: string; // Grounded strictly in text without unsupported extrapolation
  modelRawInterpretationNotes: string;
}

export interface ModelConfidence {
  score: number; // 0.0 - 1.0
  label: 'low' | 'medium' | 'high';
  isCalibrated: false; // Explicitly marked as uncalibrated model self-assessment
  explanation: string;
}

export interface ProvenanceRecord {
  reportId: string;
  source: ReportSource;
  mergedAt: string;
  mergedByReviewer: string;
  reason: string;
  reconciledImpactNotes?: string;
}

export interface Incident {
  id: string;
  title: string;
  originType: DataOriginType;
  engineMode: EngineMode;
  feedProvenance?: FeedProvenance;
  reviewStatus: ReviewStatus;
  conflictStatus: ConflictStatus;
  evidenceCompleteness: EvidenceCompleteness;
  modelConfidence: ModelConfidence;
  primaryReport: ReportSource;
  mergedReports: ProvenanceRecord[];
  analysis: EvidenceGroundedAnalysis;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectedReasons?: string[];
  duplicateCandidateIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MatchingThresholds {
  localizedDistanceKm: number;    // e.g. 1.0 km for localized structural/hazmat
  regionalDistanceKm: number;     // e.g. 25.0 km for floods/wildfires
  macroRegionalDistanceKm: number;// e.g. 150.0 km for earthquakes
  concurrencyWindowHours: number; // e.g. 3.0 hours for concurrent event matching
  reportingDelayWindowHours: number; // e.g. 24.0 hours for reporting delay tolerance
  minCandidateScore: number;      // e.g. 0.50
}

export interface CandidateDuplicateMatch {
  candidateIncidentId: string;
  overallScore: number; // 0.0 to 1.0
  isCandidate: boolean;
  categoryMatch: {
    match: boolean;
    details: string;
  };
  locationProximity: {
    score: number;
    distanceKm?: number;
    locationA: string;
    locationB: string;
    spatialScopeA: string;
    spatialScopeB: string;
    spatialUncertaintyMarginKm: number;
    note: string;
  };
  temporalProximity: {
    score: number;
    comparisonBasis: 'event_occurrence_times' | 'reporting_publication_windows' | 'insufficient_temporal_data';
    hoursDifference?: number;
    note: string;
  };
  textSimilarity: {
    score: number;
    commonKeywords: string[];
  };
  conflictsDetected: string[];
  recommendation:
    | 'likely_duplicate'
    | 'same_area_separate_incident'
    | 'insufficient_data_to_link'
    | 'conflicting_reports';
}

export interface ReviewerMergeRequest {
  primaryIncidentId: string;
  secondaryIncidentId: string;
  decision: 'merge' | 'keep_separate' | 'mark_uncertain';
  reviewerName: string;
  reviewerNotes: string;
}

export interface AnalysisApiRequest {
  rawReportText: string;
  sourceType: SourceType;
  publisherOrCaller: string;
  sourcePublicationTime?: string;
  sourceUrl?: string;
  isVerifiedSource?: boolean;
}

export interface ExternalFeedStatus {
  id: 'usgs' | 'gdacs';
  name: string;
  endpoint: string;
  status: 'healthy' | 'unavailable' | 'rate_limited' | 'not_polled';
  lastSuccessfulFetch?: string;
  itemCount: number;
  lastErrorMessage?: string;
}
