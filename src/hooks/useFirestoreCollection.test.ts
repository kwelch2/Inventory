import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirestoreError } from 'firebase/firestore';
import { useFirestoreCollection } from './useFirestoreCollection';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(() => ({ kind: 'collection' })),
  query: vi.fn((value: unknown) => value),
  onSnapshot: vi.fn()
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../config/firebase', () => ({ db: {} }));

type TestItem = { id: string; name: string };

describe('useFirestoreCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.onSnapshot.mockReturnValue(vi.fn());
  });

  it('does not subscribe when disabled', () => {
    const { result } = renderHook(() => useFirestoreCollection<TestItem>('items', [], false));
    expect(firestoreMocks.onSnapshot).not.toHaveBeenCalled();
    expect(result.current.status).toBe('disabled');
    expect(result.current.loading).toBe(false);
  });

  it('reports server snapshots as ready data', () => {
    const { result } = renderHook(() => useFirestoreCollection<TestItem>('items'));
    const success = firestoreMocks.onSnapshot.mock.calls[0][2] as (snapshot: unknown) => void;

    act(() => success({
      docs: [{ id: 'one', data: () => ({ name: 'Gloves' }) }],
      metadata: { fromCache: false }
    }));

    expect(result.current.data).toEqual([{ id: 'one', name: 'Gloves' }]);
    expect(result.current.source).toBe('server');
    expect(result.current.status).toBe('ready');
  });

  it('exposes terminal errors and can create a replacement listener', async () => {
    const { result } = renderHook(() => useFirestoreCollection<TestItem>('items'));
    const fail = firestoreMocks.onSnapshot.mock.calls[0][3] as (error: FirestoreError) => void;
    const error = { code: 'permission-denied', message: 'Denied' } as FirestoreError;

    act(() => fail(error));
    expect(result.current.error).toBe(error);
    expect(result.current.status).toBe('error');

    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(firestoreMocks.onSnapshot).toHaveBeenCalledTimes(2));
  });

  it('replaces a recoverable failed listener when the browser comes online', async () => {
    renderHook(() => useFirestoreCollection<TestItem>('items'));
    const fail = firestoreMocks.onSnapshot.mock.calls[0][3] as (error: FirestoreError) => void;

    act(() => fail({ code: 'unavailable', message: 'Offline' } as FirestoreError));
    act(() => window.dispatchEvent(new Event('online')));

    await waitFor(() => expect(firestoreMocks.onSnapshot).toHaveBeenCalledTimes(2));
  });
});
