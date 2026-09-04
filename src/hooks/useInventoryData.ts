import { useFirestoreCollection } from './useFirestoreCollection';
import type { QueryConstraint } from 'firebase/firestore';
import type { CatalogItem, OrderRequest, Vendor, Category, VendorPrice, InventoryItem, Unit, Compartment } from '../types';

type InventoryDataQueryOptions = {
  catalogConstraints?: QueryConstraint[];
  requestConstraints?: QueryConstraint[];
  vendorConstraints?: QueryConstraint[];
  categoryConstraints?: QueryConstraint[];
  pricingConstraints?: QueryConstraint[];
  inventoryConstraints?: QueryConstraint[];
  unitConstraints?: QueryConstraint[];
  compartmentConstraints?: QueryConstraint[];
  collections?: readonly InventoryCollectionName[];
};

export type InventoryCollectionName =
  | 'catalog'
  | 'requests'
  | 'vendors'
  | 'categories'
  | 'pricing'
  | 'inventory'
  | 'units'
  | 'compartments';

export const ALL_INVENTORY_COLLECTIONS: readonly InventoryCollectionName[] = [
  'catalog',
  'requests',
  'vendors',
  'categories',
  'pricing',
  'inventory',
  'units',
  'compartments'
];

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export function useInventoryData(options: InventoryDataQueryOptions = {}) {
  const selectedCollections = options.collections ?? ALL_INVENTORY_COLLECTIONS;
  const isEnabled = (name: InventoryCollectionName) => selectedCollections.includes(name);

  const catalogResult = useFirestoreCollection<CatalogItem>('catalog', options.catalogConstraints || EMPTY_CONSTRAINTS, isEnabled('catalog'));
  const requestsResult = useFirestoreCollection<OrderRequest>('requests', options.requestConstraints || EMPTY_CONSTRAINTS, isEnabled('requests'));
  const vendorsResult = useFirestoreCollection<Vendor>('vendors', options.vendorConstraints || EMPTY_CONSTRAINTS, isEnabled('vendors'));
  const categoriesResult = useFirestoreCollection<Category>('categories', options.categoryConstraints || EMPTY_CONSTRAINTS, isEnabled('categories'));
  const pricingResult = useFirestoreCollection<VendorPrice>('vendorPricing', options.pricingConstraints || EMPTY_CONSTRAINTS, isEnabled('pricing'));
  const inventoryResult = useFirestoreCollection<InventoryItem>('inventory', options.inventoryConstraints || EMPTY_CONSTRAINTS, isEnabled('inventory'));
  const unitsResult = useFirestoreCollection<Unit>('units', options.unitConstraints || EMPTY_CONSTRAINTS, isEnabled('units'));
  const compartmentsResult = useFirestoreCollection<Compartment>('compartments', options.compartmentConstraints || EMPTY_CONSTRAINTS, isEnabled('compartments'));

  const allResults = [catalogResult, requestsResult, vendorsResult, categoriesResult, pricingResult, inventoryResult, unitsResult, compartmentsResult];
  const enabledResults = allResults.filter(result => result.status !== 'disabled');
  const loading = enabledResults.some(result => result.loading);
  const error = enabledResults.find(result => result.error)?.error ?? null;
  const fromCache = enabledResults.some(result => result.source === 'cache');

  const retry = () => enabledResults.forEach(result => result.retry());

  return {
    catalog: catalogResult.data,
    requests: requestsResult.data,
    vendors: vendorsResult.data,
    categories: categoriesResult.data,
    pricing: pricingResult.data,
    inventory: inventoryResult.data,
    units: unitsResult.data,
    compartments: compartmentsResult.data,
    loading,
    error,
    fromCache,
    retry
  };
}
