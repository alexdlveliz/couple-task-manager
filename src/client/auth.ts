import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence, type User } from 'firebase/auth';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-shared-task-board';
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
});
export const auth = getAuth(app);
if (import.meta.env.VITE_USE_AUTH_EMULATOR === 'true') {
  if (import.meta.env.PROD && import.meta.env.MODE !== 'demo') throw new Error('Emulator mode is forbidden in production builds');
  if (projectId !== 'demo-shared-task-board') throw new Error('Emulator mode requires the demo project');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
export const authReady = setPersistence(auth, browserLocalPersistence);
let generation = 0;
let currentUid: string | null = null;
export function updateAuthGeneration(user: User | null): number {
  const uid = user?.uid ?? null;
  if (uid !== currentUid) { currentUid = uid; generation++; }
  return generation;
}
export function getAuthGeneration(): number { return generation; }
