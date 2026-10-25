/**
 * SignalBridge AI - Storage Repository Factory
 * Exports modular incident store instance with transparent status inspection.
 */

import { IncidentStore } from './types.ts';
import { MemoryIncidentStore } from './memoryStore.ts';
import { FirestoreIncidentStore } from './firestoreStore.ts';
import { logger } from '../logger.ts';
import firebaseConfig from '../../../firebase-applet-config.json';

function createIncidentStore(): IncidentStore {
  const hasConfig = Boolean(
    firebaseConfig &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'remixed-project-id'
  );

  if (hasConfig) {
    try {
      logger.info(`Firestore configuration detected for project: ${firebaseConfig.projectId}. Initializing Firestore store...`);
      return new FirestoreIncidentStore();
    } catch (err: any) {
      logger.warn(`Failed to initialize Firestore store: ${err.message}. Falling back to Memory store.`);
    }
  }

  logger.info('Storage initialized in Local Repository Mode (Cloud Firestore unconfigured)');
  return new MemoryIncidentStore();
}

export const incidentStore: IncidentStore = createIncidentStore();
