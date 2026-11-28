import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { auth } from './auth';
import { CalendarEvent } from '../types/calendar';

const db = getFirestore(auth.app);

/**
 * Sets up a real-time listener for the authenticated user's calendar events.
 */
export function subscribeUserEvents(
  userId: string,
  onSync: (events: CalendarEvent[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const eventsCol = collection(db, 'users', userId, 'events');

  return onSnapshot(
    eventsCol,
    (snapshot) => {
      const remoteEvents: CalendarEvent[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CalendarEvent;
        remoteEvents.push({ ...data, id: docSnap.id });
      });
      onSync(remoteEvents);
    },
    (err) => {
      console.warn('Firestore sync snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Saves or updates a single event to Firestore.
 */
export async function saveEventToFirestore(
  userId: string,
  event: CalendarEvent
): Promise<void> {
  const eventRef = doc(db, 'users', userId, 'events', event.id);
  await setDoc(eventRef, { ...event, updatedAt: Date.now() }, { merge: true });
}

/**
 * Deletes an event from Firestore.
 */
export async function deleteEventFromFirestore(
  userId: string,
  eventId: string
): Promise<void> {
  const eventRef = doc(db, 'users', userId, 'events', eventId);
  await deleteDoc(eventRef);
}

/**
 * Uploads a batch of events to Firestore (initial full sync).
 */
export async function batchUploadEvents(
  userId: string,
  events: CalendarEvent[]
): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;

  for (const ev of events) {
    const eventRef = doc(db, 'users', userId, 'events', ev.id);
    batch.set(eventRef, { ...ev, updatedAt: Date.now() }, { merge: true });
    count++;
  }

  await batch.commit();
  return count;
}

export interface RemoteProductivityDoc {
  data: Record<string, unknown>;
  updatedAt: number;
}

/**
 * Subscribe to the user's cross-device productivity & fitness snapshot in Firestore.
 */
export function subscribeProductivitySnapshot(
  userId: string,
  onSync: (docData: RemoteProductivityDoc | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const snapRef = doc(db, 'users', userId, 'productivity', 'snapshot');
  return onSnapshot(
    snapRef,
    (snap) => {
      if (!snap.exists()) {
        onSync(null);
        return;
      }
      const raw = snap.data() as { data?: Record<string, unknown>; updatedAt?: number };
      if (raw?.data && typeof raw.updatedAt === 'number') {
        onSync({ data: raw.data, updatedAt: raw.updatedAt });
      } else {
        onSync(null);
      }
    },
    (err) => {
      console.warn('Firestore productivity snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Persist the user's productivity & fitness snapshot to Firestore for Web <-> iPhone sync.
 */
export async function saveProductivitySnapshot(
  userId: string,
  snapshot: unknown,
  updatedAt: number = Date.now()
): Promise<void> {
  const sanitized = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  const snapRef = doc(db, 'users', userId, 'productivity', 'snapshot');
  await setDoc(snapRef, { data: sanitized, updatedAt }, { merge: true });
}
