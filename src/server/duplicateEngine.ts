/**
 * SignalBridge AI - Candidate Duplicate Matching Engine (Phase 3 Upgrade)
 * Transparent, multi-factor matching pipeline with category-aware spatial scoping,
 * strict event occurrence time vs publication window semantics, and anti-double-counting merge logic.
 */

import {
  Incident,
  CandidateDuplicateMatch,
  IncidentCategory,
  MatchingThresholds,
  CasualtySourceClaim
} from '../types/incident.ts';

export const DEFAULT_MATCHING_THRESHOLDS: MatchingThresholds = {
  localizedDistanceKm: 1.0,
  regionalDistanceKm: 25.0,
  macroRegionalDistanceKm: 150.0,
  concurrencyWindowHours: 3.0,
  reportingDelayWindowHours: 24.0,
  minCandidateScore: 0.50,
};

/**
 * Categorizes disaster physical scope for sound spatial tolerance.
 */
export function getCategorySpatialScope(category: IncidentCategory): 'point_localized' | 'neighborhood' | 'regional' | 'macro_regional' {
  switch (category) {
    case 'earthquake':
      return 'macro_regional';
    case 'flood':
    case 'wildfire':
    case 'severe_weather':
      return 'regional';
    case 'power_outage':
      return 'neighborhood';
    case 'structural_collapse':
    case 'hazmat_spill':
    case 'medical_emergency':
    case 'transport_accident':
    case 'other':
    default:
      return 'point_localized';
  }
}

/**
 * Calculates Haversine distance in kilometers between two lat/lng coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Tokenizes text for transparent Jaccard similarity.
 */
export function tokenizeText(text: string): Set<string> {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'it', 'this', 'that', 'from', 'as', 'into', 'there',
    'has', 'have', 'been', 'near', 'over', 'reported'
  ]);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  return new Set(tokens);
}

export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : Number((intersectionSize / unionSize).toFixed(3));
}

/**
 * Evaluates candidate duplicate relationship with strict semantic distinctions.
 */
