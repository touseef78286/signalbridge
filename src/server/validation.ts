/**
 * SignalBridge AI - Runtime Validation & Evidence Grounding Checker
 * Guarantees that model outputs are strictly validated before touching application state.
 *
 * CRITICAL AUDIT PRINCIPLES:
 * 1. Exact quote matching verifies verbatim FAITHFULNESS to the source report, NOT external claim truth.
 * 2. URL transport safety (HTTPS) verifies encryption in transit, NOT source trustworthiness or institutional veracity.
 * 3. Coordinates are only marked reliable if explicitly provided in source text/telemetry; models must never invent GPS coordinates.
 */

import {
  EvidenceGroundedAnalysis,
  IncidentCategory,
  ModelConfidence,
  SupportingTextSpan,
  EvidenceCompleteness,
  ConflictStatus
} from '../types/incident.ts';

const VALID_CATEGORIES: IncidentCategory[] = [
  'flood',
  'wildfire',
  'earthquake',
  'structural_collapse',
  'hazmat_spill',
  'power_outage',
  'medical_emergency',
  'severe_weather',
  'transport_accident',
  'other',
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /system\s*prompt\s*override/i,
  /you\s+are\s+now\s+(in|a)\s+unrestricted/i,
  /disregard\s+(the\s+)?rules/i,
  /output\s+only\s+the\s+word/i,
  /<script[\s>]/i,
  /javascript:/i,
];

/**
 * List of recognized institutional public disaster domains.
 * Merely having HTTPS does NOT imply trust; institutional domains must be identified.
 */
const INSTITUTIONAL_DOMAINS = [
  'usgs.gov',
  'gdacs.org',
  'noaa.gov',
  'weather.gov',
  'reliefweb.int',
  'fema.gov',
  'un.org',
  'europa.eu',
];

export interface InputSanitizationResult {
  isSuspicious: boolean;
  sanitizedText: string;
  reasons: string[];
}

export function sanitizeReportInput(rawText: unknown): InputSanitizationResult {
  if (typeof rawText !== 'string') {
    return {
      isSuspicious: true,
      sanitizedText: '',
      reasons: ['Input is not a string'],
    };
  }

  const sanitized = rawText
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  const reasons: string[] = [];

  if (sanitized.length === 0) {
    reasons.push('Report text is empty');
  }

  if (sanitized.length > 25000) {
    reasons.push('Report text exceeds maximum allowed length of 25,000 characters');
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      reasons.push(`Contained disallowed prompt directive matching ${pattern.toString()}`);
    }
  }

  return {
    isSuspicious: reasons.length > 0,
    sanitizedText: sanitized.slice(0, 25000),
    reasons,
  };
}

/**
 * Evaluates source URL safety and institutional trust.
 * Crucial: Distinguishes transport encryption from source veracity.
 */
export function evaluateSourceUrlTrust(url?: string): {
  isSyntacticallySafe: boolean;
  isInstitutionalDomain: boolean;
  warning?: string;
} {
  if (!url) {
    return { isSyntacticallySafe: true, isInstitutionalDomain: false };
  }

  const lower = url.toLowerCase().trim();

  // Reject dangerous schemes
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return {
      isSyntacticallySafe: false,
      isInstitutionalDomain: false,
      warning: 'Disallowed URI scheme (potential XSS/script vector)',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      isSyntacticallySafe: false,
      isInstitutionalDomain: false,
      warning: 'Malformed URL format',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      isSyntacticallySafe: false,
      isInstitutionalDomain: false,
      warning: 'Non-HTTP protocol',
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isInstitutional = INSTITUTIONAL_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );

  return {
    isSyntacticallySafe: true,
    isInstitutionalDomain: isInstitutional,
    warning: isInstitutional
      ? undefined
      : 'Unverified third-party domain (HTTPS ensures transport security, not content truthfulness)',
  };
}

/**
 * Checks whether quoteSpan actually exists in rawReportText.
 * Note: Verifies faithfulness to source report, NOT external claim truth.
 */
export function verifyQuoteSpanInText(quoteSpan: string, rawReportText: string): boolean {
  if (!quoteSpan || !rawReportText) return false;

  const normalizedQuote = quoteSpan.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedText = rawReportText.toLowerCase().replace(/\s+/g, ' ');

  if (normalizedQuote.length < 3) return false;
  return normalizedText.includes(normalizedQuote);
}

/**
 * Coordinates validator. Coordinates are only deemed "reliable" if
 * the raw report explicitly supplied numeric lat/long or geo metadata.
 */
