/**
 * SignalBridge AI - Firestore Integration & Security Rule Verification Tests
 */

import { describe, it, expect } from 'vitest';
import { FirestoreIncidentStore } from '../storage/firestoreStore.ts';
import { handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { INITIAL_INCIDENTS } from '../../data/initialIncidents.ts';
import { Incident } from '../../types/incident.ts';

describe('Firestore Integration & Resilience', () => {
  it('instantiates FirestoreIncidentStore and adheres to IncidentStore interface', async () => {
    const store = new FirestoreIncidentStore();
    expect(store.providerName).toBe('firestore');
    expect(store.isCloudReady).toBe(true);

    const status = await store.getStorageStatus();
    expect(status.provider).toBe('firestore');
    expect(status.isEphemeral).toBe(false);
    expect(status.totalIncidents).toBeGreaterThan(0);
  });

  it('preserves human reviewer verification across idempotent upserts in Firestore store', async () => {
    const store = new FirestoreIncidentStore();
    const base = INITIAL_INCIDENTS[0];
    const testIncident: Incident = {
      ...base,
      id: 'test-firestore-001',
      reviewStatus: 'verified_by_reviewer',
      reviewedBy: 'Dr. Jane Chen (USGS Seismologist)',
      reviewedAt: new Date().toISOString(),
      reviewerNotes: 'Verified against primary station telemetry.',
      feedProvenance: {
        adapterId: 'usgs',
        feedName: 'USGS Real-Time Earthquake Feed',
        sourceId: 'us7000test',
        retrievedAt: new Date().toISOString(),
        attribution: 'USGS Earthquake Hazards Program',
        license: 'Public Domain',
      },
    };

    // Save initial verified record
    await store.saveIncident(testIncident);

    // Incoming raw feed re-sync with unreviewed status
    const incomingSync: Incident = {
      ...testIncident,
      reviewStatus: 'unreviewed',
      reviewedBy: undefined,
      reviewerNotes: undefined,
    };

    const upsertRes = await store.upsertIncidentsIdempotent([incomingSync]);
    expect(upsertRes.skipped).toBe(1);

    const stored = await store.getIncidentById('test-firestore-001');
    expect(stored?.reviewStatus).toBe('verified_by_reviewer');
    expect(stored?.reviewedBy).toBe('Dr. Jane Chen (USGS Seismologist)');
  });

  it('records audit log entries into immutable audit history', async () => {
    const store = new FirestoreIncidentStore();
    const log = await store.recordAuditLog({
      action: 'review_status_updated',
      incidentId: 'test-firestore-001',
      actor: 'touseefpanjtan52@gmail.com',
      details: { reviewStatus: 'verified_by_reviewer' },
      provenance: 'Audited by system administrator',
    });

    expect(log.id).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(log.actor).toBe('touseefpanjtan52@gmail.com');

    const logs = await store.getAuditLogs('test-firestore-001');
    expect(logs.some((l) => l.id === log.id)).toBe(true);
  });

  it('handleFirestoreError formats error conforming to FirestoreErrorInfo schema', () => {
    expect(() => {
      handleFirestoreError(
        new Error('Missing or insufficient permissions'),
        OperationType.WRITE,
        'incidents/test-unauthorized'
      );
    }).toThrowError(/operationType/);

    try {
      handleFirestoreError(
        new Error('Permission denied on path'),
        OperationType.GET,
        'audit_logs'
      );
    } catch (e: any) {
      const parsed = JSON.parse(e.message);
      expect(parsed.error).toContain('Permission denied');
      expect(parsed.operationType).toBe('get');
      expect(parsed.path).toBe('audit_logs');
      expect(parsed.authInfo).toBeDefined();
    }
  });
});
