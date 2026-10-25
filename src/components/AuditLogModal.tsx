/**
 * SignalBridge AI - Audit Log & Provenance Modal
 * Displays immutable audit log events with actor attribution, provenance, and timestamp.
 */

import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  X,
  Clock,
  User,
  ShieldCheck,
  RefreshCw,
  Database,
  ArrowRight
} from 'lucide-react';
import { AuditLogEntry, StorageStatus } from '../server/storage/types.ts';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageStatus?: StorageStatus | null;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  storageStatus,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs?limit=50');
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) =>
    filterAction === 'all' ? true : log.action === filterAction
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white font-mono">
                  Immutable Audit Trail & Provenance History
                </h3>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {logs.length} Events Logged
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Non-repudiation ledger tracking feeds, automated extraction, and human reviewer decisions
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh logs"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Persistence Status Card */}
        {storageStatus && (
          <div className="bg-slate-950 px-5 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300 font-semibold">Active Repository:</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  storageStatus.isEphemeral
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {storageStatus.isEphemeral ? 'In-Memory (Ephemeral)' : 'Cloud Firestore (Persistent)'}
              </span>
            </div>
            <div className="text-slate-400 text-[11px]">
              {storageStatus.statusMessage}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-mono text-[11px]">Filter Action:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2.5 py-1 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Audit Actions ({logs.length})</option>
              <option value="review_status_updated">Review Status Updates</option>
              <option value="incidents_merged">Merge Decisions</option>
              <option value="incident_ingested">Incident Ingestion</option>
              <option value="feed_synced">Feed Synchronizations</option>
            </select>
          </div>

          <span className="text-slate-500 text-[11px] font-mono">
            Showing {filteredLogs.length} of {logs.length} entries
          </span>
        </div>

        {/* Audit Log Entries List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {loading && logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading audit logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              No audit logs matching selected filter.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isMerge = log.action === 'incidents_merged';
              const isReview = log.action === 'review_status_updated';
              const isFeed = log.action === 'feed_synced';

              return (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 text-xs font-mono space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isMerge
                            ? 'bg-purple-950 text-purple-300 border-purple-800'
                            : isReview
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : isFeed
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-300 font-semibold">
                        Target: #{log.incidentId.slice(0, 16)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-slate-300 font-medium">Actor: {log.actor}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">{log.provenance}</span>
                  </div>

                  {log.details && (
                    <div className="bg-slate-900/90 rounded p-2 text-[11px] text-slate-300 border border-slate-800">
                      <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-400 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Audit integrity guaranteed by idempotent upsert and immutable event logging.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
