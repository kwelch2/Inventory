// Type definitions for the application

export interface CatalogItem {
  id: string;
  itemName: string;
  itemRef?: string;
  category?: string;
  unit?: string;
  packSize?: number;
  parLevel?: number;
  altNames?: string[];
  barcodes?: string[];
  active?: boolean;
  pricing?: VendorPrice[];
  expirationDate?: Date | { seconds: number; nanoseconds: number };
  lotNumber?: string;
  quantity?: number;
}

export interface VendorPrice {
  id?: string;
  itemId: string;
  vendorId: string;
  vendorOrderNumber?: string;
  unitPrice?: number;
  vendorStatus?: 'In Stock' | 'Backordered' | 'Out of Stock';
}

export interface Vendor {
  id: string;
  name: string;
  accountNumber?: string;
  serviceFee?: number;
  orderUrl?: string;
  webUrl?: string;
  phone?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  email?: string;
  address?: string;
  notes?: string;
  preferred?: boolean;
}

export interface OrderRequest {
  id: string;
  itemId: string;
  quantity: string;
  status: 'Open' | 'Ordered' | 'Backordered' | 'Received' | 'Cancelled';
  vendorId?: string;
  vendorOverride?: string;
  createdAt?: Date | { seconds: number; nanoseconds: number };
  updatedAt?: Date | { seconds: number; nanoseconds: number };
}

export interface Category {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
}

export interface Compartment {
  id: string;
  name: string;
}

export interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
}
