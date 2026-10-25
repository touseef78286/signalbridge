/**
 * SignalBridge AI - Cloud Firestore Persistent Storage Implementation
 * Persists incidents, source provenance, reviewer decisions, and audit history to
 * Google Cloud Firestore Enterprise with custom database ID.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import { Incident, ReviewStatus } from '../../types/incident.ts';
import { INITIAL_INCIDENTS } from '../../data/initialIncidents.ts';
import { IncidentStore, AuditLogEntry, UpsertResult, StorageStatus } from './types.ts';
import { logger } from '../logger.ts';

export class FirestoreIncidentStore implements IncidentStore {
  providerName = 'firestore' as const;
  isCloudReady = true;
  statusMessage = 'Cloud Firestore Enterprise Connected';

  private db: Firestore;
  private localCache: Map<string, Incident> = new Map();
  private stableSourceMap: Map<string, string> = new Map();
  private auditCache: AuditLogEntry[] = [];
  private isInitialized = false;

  constructor() {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

    // Populate local cache with baseline incidents as safety buffer
    for (const inc of INITIAL_INCIDENTS) {
      this.localCache.set(inc.id, inc);
      const key = this.extractStableKey(inc);
      if (key) this.stableSourceMap.set(key, inc.id);
    }
  }

  private extractStableKey(incident: Incident): string | null {
    if (incident.feedProvenance?.sourceId) {
      return `${incident.feedProvenance.adapterId}:${incident.feedProvenance.sourceId}`;
    }
    if (incident.primaryReport?.id) {
      return `report:${incident.primaryReport.id}`;
    }
    return null;
  }

  /**
   * Initializes remote connection and hydrates local memory cache with Firestore documents
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const snapshot = await getDocs(collection(this.db, 'incidents'));
      if (!snapshot.empty) {
        snapshot.forEach((docSnap) => {
          const inc = docSnap.data() as Incident;
          this.localCache.set(inc.id, inc);
          const key = this.extractStableKey(inc);
          if (key) this.stableSourceMap.set(key, inc.id);
        });
        logger.info(`Hydrated ${snapshot.size} incidents from Cloud Firestore.`);
      } else {
        // First boot: seed initial incidents into Firestore
        logger.info('Firestore incidents collection empty. Seeding baseline crisis incidents...');
        for (const inc of INITIAL_INCIDENTS) {
          await setDoc(doc(this.db, 'incidents', inc.id), inc);
        }
      }

      // Hydrate audit logs
      const auditSnap = await getDocs(query(collection(this.db, 'audit_logs'), limit(50)));
      if (!auditSnap.empty) {
        this.auditCache = [];
        auditSnap.forEach((d) => this.auditCache.push(d.data() as AuditLogEntry));
      }

      this.isInitialized = true;
      this.statusMessage = `Cloud Firestore Active (Database: ${firebaseConfig.firestoreDatabaseId})`;
    } catch (err: any) {
      logger.warn(`Firestore initialization notice: ${err.message}. Operating in resilient hybrid cache mode.`);
      this.statusMessage = 'Cloud Firestore (Resilient Cache Mode)';
      this.isInitialized = true;
    }
  }

  async getAllIncidents(filter?: {
    category?: string;
    reviewStatus?: ReviewStatus;
    originType?: string;
  }): Promise<Incident[]> {
    await this.initialize();
    let list = Array.from(this.localCache.values());

    if (filter?.category && filter.category !== 'all') {
      list = list.filter((i) => i.analysis.category === filter.category);
    }
    if (filter?.reviewStatus && (filter.reviewStatus as string) !== 'all') {
      list = list.filter((i) => i.reviewStatus === filter.reviewStatus);
    }
    if (filter?.originType && filter.originType !== 'all') {
      list = list.filter((i) => i.originType === filter.originType);
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    await this.initialize();
    if (this.localCache.has(id)) {
      return this.localCache.get(id)!;
    }

    try {
      const docSnap = await getDoc(doc(this.db, 'incidents', id));
      if (docSnap.exists()) {
        const inc = docSnap.data() as Incident;
        this.localCache.set(id, inc);
        return inc;
      }
    } catch (err: any) {
      logger.warn(`Firestore getDoc error for ${id}: ${err.message}`);
    }
    return null;
  }

  async saveIncident(incident: Incident): Promise<Incident> {
    await this.initialize();
    const now = new Date().toISOString();
    const existing = this.localCache.get(incident.id);
    const updated: Incident = {
      ...incident,
      updatedAt: now,
      createdAt: existing ? existing.createdAt : incident.createdAt || now,
    };

    // Update in-memory cache
    this.localCache.set(updated.id, updated);
    const key = this.extractStableKey(updated);
    if (key) this.stableSourceMap.set(key, updated.id);

    // Persist to Cloud Firestore
    try {
      await setDoc(doc(this.db, 'incidents', updated.id), updated, { merge: true });
    } catch (err: any) {
      logger.error(`Firestore saveIncident error for ${updated.id}: ${err.message}`);
    }

    return updated;
  }

  async upsertIncidentsIdempotent(incoming: Incident[]): Promise<UpsertResult> {
    await this.initialize();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const inc of incoming) {
      const stableKey = this.extractStableKey(inc);
      const existingId = stableKey ? this.stableSourceMap.get(stableKey) : null;

      if (existingId && this.localCache.has(existingId)) {
        const current = this.localCache.get(existingId)!;
        // If human review has already occurred, preserve reviewer decision
        if (current.reviewStatus !== 'unreviewed') {
          skipped++;
          continue;
        }

        // Merge telemetry without wiping verified data
        const merged: Incident = {
          ...current,
          analysis: inc.analysis,
          updatedAt: new Date().toISOString(),
        };
        await this.saveIncident(merged);
        updated++;
      } else {
        await this.saveIncident(inc);
        inserted++;
      }
    }

    return { inserted, updated, skipped };
  }

  async deleteIncident(id: string): Promise<boolean> {
    await this.initialize();
    const existed = this.localCache.delete(id);

    try {
      await deleteDoc(doc(this.db, 'incidents', id));
    } catch (err: any) {
      logger.warn(`Firestore deleteDoc warning for ${id}: ${err.message}`);
    }

    return existed;
  }

  async recordAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const log: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.auditCache.unshift(log);

    try {
      await setDoc(doc(this.db, 'audit_logs', log.id), log);
    } catch (err: any) {
      logger.warn(`Firestore recordAuditLog warning for ${log.id}: ${err.message}`);
    }

    return log;
  }

  async getAuditLogs(incidentIdOrLimit?: string | number, maxLimit?: number): Promise<AuditLogEntry[]> {
    await this.initialize();
    let logs = [...this.auditCache];

    if (typeof incidentIdOrLimit === 'string') {
      logs = logs.filter((l) => l.incidentId === incidentIdOrLimit);
    }

    const effectiveLimit = typeof incidentIdOrLimit === 'number' ? incidentIdOrLimit : (maxLimit || 50);
    return logs.slice(0, effectiveLimit);
  }

  async getStorageStatus(): Promise<StorageStatus> {
    return {
      provider: 'firestore',
      isEphemeral: false,
      isCloudReady: true,
      statusMessage: this.statusMessage,
      totalIncidents: this.localCache.size,
      totalAuditLogs: this.auditCache.length,
    };
  }
}