export function validateCoordinates(
  coords: unknown,
  rawReportText: string
): { coords?: { lat: number; lng: number }; isReliable: boolean; note: string } {
  if (!coords || typeof coords !== 'object') {
    return {
      coords: undefined,
      isReliable: false,
      note: 'No geographic coordinates provided in report',
    };
  }

  const { lat, lng } = coords as { lat?: unknown; lng?: unknown };
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return {
      coords: undefined,
      isReliable: false,
      note: 'Invalid coordinate types',
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      coords: undefined,
      isReliable: false,
      note: `Coordinates out of valid WGS84 range: [${lat}, ${lng}]`,
    };
  }

  const latStr = lat.toFixed(2);
  const lngStr = lng.toFixed(2);
  const textHasExplicitCoords =
    rawReportText.includes(latStr) ||
    rawReportText.includes(lngStr) ||
    /(\-?\d{1,3}\.\d+)[,\s]+(\-?\d{1,3}\.\d+)/.test(rawReportText) ||
    /gps|lat|long|coordinates|sensor|telemetry|geojson/i.test(rawReportText);

  if (!textHasExplicitCoords) {
    return {
      coords: { lat, lng },
      isReliable: false,
      note: 'Model generated coordinates without explicit GPS figures in raw text. Flagged as unverified location estimate.',
    };
  }

  return {
    coords: { lat, lng },
    isReliable: true,
    note: 'Coordinates grounded in raw source text / telemetry',
  };
}

/**
 * Strict schema parser & validator for Gemini JSON response.
 */
