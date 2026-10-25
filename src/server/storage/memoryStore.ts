/**
 * SignalBridge AI - Modular In-Memory Incident & Audit Store
 * Provides idempotent ingestion using stable source IDs, audit logging,
 * and seamless fallback when cloud database credentials are not present.
 */

import { Incident, ReviewStatus } from '../../types/incident.ts';
import { INITIAL_INCIDENTS } from '../../data/initialIncidents.ts';
import { IncidentStore, AuditLogEntry, UpsertResult } from './types.ts';
import { logger } from '../logger.ts';

export class MemoryIncidentStore implements IncidentStore {
  providerName = 'memory_fallback' as const;
  isCloudReady = false;
  statusMessage = 'In-Memory Repository Active (Cloud Firestore unconfigured)';

  private incidents: Map<string, Incident> = new Map();
  // Stable source ID mapping to prevent duplicate records during repeated feed sync
  private sourceIdToIncidentId: Map<string, string> = new Map();
  private auditLogs: AuditLogEntry[] = [];

  constructor(initialData?: Incident[]) {
    const seed = initialData || INITIAL_INCIDENTS;
    for (const inc of seed) {
      this.incidents.set(inc.id, inc);
      const stableSourceKey = this.extractStableSourceKey(inc);
      if (stableSourceKey) {
        this.sourceIdToIncidentId.set(stableSourceKey, inc.id);
      }
    }

    // Seed baseline audit records
    this.recordAuditLog({
      action: 'incident_ingested',
      incidentId: seed[0]?.id || 'seed',
      actor: 'System Bootstrap',
      details: { count: seed.length, mode: 'initial_seed' },
      provenance: 'Application initial seed fixtures',
    });
  }

  private extractStableSourceKey(incident: Incident): string | null {
    if (incident.feedProvenance?.sourceId) {
      return `${incident.feedProvenance.adapterId}:${incident.feedProvenance.sourceId}`;
    }
    if (incident.primaryReport?.id) {
      return `report:${incident.primaryReport.id}`;
    }
    return null;
  }

  async getAllIncidents(filter?: {
    category?: string;
    reviewStatus?: ReviewStatus;
    originType?: string;
  }): Promise<Incident[]> {
    let list = Array.from(this.incidents.values());

    if (filter?.category && filter.category !== 'all') {
      list = list.filter((i) => i.analysis.category === filter.category);
    }
    if (filter?.reviewStatus && (filter.reviewStatus as string) !== 'all') {
      list = list.filter((i) => i.reviewStatus === filter.reviewStatus);
    }
    if (filter?.originType && filter.originType !== 'all') {
      list = list.filter((i) => i.originType === filter.originType);
    }

    // Sort descending by updated timestamp
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    return this.incidents.get(id) || null;
  }

  async saveIncident(incident: Incident): Promise<Incident> {
    const now = new Date().toISOString();
    const existing = this.incidents.get(incident.id);
    const updatedIncident: Incident = {
      ...incident,
      updatedAt: now,
      createdAt: existing ? existing.createdAt : incident.createdAt || now,
    };

    this.incidents.set(incident.id, updatedIncident);
    const stableSourceKey = this.extractStableSourceKey(updatedIncident);
    if (stableSourceKey) {
      this.sourceIdToIncidentId.set(stableSourceKey, updatedIncident.id);
    }

    return updatedIncident;
  }

  /**
   * Idempotent ingestion: skips duplicates or updates if matching stable source ID exists.
   */
  async upsertIncidentsIdempotent(incoming: Incident[]): Promise<UpsertResult> {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const inc of incoming) {
      const stableKey = this.extractStableSourceKey(inc);
      let targetId = inc.id;

      if (stableKey && this.sourceIdToIncidentId.has(stableKey)) {
        targetId = this.sourceIdToIncidentId.get(stableKey)!;
      }

      const existing = this.incidents.get(targetId);
      if (existing) {
        // Compare if anything meaningful changed
        const isIdentical =
          existing.title === inc.title &&
          existing.analysis.conciseSummary === inc.analysis.conciseSummary &&
          existing.primaryReport.sourcePublicationTime === inc.primaryReport.sourcePublicationTime;

        if (isIdentical) {
          skipped++;
        } else {
          // Update record while preserving human review status and reviewer audit notes!
          const merged: Incident = {
            ...inc,
            id: targetId,
            reviewStatus: existing.reviewStatus, // Preserve human review status!
            reviewerNotes: existing.reviewerNotes,
            reviewedBy: existing.reviewedBy,
            reviewedAt: existing.reviewedAt,
            mergedReports: existing.mergedReports,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
          };
          this.incidents.set(targetId, merged);
          updated++;
        }
      } else {
        // Insert new record
        this.incidents.set(targetId, inc);
        if (stableKey) {
          this.sourceIdToIncidentId.set(stableKey, targetId);
        }
        inserted++;
      }
    }

    logger.info('Idempotent ingestion completed', {
      feedSync: {
        adapterId: incoming[0]?.feedProvenance?.adapterId || 'unknown',
        status: 'success',
        recordsRetrieved: incoming.length,
        recordsNormalized: incoming.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsRejected: 0,
        durationMs: 0,
      },
    });

    return { inserted, updated, skipped };
  }

  async deleteIncident(id: string): Promise<boolean> {
    const inc = this.incidents.get(id);
    if (!inc) return false;
    const stableKey = this.extractStableSourceKey(inc);
    if (stableKey) this.sourceIdToIncidentId.delete(stableKey);
    return this.incidents.delete(id);
  }

  async recordAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const log: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.unshift(log); // Prepend latest
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop(); // Cap memory at 500 records
    }
    return log;
  }

  async getAuditLogs(incidentIdOrLimit?: string | number, limit: number = 50): Promise<AuditLogEntry[]> {
    if (typeof incidentIdOrLimit === 'number') {
      return this.auditLogs.slice(0, incidentIdOrLimit);
    }
    if (typeof incidentIdOrLimit === 'string') {
      return this.auditLogs.filter((a) => a.incidentId === incidentIdOrLimit).slice(0, limit);
    }
    return this.auditLogs.slice(0, limit);
  }

  async getStorageStatus() {
    return {
      provider: this.providerName,
      isEphemeral: true,
      isCloudReady: this.isCloudReady,
      statusMessage: this.statusMessage,
      totalIncidents: this.incidents.size,
      totalAuditLogs: this.auditLogs.length,
    };
  }
}

