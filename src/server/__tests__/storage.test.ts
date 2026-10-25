/**
 * Unit & Integration Tests: Persistent Storage & Audit Log Engine
 * Tests MemoryIncidentStore:
 * 1. Idempotent upsert with stable source keys (preventing duplicates on sync)
 * 2. Preservation of human reviewer decisions and audit notes across feed re-syncs
 * 3. Immutable audit trail logging and retrieval
 * 4. Multi-attribute querying and filtering
 * 5. Safe handling without cloud credentials
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryIncidentStore } from '../storage/memoryStore.ts';
import { Incident } from '../../types/incident.ts';

describe('MemoryIncidentStore & Audit Logging', () => {
  let store: MemoryIncidentStore;

  const sampleIncident: Incident = {
    id: 'inc-test-001',
    title: 'Flash Flood on River Rd',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    reviewStatus: 'unreviewed',
    conflictStatus: 'none',
    originType: 'live_feed',
    engineMode: 'external_feed',
    feedProvenance: {
      adapterId: 'gdacs',
      feedName: 'GDACS Real-Time Feeds',
      sourceId: 'gdacs-flood-101',
      retrievedAt: '2026-10-24T00:00:00.000Z',
      attribution: 'UN-OCHA / EC-JRC',
      license: 'Public Domain',
    },
    primaryReport: {
      id: 'rep-test-001',
      rawReportText: 'Severe flooding along River Rd due to river cresting.',
      sourceType: 'first_responder',
      publisherOrCaller: 'County Dispatch',
      sourceUrl: 'https://gdacs.org/alert/101',
      sourcePublicationTime: '2026-10-24T00:00:00.000Z',
      isVerifiedSource: true,
    },
    analysis: {
      category: 'flood',
      extractedLocation: {
        rawText: 'River Rd',
        normalizedName: 'River Road Crossing',
        hasReliableCoords: true,
        coordinates: {
          lat: 38.123,
          lng: -121.456,
        },
        confidenceNote: 'GPS telemetry verified',
        spatialScope: 'point_localized',
      },
      eventTime: {
        reportedTimeText: '2026-10-23T23:30:00.000Z',
        isoTimestamp: '2026-10-23T23:30:00.000Z',
        confidenceNote: 'Dispatch log timestamp',
        isEventOccurrenceTimeKnown: true,
      },
      sourcePublicationTime: '2026-10-24T00:00:00.000Z',
      impactAssessment: {
        casualties: { count: 0, status: 'none', exactSpan: 'none reported' },
        injuries: { count: 0, status: 'none', exactSpan: 'none reported' },
        infrastructureImpact: ['Road submerged under 3ft water'],
        urgentNeeds: [],
      },
      supportingSpans: [
        {
          statement: 'Road submerged under 3ft water',
          quoteSpan: 'Severe flooding along River Rd',
          exactQuoteInSourceText: true,
        },
      ],
      conciseSummary: 'River Rd submerged by cresting river.',
      missingInformation: [],
      conflictingClaims: [],
      modelRawInterpretationNotes: '',
    },
    evidenceCompleteness: 'high',
    modelConfidence: {
      score: 0.88,
      label: 'high',
      isCalibrated: false,
      explanation: 'Verified feed data',
    },
    mergedReports: [],
  };


  beforeEach(() => {
    // Initialize clean store without seed data for isolated unit tests
    store = new MemoryIncidentStore([]);
  });

  it('saves and retrieves an incident by ID', async () => {
    await store.saveIncident(sampleIncident);
    const retrieved = await store.getIncidentById(sampleIncident.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(sampleIncident.id);
    expect(retrieved?.title).toBe(sampleIncident.title);
  });

  it('performs idempotent upsert when receiving identical feed items', async () => {
    // Initial insert
    const result1 = await store.upsertIncidentsIdempotent([sampleIncident]);
    expect(result1.inserted).toBe(1);
    expect(result1.updated).toBe(0);
    expect(result1.skipped).toBe(0);

    // Repeated ingestion with exact same data
    const result2 = await store.upsertIncidentsIdempotent([sampleIncident]);
    expect(result2.inserted).toBe(0);
    expect(result2.updated).toBe(0);
    expect(result2.skipped).toBe(1);

    const all = await store.getAllIncidents();
    expect(all.length).toBe(1);
  });

  it('preserves human reviewer decisions when an external feed re-syncs updated information', async () => {
    // 1. Initial feed ingestion
    await store.upsertIncidentsIdempotent([sampleIncident]);

    // 2. Human reviewer validates the incident and records notes
    const reviewedIncident: Incident = {
      ...sampleIncident,
      reviewStatus: 'verified_by_reviewer',
      reviewedBy: 'Senior Operator Sarah (Badge #404)',
      reviewerNotes: 'Verified with County Emergency Management dispatch log.',
    };
    await store.saveIncident(reviewedIncident);

    // 3. External feed pushes updated summary
    const updatedFromFeed: Incident = {
      ...sampleIncident,
      title: 'Flash Flood on River Rd (Updated Magnitude)',
      analysis: {
        ...sampleIncident.analysis,
        conciseSummary: 'Updated: River cresting at 14.2 ft, 2 crossings closed.',
      },
    };

    const result = await store.upsertIncidentsIdempotent([updatedFromFeed]);
    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);

    // 4. Verify that human verification and notes were NOT overwritten by feed update!
    const stored = await store.getIncidentById(sampleIncident.id);
    expect(stored?.title).toBe('Flash Flood on River Rd (Updated Magnitude)');
    expect(stored?.reviewStatus).toBe('verified_by_reviewer');
    expect(stored?.reviewedBy).toBe('Senior Operator Sarah (Badge #404)');
    expect(stored?.reviewerNotes).toContain('Verified with County Emergency Management');
  });

  it('records audit log entries and retrieves them in reverse chronological order', async () => {
    await store.recordAuditLog({
      action: 'incident_ingested',
      incidentId: sampleIncident.id,
      actor: 'System Ingest Worker',
      details: { origin: 'gdacs_rss' },
      provenance: 'Automated live feed polling',
    });

    await store.recordAuditLog({
      action: 'review_status_updated',
      incidentId: sampleIncident.id,
      actor: 'Dispatcher Ryan',
      details: { reviewStatus: 'verified_by_reviewer' },
      provenance: 'Manual dispatcher review action',
    });

    const logs = await store.getAuditLogs(10);
    expect(logs.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    expect(logs[0].action).toBe('review_status_updated');
    expect(logs[0].actor).toBe('Dispatcher Ryan');
    expect(logs[1].action).toBe('incident_ingested');
  });

  it('filters incidents accurately by category, reviewStatus, and originType', async () => {
    const earthquakeIncident: Incident = {
      ...sampleIncident,
      id: 'inc-eq-002',
      originType: 'synthetic_demo',
      reviewStatus: 'verified_by_reviewer',
      analysis: {
        ...sampleIncident.analysis,
        category: 'earthquake',
      },
      feedProvenance: {
        adapterId: 'usgs',
        feedName: 'USGS Real-Time Earthquake Hazards',
        sourceId: 'usgs-eq-999',
        retrievedAt: '2026-10-24T00:00:00.000Z',
        attribution: 'US Geological Survey',
        license: 'U.S. Public Domain',
      },
    };

    await store.upsertIncidentsIdempotent([sampleIncident, earthquakeIncident]);

    // Category filter
    const floods = await store.getAllIncidents({ category: 'flood' });
    expect(floods.length).toBe(1);
    expect(floods[0].id).toBe(sampleIncident.id);

    const quakes = await store.getAllIncidents({ category: 'earthquake' });
    expect(quakes.length).toBe(1);
    expect(quakes[0].id).toBe(earthquakeIncident.id);

    // Review status filter
    const unreviewed = await store.getAllIncidents({ reviewStatus: 'unreviewed' });
    expect(unreviewed.length).toBe(1);
    expect(unreviewed[0].id).toBe(sampleIncident.id);

    const verified = await store.getAllIncidents({ reviewStatus: 'verified_by_reviewer' });
    expect(verified.length).toBe(1);
    expect(verified[0].id).toBe(earthquakeIncident.id);

    // Origin type filter
    const liveFeeds = await store.getAllIncidents({ originType: 'live_feed' });
    expect(liveFeeds.length).toBe(1);
    expect(liveFeeds[0].id).toBe(sampleIncident.id);
  });

  it('exposes accurate storage status reporting memory mode when cloud credentials are unset', async () => {
    const status = await store.getStorageStatus();
    expect(status.provider).toBe('memory_fallback');
    expect(status.isEphemeral).toBe(true);
    expect(status.isCloudReady).toBe(false);
    expect(typeof status.totalIncidents).toBe('number');
  });
});
