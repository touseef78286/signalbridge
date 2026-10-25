/**
 * SignalBridge AI - Main Application Entry (Phase 3)
 * Evidence-grounded disaster crisis incident triage, live public feeds (USGS / GDACS),
 * category-aware candidate duplicate resolution, and reviewer provenance audit.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Incident, ReviewStatus, ExternalFeedStatus } from './types/incident.ts';
import { INITIAL_INCIDENTS } from './data/initialIncidents.ts';
import { findDuplicateCandidates, mergeIncidentsWithProvenance } from './server/duplicateEngine.ts';
import { Header } from './components/Header.tsx';
import { MetricsBar } from './components/MetricsBar.tsx';
import { IncidentList } from './components/IncidentList.tsx';
import { IncidentDetail } from './components/IncidentDetail.tsx';
import { DuplicateReviewModal } from './components/DuplicateReviewModal.tsx';
import { IngestReportModal } from './components/IngestReportModal.tsx';
import { TestRunnerView } from './components/TestRunnerView.tsx';
import { AuditLogModal } from './components/AuditLogModal.tsx';
import { StorageStatus } from './server/storage/types.ts';
import { auth, signInWithGoogle, logOut, testFirestoreConnection } from './lib/firebase.ts';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    const saved = localStorage.getItem('signalbridge_incidents_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_INCIDENTS;
      }
    }
    return INITIAL_INCIDENTS;
  });

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(() => {
    return incidents[0]?.id || null;
  });

  const [activeTab, setActiveTab] = useState<'incidents' | 'test-suite'>('incidents');
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isFetchingFeeds, setIsFetchingFeeds] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string | undefined>(undefined);
  const [feedStatuses, setFeedStatuses] = useState<ExternalFeedStatus[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    targetIncident: Incident | null;
    candidateIncident: Incident | null;
  }>({
    isOpen: false,
    targetIncident: null,
    candidateIncident: null,
  });

  const [apiStatus, setApiStatus] = useState<{
    ok: boolean;
    geminiConfigured: boolean;
  }>({
    ok: true,
    geminiConfigured: false,
  });

  // Test Firebase Firestore connection & subscribe to Firebase Auth on mount
  useEffect(() => {
    testFirestoreConnection().then((res) => {
      console.info('[SignalBridge AI] Firebase Firestore status:', res.message);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };


  // Sync incidents to localStorage
  useEffect(() => {
    localStorage.setItem('signalbridge_incidents_v3', JSON.stringify(incidents));
  }, [incidents]);

  // Check backend server health, storage status, and feed statuses
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setApiStatus({
            ok: true,
            geminiConfigured: data.geminiConfigured,
          });
        }
      })
      .catch((err) => {
        console.warn('Backend API health check unreachable:', err);
      });

    fetch('/api/storage/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.status) {
          setStorageStatus(data.status);
        }
      })
      .catch((err) => {
        console.warn('Storage status check unreachable:', err);
      });

    fetch('/api/feeds/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.statuses)) {
          setFeedStatuses(data.statuses);
        }
      })
      .catch((err) => {
        console.warn('Feed status check unreachable:', err);
      });

    // Hydrate incidents from backend persistent store if present
    fetch('/api/incidents')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
          // Merge or initialize
          setIncidents((prev) => {
            const serverMap = new Map(data.data.map((i: Incident) => [i.id, i]));
            // Keep local modified items if newer, otherwise prefer server
            return data.data;
          });
        }
      })
      .catch((err) => {
        console.warn('Backend persistent store incidents unreachable, using local queue:', err);
      });
  }, []);


  // Fetch real external public disaster feeds (USGS and GDACS)
  const handleFetchLiveFeeds = async (forceFresh: boolean = true) => {
    setIsFetchingFeeds(true);
    try {
      const res = await fetch('/api/feeds/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFresh }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.data?.incidents)) {
        const liveItems: Incident[] = data.data.incidents;
        setIncidents((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = liveItems.filter((i) => !existingIds.has(i.id));
          return [...newItems, ...prev];
        });

        if (liveItems.length > 0) {
          setSelectedIncidentId(liveItems[0].id);
        }

        setLastFetchTime(data.data.retrievedAt || new Date().toISOString());
        if (Array.isArray(data.data.feedStatuses)) {
          setFeedStatuses(data.data.feedStatuses);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live feeds:', err);
    } finally {
      setIsFetchingFeeds(false);
    }
  };

  // Compute duplicate candidate counts map for all incidents
  const candidateCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inc of incidents) {
      const candidates = findDuplicateCandidates(inc, incidents);
      map[inc.id] = candidates.length;
    }
    return map;
  }, [incidents]);

  // Active selected incident
  const selectedIncident = useMemo(() => {
    return incidents.find((i) => i.id === selectedIncidentId) || null;
  }, [incidents, selectedIncidentId]);

  // Duplicate candidates for active selected incident
  const selectedDuplicates = useMemo(() => {
    if (!selectedIncident) return [];
    return findDuplicateCandidates(selectedIncident, incidents);
  }, [selectedIncident, incidents]);

  // Real operational counts
  const liveFeedCount = useMemo(() => {
    return incidents.filter((i) => i.originType === 'live_feed').length;
  }, [incidents]);

  const demoCount = useMemo(() => {
    return incidents.filter((i) => i.originType === 'synthetic_demo').length;
  }, [incidents]);

  const unreviewedCount = useMemo(() => {
    return incidents.filter((i) => i.reviewStatus === 'unreviewed').length;
  }, [incidents]);

  const conflictCount = useMemo(() => {
    return incidents.filter((i) => i.conflictStatus !== 'none').length;
  }, [incidents]);

  const potentialDuplicatesTotal = useMemo(() => {
    let count = 0;
    for (const inc of incidents) {
      const cands = findDuplicateCandidates(inc, incidents);
      if (cands.length > 0) count++;
    }
    return count;
  }, [incidents]);

  // Reviewer audit update with persistent store syncing
  const handleUpdateReviewStatus = async (
    incidentId: string,
    newStatus: ReviewStatus,
    reviewerName: string,
    notes: string
  ) => {
    const now = new Date().toISOString();
    const effectiveReviewer =
      reviewerName && !reviewerName.startsWith('Field Reviewer')
        ? reviewerName
        : currentUser?.displayName || currentUser?.email || reviewerName || 'Field Reviewer';
    let updatedTarget: Incident | undefined;

    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          updatedTarget = {
            ...inc,
            reviewStatus: newStatus,
            reviewedBy: effectiveReviewer,
            reviewedAt: now,
            reviewerNotes: notes,
            updatedAt: now,
          };
          return updatedTarget;
        }
        return inc;
      })
    );

    if (updatedTarget) {
      try {
        await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTarget),
        });
        fetch('/api/storage/status')
          .then((r) => r.json())
          .then((d) => { if (d.ok) setStorageStatus(d.status); });
      } catch (err) {
        console.warn('Persistent store sync error:', err);
      }
    }
  };

  const handleOpenDuplicateModal = (
    targetIncident: Incident,
    candidateIncident: Incident
  ) => {
    setDuplicateModal({
      isOpen: true,
      targetIncident,
      candidateIncident,
    });
  };

  const handleConfirmMerge = async (
    primaryId: string,
    secondaryId: string,
    reviewerName: string,
    reviewerNotes: string
  ) => {
    const primary = incidents.find((i) => i.id === primaryId);
    const secondary = incidents.find((i) => i.id === secondaryId);
    if (!primary || !secondary) return;

    try {
      const res = await fetch('/api/merge-incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryIncident: primary,
          secondaryIncident: secondary,
          reviewerName,
          reviewerNotes,
        }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setIncidents((prev) => {
          const filtered = prev.filter((i) => i.id !== secondaryId);
          return filtered.map((i) => (i.id === primaryId ? data.data : i));
        });
        setSelectedIncidentId(primaryId);
        fetch('/api/storage/status')
          .then((r) => r.json())
          .then((d) => { if (d.ok) setStorageStatus(d.status); });
        return;
      }
    } catch (err) {
      console.warn('Server merge fallback to client-side merge:', err);
    }

    const merged = mergeIncidentsWithProvenance(
      primary,
      secondary,
      reviewerName,
      reviewerNotes
    );
    setIncidents((prev) => {
      const filtered = prev.filter((i) => i.id !== secondaryId);
      return filtered.map((i) => (i.id === primaryId ? merged : i));
    });
    setSelectedIncidentId(primaryId);
  };

  const handleKeepSeparate = (
    primaryId: string,
    secondaryId: string,
    reviewerName: string,
    notes: string
  ) => {
    const now = new Date().toISOString();
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === primaryId || inc.id === secondaryId) {
          const auditLine = `[${now}] Marked separate by ${reviewerName}: ${notes}`;
          const updated: Incident = {
            ...inc,
            reviewerNotes: inc.reviewerNotes
              ? `${inc.reviewerNotes}\n${auditLine}`
              : auditLine,
            updatedAt: now,
          };
          fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          }).catch((err) => console.warn('Could not persist separation note:', err));
          return updated;
        }
        return inc;
      })
    );
  };

  const handleMarkUncertain = (
    primaryId: string,
    secondaryId: string,
    reviewerName: string,
    notes: string
  ) => {
    const now = new Date().toISOString();
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === primaryId || inc.id === secondaryId) {
          const auditLine = `[${now}] Linkage uncertain, flagged by ${reviewerName}: ${notes}`;
          const updated: Incident = {
            ...inc,
            conflictStatus: inc.conflictStatus === 'none' ? 'suspected_conflict' : inc.conflictStatus,
            reviewerNotes: inc.reviewerNotes
              ? `${inc.reviewerNotes}\n${auditLine}`
              : auditLine,
            updatedAt: now,
          };
          fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          }).catch((err) => console.warn('Could not persist uncertain flag:', err));
          return updated;
        }
        return inc;
      })
    );
  };

  const handleIncidentIngested = (newIncident: Incident) => {
    setIncidents((prev) => [newIncident, ...prev]);
    setSelectedIncidentId(newIncident.id);
    fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIncident),
    }).catch((err) => console.warn('Could not persist ingested incident:', err));
  };

  const handleResetData = () => {
    if (window.confirm('Reset operational queue to initial baseline crisis records?')) {
      setIncidents(INITIAL_INCIDENTS);
      setSelectedIncidentId(INITIAL_INCIDENTS[0].id);
      localStorage.removeItem('signalbridge_incidents_v3');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Global Header with Live Feed Sync & Status */}
      <Header
        apiStatus={apiStatus}
        storageStatus={storageStatus}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        incidentCount={incidents.length}
        liveFeedCount={liveFeedCount}
        demoCount={demoCount}
        unreviewedCount={unreviewedCount}
        conflictCount={conflictCount}
        feedStatuses={feedStatuses}
        isFetchingFeeds={isFetchingFeeds}
        lastFetchTime={lastFetchTime}
        onFetchLiveFeeds={handleFetchLiveFeeds}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenAuditLogs={() => setIsAuditLogOpen(true)}
        onResetData={handleResetData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* Operational Metrics Bar */}
        <MetricsBar
          incidents={incidents}
          potentialDuplicatesCount={potentialDuplicatesTotal}
        />

        {activeTab === 'test-suite' ? (
          <div className="flex-1">
            <TestRunnerView />
          </div>
        ) : (
          /* Split Incident Queue and Evidence Inspector */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[640px]">
            {/* Left Column: Filterable Incident Queue */}
            <div className="lg:col-span-5 h-[760px]">
              <IncidentList
                incidents={incidents}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={(id) => setSelectedIncidentId(id)}
                candidateCountsMap={candidateCountsMap}
              />
            </div>

            {/* Right Column: Grounded Evidence & Reviewer Inspector */}
            <div className="lg:col-span-7 h-[760px]">
              <IncidentDetail
                incident={selectedIncident}
                duplicateCandidates={selectedDuplicates}
                allIncidents={incidents}
                onUpdateReviewStatus={handleUpdateReviewStatus}
                onOpenDuplicateModal={handleOpenDuplicateModal}
              />
            </div>
          </div>
        )}
      </main>

      {/* Duplicate Comparison & Resolution Modal with Configurable Thresholds */}
      <DuplicateReviewModal
        isOpen={duplicateModal.isOpen}
        onClose={() =>
          setDuplicateModal({ isOpen: false, targetIncident: null, candidateIncident: null })
        }
        targetIncident={duplicateModal.targetIncident}
        candidateIncident={duplicateModal.candidateIncident}
        onConfirmMerge={handleConfirmMerge}
        onKeepSeparate={handleKeepSeparate}
        onMarkUncertain={handleMarkUncertain}
      />

      {/* Ingest Incident Modal */}
      <IngestReportModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onIncidentIngested={handleIncidentIngested}
        existingIncidents={incidents}
      />

      {/* Immutable Audit Trail & Storage Status Modal */}
      <AuditLogModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
        storageStatus={storageStatus}
      />
    </div>
  );
}

