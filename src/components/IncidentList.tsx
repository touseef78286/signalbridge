import React, { useState, useMemo } from 'react';
import {
  Incident,
  IncidentCategory,
  ReviewStatus,
  ConflictStatus,
  DataOriginType
} from '../types/incident.ts';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Layers,
  GitMerge,
  Globe,
  Database,
  User,
  Radio
} from 'lucide-react';

interface IncidentListProps {
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
  candidateCountsMap: Record<string, number>;
}

export const IncidentList: React.FC<IncidentListProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  candidateCountsMap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState<DataOriginType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | 'all'>('all');
  const [conflictFilter, setConflictFilter] = useState<ConflictStatus | 'all'>('all');

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Origin filter
      if (originFilter !== 'all' && inc.originType !== originFilter) {
        return false;
      }

      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = inc.title.toLowerCase().includes(q);
        const matchesLocation = inc.analysis.extractedLocation.normalizedName.toLowerCase().includes(q);
        const matchesSummary = inc.analysis.conciseSummary.toLowerCase().includes(q);
        const matchesPublisher = inc.primaryReport.publisherOrCaller.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLocation && !matchesSummary && !matchesPublisher) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all' && inc.analysis.category !== categoryFilter) {
        return false;
      }

      // Review status filter
      if (reviewFilter !== 'all' && inc.reviewStatus !== reviewFilter) {
        return false;
      }

      // Conflict filter
      if (conflictFilter !== 'all' && inc.conflictStatus !== conflictFilter) {
        return false;
      }

      return true;
    });
  }, [incidents, originFilter, searchQuery, categoryFilter, reviewFilter, conflictFilter]);

  const getOriginBadge = (originType: DataOriginType, feedProvenance?: any) => {
    switch (originType) {
      case 'live_feed':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
            <Radio className="w-2.5 h-2.5 text-indigo-400" />
            <span>LIVE: {feedProvenance?.adapterId?.toUpperCase() || 'FEED'}</span>
          </span>
        );
      case 'user_submission':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
            <User className="w-2.5 h-2.5 text-cyan-400" />
            <span>USER REPORT</span>
          </span>
        );
      case 'synthetic_demo':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/70">
            <Database className="w-2.5 h-2.5 text-amber-400" />
            <span>DEMO FIXTURE</span>
          </span>
        );
    }
  };

  const getCategoryColor = (category: IncidentCategory) => {
    switch (category) {
      case 'flood':
        return 'text-blue-400 bg-blue-950/60 border-blue-800';
      case 'wildfire':
        return 'text-orange-400 bg-orange-950/60 border-orange-800';
      case 'earthquake':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'structural_collapse':
        return 'text-red-400 bg-red-950/60 border-red-800';
      case 'hazmat_spill':
        return 'text-purple-400 bg-purple-950/60 border-purple-800';
      case 'power_outage':
        return 'text-yellow-400 bg-yellow-950/60 border-yellow-800';
      case 'medical_emergency':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  const getReviewBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'verified_by_reviewer':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Verified</span>
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>Under Review</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 text-slate-400 border border-slate-700">
            <span>Rejected</span>
          </span>
        );
      case 'unreviewed':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Unreviewed</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Search & Filter Toolbar */}
      <div className="p-3 border-b border-slate-800 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, locations, or agencies..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-2 text-xs">
          {/* Origin Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 text-[11px]">Origin:</span>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as any)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Origins</option>
              <option value="live_feed" className="bg-slate-900">Live External Feeds</option>
              <option value="user_submission" className="bg-slate-900">User Submissions</option>
              <option value="synthetic_demo" className="bg-slate-900">Synthetic Demo Fixtures</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 text-[11px]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Categories</option>
              <option value="earthquake" className="bg-slate-900">Earthquake</option>
              <option value="flood" className="bg-slate-900">Flood</option>
              <option value="wildfire" className="bg-slate-900">Wildfire</option>
              <option value="power_outage" className="bg-slate-900">Power Outage</option>
              <option value="structural_collapse" className="bg-slate-900">Collapse</option>
              <option value="medical_emergency" className="bg-slate-900">Medical</option>
              <option value="severe_weather" className="bg-slate-900">Severe Weather</option>
            </select>
          </div>

          {/* Review Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-500 text-[11px]">Review:</span>
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as any)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Statuses</option>
              <option value="unreviewed" className="bg-slate-900">Unreviewed</option>
              <option value="under_review" className="bg-slate-900">Under Review</option>
              <option value="verified_by_reviewer" className="bg-slate-900">Verified</option>
              <option value="rejected" className="bg-slate-900">Rejected</option>
            </select>
          </div>

          {(searchQuery || originFilter !== 'all' || categoryFilter !== 'all' || reviewFilter !== 'all' || conflictFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setOriginFilter('all');
                setCategoryFilter('all');
                setReviewFilter('all');
                setConflictFilter('all');
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer self-center ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Incident Rows */}
      <div className="overflow-y-auto divide-y divide-slate-800 flex-1">
        {filteredIncidents.length === 0 ? (
          <div className="p-8 text-center">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No matching incidents found</p>
            <p className="text-xs text-slate-600 mt-1">Try adjusting your filters or click "Sync Live Feeds"</p>
          </div>
        ) : (
          filteredIncidents.map((incident) => {
            const isSelected = incident.id === selectedIncidentId;
            const duplicateCount = candidateCountsMap[incident.id] || 0;
            const hasConflict = incident.conflictStatus !== 'none';
            const coordsReliable = incident.analysis.extractedLocation.hasReliableCoords;

            return (
              <div
                key={incident.id}
                onClick={() => onSelectIncident(incident.id)}
                className={`p-3.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-800/90 border-l-4 border-l-cyan-400'
                    : 'hover:bg-slate-850 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    {getOriginBadge(incident.originType, incident.feedProvenance)}
                    <span
                      className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded border ${getCategoryColor(
                        incident.analysis.category
                      )}`}
                    >
                      {incident.analysis.category.replace('_', ' ')}
                    </span>
                    {getReviewBadge(incident.reviewStatus)}
                    {hasConflict && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950/80 text-red-300 border border-red-800">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span>Conflict</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                    #{incident.id.slice(0, 10)}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-slate-100 line-clamp-1 mb-1">
                  {incident.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 mb-2 font-normal">
                  {incident.analysis.conciseSummary}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-800/60">
                  <div className="flex items-center space-x-1 truncate max-w-[55%]">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${coordsReliable ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="truncate text-slate-400" title={incident.analysis.extractedLocation.normalizedName}>
                      {incident.analysis.extractedLocation.normalizedName}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {duplicateCount > 0 && (
                      <span className="flex items-center space-x-1 text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-900 text-[10px] font-mono">
                        <GitMerge className="w-3 h-3" />
                        <span>{duplicateCount} match{duplicateCount > 1 ? 'es' : ''}</span>
                      </span>
                    )}

                    <span className="text-[10px] font-mono bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                      Scope: {incident.analysis.extractedLocation.spatialScope || 'local'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-500 flex justify-between">
        <span>Showing {filteredIncidents.length} of {incidents.length} incidents</span>
        <span>Keyboard: click or tap to inspect</span>
      </div>
    </div>
  );
};