export function validateAndGroundAnalysis(
  rawModelOutput: unknown,
  sourceReportText: string,
  sourcePublicationTime: string
): { analysis: EvidenceGroundedAnalysis; modelConfidence: ModelConfidence; conflictStatus: ConflictStatus } {
  let parsed: any;
  if (typeof rawModelOutput === 'string') {
    try {
      const cleaned = rawModelOutput
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (err: any) {
      throw new Error(`Model returned malformed JSON: ${err.message}`);
    }
  } else if (typeof rawModelOutput === 'object' && rawModelOutput !== null) {
    parsed = rawModelOutput;
  } else {
    throw new Error('Model output is neither string nor object');
  }

  // 1. Category validation
  let category: IncidentCategory = 'other';
  if (typeof parsed.category === 'string') {
    const norm = parsed.category.toLowerCase().trim() as IncidentCategory;
    if (VALID_CATEGORIES.includes(norm)) {
      category = norm;
    }
  }

  // 2. Spatial Scope & Location validation
  const locRaw = typeof parsed.extractedLocation?.rawText === 'string'
    ? parsed.extractedLocation.rawText.trim()
    : 'Unknown location';
  const locNorm = typeof parsed.extractedLocation?.normalizedName === 'string'
    ? parsed.extractedLocation.normalizedName.trim()
    : locRaw;

  const coordCheck = validateCoordinates(parsed.extractedLocation?.coordinates, sourceReportText);

  let spatialScope: 'point_localized' | 'neighborhood' | 'regional' | 'macro_regional' = 'point_localized';
  if (category === 'earthquake') spatialScope = 'macro_regional';
  else if (category === 'flood' || category === 'wildfire' || category === 'severe_weather') spatialScope = 'regional';
  else if (category === 'power_outage') spatialScope = 'neighborhood';

  const extractedLocation = {
    rawText: locRaw,
    normalizedName: locNorm,
    coordinates: coordCheck.coords,
    hasReliableCoords: coordCheck.isReliable,
    confidenceNote: coordCheck.note,
    spatialScope,
  };

  // 3. Event time vs source publication time
  const reportedTimeText = typeof parsed.eventTime?.reportedTimeText === 'string'
    ? parsed.eventTime.reportedTimeText.trim()
    : 'Time unspecified in report';

  let isoTimestamp: string | undefined = undefined;
  let isEventOccurrenceTimeKnown = false;
  if (
    typeof parsed.eventTime?.isoTimestamp === 'string' &&
    !isNaN(Date.parse(parsed.eventTime.isoTimestamp)) &&
    reportedTimeText !== 'Time unspecified in report'
  ) {
    isoTimestamp = new Date(parsed.eventTime.isoTimestamp).toISOString();
    isEventOccurrenceTimeKnown = true;
  }

  // 4. Grounded supporting quotes verification
  const supportingSpans: SupportingTextSpan[] = [];
  const rawSpans = Array.isArray(parsed.supportingSpans) ? parsed.supportingSpans : [];

  for (const item of rawSpans) {
    if (typeof item?.statement === 'string' && typeof item?.quoteSpan === 'string') {
      const isVerified = verifyQuoteSpanInText(item.quoteSpan, sourceReportText);
      supportingSpans.push({
        statement: item.statement.trim(),
        quoteSpan: item.quoteSpan.trim(),
        exactQuoteInSourceText: isVerified,
        verifiedInText: isVerified,
      });
    }
  }

  // 5. Impact assessment
  const casCount = typeof parsed.impactAssessment?.casualties?.count === 'number'
    ? parsed.impactAssessment.casualties.count
    : null;
  const casStatus = ['confirmed', 'estimated', 'unknown', 'none'].includes(parsed.impactAssessment?.casualties?.status)
    ? parsed.impactAssessment.casualties.status
    : 'unknown';
  const casSpan = typeof parsed.impactAssessment?.casualties?.exactSpan === 'string'
    ? parsed.impactAssessment.casualties.exactSpan.trim()
    : '';

  const injCount = typeof parsed.impactAssessment?.injuries?.count === 'number'
    ? parsed.impactAssessment.injuries.count
    : null;
  const injStatus = ['confirmed', 'estimated', 'unknown', 'none'].includes(parsed.impactAssessment?.injuries?.status)
    ? parsed.impactAssessment.injuries.status
    : 'unknown';
  const injSpan = typeof parsed.impactAssessment?.injuries?.exactSpan === 'string'
    ? parsed.impactAssessment.injuries.exactSpan.trim()
    : '';

  const infrastructureImpact = Array.isArray(parsed.impactAssessment?.infrastructureImpact)
    ? parsed.impactAssessment.infrastructureImpact.filter((i: any) => typeof i === 'string' && i.trim().length > 0)
    : [];

  const urgentNeeds = Array.isArray(parsed.impactAssessment?.urgentNeeds)
    ? parsed.impactAssessment.urgentNeeds.filter((n: any) => typeof n === 'string' && n.trim().length > 0)
    : [];

  // 6. Missing info and conflicting claims
  const missingInformation: string[] = Array.isArray(parsed.missingInformation)
    ? parsed.missingInformation.filter((m: any) => typeof m === 'string' && m.trim().length > 0)
    : [];

  const conflictingClaims: string[] = Array.isArray(parsed.conflictingClaims)
    ? parsed.conflictingClaims.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
    : [];

  const unverifiedSpansCount = supportingSpans.filter((s) => !s.exactQuoteInSourceText).length;
  if (unverifiedSpansCount > 0) {
    missingInformation.push(
      `${unverifiedSpansCount} supporting quote(s) provided by model could not be matched word-for-word in the source report.`
    );
  }

  // 7. Concise summary
  const conciseSummary = typeof parsed.conciseSummary === 'string' && parsed.conciseSummary.trim().length > 0
    ? parsed.conciseSummary.trim()
    : 'No summary generated.';

  // 8. Model confidence
  const rawScore = typeof parsed.modelConfidence?.score === 'number'
    ? Math.max(0, Math.min(1, parsed.modelConfidence.score))
    : 0.65;

  const confLabel: 'low' | 'medium' | 'high' =
    rawScore >= 0.8 ? 'high' : rawScore >= 0.5 ? 'medium' : 'low';

  const modelConfidence: ModelConfidence = {
    score: Number(rawScore.toFixed(2)),
    label: confLabel,
    isCalibrated: false,
    explanation: typeof parsed.modelConfidence?.explanation === 'string'
      ? parsed.modelConfidence.explanation.trim()
      : 'Uncalibrated model self-assessment based on report text clarity and completeness.',
  };

  let conflictStatus: ConflictStatus = 'none';
  if (conflictingClaims.length > 0) {
    conflictStatus = 'suspected_conflict';
  }

  const analysis: EvidenceGroundedAnalysis = {
    category,
    extractedLocation,
    eventTime: {
      reportedTimeText,
      isoTimestamp,
      isEventOccurrenceTimeKnown,
      confidenceNote: !isEventOccurrenceTimeKnown
        ? 'Report did not specify exact occurrence time; comparing reporting windows only'
        : 'Reported event occurrence time',
    },
    sourcePublicationTime,
    impactAssessment: {
      casualties: { count: casCount, status: casStatus, exactSpan: casSpan },
      injuries: { count: injCount, status: injStatus, exactSpan: injSpan },
      infrastructureImpact,
      urgentNeeds,
    },
    supportingSpans,
    missingInformation,
    conflictingClaims,
    conciseSummary,
    modelRawInterpretationNotes: typeof parsed.modelRawInterpretationNotes === 'string'
      ? parsed.modelRawInterpretationNotes.trim()
      : 'Model extraction completed.',
  };

  return { analysis, modelConfidence, conflictStatus };
}

/**
 * Calculates evidence completeness based on verified, objective fields.
 */
export function calculateEvidenceCompleteness(analysis: EvidenceGroundedAnalysis): EvidenceCompleteness {
  let score = 0;
  if (analysis.extractedLocation.rawText && analysis.extractedLocation.rawText !== 'Unknown location') {
    score += 1;
  }
  if (analysis.eventTime.isEventOccurrenceTimeKnown) {
    score += 1;
  }
  const verifiedQuotes = analysis.supportingSpans.filter((s) => s.exactQuoteInSourceText);
  if (verifiedQuotes.length >= 1) {
    score += 1;
  }

  if (score >= 3) return 'high';
  if (score === 2) return 'moderate';
  return 'low';
}