export function compareIncidents(
  target: Incident,
  candidate: Incident,
  thresholds: MatchingThresholds = DEFAULT_MATCHING_THRESHOLDS
): CandidateDuplicateMatch {
  const conflictsDetected: string[] = [];

  // -------------------------------------------------------------
  // Factor 1: Incident Category (Weight: 0.25)
  // -------------------------------------------------------------
  const isSameCategory = target.analysis.category === candidate.analysis.category;
  let categoryScore = isSameCategory ? 1.0 : 0.0;
  if (!isSameCategory) {
    const relatedGroups = [
      ['flood', 'severe_weather'],
      ['earthquake', 'structural_collapse'],
      ['wildfire', 'hazmat_spill'],
    ];
    for (const group of relatedGroups) {
      if (group.includes(target.analysis.category) && group.includes(candidate.analysis.category)) {
        categoryScore = 0.5;
        break;
      }
    }
  }

  const categoryDetails = isSameCategory
    ? `Identical category: ${target.analysis.category}`
    : categoryScore > 0
    ? `Related categories: ${target.analysis.category} vs ${candidate.analysis.category}`
    : `Mismatched categories: ${target.analysis.category} vs ${candidate.analysis.category}`;

  // -------------------------------------------------------------
  // Factor 2: Category-Aware Spatial Proximity (Weight: 0.35)
  // -------------------------------------------------------------
  let locationScore = 0.0;
  let distanceKm: number | undefined = undefined;
  let locationNote = '';
  const spatialScopeA = target.analysis.extractedLocation.spatialScope || getCategorySpatialScope(target.analysis.category);
  const spatialScopeB = candidate.analysis.extractedLocation.spatialScope || getCategorySpatialScope(candidate.analysis.category);

  // Determine spatial uncertainty margin
  const coordsReliableA = target.analysis.extractedLocation.hasReliableCoords;
  const coordsReliableB = candidate.analysis.extractedLocation.hasReliableCoords;
  const spatialUncertaintyMarginKm = (!coordsReliableA || !coordsReliableB) ? 5.0 : 0.1;

  const targetCoords = target.analysis.extractedLocation.coordinates;
  const candidateCoords = candidate.analysis.extractedLocation.coordinates;

  if (targetCoords && candidateCoords) {
    distanceKm = calculateHaversineDistanceKm(
      targetCoords.lat,
      targetCoords.lng,
      candidateCoords.lat,
      candidateCoords.lng
    );

    // Apply category-aware spatial tolerance
    if (spatialScopeA === 'macro_regional' || spatialScopeB === 'macro_regional') {
      // Earthquakes: broad zone of impact
      if (distanceKm <= thresholds.macroRegionalDistanceKm) {
        const ratio = Math.max(0, 1 - distanceKm / thresholds.macroRegionalDistanceKm);
        locationScore = Number((0.6 + 0.4 * ratio).toFixed(2));
        locationNote = `Within macro-regional shockwave envelope (${distanceKm} km; tolerance: ${thresholds.macroRegionalDistanceKm} km)`;
      } else {
        locationScore = 0.0;
        locationNote = `Separated by ${distanceKm} km, exceeding macro-regional envelope (${thresholds.macroRegionalDistanceKm} km)`;
      }
    } else if (spatialScopeA === 'regional' || spatialScopeB === 'regional') {
      // Floods / Wildfires / Severe storms
      if (distanceKm <= thresholds.regionalDistanceKm) {
        const ratio = Math.max(0, 1 - distanceKm / thresholds.regionalDistanceKm);
        locationScore = Number((0.5 + 0.5 * ratio).toFixed(2));
        locationNote = `Within regional hazard perimeter (${distanceKm} km; boundary tolerance: ${thresholds.regionalDistanceKm} km)`;
      } else {
        locationScore = 0.0;
        locationNote = `Distant locations (${distanceKm} km), outside regional perimeter (${thresholds.regionalDistanceKm} km)`;
      }
    } else {
      // Point-localized incidents (structural collapse, localized hazmat, building fire, medical)
      if (distanceKm <= thresholds.localizedDistanceKm) {
        locationScore = 1.0;
        locationNote = `Immediate localized site proximity (<${thresholds.localizedDistanceKm} km: ${distanceKm} km)`;
      } else if (distanceKm <= 3.0) {
        locationScore = 0.4;
        locationNote = `Nearby area (${distanceKm} km). Localized incident scope suggests these may be distinct events unless mutually spreading.`;
      } else {
        locationScore = 0.0;
        locationNote = `Separate geographic locations (${distanceKm} km apart for point-localized ${target.analysis.category}).`;
      }
    }

    if (spatialUncertaintyMarginKm > 1.0) {
      locationNote += ` [Note: ±${spatialUncertaintyMarginKm}km uncertainty due to unverified GPS telemetry]`;
    }
  } else {
    // Missing coordinates: Fall back to text Jaccard similarity of location names
    const targetLocTokens = tokenizeText(
      `${target.analysis.extractedLocation.rawText} ${target.analysis.extractedLocation.normalizedName}`
    );
    const candidateLocTokens = tokenizeText(
      `${candidate.analysis.extractedLocation.rawText} ${candidate.analysis.extractedLocation.normalizedName}`
    );
    const locJaccard = calculateJaccardSimilarity(targetLocTokens, candidateLocTokens);

    if (locJaccard > 0.6) {
      locationScore = 0.75;
      locationNote = `Substantial textual location overlap (${(locJaccard * 100).toFixed(0)}% matching tokens). Coordinates unverified.`;
    } else if (locJaccard > 0.25) {
      locationScore = 0.40;
      locationNote = `Partial text location overlap (${(locJaccard * 100).toFixed(0)}%). Coordinates not supplied in reports.`;
    } else {
      locationScore = 0.10;
      locationNote = `Distinct or unspecified locations in text. Coordinates unverified (No GPS telemetry available).`;
    }
  }

  // -------------------------------------------------------------
  // Factor 3: Strict Semantic Temporal Matching (Weight: 0.20)
  // -------------------------------------------------------------
  // RULE 1: Never compare event occurrence time against publication time as if they are the same!
  let temporalScore = 0.0;
  let hoursDifference: number | undefined = undefined;
  let temporalNote = '';
  let comparisonBasis: CandidateDuplicateMatch['temporalProximity']['comparisonBasis'] = 'insufficient_temporal_data';

  const targetHasEventTime = Boolean(
    target.analysis.eventTime.isEventOccurrenceTimeKnown &&
    target.analysis.eventTime.isoTimestamp &&
    !isNaN(Date.parse(target.analysis.eventTime.isoTimestamp))
  );

  const candidateHasEventTime = Boolean(
    candidate.analysis.eventTime.isEventOccurrenceTimeKnown &&
    candidate.analysis.eventTime.isoTimestamp &&
    !isNaN(Date.parse(candidate.analysis.eventTime.isoTimestamp))
  );

  if (targetHasEventTime && candidateHasEventTime) {
    // True event occurrence comparison!
    comparisonBasis = 'event_occurrence_times';
    const timeA = new Date(target.analysis.eventTime.isoTimestamp!).getTime();
    const timeB = new Date(candidate.analysis.eventTime.isoTimestamp!).getTime();
    const diffMs = Math.abs(timeA - timeB);
    hoursDifference = Number((diffMs / (1000 * 60 * 60)).toFixed(1));

    if (hoursDifference <= thresholds.concurrencyWindowHours) {
      temporalScore = 1.0;
      temporalNote = `Occurred concurrently within ~${hoursDifference}h window (Event occurrence comparison)`;
    } else if (hoursDifference <= 12.0) {
      temporalScore = 0.65;
      temporalNote = `Occurred within same ${hoursDifference}h period (Event occurrence comparison)`;
    } else if (hoursDifference <= 48.0) {
      temporalScore = 0.35;
      temporalNote = `Event occurrence times separated by ${hoursDifference}h (Possible secondary or delayed phase)`;
    } else {
      temporalScore = 0.05;
      temporalNote = `Event occurrence times separated by ${hoursDifference}h. Genuinely distinct incidents over time.`;
    }
  } else {
    // One or both event occurrence times are missing.
    // RULE: Evaluate publication times ONLY as reporting windows with explicit reporting delay disclaimer.
    const targetPub = target.primaryReport.sourcePublicationTime;
    const candidatePub = candidate.primaryReport.sourcePublicationTime;

    if (targetPub && candidatePub && !isNaN(Date.parse(targetPub)) && !isNaN(Date.parse(candidatePub))) {
      comparisonBasis = 'reporting_publication_windows';
      const pubA = new Date(targetPub).getTime();
      const pubB = new Date(candidatePub).getTime();
      const diffMs = Math.abs(pubA - pubB);
      hoursDifference = Number((diffMs / (1000 * 60 * 60)).toFixed(1));

      if (hoursDifference <= thresholds.reportingDelayWindowHours) {
        temporalScore = 0.50; // Bounded score: reporting window overlap alone does not prove identical event time
        temporalNote = `Reports published within ${hoursDifference}h window. Note: Event occurrence time unknown for one/both reports; comparing reporting window only (reporting delay window: ${thresholds.reportingDelayWindowHours}h).`;
      } else {
        temporalScore = 0.15;
        temporalNote = `Publication timestamps separated by ${hoursDifference}h. Event occurrence times unknown.`;
      }
    } else {
      comparisonBasis = 'insufficient_temporal_data';
      temporalScore = 0.20;
      temporalNote = 'No reliable event occurrence or publication timestamps available for temporal comparison.';
    }
  }

  // -------------------------------------------------------------
  // Factor 4: Content & Impact Keyword Overlap (Weight: 0.20)
  // -------------------------------------------------------------
  const targetKeywords = tokenizeText(
    `${target.title} ${target.analysis.conciseSummary} ${target.analysis.impactAssessment.infrastructureImpact.join(' ')} ${target.analysis.impactAssessment.urgentNeeds.join(' ')}`
  );
  const candidateKeywords = tokenizeText(
    `${candidate.title} ${candidate.analysis.conciseSummary} ${candidate.analysis.impactAssessment.infrastructureImpact.join(' ')} ${candidate.analysis.impactAssessment.urgentNeeds.join(' ')}`
  );
  const textScore = calculateJaccardSimilarity(targetKeywords, candidateKeywords);
  const commonKeywords: string[] = [];
  for (const kw of targetKeywords) {
    if (candidateKeywords.has(kw) && commonKeywords.length < 8) {
      commonKeywords.push(kw);
    }
  }

  // -------------------------------------------------------------
  // Scope-Aware Conflict Detection
  // -------------------------------------------------------------
  // RULE 4: Casualty/impact discrepancies are NOT automatically classified as contradictions
  // when reports describe different reporting scopes, time windows, or facilities.
  const targetCas = target.analysis.impactAssessment.casualties.count;
  const candidateCas = candidate.analysis.impactAssessment.casualties.count;

  if (targetCas !== null && candidateCas !== null && Math.abs(targetCas - candidateCas) >= 3) {
    // Check if temporal delta or spatial distance explains the divergence
    const isTemporallySeparated = hoursDifference !== undefined && hoursDifference >= 8.0;
    const isSpatiallyDivergent = distanceKm !== undefined && distanceKm > 3.0;

    if (isTemporallySeparated) {
      // Evolving cumulative count, not necessarily a contradiction
      conflictsDetected.push(
        `Discrepancy in casualty count (${targetCas} vs ${candidateCas}) may reflect evolving reporting scope across ${hoursDifference}h window rather than a factual contradiction.`
      );
    } else if (isSpatiallyDivergent) {
      conflictsDetected.push(
        `Discrepancy in casualty figures (${targetCas} vs ${candidateCas}) aligns with geographic separation (${distanceKm} km), suggesting distinct reporting sub-zones.`
      );
    } else {
      // Overlapping time and immediate vicinity -> Genuine conflict!
      conflictsDetected.push(
        `Direct contradiction in casualty estimates for same localized incident site: Report #${target.id.slice(0, 6)} reported ${targetCas}, while #${candidate.id.slice(0, 6)} reported ${candidateCas}.`
      );
    }
  }

  // Calculate Weighted Overall Score
  const overallScore = Number(
    (
      categoryScore * 0.25 +
      locationScore * 0.35 +
      temporalScore * 0.20 +
      textScore * 0.20
    ).toFixed(2)
  );

  // -------------------------------------------------------------
  // Recommendation Determination
  // -------------------------------------------------------------
  let recommendation: CandidateDuplicateMatch['recommendation'] = 'insufficient_data_to_link';

  const hasDirectConflict = conflictsDetected.some((c) => c.includes('Direct contradiction'));

  if (hasDirectConflict && overallScore >= 0.50) {
    recommendation = 'conflicting_reports';
  } else if (overallScore >= 0.70) {
    recommendation = 'likely_duplicate';
  } else if (
    distanceKm !== undefined &&
    spatialScopeA === 'point_localized' &&
    distanceKm > 2.0 &&
    distanceKm <= 10.0
  ) {
    // Point localized events nearby are distinct incidents
    recommendation = 'same_area_separate_incident';
  } else if (locationScore >= 0.6 && categoryScore < 0.5) {
    recommendation = 'same_area_separate_incident';
  } else if (distanceKm !== undefined && distanceKm > thresholds.regionalDistanceKm && spatialScopeA !== 'macro_regional') {
    recommendation = 'same_area_separate_incident';
  } else if (overallScore >= thresholds.minCandidateScore) {
    recommendation = 'insufficient_data_to_link';
  }

  const isCandidate = overallScore >= thresholds.minCandidateScore;

  return {
    candidateIncidentId: candidate.id,
    overallScore,
    isCandidate,
    categoryMatch: {
      match: isSameCategory,
      details: categoryDetails,
    },
    locationProximity: {
      score: Number(locationScore.toFixed(2)),
      distanceKm,
      locationA: target.analysis.extractedLocation.normalizedName,
      locationB: candidate.analysis.extractedLocation.normalizedName,
      spatialScopeA,
      spatialScopeB,
      spatialUncertaintyMarginKm,
      note: locationNote,
    },
    temporalProximity: {
      score: Number(temporalScore.toFixed(2)),
      comparisonBasis,
      hoursDifference,
      note: temporalNote,
    },
    textSimilarity: {
      score: Number(textScore.toFixed(2)),
      commonKeywords,
    },
    conflictsDetected,
    recommendation,
  };
}

