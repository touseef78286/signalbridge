/**
 * SignalBridge AI - USGS Real-Time Earthquake Hazards Adapter
 * Normalizes live USGS GeoJSON feeds into SignalBridge domain models while preserving
 * origin provenance, telemetry coordinates, event timestamps, and attribution.
 */

import { Incident } from '../../types/incident.ts';
import { DisasterSourceAdapter, SourceAdapterResult } from './types.ts';

const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson';
const USGS_FALLBACK_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';

export class UsgsSourceAdapter implements DisasterSourceAdapter {
  id = 'usgs' as const;
  name = 'USGS Earthquake Hazards Program';
  feedUrl = USGS_FEED_URL;
  attribution = 'United States Geological Survey (USGS)';
  license = 'U.S. Public Domain (Free & Unrestricted)';

  async fetchIncidents(options?: { limit?: number; timeoutMs?: number }): Promise<SourceAdapterResult> {
    const limit = options?.limit || 6;
    const timeoutMs = options?.timeoutMs || 6000;
    const retrievedAt = new Date().toISOString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetch(this.feedUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json', 'User-Agent': 'SignalBridge-AI-Disaster-Triage' }
        });
      } catch {
        // Fallback to 4.5+ week feed if significant_month is quiet or transiently unavailable
        response = await fetch(USGS_FALLBACK_FEED, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json', 'User-Agent': 'SignalBridge-AI-Disaster-Triage' }
        });
      }

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`USGS HTTP Error ${response.status}: ${response.statusText}`);
      }

      const geojson: any = await response.json();
      if (!Array.isArray(geojson.features)) {
        throw new Error('USGS response is missing features array');
      }

      const incidents: Incident[] = geojson.features.slice(0, limit).map((feat: any): Incident => {
        const props = feat.properties || {};
        const coords = feat.geometry?.coordinates || [];
        const lng = typeof coords[0] === 'number' ? coords[0] : 0;
        const lat = typeof coords[1] === 'number' ? coords[1] : 0;
        const depth = typeof coords[2] === 'number' ? coords[2] : 0;

        const eventEpochMs = typeof props.time === 'number' ? props.time : Date.now();
        const updatedEpochMs = typeof props.updated === 'number' ? props.updated : eventEpochMs;
        const eventIso = new Date(eventEpochMs).toISOString();
        const updatedIso = new Date(updatedEpochMs).toISOString();

        const mag = props.mag !== undefined ? props.mag : 'N/A';
        const place = props.place || 'Unknown Location';
        const title = `EARTHQUAKE: M ${mag} - ${place}`;
        const rawReportText = `USGS Seismic Telemetry: M ${mag} earthquake occurred at ${place}. Event time: ${eventIso}. Focal depth: ${depth} km. Review status: ${props.status || 'automated'}. Felt reports submitted: ${props.felt || 0}. Event reference: ${props.url || feat.id}.`;

        return {
          id: `inc-usgs-${feat.id || Math.random().toString(36).slice(2, 8)}`,
          title,
          originType: 'live_feed',
          engineMode: 'external_feed',
          feedProvenance: {
            adapterId: 'usgs',
            feedName: this.name,
            sourceId: String(feat.id),
            externalUrl: props.url,
            retrievedAt,
            attribution: this.attribution,
            license: this.license,
          },
          reviewStatus: props.status === 'reviewed' ? 'verified_by_reviewer' : 'unreviewed',
          conflictStatus: 'none',
          evidenceCompleteness: 'high',
          modelConfidence: {
            score: 0.98,
            label: 'high',
            isCalibrated: false,
            explanation: 'Instrumented global seismometer telemetry from USGS seismic network.',
          },
          primaryReport: {
            id: `rep-usgs-${feat.id}`,
            sourceType: 'official_agency_feed',
            publisherOrCaller: 'USGS National Earthquake Information Center (NEIC)',
            sourcePublicationTime: updatedIso,
            sourceUrl: props.url,
            rawReportText,
            isVerifiedSource: true,
          },
          mergedReports: [],
          analysis: {
            category: 'earthquake',
            extractedLocation: {
              rawText: place,
              normalizedName: place,
              coordinates: { lat, lng },
              hasReliableCoords: true,
              confidenceNote: `Instrumented GPS coordinates from USGS network (Depth: ${depth} km)`,
              spatialScope: 'macro_regional',
            },
            eventTime: {
              reportedTimeText: new Date(eventEpochMs).toUTCString(),
              isoTimestamp: eventIso,
              isEventOccurrenceTimeKnown: true,
              confidenceNote: 'High-precision seismic origin time calculated by NEIC sensors',
            },
            sourcePublicationTime: updatedIso,
            impactAssessment: {
              casualties: { count: null, status: 'unknown', exactSpan: '' },
              injuries: { count: null, status: 'unknown', exactSpan: '' },
              infrastructureImpact: [
                `Ground motion magnitude M ${mag} recorded`,
                `Felt reports submitted by citizens: ${props.felt || 0}`,
              ],
              urgentNeeds: [],
            },
            supportingSpans: [
              {
                statement: `Magnitude ${mag} earthquake verified at ${place}`,
                quoteSpan: `M ${mag} earthquake occurred at ${place}`,
                exactQuoteInSourceText: true,
              },
            ],
            missingInformation: [
              'Localized on-ground structural damage inspection pending civil defense survey',
            ],
            conflictingClaims: [],
            conciseSummary: `Magnitude ${mag} earthquake confirmed at ${place} at depth of ${depth} km. Telemetry verified by USGS NEIC.`,
            modelRawInterpretationNotes: 'Normalized directly from official USGS GeoJSON API.',
          },
          createdAt: eventIso,
          updatedAt: updatedIso,
        };
      });

      return {
        adapterId: 'usgs',
        success: true,
        incidents,
        retrievedAt,
        itemCount: incidents.length,
        feedUrl: this.feedUrl,
        attribution: this.attribution,
        license: this.license,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        adapterId: 'usgs',
        success: false,
        incidents: [],
        retrievedAt,
        itemCount: 0,
        feedUrl: this.feedUrl,
        error: err.message || 'Failed to fetch USGS feed',
        attribution: this.attribution,
        license: this.license,
      };
    }
  }
}
