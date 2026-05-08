import type { CatalogItem, FirebaseDateLike, VendorPrice } from '../types';

export function parseFirebaseDate(value: FirebaseDateLike | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

// Generates variations so search terms like "3ml" and "3 ml" both match.
export function getSearchVariations(term: string): string[] {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return [];

  const variations = [normalizedTerm];
  const numberLetterPattern = /^(\d+)([a-z]+)$/i;
  const spacedPattern = /^(\d+)\s+([a-z]+)$/i;

  const compactMatch = normalizedTerm.match(numberLetterPattern);
  if (compactMatch) {
    variations.push(`${compactMatch[1]} ${compactMatch[2]}`);
  }

  const spacedMatch = normalizedTerm.match(spacedPattern);
  if (spacedMatch) {
    variations.push(`${spacedMatch[1]}${spacedMatch[2]}`);
  }

  return Array.from(new Set(variations));
}

export function getItemName(
  request: { otherItemName?: string; catalogId?: string; itemId?: string },
  catalogByCatalogId: Map<string, CatalogItem>,
  catalogMap: Map<string, CatalogItem>
): string {
  if (request.otherItemName) return request.otherItemName;

  const lookupKey = request.catalogId || request.itemId;
  if (!lookupKey) return 'Unknown Item';

  const item = catalogByCatalogId.get(lookupKey) || catalogMap.get(lookupKey);
  return item?.itemName || 'Unknown Item';
}

export function getCatalogItemPricing(
  item: CatalogItem,
  pricingMap: Map<string, VendorPrice[]>
): VendorPrice[] {
  if (item.catalogId && pricingMap.has(item.catalogId)) {
    return pricingMap.get(item.catalogId) || [];
  }

  return pricingMap.get(item.id) || [];
}