/**
 * Searches an incident list for all potential duplicate candidates of a target incident.
 */
export function findDuplicateCandidates(
  target: Incident,
  allIncidents: Incident[],
  thresholds: MatchingThresholds = DEFAULT_MATCHING_THRESHOLDS
): CandidateDuplicateMatch[] {
  const matches: CandidateDuplicateMatch[] = [];

  for (const incident of allIncidents) {
    if (incident.id === target.id) continue;
    const match = compareIncidents(target, incident, thresholds);
    if (match.isCandidate) {
      matches.push(match);
    }
  }

  return matches.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Executes a human reviewer merge decision while preserving full provenance,
 * tracking source-attributed casualty claims, and avoiding double-counting impacts.
 */
export function mergeIncidentsWithProvenance(
  primary: Incident,
  secondary: Incident,
  reviewerName: string,
  reviewerNotes: string
): Incident {
  const mergedAt = new Date().toISOString();

  // Archive secondary's primary report into provenance history
  const newProvenanceRecord = {
    reportId: secondary.primaryReport.id,
    source: secondary.primaryReport,
    mergedAt,
    mergedByReviewer: reviewerName,
    reason: reviewerNotes || `Merged duplicate report #${secondary.id.slice(0, 8)}`,
    reconciledImpactNotes: `Merged secondary claims without summing to prevent double-counting.`,
  };

  const allMergedReports = [
    ...primary.mergedReports,
    newProvenanceRecord,
    ...secondary.mergedReports,
  ];

  // Aggregate infrastructure impact and urgent needs without duplicates
  const aggregatedInfra = Array.from(
    new Set([
      ...primary.analysis.impactAssessment.infrastructureImpact,
      ...secondary.analysis.impactAssessment.infrastructureImpact,
    ])
  );

  const aggregatedNeeds = Array.from(
    new Set([
      ...primary.analysis.impactAssessment.urgentNeeds,
      ...secondary.analysis.impactAssessment.urgentNeeds,
    ])
  );

  // Preserve and verify supporting quotes
  const combinedSpans = [
    ...primary.analysis.supportingSpans,
    ...secondary.analysis.supportingSpans,
  ];

  // Preserve source-attributed casualty breakdown to prevent double-counting!
  const priClaims: CasualtySourceClaim[] = primary.analysis.impactAssessment.casualties.claimsBreakdown || [
    {
      reportId: primary.primaryReport.id,
      publisher: primary.primaryReport.publisherOrCaller,
      count: primary.analysis.impactAssessment.casualties.count,
      status: primary.analysis.impactAssessment.casualties.status,
      reportedAt: primary.primaryReport.sourcePublicationTime,
      scopeDescription: 'Primary Incident Initial Scope',
    },
  ];

  const secClaims: CasualtySourceClaim[] = secondary.analysis.impactAssessment.casualties.claimsBreakdown || [
    {
      reportId: secondary.primaryReport.id,
      publisher: secondary.primaryReport.publisherOrCaller,
      count: secondary.analysis.impactAssessment.casualties.count,
      status: secondary.analysis.impactAssessment.casualties.status,
      reportedAt: secondary.primaryReport.sourcePublicationTime,
      scopeDescription: 'Secondary Merged Report Scope',
    },
  ];

  const combinedCasualtyClaims = [...priClaims, ...secClaims];

  // Reconciled count: Do not blind-sum! If they differ, keep primary's count or note disagreement
  const priCount = primary.analysis.impactAssessment.casualties.count;
  const secCount = secondary.analysis.impactAssessment.casualties.count;
  let reconciledCount: number | null = priCount;
  if (priCount === null && secCount !== null) {
    reconciledCount = secCount;
  }

  // Preserve conflicting claims
  const combinedConflicts = Array.from(
    new Set([
      ...primary.analysis.conflictingClaims,
      ...secondary.analysis.conflictingClaims,
    ])
  );

  if (priCount !== null && secCount !== null && Math.abs(priCount - secCount) >= 2) {
    combinedConflicts.push(
      `Casualty reconciliation required: Primary report cited ${priCount}, secondary cited ${secCount}. Kept primary as default; see source provenance breakdown.`
    );
  }

  const conflictStatus = combinedConflicts.length > 0 ? 'suspected_conflict' : primary.conflictStatus;

  return {
    ...primary,
    conflictStatus,
    mergedReports: allMergedReports,
    analysis: {
      ...primary.analysis,
      impactAssessment: {
        ...primary.analysis.impactAssessment,
        casualties: {
          ...primary.analysis.impactAssessment.casualties,
          count: reconciledCount,
          claimsBreakdown: combinedCasualtyClaims,
        },
        infrastructureImpact: aggregatedInfra,
        urgentNeeds: aggregatedNeeds,
      },
      supportingSpans: combinedSpans,
      conflictingClaims: combinedConflicts,
    },
    reviewerNotes: primary.reviewerNotes
      ? `${primary.reviewerNotes}\n[${mergedAt}] Merged report #${secondary.id.slice(0, 8)} by ${reviewerName}: ${reviewerNotes}`
      : `[${mergedAt}] Merged report #${secondary.id.slice(0, 8)} by ${reviewerName}: ${reviewerNotes}`,
    updatedAt: mergedAt,
  };
}
