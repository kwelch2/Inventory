// Type definitions for the application

export interface ItemReference {
  ref: string;           // The actual reference/SKU number
  vendorId?: string;     // Optional vendor this ref is associated with
  vendorName?: string;   // Display name of vendor for UI
  isCurrent: boolean;    // Whether this is the current/preferred reference
  addedAt?: Date | { seconds: number; nanoseconds: number };
  description?: string;  // Optional notes (e.g., "Vendor A's branded version")
}

export interface CatalogItem {
  id: string;
  itemName: string;
  itemRef?: string;      // DEPRECATED: Kept for backward compat, use itemReferences instead
  itemReferences?: ItemReference[];  // New: Array of current + historical references
  preferredVendorId?: string;  // Optional: Preferred vendor for pricing when multiple vendors have item
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
  qty?: number;
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
