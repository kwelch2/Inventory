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
};

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export function useInventoryData(options: InventoryDataQueryOptions = {}) {
  const { data: catalog, loading: catalogLoading } = useFirestoreCollection<CatalogItem>('catalog', options.catalogConstraints || EMPTY_CONSTRAINTS);
  const { data: requests, loading: requestsLoading } = useFirestoreCollection<OrderRequest>('requests', options.requestConstraints || EMPTY_CONSTRAINTS);
  const { data: vendors, loading: vendorsLoading } = useFirestoreCollection<Vendor>('vendors', options.vendorConstraints || EMPTY_CONSTRAINTS);
  const { data: categories, loading: categoriesLoading } = useFirestoreCollection<Category>('categories', options.categoryConstraints || EMPTY_CONSTRAINTS);
  const { data: pricing, loading: pricingLoading } = useFirestoreCollection<VendorPrice>('vendorPricing', options.pricingConstraints || EMPTY_CONSTRAINTS);
  const { data: inventory, loading: inventoryLoading } = useFirestoreCollection<InventoryItem>('inventory', options.inventoryConstraints || EMPTY_CONSTRAINTS);
  const { data: units, loading: unitsLoading } = useFirestoreCollection<Unit>('units', options.unitConstraints || EMPTY_CONSTRAINTS);
  const { data: compartments, loading: compartmentsLoading } = useFirestoreCollection<Compartment>('compartments', options.compartmentConstraints || EMPTY_CONSTRAINTS);

  const loading = catalogLoading || requestsLoading || vendorsLoading || categoriesLoading || pricingLoading || inventoryLoading || unitsLoading || compartmentsLoading;

  return {
    catalog,
    requests,
    vendors,
    categories,
    pricing,
    inventory,
    units,
    compartments,
    loading
  };
}
