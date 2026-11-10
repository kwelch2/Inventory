import type { StationNeed } from '../types';

export type StationStore = NonNullable<StationNeed['store']>;
export type StationSort = 'store' | 'item' | 'status';

export const STATION_STORES: StationStore[] = ['Costco', 'Office Depot', 'Other'];

export const normalizeItem = (item: string) => item.trim().toLowerCase();

const storeRank = (store?: string) => store ? STATION_STORES.indexOf(store as StationStore) : STATION_STORES.length;

export const formatQuantity = (need: StationNeed) =>
  need.quantity === undefined ? '' : `${need.quantity}${need.unit ? ` ${need.unit}` : ''}`;

export const isValidQuantity = (quantity: number) =>
  Number.isInteger(quantity) && quantity > 0 && quantity <= 100000;

export const sortStationNeeds = (needs: StationNeed[], sortBy: StationSort) =>
  [...needs].sort((a, b) => {
    if (sortBy === 'store') {
      const diff = storeRank(a.store) - storeRank(b.store);
      if (diff !== 0) return diff;
    } else if (sortBy === 'status' && a.status !== b.status) {
      return a.status === 'Needed' ? -1 : 1;
    }
    return a.item.localeCompare(b.item);
  });

export const buildShoppingListText = (needs: StationNeed[]) =>
  needs.map(need => {
    const details = [formatQuantity(need), need.store, need.note].filter(Boolean).join(' · ');
    return `[ ] ${need.item}${details ? ` — ${details}` : ''}`;
  }).join('\n');

export const printStationList = () => {
  document.body.classList.add('print-station-list');
  window.addEventListener('afterprint', () => document.body.classList.remove('print-station-list'), { once: true });
  window.print();
};
