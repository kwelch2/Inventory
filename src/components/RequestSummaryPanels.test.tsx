import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { addDoc, setDoc, updateDoc } from 'firebase/firestore';
import { RequestSummaryPanels } from './RequestSummaryPanels';
import type { OxygenStock, StationNeed } from '../types';

const { mockedUseFirestoreCollection } = vi.hoisted(() => ({
  mockedUseFirestoreCollection: vi.fn()
}));

vi.mock('../hooks/useFirestoreCollection', () => ({
  useFirestoreCollection: mockedUseFirestoreCollection
}));

vi.mock('../config/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(async () => ({ id: 'new-need' })),
  collection: vi.fn((...segments: string[]) => segments.slice(1).join('/')),
  deleteField: vi.fn(() => '__delete_field__'),
  doc: vi.fn((...segments: string[]) => segments.slice(1).join('/')),
  serverTimestamp: vi.fn(() => '__server_timestamp__'),
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined)
}));

const makeCollectionResult = (data: unknown[]) => ({
  data,
  loading: false,
  error: null,
  source: 'server',
  status: 'ready',
  retry: vi.fn()
});

const requestCounts = { openCount: 4, orderedCount: 2, backorderedCount: 1 };
let oxygenData: OxygenStock[];
let stationData: StationNeed[];
let presetData: { id: string; name: string }[];

const renderPanels = () => render(<RequestSummaryPanels requestCounts={requestCounts} />);

