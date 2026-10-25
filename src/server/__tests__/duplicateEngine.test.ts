/**
 * Unit Tests: Candidate Duplicate Matching Engine
 * Covers:
 * 1. Two reports describing the same incident (should be flagged as duplicate candidate)
 * 2. Similar wording but genuinely different incidents (e.g. 48km apart or different sectors)
 * 3. Conflicting casualty or damage estimates (must flag conflicting claims)
 * 4. Missing location and event time (handled gracefully without inventing values)
 * 5. Reviewer decisions and source provenance after merging
 */

import { describe, it, expect } from 'vitest';
import {
  compareIncidents,
  findDuplicateCandidates,
  mergeIncidentsWithProvenance,
  calculateHaversineDistanceKm
} from '../duplicateEngine.ts';
import { Incident } from '../../types/incident.ts';

const baseIncident: Incident = {
  id: 'inc-001',
  title: 'FLOOD: North Bridge, 4th Street',
  originType: 'synthetic_demo',
  engineMode: 'demo_fallback',
  reviewStatus: 'unreviewed',
  conflictStatus: 'none',
  evidenceCompleteness: 'high',
  modelConfidence: {
    score: 0.88,
    label: 'high',
    isCalibrated: false,
    explanation: 'High confidence grounded extraction',
  },
  primaryReport: {
    id: 'rep-001',
    sourceType: 'first_responder',
    publisherOrCaller: 'Station 4 Fire Dispatch',
    sourcePublicationTime: '2026-10-23T22:20:00.000Z',
    rawReportText:
      'Engine 4 on scene at North Bridge crossing at 4th Street. Water rising over 3 feet across the road. 2 motorists treated for mild hypothermia. No fatalities reported at this time.',
    isVerifiedSource: true,
  },
  mergedReports: [],
  analysis: {
    category: 'flood',
    extractedLocation: {
      rawText: 'North Bridge crossing at 4th Street',
      normalizedName: 'North Bridge, 4th Street',
      coordinates: { lat: 37.7749, lng: -122.4194 },
      hasReliableCoords: true,
      confidenceNote: 'Coordinates verified from GPS telemetry',
      spatialScope: 'regional',
    },
    eventTime: {
      reportedTimeText: '22:15 local time',
      isoTimestamp: '2026-10-23T22:15:00.000Z',
      isEventOccurrenceTimeKnown: true,
      confidenceNote: 'Extracted from dispatch log',
    },
    sourcePublicationTime: '2026-10-23T22:20:00.000Z',
    impactAssessment: {
      casualties: { count: 0, status: 'none', exactSpan: 'No fatalities reported' },
      injuries: { count: 2, status: 'confirmed', exactSpan: '2 motorists treated' },
      infrastructureImpact: ['Bridge approaches submerged under 3 feet of water'],
      urgentNeeds: ['Heavy water rescue raft'],
    },
    supportingSpans: [
      {
        statement: 'Water rising 3 feet',
        quoteSpan: 'Water rising over 3 feet across the road',
        exactQuoteInSourceText: true,
        verifiedInText: true,
      },
    ],
    missingInformation: [],
    conflictingClaims: [],
    conciseSummary: 'Flash flood at North Bridge, 4th St. 2 motorists treated for hypothermia.',
    modelRawInterpretationNotes: 'Verified extraction',
  },
  createdAt: '2026-10-23T22:21:00.000Z',
  updatedAt: '2026-10-23T22:21:00.000Z',
};

