/**
 * Unit & Integration Tests: Real-Source Adapters & Critical Correlation Audit
 * Covers:
 * 1. USGS GeoJSON adapter normalization & telemetry preservation
 * 2. GDACS GeoJSON adapter normalization & humanitarian alert level mapping
 * 3. Rate-limiting & in-memory cache TTL (60s)
 * 4. Semantic temporal matching (event occurrence vs reporting delay window)
 * 5. Category-aware spatial scoping (localized vs macro-regional tolerance)
 * 6. Casualty reconciliation without double-counting
 * 7. HTTPS transport safety vs domain institutional veracity
 * 8. Unmistakable separation of synthetic demo vs live feed data
 */

import { describe, it, expect } from 'vitest';
import { UsgsSourceAdapter } from '../adapters/usgsAdapter.ts';
import { GdacsSourceAdapter } from '../adapters/gdacsAdapter.ts';
import { AdapterRegistry } from '../adapters/adapterRegistry.ts';
import {
  compareIncidents,
  mergeIncidentsWithProvenance,
  getCategorySpatialScope,
  DEFAULT_MATCHING_THRESHOLDS
} from '../duplicateEngine.ts';
import { evaluateSourceUrlTrust } from '../validation.ts';
import { generateHeuristicFallback } from '../geminiService.ts';
import { Incident } from '../../types/incident.ts';

describe('Real-Source Adapters (USGS & GDACS)', () => {
  it(
    'normalizes USGS GeoJSON features preserving seismometer telemetry, depth, and review status',
    async () => {
      const adapter = new UsgsSourceAdapter();
      const result = await adapter.fetchIncidents({ limit: 2, timeoutMs: 8000 });

      expect(result.adapterId).toBe('usgs');
      expect(result.attribution).toContain('USGS');
      expect(result.license).toContain('Public Domain');

      if (result.success && result.incidents.length > 0) {
        const inc = result.incidents[0];
        expect(inc.originType).toBe('live_feed');
        expect(inc.engineMode).toBe('external_feed');
        expect(inc.feedProvenance?.adapterId).toBe('usgs');
        expect(inc.analysis.category).toBe('earthquake');
        expect(inc.analysis.extractedLocation.spatialScope).toBe('macro_regional');
        expect(inc.analysis.extractedLocation.hasReliableCoords).toBe(true);
        expect(inc.analysis.eventTime.isEventOccurrenceTimeKnown).toBe(true);
        expect(inc.analysis.eventTime.isoTimestamp).toBeDefined();
      }
    },
    15000
  );

  it(
    'normalizes GDACS GeoJSON alerts preserving category, coordinates, and UN-OCHA attribution',
    async () => {
      const adapter = new GdacsSourceAdapter();
      const result = await adapter.fetchIncidents({ limit: 2, timeoutMs: 8000 });

      expect(result.adapterId).toBe('gdacs');
      expect(result.attribution).toContain('GDACS');

      if (result.success && result.incidents.length > 0) {
        const inc = result.incidents[0];
        expect(inc.originType).toBe('live_feed');
        expect(inc.engineMode).toBe('external_feed');
        expect(inc.feedProvenance?.adapterId).toBe('gdacs');
        expect(inc.analysis.extractedLocation.hasReliableCoords).toBe(true);
        expect(inc.primaryReport.isVerifiedSource).toBe(true);
      }
    },
    15000
  );

  it(
    'enforces 60-second rate-limiting cache in AdapterRegistry',
    async () => {
      const registry = new AdapterRegistry();

      // First call fetches
      const first = await registry.fetchAdapter('usgs', false);
      // Immediate second call should return cached result without hitting network
      const second = await registry.fetchAdapter('usgs', false);

      expect(second.retrievedAt).toBe(first.retrievedAt);
    },
    15000
  );
});

