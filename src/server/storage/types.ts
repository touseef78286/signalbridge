/**
 * SignalBridge AI - Modular Storage Interfaces & Audit Types
 */

import { Incident, ReviewStatus } from '../../types/incident.ts';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action:
    | 'incident_ingested'
    | 'analysis_completed'
    | 'review_status_updated'
    | 'incidents_merged'
    | 'candidates_kept_separate'
    | 'candidate_marked_uncertain'
    | 'feed_synced';
  incidentId: string;
  actor: string;
  details: Record<string, any>;
  provenance: string;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface StorageStatus {
  provider: 'memory_fallback' | 'firestore';
  isEphemeral: boolean;
  isCloudReady: boolean;
  statusMessage: string;
  totalIncidents: number;
  totalAuditLogs: number;
}

export interface IncidentStore {
  providerName: 'memory_fallback' | 'firestore';
  isCloudReady: boolean;
  statusMessage: string;

  getAllIncidents(filter?: {
    category?: string;
    reviewStatus?: ReviewStatus;
    originType?: string;
  }): Promise<Incident[]>;

  getIncidentById(id: string): Promise<Incident | null>;

  saveIncident(incident: Incident): Promise<Incident>;

  upsertIncidentsIdempotent(incidents: Incident[]): Promise<UpsertResult>;

  deleteIncident(id: string): Promise<boolean>;

  recordAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry>;

  getAuditLogs(incidentIdOrLimit?: string | number, limit?: number): Promise<AuditLogEntry[]>;

  getStorageStatus(): Promise<StorageStatus>;
}

