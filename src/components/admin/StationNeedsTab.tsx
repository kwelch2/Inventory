import { useMemo, useRef, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DataStatus } from '../DataStatus';
import { useFirestoreCollection } from '../../hooks/useFirestoreCollection';
import type { StationNeed, StationNeedStatus } from '../../types';
import {
  STATION_STORES,
  formatQuantity,
  isValidQuantity,
  normalizeItem,
  printStationList,
  sortStationNeeds,
  type StationSort,
  type StationStore
} from '../../utils/stationNeeds';
import '../RequestSummaryPanels.css';

type PresetItem = { id: string; name: string };
type NeedDraft = { id: string | null; item: string; quantity: string; store: StationStore | ''; note: string };
const EMPTY_DRAFT: NeedDraft = { id: null, item: '', quantity: '', store: '', note: '' };

export const StationNeedsTab = () => {
  const presetResult = useFirestoreCollection<PresetItem>('stationPresetItems');
  const needsResult = useFirestoreCollection<StationNeed>('stationNeeds');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState<NeedDraft | null>(null);
  const [sortBy, setSortBy] = useState<StationSort>('store');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const presets = useMemo(
    () => [...presetResult.data].sort((a, b) => a.name.localeCompare(b.name)),
    [presetResult.data]
  );
  const activeNeeds = useMemo(
    () => sortStationNeeds(needsResult.data.filter(n => n.status === 'Needed' || n.status === 'Purchased'), sortBy),
    [needsResult.data, sortBy]
  );

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
      setFailed(false);
      setMessage(success);
    } catch (error) {
      console.error(failure, error);
      setFailed(true);
      setMessage(failure);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const nameExists = (name: string, exceptId?: string) =>
    presets.some(p => p.id !== exceptId && normalizeItem(p.name) === normalizeItem(name));

  const addPreset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || name.length > 200) {
      setFailed(true);
      setMessage('Enter an item name (up to 200 characters).');
      return;
    }
    if (nameExists(name)) {
      setFailed(true);
      setMessage('That item is already in the quick-pick list.');
      return;
    }
    void run(async () => {
      await addDoc(collection(db, 'stationPresetItems'), {
        name, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setNewName('');
    }, `${name} added.`, 'Could not add the item. Try again.');
  };

  const saveRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const name = editing.name.trim();
    if (!name || name.length > 200 || nameExists(name, editing.id)) {
      setFailed(true);
      setMessage('Enter a unique item name (up to 200 characters).');
      return;
    }
    void run(async () => {
      await updateDoc(doc(db, 'stationPresetItems', editing.id), { name, updatedAt: serverTimestamp() });
      setEditing(null);
    }, 'Item renamed.', 'Could not rename the item. Try again.');
  };

  const removePreset = (preset: PresetItem) => {
    if (!window.confirm(`Remove "${preset.name}" from the quick-pick list? Existing shopping requests are not affected.`)) return;
    void run(() => deleteDoc(doc(db, 'stationPresetItems', preset.id)), `${preset.name} removed.`, 'Could not remove the item. Try again.');
  };

  const startNeedEdit = (need?: StationNeed) => {
    setMessage('');
    setDraft(need ? {
      id: need.id,
      item: need.item,
      quantity: need.quantity === undefined ? '' : String(need.quantity),
      store: need.store ?? '',
      note: need.note ?? ''
    } : EMPTY_DRAFT);
  };

  const saveNeed = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || busyRef.current) return;
    const item = draft.item.trim();
    const quantity = draft.quantity.trim() ? Number(draft.quantity) : undefined;
    const note = draft.note.trim();
    const invalid = (text: string) => { setFailed(true); setMessage(text); };
    if (!item || item.length > 200) return invalid('Enter an item name (up to 200 characters).');
    if (quantity !== undefined && !isValidQuantity(quantity)) return invalid('Enter a whole-number quantity from 1 to 100,000.');
    if (note.length > 1000) return invalid('Note must be 1,000 characters or fewer.');
    if (needsResult.status !== 'ready') return invalid('The shared list is not ready. Retry loading it first.');
    const duplicate = needsResult.data.some(need =>
      need.id !== draft.id &&
      (need.status === 'Needed' || need.status === 'Purchased') &&
      normalizeItem(need.item) === normalizeItem(item));
    if (duplicate) return invalid('An active request already exists for that item. Edit that request instead.');

    const current = draft;
    void run(async () => {
      if (current.id) {
        await updateDoc(doc(db, 'stationNeeds', current.id), {
          item,
          quantity: quantity ?? deleteField(),
          store: current.store || deleteField(),
          note: note || deleteField(),
          updatedAt: serverTimestamp()
        });
      } else {
        const data: Record<string, unknown> = {
          item, status: 'Needed', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        };
        if (quantity !== undefined) data.quantity = quantity;
        if (current.store) data.store = current.store;
        if (note) data.note = note;
        await addDoc(collection(db, 'stationNeeds'), data);
      }
      setDraft(null);
    }, current.id ? `${item} updated.` : `${item} added to the list.`, `Could not save ${item}. Try again.`);
  };

  const setStatus = (need: StationNeed, status: StationNeedStatus) => {
    void run(
      () => updateDoc(doc(db, 'stationNeeds', need.id), { status, updatedAt: serverTimestamp() }),
      `${need.item} marked ${status.toLowerCase()}.`,
      `Could not update ${need.item}. Try again.`
    );
  };

  return (
    <div className="station-admin-tab">
      <div className="content-card">
        <h2>Quick-pick items</h2>
        <p className="muted">These are the standard choices crews see when adding a station need.</p>
        <DataStatus loading={presetResult.loading} error={presetResult.error} fromCache={presetResult.source === 'cache'} onRetry={presetResult.retry} />
        {presetResult.status === 'ready' && presets.length === 0 && (
          <p className="muted">No quick-pick items yet. Add the items your crews buy most often.</p>
        )}
        <ul className="station-admin-presets">
          {presets.map(preset => (
            <li key={preset.id}>
              {editing?.id === preset.id ? (
                <form onSubmit={saveRename} className="station-admin-inline-form">
                  <label htmlFor={`preset-${preset.id}`}>Item name</label>
                  <input id={`preset-${preset.id}`} type="text" maxLength={200} value={editing.name}
                    onChange={event => setEditing({ id: preset.id, name: event.target.value })} />
                  <button type="submit" className="btn btn-small btn-primary" disabled={busy}>Save</button>
                  <button type="button" className="btn btn-small" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span>{preset.name}</span>
                  <button type="button" className="btn btn-small" disabled={busy} aria-label={`Rename ${preset.name}`}
                    onClick={() => setEditing({ id: preset.id, name: preset.name })}>Edit</button>
                  <button type="button" className="btn btn-small" disabled={busy} aria-label={`Remove ${preset.name}`}
                    onClick={() => removePreset(preset)}>Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
        {(presets.length > 0 || presetResult.status === 'ready') && (
          <form onSubmit={addPreset} className="station-admin-inline-form">
            <label htmlFor="new-preset-item">New quick-pick item</label>
            <input id="new-preset-item" type="text" maxLength={200} value={newName} onChange={event => setNewName(event.target.value)} />
            <button type="submit" className="btn btn-small btn-primary" disabled={busy || presetResult.status !== 'ready'}>Add item</button>
          </form>
        )}
      </div>

      <div className="content-card">
        <h2>Shopping list</h2>
        <DataStatus loading={needsResult.loading} error={needsResult.error} fromCache={needsResult.source === 'cache'} onRetry={needsResult.retry} />
        <div className="station-list-toolbar">
          <label htmlFor="admin-station-sort">Sort by</label>
          <select id="admin-station-sort" value={sortBy} onChange={event => setSortBy(event.target.value as StationSort)}>
            <option value="store">Store</option>
            <option value="item">Item name</option>
            <option value="status">Status</option>
          </select>
          <button type="button" className="btn btn-small" disabled={activeNeeds.length === 0} onClick={printStationList}>
            Print shopping list
          </button>
          <button type="button" className="btn btn-small btn-primary" disabled={busy || needsResult.status !== 'ready'} onClick={() => startNeedEdit()}>
            Add item to list
          </button>
        </div>
        {draft && (
          <form className="station-need-edit station-admin-need-form" onSubmit={saveNeed}>
            <h3>{draft.id ? 'Edit list item' : 'Add list item'}</h3>
            <label htmlFor="admin-need-item">Item</label>
            <input id="admin-need-item" type="text" maxLength={200} list="admin-need-presets" value={draft.item}
              onChange={event => setDraft({ ...draft, item: event.target.value })} />
            <datalist id="admin-need-presets">
              {presets.map(preset => <option value={preset.name} key={preset.id} />)}
            </datalist>
            <label htmlFor="admin-need-quantity">Quantity (optional)</label>
            <input id="admin-need-quantity" type="number" min="1" max="100000" step="1" value={draft.quantity}
              onChange={event => setDraft({ ...draft, quantity: event.target.value })} />
            <label htmlFor="admin-need-store">Store (optional)</label>
            <select id="admin-need-store" value={draft.store}
              onChange={event => setDraft({ ...draft, store: event.target.value as StationStore | '' })}>
              <option value="">No preference</option>
              {STATION_STORES.map(store => <option value={store} key={store}>{store}</option>)}
            </select>
            <label htmlFor="admin-need-note">Note (optional)</label>
            <textarea id="admin-need-note" maxLength={1000} rows={2} value={draft.note}
              onChange={event => setDraft({ ...draft, note: event.target.value })} />
            <div className="station-need-actions">
              <button type="submit" className="btn btn-small btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn btn-small" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        )}
        {activeNeeds.length === 0 ? (
          <p className="muted">No active station needs.</p>
        ) : (
          <ul className="station-admin-needs station-print-area-source">
            {activeNeeds.map(need => (
              <li key={need.id} className="station-need-row">
                <div>
                  <strong>{need.item}</strong>
                  <span className="station-need-details">{[formatQuantity(need), need.store, need.note].filter(Boolean).join(' · ')}</span>
                  <span className={`station-need-status station-need-status-${need.status.toLowerCase()}`}>{need.status}</span>
                </div>
                <div className="station-need-actions">
                  <button type="button" className="btn btn-small" disabled={busy} aria-label={`Edit ${need.item}`} onClick={() => startNeedEdit(need)}>Edit</button>
                                    {need.status === 'Needed' && (
                                      <button type="button" className="btn btn-small" disabled={busy} onClick={() => setStatus(need, 'Purchased')}>Mark Purchased</button>
                  )}
                  {need.status === 'Purchased' && (
                    <button type="button" className="btn btn-small" disabled={busy} onClick={() => setStatus(need, 'Stocked')}>Mark Stocked</button>
                  )}
                  <button type="button" className="btn btn-small" disabled={busy} onClick={() => setStatus(need, 'Cancelled')}>Cancel</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {message && <p className={failed ? 'panel-error-message' : 'panel-success-message'} role={failed ? 'alert' : 'status'}>{message}</p>}
        <div className="station-print-area" aria-hidden="true">
          <h1>Station shopping list</h1>
          {sortStationNeeds(activeNeeds.filter(n => n.status === 'Needed'), sortBy === 'status' ? 'store' : sortBy).map(need => (
            <p key={need.id}>
              ☐ <strong>{need.item}</strong>
              {[formatQuantity(need), need.store, need.note].some(Boolean) &&
                ` — ${[formatQuantity(need), need.store, need.note].filter(Boolean).join(' · ')}`}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};