describe('Candidate Duplicate Detection Engine', () => {
  it('correctly calculates Haversine distance between two coordinates', () => {
    const dist = calculateHaversineDistanceKm(37.7793, -122.4192, 37.7955, -122.3937);
    expect(dist).toBeGreaterThan(2.0);
    expect(dist).toBeLessThan(3.5);
  });

  it('detects two reports describing the SAME incident as likely duplicates', () => {
    const duplicateCitizenReport: Incident = {
      ...baseIncident,
      id: 'inc-002',
      title: 'FLOOD: 4th St & North Bridge',
      primaryReport: {
        id: 'rep-002',
        sourceType: 'citizen_call',
        publisherOrCaller: 'Caller #882',
        sourcePublicationTime: '2026-10-23T22:35:00.000Z',
        rawReportText:
          'Cars stuck in high water near 4th street north bridge. Water is 3 feet deep. Fire department is on scene helping people out of cars.',
        isVerifiedSource: false,
      },
      analysis: {
        ...baseIncident.analysis,
        extractedLocation: {
          rawText: '4th street north bridge',
          normalizedName: 'North Bridge, 4th Street',
          coordinates: { lat: 37.7751, lng: -122.4192 },
          hasReliableCoords: true,
          confidenceNote: 'GPS telemetry',
          spatialScope: 'regional',
        },
        eventTime: {
          reportedTimeText: '22:30',
          isoTimestamp: '2026-10-23T22:30:00.000Z',
          isEventOccurrenceTimeKnown: true,
          confidenceNote: 'Call time',
        },
      },
    };

    const comparison = compareIncidents(baseIncident, duplicateCitizenReport);

    expect(comparison.isCandidate).toBe(true);
    expect(comparison.overallScore).toBeGreaterThanOrEqual(0.70);
    expect(comparison.recommendation).toBe('likely_duplicate');
    expect(comparison.categoryMatch.match).toBe(true);
    expect(comparison.locationProximity.distanceKm).toBeDefined();
    expect(comparison.locationProximity.distanceKm!).toBeLessThan(0.5);
  });

  it('distinguishes similar wording describing GENUINELY DIFFERENT incidents far apart', () => {
    const distantIncident: Incident = {
      ...baseIncident,
      id: 'inc-003',
      title: 'FLOOD: South Valley Reservoir Outflow',
      analysis: {
        ...baseIncident.analysis,
        extractedLocation: {
          rawText: 'South Valley Reservoir Outflow at Mile Marker 18',
          normalizedName: 'South Valley Reservoir, Mile Marker 18',
          coordinates: { lat: 37.4021, lng: -121.9542 }, // ~48 km away
          hasReliableCoords: true,
          confidenceNote: 'Verified mile marker sensor',
          spatialScope: 'regional',
        },
        eventTime: {
          reportedTimeText: '22:15',
          isoTimestamp: '2026-10-23T22:15:00.000Z',
          isEventOccurrenceTimeKnown: true,
          confidenceNote: 'Sensor timestamp',
        },
      },
    };

    const comparison = compareIncidents(baseIncident, distantIncident);

    expect(comparison.recommendation).toBe('same_area_separate_incident');
    expect(comparison.overallScore).toBeLessThan(0.70);
    expect(comparison.locationProximity.distanceKm!).toBeGreaterThan(30);
  });

  it('detects conflicting casualty claims between two overlapping reports', () => {
    const conflictingReport: Incident = {
      ...baseIncident,
      id: 'inc-004',
      analysis: {
        ...baseIncident.analysis,
        impactAssessment: {
          ...baseIncident.analysis.impactAssessment,
          casualties: { count: 12, status: 'estimated', exactSpan: 'at least 12 people feared dead' },
        },
        conflictingClaims: ['Claimed 12 dead contradicts official count of 0'],
      },
      primaryReport: {
        ...baseIncident.primaryReport,
        rawReportText: 'Catastrophic collapse at North Bridge! At least 12 people feared dead in current!',
      },
    };

    const comparison = compareIncidents(baseIncident, conflictingReport);

    expect(comparison.conflictsDetected.length).toBeGreaterThan(0);
    expect(comparison.recommendation).toBe('conflicting_reports');
  });

  it('handles missing coordinates and timestamps gracefully without inventing values', () => {
    const missingFieldsIncident: Incident = {
      ...baseIncident,
      id: 'inc-005',
      primaryReport: {
        ...baseIncident.primaryReport,
        sourcePublicationTime: '',
      },
      analysis: {
        ...baseIncident.analysis,
        extractedLocation: {
          rawText: 'Somewhere along the north river road',
          normalizedName: 'North River Road',
          coordinates: undefined,
          hasReliableCoords: false,
          confidenceNote: 'No GPS telemetry provided',
          spatialScope: 'regional',
        },
        eventTime: {
          reportedTimeText: 'Time unspecified in report',
          isoTimestamp: undefined,
          isEventOccurrenceTimeKnown: false,
          confidenceNote: 'No temporal indicator found',
        },
      },
    };

    const comparison = compareIncidents(baseIncident, missingFieldsIncident);

    expect(comparison.locationProximity.distanceKm).toBeUndefined();
    expect(comparison.locationProximity.note).toContain('Coordinates unverified');
    expect(comparison.temporalProximity.hoursDifference).toBeUndefined();
    expect(comparison.recommendation).toBe('insufficient_data_to_link');
  });

  it('preserves source provenance and aggregates impact after reviewer merge', () => {
    const secondaryIncident: Incident = {
      ...baseIncident,
      id: 'inc-006',
      primaryReport: {
        id: 'rep-006',
        sourceType: 'social_media',
        publisherOrCaller: '@traffic_patrol_volunteer',
        sourcePublicationTime: '2026-10-23T22:40:00.000Z',
        rawReportText: 'North Bridge water level reached top of concrete jersey barriers. Tow truck needed for stuck sedan.',
        isVerifiedSource: false,
      },
      analysis: {
        ...baseIncident.analysis,
        impactAssessment: {
          ...baseIncident.analysis.impactAssessment,
          urgentNeeds: ['Heavy duty tow truck'],
          infrastructureImpact: ['Concrete jersey barriers compromised'],
        },
      },
    };

    const merged = mergeIncidentsWithProvenance(
      baseIncident,
      secondaryIncident,
      'Supervisor Alex Vance',
      'Verified same 4th st bridge obstruction from traffic volunteer photo.'
    );

    expect(merged.mergedReports.length).toBe(1);
    expect(merged.mergedReports[0].reportId).toBe('rep-006');
    expect(merged.mergedReports[0].mergedByReviewer).toBe('Supervisor Alex Vance');
    expect(merged.mergedReports[0].source.rawReportText).toContain('North Bridge water level');

    expect(merged.analysis.impactAssessment.urgentNeeds).toContain('Heavy duty tow truck');
    expect(merged.analysis.impactAssessment.infrastructureImpact).toContain('Concrete jersey barriers compromised');
  });
});
