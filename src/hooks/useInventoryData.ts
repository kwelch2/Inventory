import { useFirestoreCollection } from './useFirestoreCollection';
import type { CatalogItem, OrderRequest, Vendor, Category, VendorPrice } from '../types';

export function useInventoryData() {
  const { data: catalog, loading: catalogLoading } = useFirestoreCollection<CatalogItem>('catalog');
  const { data: requests, loading: requestsLoading } = useFirestoreCollection<OrderRequest>('requests');
  const { data: vendors, loading: vendorsLoading } = useFirestoreCollection<Vendor>('vendors');
  const { data: categories, loading: categoriesLoading } = useFirestoreCollection<Category>('categories');
  const { data: pricing, loading: pricingLoading } = useFirestoreCollection<VendorPrice>('vendorPricing');

  const loading = catalogLoading || requestsLoading || vendorsLoading || categoriesLoading || pricingLoading;

  return {
    catalog,
    requests,
    vendors,
    categories,
    pricing,
    loading
  };
}
