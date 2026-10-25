/**
 * SignalBridge AI - Real-World Disaster Source Adapter Interfaces
 */

import { Incident, ExternalFeedStatus } from '../../types/incident.ts';

export interface SourceAdapterResult {
  adapterId: 'usgs' | 'gdacs';
  success: boolean;
  incidents: Incident[];
  retrievedAt: string;
  itemCount: number;
  feedUrl: string;
  error?: string;
  attribution: string;
  license: string;
}

export interface DisasterSourceAdapter {
  id: 'usgs' | 'gdacs';
  name: string;
  feedUrl: string;
  attribution: string;
  license: string;
  fetchIncidents(options?: { limit?: number; timeoutMs?: number }): Promise<SourceAdapterResult>;
}
