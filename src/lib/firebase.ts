import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "juicy-effort-3f4nj",
  appId: "1:638243832384:web:eaa14e768bcc9ccc1f55a5",
  apiKey: "AIzaSyCh3G6ToVVpPuuC1nQCv3xbDNi3idSfFGU",
  authDomain: "juicy-effort-3f4nj.firebaseapp.com",
  storageBucket: "juicy-effort-3f4nj.firebasestorage.app",
  messagingSenderId: "638243832384"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use custom Firestore Database ID designated in config
const db = initializeFirestore(app, {}, "ai-studio-fab40bd7-1b85-4807-bf95-70ea953ee3a2");

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app, auth, db };
