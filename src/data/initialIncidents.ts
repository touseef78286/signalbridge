/**
 * SignalBridge AI - Initial Realistic Operational Incidents
 * Grounded seed data demonstrating distinct categories, conflict states, review states,
 * and duplicate candidates. Explicitly tagged as synthetic demo data.
 */

import { Incident } from '../types/incident.ts';

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-sf-001',
    title: 'FLOOD: North Bridge, 4th Street',
    originType: 'synthetic_demo',
    engineMode: 'demo_fallback',
    reviewStatus: 'unreviewed',
    conflictStatus: 'none',
    evidenceCompleteness: 'high',
    modelConfidence: {
      score: 0.88,
      label: 'high',
      isCalibrated: false,
      explanation: '[SYNTHETIC DEMO FIXTURE] Calibrated test vector: clear timestamps, exact intersection coordinates, official dispatch text.',
    },
    primaryReport: {
      id: 'rep-fd-101',
      sourceType: 'first_responder',
      publisherOrCaller: 'Engine 4 Lieutenant Gomez',
      sourcePublicationTime: '2026-10-23T22:20:00.000Z',
      rawReportText:
        'Engine 4 on scene at North Bridge crossing at 4th Street. Water rising over 3 feet across the road. 2 motorists treated for mild hypothermia. No fatalities reported at this time. Heavy water rescue raft requested.',
      isVerifiedSource: true,
      contactInfo: 'Dispatch Channel Bravo-2',
    },
    mergedReports: [],
    analysis: {
      category: 'flood',
      extractedLocation: {
        rawText: 'North Bridge crossing at 4th Street',
        normalizedName: 'North Bridge, 4th Street',
        coordinates: { lat: 37.7749, lng: -122.4194 },
        hasReliableCoords: true,
        confidenceNote: 'Coordinates verified from emergency responder vehicle GPS telemetry',
        spatialScope: 'regional',
      },
      eventTime: {
        reportedTimeText: '22:15 local time',
        isoTimestamp: '2026-10-23T22:15:00.000Z',
        isEventOccurrenceTimeKnown: true,
        confidenceNote: 'Extracted directly from dispatch log',
      },
      sourcePublicationTime: '2026-10-23T22:20:00.000Z',
      impactAssessment: {
        casualties: {
          count: 0,
          status: 'none',
          exactSpan: 'No fatalities reported at this time.',
          claimsBreakdown: [
            {
              reportId: 'rep-fd-101',
              publisher: 'Engine 4 Lieutenant Gomez',
              count: 0,
              status: 'none',
              reportedAt: '2026-10-23T22:20:00.000Z',
              scopeDescription: 'Engine 4 on-scene perimeter',
            },
          ],
        },
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
          quoteSpan: 'Water rising over 3 feet across the road',
          exactQuoteInSourceText: true,
        },
        {
          statement: 'Two motorists treated for hypothermia',
          quoteSpan: '2 motorists treated for mild hypothermia',
          exactQuoteInSourceText: true,
        },
      ],
      missingInformation: [
        'Structural integrity inspection of bridge abutment pending',
      ],
      conflictingClaims: [],
      conciseSummary:
        'Flash flooding at North Bridge (4th St) reached 3ft depth at 22:15. Two motorists treated for hypothermia; no deaths. Rescue raft requested.',
      modelRawInterpretationNotes: 'Verified against local hydrology alert zone.',
    },
    createdAt: '2026-10-23T22:21:00.000Z',
    updatedAt: '2026-10-23T22:21:00.000Z',
  },
  {
    id: 'inc-sf-002',
    title: 'FLOOD: 4th St & North Bridge Crossroad',
    originType: 'synthetic_demo',
    engineMode: 'demo_fallback',
    reviewStatus: 'unreviewed',
    conflictStatus: 'none',
    evidenceCompleteness: 'moderate',
    modelConfidence: {
      score: 0.74,
      label: 'medium',
      isCalibrated: false,
      explanation: '[SYNTHETIC DEMO FIXTURE] Citizen phone call with matching location and timing; unverified witness account.',
    },
    primaryReport: {
      id: 'rep-cit-204',
      sourceType: 'citizen_call',
      publisherOrCaller: 'Citizen caller #882 (Anonymous)',
      sourcePublicationTime: '2026-10-23T22:35:00.000Z',
      rawReportText:
        'Cars are stuck in high water near 4th street north bridge. Water is 3 feet deep. Fire department is on scene helping people out of cars.',
      isVerifiedSource: false,
    },
    mergedReports: [],
    analysis: {
      category: 'flood',
      extractedLocation: {
        rawText: 'near 4th street north bridge',
        normalizedName: 'North Bridge, 4th Street',
        coordinates: { lat: 37.7751, lng: -122.4192 },
        hasReliableCoords: true,
        confidenceNote: 'Caller cell tower triangulation within 100m',
        spatialScope: 'regional',
      },
      eventTime: {
        reportedTimeText: 'approx 22:30',
        isoTimestamp: '2026-10-23T22:30:00.000Z',
        isEventOccurrenceTimeKnown: true,
        confidenceNote: 'Phone call received at 22:35',
      },
      sourcePublicationTime: '2026-10-23T22:35:00.000Z',
      impactAssessment: {
        casualties: { count: null, status: 'unknown', exactSpan: '' },
        injuries: { count: null, status: 'unknown', exactSpan: '' },
        infrastructureImpact: ['Vehicles stranded in floodwaters'],
        urgentNeeds: ['Towing service', 'Evacuation assistance'],
      },
      supportingSpans: [
        {
          statement: 'Cars stuck in 3 feet high water',
          quoteSpan: 'Cars are stuck in high water near 4th street north bridge. Water is 3 feet deep',
          exactQuoteInSourceText: true,
        },
      ],
      missingInformation: [
        'Number of stranded occupants unknown',
        'Casualty details omitted by caller',
      ],
      conflictingClaims: [],
      conciseSummary:
        'Citizen report of vehicles stranded in 3ft water at 4th St North Bridge. Confirms fire crews assisting.',
      modelRawInterpretationNotes: 'Likely duplicate of #inc-sf-001.',
    },
    createdAt: '2026-10-23T22:36:00.000Z',
    updatedAt: '2026-10-23T22:36:00.000Z',
  },
  {
    id: 'inc-sf-003',
    title: 'FLOOD: North Bridge Downstream Embankment',
    originType: 'synthetic_demo',
    engineMode: 'demo_fallback',
    reviewStatus: 'unreviewed',
    conflictStatus: 'suspected_conflict',
    evidenceCompleteness: 'moderate',
    modelConfidence: {
      score: 0.58,
      label: 'medium',
      isCalibrated: false,
      explanation: '[SYNTHETIC DEMO FIXTURE] Social media post with severe casualty discrepancy requiring urgent field verification.',
    },
    primaryReport: {
      id: 'rep-soc-309',
      sourceType: 'social_media',
      publisherOrCaller: '@bay_watcher_live',
      sourcePublicationTime: '2026-10-23T22:45:00.000Z',
      sourceUrl: 'https://social.example.org/post/994821',
      rawReportText:
        'Disaster at North Bridge 4th St! At least 6 people swept away downstream in roaring floodwater. Send choppers now!!',
      isVerifiedSource: false,
    },
    mergedReports: [],
    analysis: {
      category: 'flood',
      extractedLocation: {
        rawText: 'North Bridge 4th St',
        normalizedName: 'North Bridge, 4th Street',
        coordinates: { lat: 37.7748, lng: -122.4196 },
        hasReliableCoords: false,
        confidenceNote: 'Coordinates estimated from landmark name; no device telemetry',
        spatialScope: 'regional',
      },
      eventTime: {
        reportedTimeText: '22:40 PM',
        isoTimestamp: '2026-10-23T22:40:00.000Z',
        isEventOccurrenceTimeKnown: true,
        confidenceNote: 'Post timestamp',
      },
      sourcePublicationTime: '2026-10-23T22:45:00.000Z',
      impactAssessment: {
        casualties: {
          count: 6,
          status: 'estimated',
          exactSpan: 'At least 6 people swept away downstream',
          claimsBreakdown: [
            {
              reportId: 'rep-soc-309',
              publisher: '@bay_watcher_live',
              count: 6,
              status: 'estimated',
              reportedAt: '2026-10-23T22:45:00.000Z',
              scopeDescription: 'Eyewitness claimed swept downstream',
            },
          ],
        },
        injuries: { count: null, status: 'unknown', exactSpan: '' },
        infrastructureImpact: ['Roaring floodwater over bridge embankment'],
        urgentNeeds: ['Helicopter search and rescue'],
      },
      supportingSpans: [
        {
          statement: 'Claimed 6 people swept downstream',
          quoteSpan: 'At least 6 people swept away downstream',
          exactQuoteInSourceText: true,
        },
      ],
      missingInformation: [
        'No official first-responder corroboration of swept-away victims',
        'Specific eyewitness contact info unavailable',
      ],
      conflictingClaims: [
        'Direct contradiction in casualty estimates for same localized incident site: Engine 4 reported 0 fatalities, while social post claims 6 swept away.',
      ],
      conciseSummary:
        'Social media post alleging 6 people swept away at North Bridge. Directly conflicts with Engine 4 on-scene report.',
      modelRawInterpretationNotes: 'High conflict indicator triggered.',
    },
    createdAt: '2026-10-23T22:46:00.000Z',
    updatedAt: '2026-10-23T22:46:00.000Z',
  },
  {
    id: 'inc-sf-004',
    title: 'POWER OUTAGE: Sector 9 Industrial Substation',
    originType: 'synthetic_demo',
    engineMode: 'demo_fallback',
    reviewStatus: 'unreviewed',
    conflictStatus: 'none',
    evidenceCompleteness: 'high',
    modelConfidence: {
      score: 0.94,
      label: 'high',
      isCalibrated: false,
      explanation: '[SYNTHETIC DEMO FIXTURE] Direct SCADA breaker trip telemetry and utility incident commander corroboration.',
    },
    primaryReport: {
      id: 'rep-iot-411',
      sourceType: 'sensor_iot',
      publisherOrCaller: 'SCADA Telemetry System (East Grid)',
      sourcePublicationTime: '2026-10-24T04:02:00.000Z',
      rawReportText:
        'SCADA Automated Alert: Transformer unit 3 destroyed by electrical fire at Sector 9 Industrial Park Substation. 24,000 households without electricity in East Grid. Zero personnel on site, no injuries. Hazmat foam suppression unit requested.',
      isVerifiedSource: true,
    },
    mergedReports: [],
    analysis: {
      category: 'power_outage',
      extractedLocation: {
        rawText: 'Sector 9 Industrial Park Substation',
        normalizedName: 'Sector 9 Substation, Eastern Industrial Corridor',
        coordinates: { lat: 38.0512, lng: -122.1145 },
        hasReliableCoords: true,
        confidenceNote: 'SCADA fixed RTU coordinates verified in GIS database',
        spatialScope: 'neighborhood',
      },
      eventTime: {
        reportedTimeText: '04:00 AM',
        isoTimestamp: '2026-10-24T04:00:00.000Z',
        isEventOccurrenceTimeKnown: true,
        confidenceNote: 'Telemetry circuit breaker trip timestamp',
      },
      sourcePublicationTime: '2026-10-24T04:02:00.000Z',
      impactAssessment: {
        casualties: { count: 0, status: 'none', exactSpan: 'Zero personnel on site' },
        injuries: { count: 0, status: 'none', exactSpan: 'no injuries' },
        infrastructureImpact: [
          'Transformer unit 3 destroyed by electrical fire',
          '24,000 households without electricity in East Grid',
        ],
        urgentNeeds: ['Hazmat foam suppression unit', 'Feeder line reroute to Substation 11'],
      },
      supportingSpans: [
        {
          statement: 'Transformer destroyed by fire',
          quoteSpan: 'Transformer unit 3 destroyed by electrical fire',
          exactQuoteInSourceText: true,
        },
        {
          statement: '24,000 homes without power',
          quoteSpan: '24,000 households without electricity in East Grid',
          exactQuoteInSourceText: true,
        },
      ],
      missingInformation: ['Estimated time to full power restoration (ETR)'],
      conflictingClaims: [],
      conciseSummary:
        'Transformer 3 fire at Sector 9 Substation caused blackout for 24,000 homes. Zero injuries. Foam suppression dispatched.',
      modelRawInterpretationNotes: 'Telemetry confirmed breaker trip.',
    },
    createdAt: '2026-10-24T04:03:00.000Z',
    updatedAt: '2026-10-24T04:03:00.000Z',
  },
  {
    id: 'inc-sf-005',
    title: 'MEDICAL EMERGENCY: Chemical Exposure Zone',
    originType: 'synthetic_demo',
    engineMode: 'demo_fallback',
    reviewStatus: 'under_review',
    conflictStatus: 'none',
    evidenceCompleteness: 'low',
    modelConfidence: {
      score: 0.38,
      label: 'low',
      isCalibrated: false,
      explanation: '[SYNTHETIC DEMO FIXTURE] Critical identifying fields (exact address, event onset time, victim headcount) are absent.',
    },
    primaryReport: {
      id: 'rep-cit-519',
      sourceType: 'citizen_call',
      publisherOrCaller: 'Distressed Caller (Anonymous mobile)',
      sourcePublicationTime: '2026-10-24T05:15:00.000Z',
      rawReportText:
        'Heavy smell of chemicals and people coughing in the hallway. We cannot breathe properly. Please send an ambulance quickly!',
      isVerifiedSource: false,
    },
    mergedReports: [],
    analysis: {
      category: 'medical_emergency',
      extractedLocation: {
        rawText: 'hallway (unspecified building)',
        normalizedName: 'Unknown Location (Unspecified Building)',
        coordinates: undefined,
        hasReliableCoords: false,
        confidenceNote: 'Caller hung up before providing street address or building number',
        spatialScope: 'point_localized',
      },
      eventTime: {
        reportedTimeText: 'Time unspecified in report',
        isoTimestamp: undefined,
        isEventOccurrenceTimeKnown: false,
        confidenceNote: 'No temporal indicator provided',
      },
      sourcePublicationTime: '2026-10-24T05:15:00.000Z',
      impactAssessment: {
        casualties: { count: null, status: 'unknown', exactSpan: '' },
        injuries: { count: null, status: 'estimated', exactSpan: 'people coughing in the hallway. We cannot breathe properly' },
        infrastructureImpact: ['Airborne chemical odor in interior hallway'],
        urgentNeeds: ['Cell phone carrier emergency location lookup', 'Hazmat medical team'],
      },
      supportingSpans: [
        {
          statement: 'Chemical odor causing breathing difficulty',
          quoteSpan: 'Heavy smell of chemicals and people coughing in the hallway. We cannot breathe properly',
          exactQuoteInSourceText: true,
        },
      ],
      missingInformation: [
        'CRITICAL: Exact address, city, or coordinates missing',
        'Specific chemical identity unknown',
        'Headcount of affected occupants unknown',
      ],
      conflictingClaims: [],
      conciseSummary:
        'Unlocated emergency call reporting chemical odor and breathing distress. Urgent cell traceback required.',
      modelRawInterpretationNotes: 'Low information density. Assigned under_review for PSAP re-contact.',
    },
    reviewerNotes: 'PSAP dispatcher attempting callback on cell tower sector 4.',
    reviewedBy: 'Dispatcher Jenkins',
    reviewedAt: '2026-10-24T05:20:00.000Z',
    createdAt: '2026-10-24T05:16:00.000Z',
    updatedAt: '2026-10-24T05:20:00.000Z',
  },
  {
    id: 'inc-sf-006',
    title: 'STRUCTURAL COLLAPSE: Pier 40 Warehouse 12',
    originType: 'synthetic_demo',
    engineMode: 'demo_fallback',
    reviewStatus: 'verified_by_reviewer',
    conflictStatus: 'none',
    evidenceCompleteness: 'high',
    modelConfidence: {
      score: 0.91,
      label: 'high',
      isCalibrated: false,
      explanation: '[SYNTHETIC DEMO FIXTURE] Corroborated by on-site structural engineer report and port security log.',
    },
    primaryReport: {
      id: 'rep-sec-601',
      sourceType: 'field_agency',
      publisherOrCaller: 'Port Authority Security Sgt. Chen',
      sourcePublicationTime: '2026-10-24T01:30:00.000Z',
      rawReportText:
        'Port Authority on site at Warehouse 12, Pier 40. Roof truss partial failure in storage bay B. Security guard suffered sprained ankle during evacuation. Zero fatalities. Perimeter secured.',
      isVerifiedSource: true,
    },
    mergedReports: [
      {
        reportId: 'rep-eng-602',
        source: {
          id: 'rep-eng-602',
          sourceType: 'first_responder',
          publisherOrCaller: 'Structural Inspector Alvarez, City Building Dept',
          sourcePublicationTime: '2026-10-24T02:15:00.000Z',
          rawReportText:
            'Inspection completed Warehouse 12 Pier 40: Timber truss cracked due to storm runoff ponding. Red-tagged storage bay B. Red-tag issued for bay B only; bay A structurally sound.',
          isVerifiedSource: true,
        },
        mergedAt: '2026-10-24T02:45:00.000Z',
        mergedByReviewer: 'Reviewer Alex Vance',
        reason: 'Consolidated engineering inspection report into primary incident file.',
        reconciledImpactNotes: 'Bay B red-tagged. No additional casualties.',
      },
    ],
    analysis: {
      category: 'structural_collapse',
      extractedLocation: {
        rawText: 'Warehouse 12, Pier 40',
        normalizedName: 'Warehouse 12, Pier 40, Port District',
        coordinates: { lat: 37.7812, lng: -122.3891 },
        hasReliableCoords: true,
        confidenceNote: 'Port GIS asset ID #PA-W12 verified',
        spatialScope: 'point_localized',
      },
      eventTime: {
        reportedTimeText: '01:15 AM',
        isoTimestamp: '2026-10-24T01:15:00.000Z',
        isEventOccurrenceTimeKnown: true,
        confidenceNote: 'Incident log entry',
      },
      sourcePublicationTime: '2026-10-24T01:30:00.000Z',
      impactAssessment: {
        casualties: { count: 0, status: 'none', exactSpan: 'Zero fatalities' },
        injuries: { count: 1, status: 'confirmed', exactSpan: 'Security guard suffered sprained ankle' },
        infrastructureImpact: [
          'Roof truss partial failure in storage bay B',
          'Storage Bay B red-tagged by city building inspector',
        ],
        urgentNeeds: ['Structural shoring crew', 'Perimeter caution fencing'],
      },
      supportingSpans: [
        {
          statement: 'Roof truss partial failure in bay B',
          quoteSpan: 'Roof truss partial failure in storage bay B',
          exactQuoteInSourceText: true,
        },
        {
          statement: 'Security guard suffered sprained ankle',
          quoteSpan: 'Security guard suffered sprained ankle',
          exactQuoteInSourceText: true,
        },
      ],
      missingInformation: [],
      conflictingClaims: [],
      conciseSummary:
        'Partial roof truss failure at Pier 40 Warehouse 12. 1 minor injury (guard sprained ankle), zero deaths. Bay B red-tagged.',
      modelRawInterpretationNotes: 'Verified against building code inspection database.',
    },
    reviewerNotes: 'Verified by Reviewer Alex Vance after on-site building dept inspection confirmed timber truss crack. Red tag applied.',
    reviewedBy: 'Reviewer Alex Vance (ID: RV-409)',
    reviewedAt: '2026-10-24T02:50:00.000Z',
    createdAt: '2026-10-24T01:31:00.000Z',
    updatedAt: '2026-10-24T02:50:00.000Z',
  },
];
