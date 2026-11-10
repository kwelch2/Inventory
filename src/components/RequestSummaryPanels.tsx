import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  addDoc,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DataStatus } from './DataStatus';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import type { OxygenStatus, OxygenStock, StationNeed, StationNeedStatus } from '../types';
import {
  STATION_STORES,
  buildShoppingListText,
  formatQuantity,
  isValidQuantity,
  normalizeItem,
  printStationList,
  sortStationNeeds,
  type StationSort,
  type StationStore
} from '../utils/stationNeeds';
import './RequestSummaryPanels.css';

type RequestCounts = {
  openCount: number;
  orderedCount: number;
  backorderedCount: number;
};

type ExpandedPanel = 'oxygen' | 'station' | null;
type EditDraft = { id: string; item: string; quantity: string; store: StationStore | ''; note: string };
type OxygenField = 'dStatus' | 'sStatus';

const OXYGEN_OPTIONS: OxygenStatus[] = ['OK', 'Low', 'Out'];
const ACTIVE_STATION_STATUSES: StationNeedStatus[] = ['Needed', 'Purchased'];

export const RequestSummaryPanels = ({ requestCounts }: { requestCounts: RequestCounts }) => {
  const oxygenResult = useFirestoreCollection<OxygenStock>('oxygenStock');
  const stationResult = useFirestoreCollection<StationNeed>('stationNeeds');
  const presetResult = useFirestoreCollection<{ id: string; name: string }>('stationPresetItems');
  const standardItems = useMemo(
    () => presetResult.data.map(preset => preset.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [presetResult.data]
  );
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const [oxygenSavingFields, setOxygenSavingFields] = useState<OxygenField[]>([]);
  const oxygenSavingFieldsRef = useRef(new Set<OxygenField>());
  const [oxygenSaveMessage, setOxygenSaveMessage] = useState('');
  const [stationChoice, setStationChoice] = useState('');
  const [customItem, setCustomItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [store, setStore] = useState<StationStore | ''>('');
  const [note, setNote] = useState('');
  const [sortBy, setSortBy] = useState<StationSort>('store');
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [stationSubmitting, setStationSubmitting] = useState(false);
  const stationSubmittingRef = useRef(false);
  const [savingNeedIds, setSavingNeedIds] = useState<string[]>([]);
  const savingNeedIdsRef = useRef(new Set<string>());
  const [pendingStationItems, setPendingStationItems] = useState<string[]>([]);
  const pendingStationItemsRef = useRef(new Map<string, string | null>());
  const [stationSaveMessage, setStationSaveMessage] = useState('');
  const oxygenButtonRef = useRef<HTMLButtonElement>(null);
  const stationButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyExpanded = useRef<ExpandedPanel>(null);

  const oxygenStock = oxygenResult.data.find(item => item.id === 'shared');
  const stationNeeds = stationResult.data;
  const activeStationNeeds = useMemo(
    () => stationNeeds.filter(item => ACTIVE_STATION_STATUSES.includes(item.status)),
    [stationNeeds]
  );
  const neededItems = activeStationNeeds.filter(item => item.status === 'Needed');
  const purchasedCount = activeStationNeeds.filter(item => item.status === 'Purchased').length;
  const stationSummaryReady = stationResult.status === 'ready' ||
    (stationResult.error !== null && stationNeeds.length > 0);
  const itemName = stationChoice === 'custom' ? customItem.trim() : stationChoice;
  const duplicateNeed = itemName
    ? activeStationNeeds.find(item => normalizeItem(item.item) === normalizeItem(itemName))
    : undefined;
  const matchingPendingItem = itemName && pendingStationItems.includes(normalizeItem(itemName));

  useEffect(() => {
    if (previouslyExpanded.current && !expandedPanel) {
      const button = previouslyExpanded.current === 'oxygen'
        ? oxygenButtonRef.current
        : stationButtonRef.current;
      button?.focus();
    }
    previouslyExpanded.current = expandedPanel;
  }, [expandedPanel]);

  useEffect(() => {
    if (pendingStationItemsRef.current.size === 0) return;
    const activeNames = new Set(activeStationNeeds.map(item => normalizeItem(item.item)));
    const unresolvedItems = [...pendingStationItemsRef.current.entries()]
      .filter(([item, id]) => id
        ? !stationNeeds.some(need => need.id === id)
        : !activeNames.has(item))
      .map(([item]) => item);
    if (unresolvedItems.length !== pendingStationItemsRef.current.size) {
      pendingStationItemsRef.current = new Map(
        unresolvedItems.map(item => [item, pendingStationItemsRef.current.get(item) ?? null])
      );
      setPendingStationItems(unresolvedItems);
    }
  }, [activeStationNeeds, stationNeeds]);

  const togglePanel = (panel: Exclude<ExpandedPanel, null>) => {
    setExpandedPanel(current => current === panel ? null : panel);
  };

  const saveOxygenStatus = async (field: OxygenField, status: OxygenStatus) => {
    if (oxygenSavingFieldsRef.current.has(field)) return;
    const cylinder = field === 'dStatus' ? 'D-Cylinder' : 'S-Cylinder';
    if (status === 'Out') {
      if (!window.confirm(`Confirm that the ${cylinder} is Out?`)) return;
    }

    oxygenSavingFieldsRef.current.add(field);
    setOxygenSavingFields(current => [...current, field]);
    setOxygenSaveMessage('');
    try {
      await setDoc(doc(db, 'oxygenStock', 'shared'), {
        [field]: status,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setOxygenSaveMessage(`${cylinder} status saved.`);
    } catch (error) {
      console.error('Error saving oxygen status:', error);
      setOxygenSaveMessage(`Could not save the ${cylinder} status. Try again.`);
    } finally {
      oxygenSavingFieldsRef.current.delete(field);
      setOxygenSavingFields(current => current.filter(savingField => savingField !== field));
    }
  };

  const resetStationForm = () => {
    setStationChoice('');
    setCustomItem('');
    setQuantity('');
    setStore('');
    setNote('');
  };

  const getStationFormValues = () => {
    if (!itemName || itemName.length > 200) {
      setStationSaveMessage('Choose or enter an item name (up to 200 characters).');
      return null;
    }
    if (note.trim().length > 1000) {
      setStationSaveMessage('Note must be 1,000 characters or fewer.');
      return null;
    }
    const parsedQuantity = quantity.trim() ? Number(quantity) : undefined;
    if (parsedQuantity !== undefined && !isValidQuantity(parsedQuantity)) {
      setStationSaveMessage('Enter a whole-number quantity from 1 to 100,000.');
      return null;
    }
    return {
      item: itemName,
      quantity: parsedQuantity,
      store,
      note: note.trim()
    };
  };

  const submitStationNeed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stationSubmittingRef.current) return;
    if (stationResult.status !== 'ready') {
      setStationSaveMessage('The shared list is not ready. Retry loading it before submitting.');
      return;
    }
    const values = getStationFormValues();
    if (!values) return;
    if (duplicateNeed) {
      setStationSaveMessage(`An active ${duplicateNeed.status.toLowerCase()} request already exists for this item. Update that request or change the item.`);
      return;
    }
    if (matchingPendingItem) {
      setStationSaveMessage('This item was just submitted. Wait for the shared list to sync before submitting it again.');
      return;
    }

    stationSubmittingRef.current = true;
    setStationSubmitting(true);
    setStationSaveMessage('');
    const normalizedItem = normalizeItem(values.item);
    pendingStationItemsRef.current.set(normalizedItem, null);
    setPendingStationItems([...pendingStationItemsRef.current.keys()]);
    try {
      const requestData: Record<string, unknown> = {
        item: values.item,
        status: 'Needed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (values.store) requestData.store = values.store;
      if (values.quantity !== undefined) requestData.quantity = values.quantity;
      if (values.note) requestData.note = values.note;
      const createdNeed = await addDoc(collection(db, 'stationNeeds'), requestData);
      if (pendingStationItemsRef.current.has(normalizedItem)) {
        pendingStationItemsRef.current.set(normalizedItem, createdNeed.id);
      }
      setStationSaveMessage('Station need submitted.');
      resetStationForm();
    } catch (error) {
      pendingStationItemsRef.current.delete(normalizedItem);
      setPendingStationItems([...pendingStationItemsRef.current.keys()]);
      console.error('Error creating station need:', error);
      setStationSaveMessage('Could not submit the station need. Try again.');
    } finally {
      stationSubmittingRef.current = false;
      setStationSubmitting(false);
    }
  };

  const updateDuplicateNeed = async () => {
    if (!duplicateNeed || stationSubmittingRef.current || stationResult.status !== 'ready') return;
    const values = getStationFormValues();
    if (!values) return;
    const hasChanges = duplicateNeed.item !== values.item ||
      duplicateNeed.quantity !== values.quantity ||
      (duplicateNeed.store || '') !== values.store ||
      (duplicateNeed.note || '') !== values.note;
    if (!hasChanges) {
      setStationSaveMessage('The existing station need already has these details.');
      return;
    }

    stationSubmittingRef.current = true;
    setStationSubmitting(true);
    setStationSaveMessage('');
    try {
      await updateDoc(doc(db, 'stationNeeds', duplicateNeed.id), {
        item: values.item,
        quantity: values.quantity ?? deleteField(),
        store: values.store || deleteField(),
        note: values.note || deleteField(),
        updatedAt: serverTimestamp()
      });
      setStationSaveMessage('Existing station need updated.');
      resetStationForm();
    } catch (error) {
      console.error('Error updating station need:', error);
      setStationSaveMessage('Could not update the existing station need. Try again.');
    } finally {
      stationSubmittingRef.current = false;
      setStationSubmitting(false);
    }
  };

  const updateStationStatus = async (need: StationNeed, status: StationNeedStatus) => {
    if (savingNeedIdsRef.current.has(need.id)) return;
    savingNeedIdsRef.current.add(need.id);
    setSavingNeedIds(current => [...current, need.id]);
    setStationSaveMessage('');
    try {
      await updateDoc(doc(db, 'stationNeeds', need.id), {
        status,
        updatedAt: serverTimestamp()
      });
      setStationSaveMessage(`${need.item} marked ${status.toLowerCase()}.`);
    } catch (error) {
      console.error('Error updating station need status:', error);
      setStationSaveMessage(`Could not update ${need.item}. Try again.`);
    } finally {
      savingNeedIdsRef.current.delete(need.id);
      setSavingNeedIds(current => current.filter(id => id !== need.id));
    }
  };

  const statusText = (field: OxygenField) => {
    const status = oxygenStock?.[field];
    return status === 'OK' || status === 'Low' || status === 'Out' ? status : 'Not set';
  };

  const getStationQuantity = formatQuantity;

  const sortedActiveNeeds = useMemo(
    () => sortStationNeeds(activeStationNeeds, sortBy),
    [activeStationNeeds, sortBy]
  );
  const shoppingList = useMemo(
    () => sortStationNeeds(activeStationNeeds.filter(item => item.status === 'Needed'), sortBy === 'status' ? 'store' : sortBy),
    [activeStationNeeds, sortBy]
  );

  const startEdit = (need: StationNeed) => {
    setStationSaveMessage('');
    setEditDraft({
      id: need.id,
      item: need.item,
      quantity: need.quantity === undefined ? '' : String(need.quantity),
      store: need.store ?? '',
      note: need.note ?? ''
    });
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDraft || savingNeedIdsRef.current.has(editDraft.id)) return;
    const item = editDraft.item.trim();
    const parsedQuantity = editDraft.quantity.trim() ? Number(editDraft.quantity) : undefined;
    if (!item || item.length > 200) {
      setStationSaveMessage('Enter an item name (up to 200 characters).');
      return;
    }
    if (parsedQuantity !== undefined && !isValidQuantity(parsedQuantity)) {
      setStationSaveMessage('Enter a whole-number quantity from 1 to 100,000.');
      return;
    }
    if (editDraft.note.trim().length > 1000) {
      setStationSaveMessage('Note must be 1,000 characters or fewer.');
      return;
    }
    if (activeStationNeeds.some(need => need.id !== editDraft.id && normalizeItem(need.item) === normalizeItem(item))) {
      setStationSaveMessage('An active request already exists for that item. Edit that request instead.');
      return;
    }

    const id = editDraft.id;
    savingNeedIdsRef.current.add(id);
    setSavingNeedIds(current => [...current, id]);
    setStationSaveMessage('');
    try {
      await updateDoc(doc(db, 'stationNeeds', id), {
        item,
        quantity: parsedQuantity ?? deleteField(),
        store: editDraft.store || deleteField(),
        note: editDraft.note.trim() || deleteField(),
        updatedAt: serverTimestamp()
      });
      setStationSaveMessage(`${item} updated.`);
      setEditDraft(null);
    } catch (error) {
      console.error('Error editing station need:', error);
      setStationSaveMessage(`Could not update ${item}. Try again.`);
    } finally {
      savingNeedIdsRef.current.delete(id);
      setSavingNeedIds(current => current.filter(savingId => savingId !== id));
    }
  };

  const copyShoppingList = async () => {
    try {
      await navigator.clipboard.writeText(buildShoppingListText(shoppingList));
      setShareMessage('Shopping list copied.');
    } catch (error) {
      console.error('Error copying shopping list:', error);
      setShareMessage('Could not copy the list. Use Print or Email instead.');
    }
  };

  const emailHref = `mailto:?subject=${encodeURIComponent('Station shopping list')}&body=${encodeURIComponent(buildShoppingListText(shoppingList))}`;

  return (
    <section className="request-summary-panels" aria-label="Supply summaries">
      <div className="request-summary-cards">
        <article className="request-summary-card supply-summary-card">
          <h2>Supply Requests</h2>
          <dl className="supply-request-counts">
            <div><dt>Open</dt><dd>{requestCounts.openCount}</dd></div>
            <div><dt>Ordered</dt><dd>{requestCounts.orderedCount}</dd></div>
            <div><dt>Backordered</dt><dd>{requestCounts.backorderedCount}</dd></div>
          </dl>
        </article>

        <button
          ref={oxygenButtonRef}
          className="request-summary-card request-summary-toggle"
          type="button"
          aria-expanded={expandedPanel === 'oxygen'}
          aria-controls="oxygen-stock-panel"
          onClick={() => togglePanel('oxygen')}
        >
          <span className="request-summary-title">Oxygen</span>
          <span className="oxygen-summary-statuses">
            <OxygenStatusLabel cylinder="D-Cylinder" status={statusText('dStatus')} />
                        <OxygenStatusLabel cylinder="S-Cylinder" status={statusText('sStatus')} />
          </span>
          <span className="delivery-note">Delivery every Thursday.</span>
          <span className="request-summary-hint">{expandedPanel === 'oxygen' ? 'Close oxygen controls' : 'Manage oxygen stock'}</span>
        </button>

        <button
          ref={stationButtonRef}
          className="request-summary-card request-summary-toggle"
          type="button"
          aria-expanded={expandedPanel === 'station'}
          aria-controls="station-needs-panel"
          onClick={() => togglePanel('station')}
        >
          <span className="request-summary-title">Station Needs</span>
          <span className="station-summary-items">
            {stationSummaryReady
              ? neededItems.slice(0, 2).map(item => item.item).join(' · ') || 'No items needed'
              : stationResult.status === 'loading' ? 'Loading shared list…' : 'List unavailable'}
          </span>
          <span className="station-summary-counts">
            Needed: {stationSummaryReady ? neededItems.length : '—'} · Purchased: {stationSummaryReady ? purchasedCount : '—'}
          </span>
          <span className="request-summary-hint">{expandedPanel === 'station' ? 'Close station list' : 'Manage station list'}</span>
        </button>
      </div>

      <section
        id="oxygen-stock-panel"
        className="request-expanded-panel"
        aria-labelledby="oxygen-panel-heading"
        hidden={expandedPanel !== 'oxygen'}
      >
        <header className="request-expanded-header">
          <div>
            <h2 id="oxygen-panel-heading">Oxygen</h2>
            <p>Shared cylinder status. Delivery every Thursday.</p>
          </div>
          <button type="button" className="btn btn-small" onClick={() => setExpandedPanel(null)}>Close</button>
        </header>
        <DataStatus
          loading={oxygenResult.loading}
          error={oxygenResult.error}
          fromCache={oxygenResult.source === 'cache'}
          onRetry={oxygenResult.retry}
        />
        <div className="oxygen-controls">
          {(['dStatus', 'sStatus'] as OxygenField[]).map(field => {
            const cylinder = field === 'dStatus' ? 'D-Cylinder' : 'S-Cylinder';
            const currentStatus = statusText(field);
            const saving = oxygenSavingFields.includes(field);
            return (
              <fieldset className="oxygen-cylinder-controls" key={field}>
                <legend>{cylinder} status</legend>
                <p className="oxygen-current-status">
                  Current status: <OxygenStatusLabel cylinder={cylinder} status={currentStatus} />
                </p>
                <div className="oxygen-status-options" role="group" aria-label={`${cylinder} status`}>
                  {OXYGEN_OPTIONS.map(status => (
                    <button
                      className={`oxygen-option oxygen-option-${status.toLowerCase()}`}
                      type="button"
                      key={status}
                      aria-label={`Set ${cylinder} to ${status}`}
                      aria-pressed={currentStatus === status}
                      disabled={saving}
                      onClick={() => void saveOxygenStatus(field, status)}
                    >
                      <span className="oxygen-option-check" aria-hidden="true">{currentStatus === status ? '✓' : ''}</span>
                      {status}
                    </button>
                  ))}
                </div>
                {saving && <p className="muted oxygen-saving" role="status">Saving…</p>}
              </fieldset>
            );
          })}
        </div>
        {oxygenSaveMessage && (
          <p className={oxygenSaveMessage.startsWith('Could not') ? 'panel-error-message' : 'panel-success-message'} role={oxygenSaveMessage.startsWith('Could not') ? 'alert' : 'status'}>
            {oxygenSaveMessage}
          </p>
        )}
      </section>

      <section
        id="station-needs-panel"
        className="request-expanded-panel"
        aria-labelledby="station-panel-heading"
        hidden={expandedPanel !== 'station'}
      >
        <header className="request-expanded-header">
          <div>
            <h2 id="station-panel-heading">Station Needs</h2>
            <p>Shared station shopping list, separate from medical supply requests.</p>
          </div>
          <button type="button" className="btn btn-small" onClick={() => setExpandedPanel(null)}>Close</button>
        </header>
        <DataStatus
          loading={stationResult.loading}
          error={stationResult.error}
          fromCache={stationResult.source === 'cache'}
          onRetry={stationResult.retry}
        />
        <div className="station-needs-layout">
          <form className="station-need-form" onSubmit={event => void submitStationNeed(event)}>
            <h3>Add a station need</h3>
            <label htmlFor="station-item-choice">Item</label>
            <select
              id="station-item-choice"
              value={stationChoice}
              onChange={event => {
                setStationChoice(event.target.value);
                setStationSaveMessage('');
              }}
            >
              <option value="">Choose an item</option>
              {standardItems.map(item => <option value={item} key={item}>{item}</option>)}
              <option value="custom">Other / custom item</option>
            </select>
            {stationChoice === 'custom' && (
              <>
                <label htmlFor="station-custom-item">Custom item name</label>
                <input
                  id="station-custom-item"
                  type="text"
                  maxLength={200}
                  value={customItem}
                  onChange={event => setCustomItem(event.target.value)}
                />
              </>
            )}

            <div className="station-optional-fields">
              <div>
                <label htmlFor="station-quantity">Quantity (optional)</label>
                <input
                  id="station-quantity"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={quantity}
                  onChange={event => setQuantity(event.target.value)}
                />
              </div>
            </div>

            <label htmlFor="station-store">Store (optional)</label>
            <select id="station-store" value={store} onChange={event => setStore(event.target.value as StationStore | '')}>
              <option value="">No preference</option>
              {STATION_STORES.map(storeOption => <option value={storeOption} key={storeOption}>{storeOption}</option>)}
            </select>

            <label htmlFor="station-note">Note (optional)</label>
            <textarea
              id="station-note"
              maxLength={1000}
              rows={3}
              value={note}
              onChange={event => setNote(event.target.value)}
            />

            {duplicateNeed && (
              <div className="station-duplicate-warning" role="alert">
                <p>
                  A {duplicateNeed.status.toLowerCase()} request for {duplicateNeed.item} already exists.
                  Update it instead of creating a duplicate.
                </p>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={stationSubmitting || stationResult.status !== 'ready'}
                  onClick={() => void updateDuplicateNeed()}
                >
                  Update existing request
                </button>
              </div>
            )}
            {matchingPendingItem && !duplicateNeed && (
              <p className="station-duplicate-warning" role="status">
                This item was just submitted. Wait for the shared list to sync before submitting it again.
              </p>
            )}

            {stationResult.status !== 'ready' && (
              <p className="muted" role="status">Wait until the shared list is available before submitting.</p>
            )}
            {stationSaveMessage && (
              <p className={stationSaveMessage.startsWith('Could not') || stationSaveMessage.startsWith('Choose') || stationSaveMessage.startsWith('Enter') || stationSaveMessage.startsWith('Note') || stationSaveMessage.startsWith('The shared') || stationSaveMessage.startsWith('An active')
                ? 'panel-error-message'
                : 'panel-success-message'} role={stationSaveMessage.startsWith('Could not') ? 'alert' : 'status'}>
                {stationSaveMessage}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={stationSubmitting || !!matchingPendingItem || stationResult.status !== 'ready'}>
              {stationSubmitting ? 'Saving…' : 'Add to station list'}
            </button>
          </form>

          <div className="station-active-list">
            <h3>Active station needs</h3>
            <p className="station-status-guidance">
              Purchased means bought but not yet stocked. Stocked and cancelled items remain in history.
            </p>
            <div className="station-list-toolbar">
              <label htmlFor="station-sort">Sort by</label>
              <select id="station-sort" value={sortBy} onChange={event => setSortBy(event.target.value as StationSort)}>
                <option value="store">Store</option>
                <option value="item">Item name</option>
                <option value="status">Status</option>
              </select>
              <button type="button" className="btn btn-small" disabled={shoppingList.length === 0} onClick={printStationList}>
                Print shopping list
              </button>
              <button type="button" className="btn btn-small" disabled={shoppingList.length === 0} onClick={() => void copyShoppingList()}>
                Copy list
              </button>
              {shoppingList.length > 0 ? (
                <a className="btn btn-small" href={emailHref}>Email list</a>
              ) : (
                <span className="btn btn-small" aria-disabled="true">Email list</span>
              )}
            </div>
            {shareMessage && <p className="muted" role="status">{shareMessage}</p>}
            {activeStationNeeds.length === 0 ? (
              <p className="muted">{stationResult.status === 'ready' ? 'No active station needs.' : 'Station needs are unavailable.'}</p>
            ) : (
              <ul>
                {sortedActiveNeeds.map(need => {
                  const saving = savingNeedIds.includes(need.id);
                  if (editDraft?.id === need.id) {
                    return (
                      <li className="station-need-row station-need-edit" key={need.id}>
                        <form onSubmit={event => void saveEdit(event)}>
                          <label htmlFor={`edit-item-${need.id}`}>Item</label>
                          <input id={`edit-item-${need.id}`} type="text" maxLength={200} value={editDraft.item}
                            onChange={event => setEditDraft({ ...editDraft, item: event.target.value })} />
                          <label htmlFor={`edit-quantity-${need.id}`}>Quantity (optional)</label>
                          <input id={`edit-quantity-${need.id}`} type="number" min="1" max="100000" step="1" value={editDraft.quantity}
                            onChange={event => setEditDraft({ ...editDraft, quantity: event.target.value })} />
                          <label htmlFor={`edit-store-${need.id}`}>Store (optional)</label>
                          <select id={`edit-store-${need.id}`} value={editDraft.store}
                            onChange={event => setEditDraft({ ...editDraft, store: event.target.value as StationStore | '' })}>
                            <option value="">No preference</option>
                            {STATION_STORES.map(storeOption => <option value={storeOption} key={storeOption}>{storeOption}</option>)}
                          </select>
                          <label htmlFor={`edit-note-${need.id}`}>Note (optional)</label>
                          <textarea id={`edit-note-${need.id}`} maxLength={1000} rows={2} value={editDraft.note}
                            onChange={event => setEditDraft({ ...editDraft, note: event.target.value })} />
                          <div className="station-need-actions">
                            <button type="submit" className="btn btn-small btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                            <button type="button" className="btn btn-small" disabled={saving} onClick={() => setEditDraft(null)}>Cancel edit</button>
                          </div>
                        </form>
                      </li>
                    );
                  }
                  return (
                    <li className="station-need-row" key={need.id}>
                      <div>
                        <strong>{need.item}</strong>
                        <span className="station-need-details">
                          {[getStationQuantity(need), need.store, need.note].filter(Boolean).join(' · ')}
                        </span>
                        <span className={`station-need-status station-need-status-${need.status.toLowerCase()}`}>{need.status}</span>
                      </div>
                      <div className="station-need-actions">
                        <button type="button" className="btn btn-small" disabled={saving} aria-label={`Edit ${need.item}`} onClick={() => startEdit(need)}>
                          Edit
                        </button>
                        {need.status === 'Needed' && (
                          <button type="button" className="btn btn-small" disabled={saving} onClick={() => void updateStationStatus(need, 'Purchased')}>
                            {saving ? 'Saving…' : 'Mark Purchased'}
                          </button>
                        )}
                        {need.status === 'Purchased' && (
                          <button type="button" className="btn btn-small" disabled={saving} onClick={() => void updateStationStatus(need, 'Stocked')}>
                            {saving ? 'Saving…' : 'Mark Stocked'}
                          </button>
                        )}
                        <button type="button" className="btn btn-small station-cancel-button" disabled={saving} onClick={() => void updateStationStatus(need, 'Cancelled')}>
                          Cancel
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <details className="station-history">
              <summary>History ({stationNeeds.filter(item => item.status === 'Stocked' || item.status === 'Cancelled').length})</summary>
              {stationNeeds.filter(item => item.status === 'Stocked' || item.status === 'Cancelled').length === 0 ? (
                <p className="muted">No station history yet.</p>
              ) : (
                <ul>
                  {stationNeeds
                    .filter(item => item.status === 'Stocked' || item.status === 'Cancelled')
                    .map(need => (
                      <li key={need.id}>
                        <strong>{need.item}</strong>
                        <span>{[getStationQuantity(need), need.store, need.status].filter(Boolean).join(' · ')}</span>
                      </li>
                    ))}
                </ul>
              )}
            </details>
          </div>
          <div className="station-print-area" aria-hidden="true">
            <h1>Station shopping list</h1>
            {shoppingList.map(need => (
              <p key={need.id}>
                ☐ <strong>{need.item}</strong>
                {[getStationQuantity(need), need.store, need.note].filter(Boolean).length > 0 &&
                  ` — ${[getStationQuantity(need), need.store, need.note].filter(Boolean).join(' · ')}`}
              </p>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
};

const OxygenStatusLabel = ({ cylinder, status }: { cylinder: string; status: string }) => {
  const colorStatus = status === 'OK' || status === 'Low' || status === 'Out' ? status.toLowerCase() : 'unset';
  return (
    <span className={`oxygen-status-label oxygen-status-${colorStatus}`}>
      <span className="oxygen-status-indicator" aria-hidden="true" />
      {cylinder}: {status}
    </span>
  );
};
