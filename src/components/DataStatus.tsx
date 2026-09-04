import type { FirestoreError } from 'firebase/firestore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import './DataStatus.css';

type DataStatusProps = {
  loading: boolean;
  error: FirestoreError | null;
  fromCache: boolean;
  onRetry: () => void;
  loadingLabel?: string;
};

const getErrorMessage = (error: FirestoreError) => {
  if (error.code === 'permission-denied') return 'You do not have permission to load this data.';
  if (error.code === 'failed-precondition') return 'This data query needs additional Firebase configuration.';
  if (error.code === 'unauthenticated') return 'Your authentication has expired. Please sign in again.';
  return 'The live data connection failed.';
};

export const DataStatus = ({ loading, error, fromCache, onRetry, loadingLabel = 'Loading data...' }: DataStatusProps) => {
  const online = useNetworkStatus();

  if (error) {
    return (
      <div className="data-status data-status-error" role="alert">
        <span>{getErrorMessage(error)}</span>
        <button className="btn btn-small" type="button" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (!online) {
    return <div className="data-status data-status-warning" role="status">Offline — displayed data may be out of date.</div>;
  }

  if (loading) {
    return <div className="data-status data-status-loading" role="status">{loadingLabel}</div>;
  }

  if (fromCache) {
    return <div className="data-status data-status-warning" role="status">Showing cached data while reconnecting…</div>;
  }

  return <div className="data-status data-status-live" role="status"><span className="status-dot" /> Live</div>;
};
