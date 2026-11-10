import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDoc, updateDoc } from 'firebase/firestore';
import { StationNeedsTab } from './StationNeedsTab';
import type { StationNeed } from '../../types';

const { mockedUseFirestoreCollection } = vi.hoisted(() => ({ mockedUseFirestoreCollection: vi.fn() }));

vi.mock('../../hooks/useFirestoreCollection', () => ({ useFirestoreCollection: mockedUseFirestoreCollection }));
vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(async () => ({ id: 'new' })),
  collection: vi.fn((...segments: string[]) => segments.slice(1).join('/')),
  deleteDoc: vi.fn(async () => undefined),
  deleteField: vi.fn(() => '__delete_field__'),
  doc: vi.fn((...segments: string[]) => segments.slice(1).join('/')),
  serverTimestamp: vi.fn(() => '__server_timestamp__'),
  updateDoc: vi.fn(async () => undefined)
}));

const result = (data: unknown[]) => ({
  data, loading: false, error: null, source: 'server', status: 'ready', retry: vi.fn()
});

let needs: StationNeed[];

describe('StationNeedsTab', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
    needs = [{
      id: 'n1', item: 'hand soap', quantity: 2, store: 'Costco', status: 'Needed',
      createdAt: new Date(), updatedAt: new Date()
    }];
    mockedUseFirestoreCollection.mockImplementation((name: string) =>
      result(name === 'stationNeeds' ? needs : []));
  });

  it('shows an empty quick-pick state with no built-in items', () => {
    render(<StationNeedsTab />);
    expect(screen.getByText(/No quick-pick items yet/)).toBeInTheDocument();
    expect(screen.queryByText('laundry detergent')).not.toBeInTheDocument();
  });

  it('edits a shopping list item from the admin tab', async () => {
    render(<StationNeedsTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit hand soap' }));
    fireEvent.change(screen.getByLabelText('Quantity (optional)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Store (optional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith('stationNeeds/n1', expect.objectContaining({
      item: 'hand soap', quantity: 5, store: '__delete_field__'
    })));
  });

  it('adds a list item and rejects fractional quantities and duplicates', async () => {
    render(<StationNeedsTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Add item to list' }));
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'Hand Soap' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'coffee' } });
    fireEvent.change(screen.getByLabelText('Quantity (optional)'), { target: { value: '1.5' } });
    const form = screen.getByRole('button', { name: 'Save' }).closest('form');
    if (!form) throw new Error('Form missing.');
    fireEvent.submit(form);
    expect(await screen.findByText(/whole-number quantity/)).toBeInTheDocument();
    expect(addDoc).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Quantity (optional)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(addDoc).toHaveBeenCalledWith('stationNeeds', expect.objectContaining({
      item: 'coffee', quantity: 3, status: 'Needed'
    })));
  });
});
