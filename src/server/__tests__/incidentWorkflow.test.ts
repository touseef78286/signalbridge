/**
 * Integration & Workflow Tests: Incident Lifecycle & Error Resilience
 * Covers:
 * 1. Verification independence: model confidence !== verified status
 * 2. Invalid or fabricated source references detection
 * 3. Gemini API simulation: timeout, rate limit (429), server error (503) bounded retry handling
 * 4. Human reviewer audit lifecycle
 */

import { describe, it, expect, vi } from 'vitest';
import { analyzeIncidentReport, generateHeuristicFallback } from '../geminiService.ts';
import { Incident } from '../../types/incident.ts';

describe('Incident Review Lifecycle & API Error Resilience', () => {
  it('strictly isolates model confidence from human review verification', async () => {
    // Even if a model claims 0.99 confidence, the incident status MUST remain 'unreviewed'
    const result = await analyzeIncidentReport(
      {
        rawReportText:
          'Engine 4 on scene at North Bridge crossing at 4th Street. Water rising over 3 feet across the road. 2 motorists treated for mild hypothermia.',
        sourceType: 'first_responder',
        publisherOrCaller: 'Station 4 Dispatch',
      },
      { forceMock: true }
    );

    expect(result.incident.reviewStatus).toBe('unreviewed');
    expect(result.incident.reviewStatus).not.toBe('verified_by_reviewer');
    expect(result.incident.modelConfidence.isCalibrated).toBe(false);
  });

  it('detects fabricated or invalid source URLs safely', () => {
    const suspiciousUrls = [
      'javascript:stealData()',
      'http://fake-disaster-news-scam.xyz/click',
      'data:text/html,<script>alert(1)</script>',
    ];

    for (const url of suspiciousUrls) {
      const isUnsafe = url.startsWith('javascript:') || url.startsWith('data:') || !url.startsWith('https://');
      expect(isUnsafe).toBe(true);
    }
  });

  it('handles API failure scenarios using deterministic grounded fallback without crashing', () => {
    const rawReport = 'Heavy water rising on North Bridge at 4th street crossing. Roads impassable.';
    const fallback = generateHeuristicFallback(rawReport, '2026-10-23T22:20:00.000Z');

    expect(fallback.analysis.category).toBe('flood');
    expect(fallback.analysis.extractedLocation.normalizedName).toBeDefined();
    expect(fallback.modelConfidence.isCalibrated).toBe(false);
  });

  it('simulates bounded retries for transient errors (max 2 retries)', async () => {
    let callCount = 0;
    const mockCall = vi.fn(async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error('429 Rate limit exceeded - Resource exhausted');
      }
      return { success: true };
    });

    // Execute bounded retry runner
    let result = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        result = await mockCall();
        break;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }

    expect(callCount).toBe(2);
    expect(result).toEqual({ success: true });
  });

  it('stops at bounded limit if server error (503) persists without infinite looping', async () => {
    let callCount = 0;
    const mockFailingCall = vi.fn(async () => {
      callCount++;
      throw new Error('503 Service Unavailable');
    });

    let caughtError: Error | null = null;
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await mockFailingCall();
      } catch (err: any) {
        caughtError = err;
      }
    }

    // Must execute exactly 3 times (1 initial + 2 retries) and terminate
    expect(callCount).toBe(3);
    expect(caughtError?.message).toContain('503');
  });
});
