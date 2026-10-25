/**
 * SignalBridge AI - Structured Observability Logger
 * Formats operational logs as structured JSON compatible with Google Cloud Logging / Cloud Run.
 * Automatically redacts secrets, credentials, and sensitive PII.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogPayload {
  severity: LogLevel;
  message: string;
  timestamp: string;
  service: 'signalbridge-ai';
  requestId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  feedSync?: {
    adapterId: string;
    status: 'success' | 'failure';
    recordsRetrieved: number;
    recordsNormalized: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsRejected: number;
    durationMs: number;
    error?: string;
  };
  geminiCall?: {
    model: string;
    outcome: 'success' | 'rate_limited' | 'timed_out' | 'malformed_json' | 'error';
    latencyMs: number;
    retriesAttempted: number;
    promptTokensEstimated?: number;
    error?: string;
  };
  duplicateProcessing?: {
    targetIncidentId: string;
    candidatesEvaluated: number;
    candidatesMatched: number;
    conflictsDetectedCount: number;
    recommendation: string;
    durationMs: number;
  };
  reviewAction?: {
    incidentId: string;
    reviewerId: string;
    action: string;
    conflictStatus: string;
  };
  details?: Record<string, any>;
}

// Secret and credential patterns to mask in logs
const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g, // Google API keys
  /sk-[a-zA-Z0-9-_]{20,}/g, // OpenAI/Standard bearer keys
  /Bearer\s+[a-zA-Z0-9-_.]+/gi,
  /"GEMINI_API_KEY":\s*"[^"]+"/gi,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email masking in telemetry
];

function sanitizeLogData(input: any): any {
  if (typeof input === 'string') {
    let sanitized = input;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_CREDENTIAL]');
    }
    return sanitized;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeLogData);
  }
  if (typeof input === 'object' && input !== null) {
    const copy: Record<string, any> = {};
    for (const [key, val] of Object.entries(input)) {
      if (/key|secret|token|password|auth/i.test(key)) {
        copy[key] = '[REDACTED]';
      } else {
        copy[key] = sanitizeLogData(val);
      }
    }
    return copy;
  }
  return input;
}

class Logger {
  private formatLog(
    severity: LogLevel,
    message: string,
    meta?: Partial<StructuredLogPayload>
  ): string {
    const payload: StructuredLogPayload = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      service: 'signalbridge-ai',
      ...meta,
    };

    const sanitized = sanitizeLogData(payload);
    return JSON.stringify(sanitized);
  }

  debug(message: string, meta?: Partial<StructuredLogPayload>) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('DEBUG', message, meta));
    }
  }

  info(message: string, meta?: Partial<StructuredLogPayload>) {
    console.log(this.formatLog('INFO', message, meta));
  }

  warn(message: string, meta?: Partial<StructuredLogPayload>) {
    console.warn(this.formatLog('WARN', message, meta));
  }

  error(message: string, meta?: Partial<StructuredLogPayload>) {
    console.error(this.formatLog('ERROR', message, meta));
  }
}

export const logger = new Logger();
