import { useCallback, useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import type { FirestoreError, QueryConstraint } from 'firebase/firestore';
import { db } from '../config/firebase';

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export function useFirestoreCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS,
  enabled = true
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [source, setSource] = useState<'cache' | 'server' | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  const retry = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setSource(null);
    setRetryVersion(version => version + 1);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const collectionRef = collection(db, collectionName);
    const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        setData(items);
        setLoading(false);
        setError(null);
        setSource(snapshot.metadata.fromCache ? 'cache' : 'server');
      },
      (err) => {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, constraints, enabled, retryVersion]);

  useEffect(() => {
    if (!enabled || !error || !['cancelled', 'unknown', 'deadline-exceeded', 'internal', 'unavailable'].includes(error.code)) {
      return;
    }

    const recover = () => retry();
    const recoverWhenVisible = () => {
      if (document.visibilityState === 'visible') recover();
    };
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recoverWhenVisible);
    return () => {
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recoverWhenVisible);
    };
  }, [enabled, error, retry]);

  const visibleLoading = enabled ? loading : false;
  const visibleError = enabled ? error : null;

  return {
    data,
    loading: visibleLoading,
    error: visibleError,
    source: enabled ? source : null,
    status: !enabled ? 'disabled' as const : visibleError ? 'error' as const : visibleLoading ? 'loading' as const : 'ready' as const,
    retry
  };
}
