// Type definitions for the application

export type FirebaseTimestampLike = { seconds: number; nanoseconds: number };
export type FirebaseDateLike = Date | FirebaseTimestampLike;

export const REQUEST_STATUS_VALUES = ['Open', 'Ordered', 'Backordered', 'Received', 'Cancelled'] as const;
export type RequestStatus = typeof REQUEST_STATUS_VALUES[number];

export const INVENTORY_STATUS_VALUES = ['Pending', 'OK', 'Replaced', ''] as const;
export type InventoryStatus = typeof INVENTORY_STATUS_VALUES[number];

export const VENDOR_STATUS_VALUES = ['In Stock', 'Backordered', 'Out of Stock'] as const;
export type VendorStatus = typeof VENDOR_STATUS_VALUES[number];

export interface ItemReference {
  ref: string;           // The actual reference/SKU number
  vendorId?: string;     // Optional vendor this ref is associated with
  vendorName?: string;   // Display name of vendor for UI
  isCurrent: boolean;    // Whether this is the current/preferred reference
  addedAt?: FirebaseDateLike;
  description?: string;  // Optional notes (e.g., "Vendor A's branded version")
}

export interface CatalogItem {
  id: string;
  catalogId: string;
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
  expirationDate?: FirebaseDateLike;
  lotNumber?: string;
  quantity: number;
}

export interface VendorPrice {
  id?: string;
  catalogId: string;  // Links to CatalogItem.catalogId field
  itemId?: string;    // Legacy field, prefer catalogId
  vendorId: string;
  vendorOrderNumber?: string;
  unitPrice?: number;
  vendorStatus?: VendorStatus;
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
  quantity: number;
  unit?: string; // Unit of measure (Box, Each, etc.)
  status?: RequestStatus;
  vendorId?: string;
  vendorOverride?: string;
  overrideVendorId?: string; // Override vendor selection
  notes?: string;
  receivedAt?: FirebaseDateLike;
  createdAt?: FirebaseDateLike;
  updatedAt?: FirebaseDateLike;
  lastOrdered?: FirebaseDateLike;
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
  expiryDate?: FirebaseDateLike;
  quantity: number;
  status?: InventoryStatus;
  crewStatus?: string; // Note field
  createdAt?: FirebaseDateLike;
  updatedAt?: FirebaseDateLike;
}

export interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
}