describe('Critical Engineering Correlation Audit', () => {
  const sampleQuakeA: Incident = {
    id: 'inc-quake-001',
    title: 'EARTHQUAKE: M 6.7 - Gulf of California',
    originType: 'live_feed',
    engineMode: 'external_feed',
    reviewStatus: 'unreviewed',
    conflictStatus: 'none',
    evidenceCompleteness: 'high',
    modelConfidence: { score: 0.95, label: 'high', isCalibrated: false, explanation: 'USGS NEIC' },
    primaryReport: {
      id: 'rep-q-01',
      sourceType: 'official_agency_feed',
      publisherOrCaller: 'USGS Seismology',
      sourcePublicationTime: '2026-10-24T05:00:00.000Z',
      rawReportText: 'M 6.7 earthquake in Gulf of California at depth of 10 km. Recorded at 04:55 UTC.',
      isVerifiedSource: true,
    },
    mergedReports: [],
    analysis: {
      category: 'earthquake',
      extractedLocation: {
        rawText: 'Gulf of California',
        normalizedName: 'Gulf of California',
        coordinates: { lat: 24.50, lng: -109.50 },
        hasReliableCoords: true,
        confidenceNote: 'USGS telemetry',
        spatialScope: 'macro_regional',
      },
      eventTime: {
        reportedTimeText: '04:55 UTC',
        isoTimestamp: '2026-10-24T04:55:00.000Z',
        isEventOccurrenceTimeKnown: true,
        confidenceNote: 'NEIC seismometer arrival calculation',
      },
      sourcePublicationTime: '2026-10-24T05:00:00.000Z',
      impactAssessment: {
        casualties: { count: 0, status: 'none', exactSpan: '' },
        injuries: { count: 0, status: 'none', exactSpan: '' },
        infrastructureImpact: ['Tsunami evaluation in progress'],
        urgentNeeds: [],
      },
      supportingSpans: [
        { statement: 'M 6.7 quake recorded', quoteSpan: 'M 6.7 earthquake', exactQuoteInSourceText: true }
      ],
      missingInformation: [],
      conflictingClaims: [],
      conciseSummary: 'M 6.7 earthquake in Gulf of California.',
      modelRawInterpretationNotes: '',
    },
    createdAt: '2026-10-24T04:55:00.000Z',
    updatedAt: '2026-10-24T05:00:00.000Z',
  };

  it('performs category-aware spatial scoping: recognizes earthquake shockwave at 45km', () => {
    // GDACS early warning for the same earthquake 45km away
    const sampleQuakeB: Incident = {
      ...sampleQuakeA,
      id: 'inc-quake-002',
      primaryReport: {
        ...sampleQuakeA.primaryReport,
        id: 'rep-q-02',
        publisherOrCaller: 'GDACS Alert Network',
      },
      analysis: {
        ...sampleQuakeA.analysis,
        extractedLocation: {
          rawText: 'Gulf of California Marine Zone',
          normalizedName: 'Gulf of California Marine Zone',
          coordinates: { lat: 24.80, lng: -109.75 }, // ~42 km away
          hasReliableCoords: true,
          confidenceNote: 'GDACS buoy',
          spatialScope: 'macro_regional',
        },
      },
    };

    const match = compareIncidents(sampleQuakeA, sampleQuakeB);
    // Because spatialScope is macro_regional, 42km is within the envelope!
    expect(match.locationProximity.score).toBeGreaterThanOrEqual(0.60);
    expect(match.locationProximity.note).toContain('macro-regional shockwave envelope');
    expect(match.recommendation).toBe('likely_duplicate');
  });

  it('enforces tight localized scoping for point-localized incidents (3.5km separated = distinct)', () => {
    // Two structural collapses 3.5km apart
    const collapseA: Incident = {
      ...sampleQuakeA,
      id: 'inc-col-1',
      title: 'COLLAPSE: Pier 14 Warehouse',
      analysis: {
        ...sampleQuakeA.analysis,
        category: 'structural_collapse',
        extractedLocation: {
          rawText: 'Pier 14',
          normalizedName: 'Pier 14',
          coordinates: { lat: 37.794, lng: -122.392 },
          hasReliableCoords: true,
          confidenceNote: 'Port GPS',
          spatialScope: 'point_localized',
        },
      },
    };

    const collapseB: Incident = {
      ...collapseA,
      id: 'inc-col-2',
      title: 'COLLAPSE: North Marina Shed',
      analysis: {
        ...collapseA.analysis,
        extractedLocation: {
          rawText: 'North Marina',
          normalizedName: 'North Marina',
          coordinates: { lat: 37.806, lng: -122.435 }, // ~3.8 km away
          hasReliableCoords: true,
          confidenceNote: 'Marina GPS',
          spatialScope: 'point_localized',
        },
      },
    };

    const match = compareIncidents(collapseA, collapseB);
    expect(match.locationProximity.score).toBeLessThanOrEqual(0.40);
    expect(match.recommendation).toBe('same_area_separate_incident');
  });

  it('strictly isolates event occurrence time vs reporting publication window', () => {
    // Incident with unknown event occurrence time
    const reportWithUnknownEventTime: Incident = {
      ...sampleQuakeA,
      id: 'inc-delayed-01',
      analysis: {
        ...sampleQuakeA.analysis,
        eventTime: {
          reportedTimeText: 'Time unspecified in report',
          isoTimestamp: undefined,
          isEventOccurrenceTimeKnown: false,
          confidenceNote: 'No event time provided',
        },
      },
    };

    const match = compareIncidents(sampleQuakeA, reportWithUnknownEventTime);
    expect(match.temporalProximity.comparisonBasis).toBe('reporting_publication_windows');
    expect(match.temporalProximity.note).toContain('Event occurrence time unknown');
  });

  it('preserves casualty breakdown and avoids double-counting during merge', () => {
    const reportA: Incident = {
      ...sampleQuakeA,
      id: 'inc-pri',
      analysis: {
        ...sampleQuakeA.analysis,
        impactAssessment: {
          ...sampleQuakeA.analysis.impactAssessment,
          casualties: {
            count: 3,
            status: 'confirmed',
            exactSpan: '3 bodies recovered from east rubble',
            claimsBreakdown: [
              {
                reportId: 'rep-01',
                publisher: 'Engine 4',
                count: 3,
                status: 'confirmed',
                reportedAt: '2026-10-24T05:00:00.000Z',
                scopeDescription: 'East Rubble',
              },
            ],
          },
        },
      },
    };

    const reportB: Incident = {
      ...sampleQuakeA,
      id: 'inc-sec',
      analysis: {
        ...sampleQuakeA.analysis,
        impactAssessment: {
          ...sampleQuakeA.analysis.impactAssessment,
          casualties: {
            count: 2,
            status: 'confirmed',
            exactSpan: '2 victims transported to morgue',
            claimsBreakdown: [
              {
                reportId: 'rep-02',
                publisher: 'Medic 8',
                count: 2,
                status: 'confirmed',
                reportedAt: '2026-10-24T05:15:00.000Z',
                scopeDescription: 'Triage Station',
              },
            ],
          },
        },
      },
    };

    const merged = mergeIncidentsWithProvenance(reportA, reportB, 'Supervisor Miller', 'Consolidate field medic logs');

    // Must NOT blindly sum 3 + 2 = 5!
    expect(merged.analysis.impactAssessment.casualties.count).not.toBe(5);
    expect(merged.analysis.impactAssessment.casualties.claimsBreakdown?.length).toBe(2);
    expect(merged.mergedReports.length).toBe(1);
    expect(merged.mergedReports[0].reportId).toBe('rep-q-01');
  });

  it('evaluates URL transport safety without treating HTTPS as institutional trust', () => {
    // Official institutional domain
    const usgsTrust = evaluateSourceUrlTrust('https://earthquake.usgs.gov/earthquakes/event/123');
    expect(usgsTrust.isSyntacticallySafe).toBe(true);
    expect(usgsTrust.isInstitutionalDomain).toBe(true);
    expect(usgsTrust.warning).toBeUndefined();

    // Random phishing/blog HTTPS domain
    const randomHttps = evaluateSourceUrlTrust('https://scam-emergency-news.xyz/breaking');
    expect(randomHttps.isSyntacticallySafe).toBe(true);
    expect(randomHttps.isInstitutionalDomain).toBe(false);
    expect(randomHttps.warning).toContain('Unverified third-party domain');

    // Dangerous scheme
    const scriptUri = evaluateSourceUrlTrust('javascript:stealKeys()');
    expect(scriptUri.isSyntacticallySafe).toBe(false);
  });

  it('unmistakably tags deterministic fallback as synthetic demo fixture', () => {
    const fallback = generateHeuristicFallback('Flooding on North Bridge', '2026-10-24T05:00:00.000Z');
    expect(fallback.originType).toBe('synthetic_demo');
    expect(fallback.engineMode).toBe('demo_fallback');
    expect(fallback.modelConfidence.explanation).toContain('[SYNTHETIC DEMO FIXTURE]');
  });
});
