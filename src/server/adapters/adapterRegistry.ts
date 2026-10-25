/**
 * SignalBridge AI - Unified Disaster Source Adapter Registry
 * Manages external data sources with safe request limits, 60s in-memory caching,
 * structured feed health tracking, and transparent error reporting.
 */

import { Incident, ExternalFeedStatus } from '../../types/incident.ts';
import { DisasterSourceAdapter, SourceAdapterResult } from './types.ts';
import { UsgsSourceAdapter } from './usgsAdapter.ts';
import { GdacsSourceAdapter } from './gdacsAdapter.ts';

interface CacheEntry {
  data: SourceAdapterResult;
  cachedAt: number;
}

export class AdapterRegistry {
  private adapters: Map<string, DisasterSourceAdapter> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds rate-limit cache

  private feedStatuses: Map<string, ExternalFeedStatus> = new Map([
    [
      'usgs',
      {
        id: 'usgs',
        name: 'USGS Earthquake Hazards Program',
        endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson',
        status: 'not_polled',
        itemCount: 0,
      },
    ],
    [
      'gdacs',
      {
        id: 'gdacs',
        name: 'Global Disaster Alert and Coordination System (GDACS)',
        endpoint: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/map',
        status: 'not_polled',
        itemCount: 0,
      },
    ],
  ]);

  constructor() {
    this.registerAdapter(new UsgsSourceAdapter());
    this.registerAdapter(new GdacsSourceAdapter());
  }

  registerAdapter(adapter: DisasterSourceAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getFeedStatuses(): ExternalFeedStatus[] {
    return Array.from(this.feedStatuses.values());
  }

  async fetchAdapter(
    adapterId: 'usgs' | 'gdacs',
    forceFresh: boolean = false
  ): Promise<SourceAdapterResult> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new Error(`Unknown source adapter: ${adapterId}`);
    }

    const now = Date.now();
    const cached = this.cache.get(adapterId);

    // Return cached results if within TTL and not forcing refresh
    if (!forceFresh && cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const result = await adapter.fetchIncidents({ limit: 6, timeoutMs: 6000 });

    const statusObj = this.feedStatuses.get(adapterId) || {
      id: adapterId,
      name: adapter.name,
      endpoint: adapter.feedUrl,
      status: 'not_polled',
      itemCount: 0,
    };

    if (result.success) {
      statusObj.status = 'healthy';
      statusObj.lastSuccessfulFetch = result.retrievedAt;
      statusObj.itemCount = result.itemCount;
      statusObj.lastErrorMessage = undefined;
      this.cache.set(adapterId, { data: result, cachedAt: now });
    } else {
      statusObj.status = 'unavailable';
      statusObj.lastErrorMessage = result.error;
    }

    this.feedStatuses.set(adapterId, statusObj);
    return result;
  }

  async fetchAllLiveIncidents(forceFresh: boolean = false): Promise<{
    incidents: Incident[];
    feedStatuses: ExternalFeedStatus[];
  }> {
    const results = await Promise.allSettled([
      this.fetchAdapter('usgs', forceFresh),
      this.fetchAdapter('gdacs', forceFresh),
    ]);

    const incidents: Incident[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.success) {
        incidents.push(...res.value.incidents);
      }
    }

    return {
      incidents,
      feedStatuses: this.getFeedStatuses(),
    };
  }
}

export const globalAdapterRegistry = new AdapterRegistry();
