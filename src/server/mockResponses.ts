/**
 * SignalBridge AI - Deterministic Mock Responses
 * Provides calibrated test fixtures and fallback mocks for unit tests and offline testing.
 */

export const MOCK_GEMINI_ANALYSES = {
  // Vector 1: Standard flash flood with exact quotes
  flashFloodNorthBridge: {
    category: 'flood',
    extractedLocation: {
      rawText: 'North Bridge crossing at 4th Street',
      normalizedName: 'North Bridge, 4th Street',
      coordinates: { lat: 37.7749, lng: -122.4194 },
    },
    eventTime: {
      reportedTimeText: '22:15 local time',
      isoTimestamp: '2026-10-23T22:15:00.000Z',
      confidenceNote: 'Extracted from field report dispatch log',
    },
    impactAssessment: {
      casualties: { count: 0, status: 'none', exactSpan: 'No fatalities reported at this time.' },
      injuries: { count: 2, status: 'confirmed', exactSpan: '2 motorists treated for mild hypothermia' },
      infrastructureImpact: [
        'Bridge approaches submerged under 3 feet of water',
        'Guard rail damaged on east embankment',
      ],
      urgentNeeds: ['Heavy water rescue raft', 'Road closure barriers'],
    },
    supportingSpans: [
      {
        statement: 'Water level reached 3 feet above road surface',
        quoteSpan: 'water rising over 3 feet across the road',
      },
      {
        statement: 'Two injured motorists treated',
        quoteSpan: '2 motorists treated for mild hypothermia',
      },
    ],
    missingInformation: [
      'Structural integrity of bridge abutment pending engineer inspection',
    ],
    conflictingClaims: [],
    conciseSummary:
      'Flash flooding at North Bridge (4th St) reached 3ft depth at 22:15. Two motorists treated for hypothermia, no deaths reported. Rescue raft requested.',
    modelConfidence: {
      score: 0.88,
      explanation: 'Report provided explicit timestamp, exact cross-streets, and clear casualty counts.',
    },
    modelRawInterpretationNotes: 'Verified against local hydrology alert zone.',
  },

  // Vector 2: Conflicting casualty report for same flood incident
  flashFloodConflict: {
    category: 'flood',
    extractedLocation: {
      rawText: 'Near 4th St North Bridge intersection',
      normalizedName: 'North Bridge, 4th Street',
      coordinates: { lat: 37.7752, lng: -122.4190 },
    },
    eventTime: {
      reportedTimeText: 'approx 10:30 PM',
      isoTimestamp: '2026-10-23T22:30:00.000Z',
      confidenceNote: 'Citizen observation',
    },
    impactAssessment: {
      casualties: { count: 6, status: 'estimated', exactSpan: 'at least 6 people swept away downstream' },
      injuries: { count: 4, status: 'estimated', exactSpan: 'multiple injured on roof of car' },
      infrastructureImpact: [
        'Submerged cars on 4th Street',
      ],
      urgentNeeds: ['Helicopter evacuation'],
    },
    supportingSpans: [
      {
        statement: 'Multiple victims claimed swept downstream',
        quoteSpan: 'at least 6 people swept away downstream',
      },
    ],
    missingInformation: [
      'No official first-responder verification of casualty estimate',
    ],
    conflictingClaims: [
      'Casualty estimate of 6 swept away conflicts with official dispatch report of 0 fatalities.',
    ],
    conciseSummary:
      'Citizen post claiming 6 persons swept away at 4th St North Bridge around 10:30 PM. High discrepancy with official reports.',
    modelConfidence: {
      score: 0.62,
      explanation: 'High casualty figures from unverified citizen post require field confirmation.',
    },
    modelRawInterpretationNotes: 'Potential viral exaggeration or separate downstream observation.',
  },

  // Vector 3: Densely similar wording but completely different incident (Substation fire 35km away)
  powerSubstationSector9: {
    category: 'power_outage',
    extractedLocation: {
      rawText: 'Sector 9 Industrial Park Substation',
      normalizedName: 'Sector 9 Substation, Eastern Industrial Corridor',
      coordinates: { lat: 38.0512, lng: -122.1145 },
    },
    eventTime: {
      reportedTimeText: '04:00 AM',
      isoTimestamp: '2026-10-24T04:00:00.000Z',
      confidenceNote: 'SCADA breaker trip record',
    },
    impactAssessment: {
      casualties: { count: 0, status: 'none', exactSpan: 'zero personnel on site' },
      injuries: { count: 0, status: 'none', exactSpan: 'no injuries' },
      infrastructureImpact: [
        'Transformer unit 3 destroyed by electrical fire',
        '24,000 households without electricity in East Grid',
      ],
      urgentNeeds: ['Hazmat foam suppression unit', 'Grid rerouting to feeder line B'],
    },
    supportingSpans: [
      {
        statement: 'Electrical fire destroyed transformer 3',
        quoteSpan: 'transformer unit 3 destroyed by electrical fire',
      },
    ],
    missingInformation: ['Estimated time to power restoration'],
    conflictingClaims: [],
    conciseSummary:
      'Transformer fire at Sector 9 Substation knocked out power to 24,000 customers. Zero casualties. Fire crews on site.',
    modelConfidence: {
      score: 0.94,
      explanation: 'Automated telemetry data with corroborating utility statement.',
    },
    modelRawInterpretationNotes: 'SCADA logged automatic circuit breaker trip.',
  },

  // Vector 4: Missing location and event time report
  missingLocationAndTime: {
    category: 'medical_emergency',
    extractedLocation: {
      rawText: 'Unknown location',
      normalizedName: 'Unknown location',
      coordinates: undefined,
    },
    eventTime: {
      reportedTimeText: 'Time unspecified in report',
      isoTimestamp: undefined,
      confidenceNote: 'No temporal indicator found in text',
    },
    impactAssessment: {
      casualties: { count: null, status: 'unknown', exactSpan: '' },
      injuries: { count: null, status: 'unknown', exactSpan: '' },
      infrastructureImpact: [],
      urgentNeeds: ['Identify caller location', 'Dispatch welfare check'],
    },
    supportingSpans: [
      {
        statement: 'Smell of gas and coughing reported',
        quoteSpan: 'heavy smell of chemicals and people coughing',
      },
    ],
    missingInformation: [
      'Exact physical address or landmark missing',
      'Time of incident initiation unknown',
      'Number of affected individuals unspecified',
    ],
    conflictingClaims: [],
    conciseSummary:
      'Unlocated report describing chemical odor and coughing symptoms. Immediate caller traceback required.',
    modelConfidence: {
      score: 0.35,
      explanation: 'Critical identifying fields (location, time, severity) are absent.',
    },
    modelRawInterpretationNotes: 'Low information density report.',
  },

  // Vector 5: Malformed / Hallucinated quote span (for testing anti-hallucination filter)
  hallucinatedQuotesOutput: {
    category: 'structural_collapse',
    extractedLocation: {
      rawText: 'Warehouse 12, Pier 40',
      normalizedName: 'Warehouse 12, Pier 40',
      coordinates: { lat: 37.7812, lng: -122.3891 },
    },
    eventTime: {
      reportedTimeText: '01:15 AM',
      isoTimestamp: '2026-10-24T01:15:00.000Z',
      confidenceNote: 'Night guard dispatch call',
    },
    impactAssessment: {
      casualties: { count: 0, status: 'none', exactSpan: 'nobody inside the storage bay' },
      injuries: { count: 1, status: 'confirmed', exactSpan: 'security guard suffered sprained ankle' },
      infrastructureImpact: ['Roof truss partial failure'],
      urgentNeeds: ['Structural engineer evaluation'],
    },
    supportingSpans: [
      {
        statement: 'Security guard injured ankle',
        quoteSpan: 'security guard suffered sprained ankle', // Real in test text
      },
      {
        statement: 'Alien spacecraft collided with the roof',
        quoteSpan: 'alien spacecraft crashed through the reinforced ceiling', // Hallucinated quote!
      },
    ],
    missingInformation: [],
    conflictingClaims: [],
    conciseSummary: 'Roof collapse at Warehouse 12 with one minor guard injury.',
    modelConfidence: {
      score: 0.8,
      explanation: 'Extracted report with some dubious spans.',
    },
    modelRawInterpretationNotes: 'Testing quote grounding filter.',
  },
};
