import { useFirestoreCollection } from './useFirestoreCollection';
import type { CatalogItem, OrderRequest, Vendor, Category, VendorPrice, InventoryItem, Unit, Compartment } from '../types';

export function useInventoryData() {
  const { data: catalog, loading: catalogLoading } = useFirestoreCollection<CatalogItem>('catalog');
  const { data: requests, loading: requestsLoading } = useFirestoreCollection<OrderRequest>('requests');
  const { data: vendors, loading: vendorsLoading } = useFirestoreCollection<Vendor>('vendors');
  const { data: categories, loading: categoriesLoading } = useFirestoreCollection<Category>('categories');
  const { data: pricing, loading: pricingLoading } = useFirestoreCollection<VendorPrice>('vendorPricing');
  const { data: inventory, loading: inventoryLoading } = useFirestoreCollection<InventoryItem>('inventory');
  const { data: units, loading: unitsLoading } = useFirestoreCollection<Unit>('units');
  const { data: compartments, loading: compartmentsLoading } = useFirestoreCollection<Compartment>('compartments');

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
