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
  catalogId: string;  // Links to CatalogItem.catalogId field
  itemId?: string;    // Legacy field, prefer catalogId
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
  catalogId?: string; // Primary field for catalog items
  itemId?: string; // Legacy support
  otherItemName?: string; // For unlisted items
  quantity?: string;
  qty?: string; // Alternative quantity field
  unit?: string; // Unit of measure (Box, Each, etc.)
  status?: 'Open' | 'Ordered' | 'Backordered' | 'Received' | 'Cancelled' | 'Completed' | 'Closed';
  vendorId?: string;
  vendorOverride?: string;
  overrideVendorId?: string; // Override vendor selection
  notes?: string;
  receivedAt?: Date | { seconds: number; nanoseconds: number };
  createdAt?: Date | { seconds: number; nanoseconds: number };
  updatedAt?: Date | { seconds: number; nanoseconds: number };
  lastOrdered?: Date | { seconds: number; nanoseconds: number };
  requesterEmail?: string;
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

export interface InventoryItem {
  id: string;
  catalogId?: string;
  itemName?: string; // For custom/unlisted items
  unitId: string;
  compartment?: string;
  expiryDate?: Date | { seconds: number; nanoseconds: number };
  quantity?: number;
  status?: 'Pending' | 'OK' | 'Replaced' | '';
  crewStatus?: string; // Note field
  createdAt?: Date | { seconds: number; nanoseconds: number };
  updatedAt?: Date | { seconds: number; nanoseconds: number };
}

export interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
}