describe('RequestSummaryPanels', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    oxygenData = [{ id: 'shared' }];
    stationData = [];
    presetData = [
      { id: 'p-coffee', name: 'coffee' },
      { id: 'p-paper', name: 'printer paper' }
    ];
    mockedUseFirestoreCollection.mockImplementation((collectionName: string) =>
      makeCollectionResult(
        collectionName === 'oxygenStock' ? oxygenData
          : collectionName === 'stationPresetItems' ? presetData
          : stationData
      )
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows compact persisted summaries while both management panels are collapsed', () => {
    renderPanels();
    const oxygenSummary = screen.getByRole('button', { name: /Manage oxygen stock/ });
    const stationSummary = screen.getByRole('button', { name: /Manage station list/ });

    expect(screen.getByText('Supply Requests')).toBeInTheDocument();
    expect(screen.getByText('Open').parentElement).toHaveTextContent('4');
    expect(screen.getByText('Ordered').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Backordered').parentElement).toHaveTextContent('1');
    expect(oxygenSummary).toHaveTextContent('D-Cylinder: Not set');
    expect(oxygenSummary).toHaveTextContent('S-Cylinder: Not set');
    expect(oxygenSummary).toHaveTextContent('Delivery every Thursday.');
    expect(screen.getByText('No items needed')).toBeInTheDocument();
    expect(screen.getByText('Needed: 0 · Purchased: 0')).toBeInTheDocument();
    expect(oxygenSummary).toHaveAttribute('aria-expanded', 'false');
    expect(stationSummary).toHaveAttribute('aria-expanded', 'false');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('limits the station summary to two needed item names and counts purchased items', () => {
    stationData = [
      { id: 'one', item: 'laundry detergent', store: 'Costco', status: 'Needed', createdAt: new Date(), updatedAt: new Date() },
      { id: 'two', item: 'coffee', store: 'Other', status: 'Needed', createdAt: new Date(), updatedAt: new Date() },
      { id: 'three', item: 'hand soap', store: 'Office Depot', status: 'Needed', createdAt: new Date(), updatedAt: new Date() },
      { id: 'four', item: 'dryer sheets', store: 'Costco', status: 'Purchased', createdAt: new Date(), updatedAt: new Date() }
    ];
    renderPanels();
    const stationSummary = screen.getByRole('button', { name: /Manage station list/ });

    expect(stationSummary).toHaveTextContent('laundry detergent · coffee');
    expect(stationSummary).not.toHaveTextContent('hand soap');
    expect(stationSummary).toHaveTextContent('Needed: 3 · Purchased: 1');
  });

  it('keeps only one panel expanded and returns focus to the summary when closed', () => {
    renderPanels();
    const oxygenSummary = screen.getByRole('button', { name: /Manage oxygen stock/ });
    const stationSummary = screen.getByRole('button', { name: /Manage station list/ });

    fireEvent.click(oxygenSummary);
    expect(screen.getByRole('region', { name: 'Oxygen' })).toBeInTheDocument();
    fireEvent.click(stationSummary);
    expect(screen.queryByRole('region', { name: 'Oxygen' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Station Needs' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('region', { name: 'Station Needs' })).not.toBeInTheDocument();
    expect(stationSummary).toHaveFocus();
  });

  it('does not save Out when confirmation is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: /Manage oxygen stock/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Set D-Cylinder to Out' }));

    expect(window.confirm).toHaveBeenCalledWith('Confirm that the D-Cylinder is Out?');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('saves Out only after confirmation', async () => {
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: /Manage oxygen stock/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Set D-Cylinder to Out' }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledWith(
      'oxygenStock/shared',
      { dStatus: 'Out', updatedAt: '__server_timestamp__' },
      { merge: true }
    ));
    expect(await screen.findByText('D-Cylinder status saved.')).toBeInTheDocument();
  });

  it('saves Low immediately and exposes failed writes without changing the displayed status', async () => {
    vi.mocked(setDoc).mockRejectedValueOnce(new Error('offline'));
    renderPanels();
    fireEvent.click(screen.getByRole('button', { name: /Manage oxygen stock/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Set D-Cylinder to Low' }));

    expect(window.confirm).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the D-Cylinder status.');
    expect(screen.getByRole('button', { name: /D-Cylinder: Not set/ })).toBeInTheDocument();
  });

  it('updates station need status through the allowed active workflow', async () => {
    stationData = [{
      id: 'need-1',
      item: 'coffee',
      store: 'Costco',
      status: 'Needed',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Purchased' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith(
      'stationNeeds/need-1',
      { status: 'Purchased', updatedAt: '__server_timestamp__' }
    ));
    expect(await screen.findByText('coffee marked purchased.')).toBeInTheDocument();
  });

  it('marks a purchased station need stocked', async () => {
    stationData = [{
      id: 'need-2',
      item: 'laundry detergent',
      store: 'Other',
      status: 'Purchased',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Stocked' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith(
      'stationNeeds/need-2',
      { status: 'Stocked', updatedAt: '__server_timestamp__' }
    ));
  });

  it('allows an active station need to be cancelled', async () => {
    stationData = [{
      id: 'need-3',
      item: 'hand soap',
      store: 'Office Depot',
      status: 'Needed',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith(
      'stationNeeds/need-3',
      { status: 'Cancelled', updatedAt: '__server_timestamp__' }
    ));
  });

  it('warns about an active duplicate and updates it instead of creating another record', async () => {
    stationData = [{
      id: 'need-coffee',
      item: 'Coffee',
      store: 'Costco',
      status: 'Needed',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'coffee' } });
    fireEvent.change(screen.getByLabelText('Quantity (optional)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Store (optional)'), { target: { value: 'Office Depot' } });

    expect(screen.getByRole('alert')).toHaveTextContent('A needed request for Coffee already exists.');
    fireEvent.click(screen.getByRole('button', { name: 'Update existing request' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith(
      'stationNeeds/need-coffee',
      expect.objectContaining({
        item: 'coffee',
        quantity: 2,
        store: 'Office Depot',
        updatedAt: '__server_timestamp__'
      })
    ));
    expect(addDoc).not.toHaveBeenCalled();
    expect(await screen.findByText('Existing station need updated.')).toBeInTheDocument();
  });

  it('creates a standard item only after the station form is submitted', async () => {
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'printer paper' } });
    fireEvent.change(screen.getByLabelText('Store (optional)'), { target: { value: 'Other' } });
    expect(addDoc).not.toHaveBeenCalled();

    const form = screen.getByRole('button', { name: 'Add to station list' }).closest('form');
    if (!form) throw new Error('Station need form was not rendered.');
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    await waitFor(() => expect(addDoc).toHaveBeenCalledWith('stationNeeds', expect.objectContaining({
      item: 'printer paper',
      store: 'Other',
      status: 'Needed',
      createdAt: '__server_timestamp__',
      updatedAt: '__server_timestamp__'
    })));
    expect(addDoc).toHaveBeenCalledOnce();
  });

  it('shows station submission failures as errors', async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('offline'));
    renderPanels();
    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'coffee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to station list' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not submit the station need.');
  });

  it('submits without a store and omits it from the record', async () => {
    renderPanels();
    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'coffee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to station list' }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    expect(vi.mocked(addDoc).mock.calls[0][1]).not.toHaveProperty('store');
    expect(vi.mocked(addDoc).mock.calls[0][1]).not.toHaveProperty('unit');
  });

  it('offers no built-in quick-pick items when admin has not added any', () => {
    presetData = [];
    renderPanels();
    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));

    expect(screen.queryByRole('option', { name: 'coffee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'hand soap' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other / custom item' })).toBeInTheDocument();
  });

  it('uses admin-managed quick-pick items and rejects fractional quantities', async () => {
    presetData = [{ id: 'p1', name: 'paper towels' }];
    renderPanels();
    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));

    expect(screen.getByRole('option', { name: 'paper towels' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'coffee' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'paper towels' } });
    fireEvent.change(screen.getByLabelText('Quantity (optional)'), { target: { value: '0' } });
    const form = screen.getByRole('button', { name: 'Add to station list' }).closest('form');
    if (!form) throw new Error('Station need form was not rendered.');
    fireEvent.submit(form);
    expect(await screen.findByText(/whole-number quantity/)).toBeInTheDocument();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('edits an active item and clears its optional store', async () => {
    stationData = [{
      id: 'need-soap', item: 'hand soap', store: 'Costco', status: 'Needed',
      createdAt: new Date(), updatedAt: new Date()
    }];
    renderPanels();
    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit hand soap' }));
    fireEvent.change(screen.getByLabelText('Store (optional)', { selector: '#edit-store-need-soap' }), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Quantity (optional)', { selector: '#edit-quantity-need-soap' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith('stationNeeds/need-soap', expect.objectContaining({
      item: 'hand soap',
      quantity: 3,
      store: '__delete_field__'
    })));
  });

  it('sorts the shopping list by store and builds the email list from needed items only', () => {
    stationData = [
      { id: 'a', item: 'coffee', store: 'Other', status: 'Needed', createdAt: new Date(), updatedAt: new Date() },
      { id: 'b', item: 'hand soap', store: 'Costco', status: 'Needed', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c', item: 'dryer sheets', status: 'Purchased', createdAt: new Date(), updatedAt: new Date() }
    ];
    renderPanels();
    fireEvent.click(screen.getByRole('button', { name: /Manage station list/ }));

    const names = screen.getAllByRole('listitem').map(li => li.querySelector('strong')?.textContent);
    expect(names.slice(0, 3)).toEqual(['hand soap', 'coffee', 'dryer sheets']);
    const href = screen.getByRole('link', { name: 'Email list' }).getAttribute('href') ?? '';
    const body = decodeURIComponent(href);
    expect(body).toContain('hand soap');
    expect(body).not.toContain('dryer sheets');
  });
});
