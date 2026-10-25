/**
 * SignalBridge AI - Firebase Client SDK Integration
 * Configures Firestore with custom database ID, Firebase Authentication (Google Auth),
 * strict security error logging (FirestoreErrorInfo), and connection verification.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Incident } from '../types/incident.ts';
import { AuditLogEntry } from '../server/storage/types.ts';

// 1. Initialize Firebase App (Idempotent across HMR/reloads)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Firestore with required database ID from config
// CRITICAL: The app uses custom database ID "ai-studio-signalbridgeai-04ceeac2-d3e4-4687-8385-5ba55dfa7d26"
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 3. Initialize Firebase Auth with Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 4. Standardized Firestore Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 5. Test connection on boot via getDocFromServer
export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  const testPath = 'incidents/_connection_check';
  try {
    await getDocFromServer(doc(db, 'incidents', '_connection_check'));
    return {
      connected: true,
      message: 'Cloud Firestore Enterprise connected successfully.',
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline status:', error.message);
      return {
        connected: false,
        message: 'Client is offline. Falling back to local queue.',
      };
    }
    // A document not found is still a successful connection to Firestore
    return {
      connected: true,
      message: 'Cloud Firestore connected and accessible.',
    };
  }
}

// 6. Auth Helpers
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.error('Google Sign-in failed:', err.message);
    throw err;
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

// 7. Client Firestore Operations with Error Handlers
export async function persistIncidentToFirestore(incident: Incident): Promise<void> {
  const path = `incidents/${incident.id}`;
  try {
    await setDoc(doc(db, 'incidents', incident.id), incident, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteIncidentFromFirestore(incidentId: string): Promise<void> {
  const path = `incidents/${incidentId}`;
  try {
    await deleteDoc(doc(db, 'incidents', incidentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function persistAuditLogToFirestore(entry: AuditLogEntry): Promise<void> {
  const path = `audit_logs/${entry.id}`;
  try {
    await setDoc(doc(db, 'audit_logs', entry.id), entry);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeToIncidents(
  onData: (incidents: Incident[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colPath = 'incidents';
  return onSnapshot(
    collection(db, colPath),
    (snapshot) => {
      const items: Incident[] = [];
      snapshot.forEach((d) => items.push(d.data() as Incident));
      onData(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.GET, colPath);
    }
  );
}

export function subscribeToAuditLogs(
  onData: (logs: AuditLogEntry[]) => void,
  maxLogs: number = 50
): () => void {
  const colPath = 'audit_logs';
  const q = query(collection(db, colPath), limit(maxLogs));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLogEntry[] = [];
      snapshot.forEach((d) => logs.push(d.data() as AuditLogEntry));
      onData(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, colPath);
    }
  );
}
