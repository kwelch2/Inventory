import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { removeUndefinedFields } from '../src/utils/helpers';

const PROJECT_ID = 'demo-inventory';
let testEnvironment: RulesTestEnvironment;

const publicRequest = () => ({
  catalogId: 'catalog-1',
  quantity: 2,
  unit: 'Each',
  notes: '',
  status: 'Open',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

const publicInventory = () => ({
  catalogId: 'catalog-1',
  unitId: 'unit-1',
  compartment: 'Cabinet A',
  expiryDate: new Date('2030-01-01T00:00:00Z'),
  quantity: 1,
  status: '',
  crewStatus: '',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

const publicStationNeed = () => ({
  item: 'coffee',
  quantity: 2,
  unit: 'bags',
  store: 'Costco',
  note: '',
  status: 'Needed',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

beforeAll(async () => {
  const emulatorAddress = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorAddress) {
    throw new Error('Run rules tests through `npm run test:rules:emulator`.');
  }
  const [host, portText] = emulatorAddress.split(':');
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(portText),
      rules: readFileSync(resolve('firestore.rules'), 'utf8')
    }
  });
});

afterEach(async () => {
  if (testEnvironment) await testEnvironment.clearFirestore();
});

afterAll(async () => {
  if (testEnvironment) await testEnvironment.cleanup();
});

async function seed(path: string, data: Record<string, unknown>) {
  await testEnvironment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('intentional public access', () => {
  it('allows public collection reads used by Dashboard, Requests, and Expiry', async () => {
    await seed('catalog/item-1', { itemName: 'Bandage' });
    await seed('requests/request-1', { ...publicRequest(), createdAt: new Date(), updatedAt: new Date() });
    await seed('inventory/inventory-1', { ...publicInventory(), createdAt: new Date(), updatedAt: new Date() });
    const db = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDocs(collection(db, 'catalog')));
    await assertSucceeds(getDocs(collection(db, 'requests')));
    await assertSucceeds(getDocs(collection(db, 'inventory')));
  });

  it('allows a valid anonymous request but rejects schema pollution and oversized content', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(db, 'requests/valid'), publicRequest()));
    await assertFails(setDoc(doc(db, 'requests/polluted'), { ...publicRequest(), isAdmin: true }));
    await assertFails(setDoc(doc(db, 'requests/huge'), { ...publicRequest(), notes: 'x'.repeat(2001) }));
    await assertFails(setDoc(doc(db, 'requests/negative'), { ...publicRequest(), quantity: -1 }));
  });

  it('allows the exact anonymous request edits used by the UI', async () => {
    await seed('requests/r1', {
      catalogId: 'catalog-1', quantity: 2, unit: 'Each', notes: '', status: 'Open',
      createdAt: new Date(), updatedAt: new Date()
    });
    const ref = doc(testEnvironment.unauthenticatedContext().firestore(), 'requests/r1');

    await assertSucceeds(updateDoc(ref, { notes: 'Crew needs this soon' }));
    await assertSucceeds(updateDoc(ref, { quantity: 4, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, {
      quantity: 6, unit: 'Each', notes: 'Merged request', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(ref, { status: 'Received', receivedAt: serverTimestamp() }));
  });

  it('keeps the two observed quantity-less legacy requests editable', async () => {
    await seed('requests/legacy', {
      otherItemName: 'Legacy request', notes: '', status: 'Open', createdAt: new Date()
    });
    const ref = doc(testEnvironment.unauthenticatedContext().firestore(), 'requests/legacy');

    await assertSucceeds(updateDoc(ref, { notes: 'Still needed' }));
    await assertSucceeds(updateDoc(ref, { quantity: 1, updatedAt: serverTimestamp() }));
  });

  it('rejects anonymous request deletion, admin-field changes, and invalid transitions', async () => {
    await seed('requests/r1', {
      catalogId: 'catalog-1', quantity: 2, notes: '', status: 'Open',
      createdAt: new Date(), updatedAt: new Date()
    });
    const ref = doc(testEnvironment.unauthenticatedContext().firestore(), 'requests/r1');

    await assertFails(deleteDoc(ref));
    await assertFails(updateDoc(ref, { overrideVendorId: 'vendor-1', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: 'Ordered', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), notes: 'tampered' }));
  });

  it('allows valid anonymous inventory creation and existing detail/status edits', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(db, 'inventory/new'), publicInventory()));
    await seed('inventory/i1', {
      catalogId: 'catalog-1', unitId: 'unit-1', compartment: '', expiryDate: new Date(),
      quantity: 1, status: '', crewStatus: '', createdAt: new Date(), updatedAt: new Date()
    });
    const ref = doc(db, 'inventory/i1');

    await assertSucceeds(updateDoc(ref, { status: 'Pending', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, {
      unitId: 'unit-2', compartment: 'Shelf 2', quantity: 3,
      crewStatus: 'Rotate stock', expiryDate: new Date('2031-01-01T00:00:00Z'),
      updatedAt: serverTimestamp()
    }));
  });

  it('rejects anonymous inventory deletion, identity changes, bad types, and huge notes', async () => {
    await seed('inventory/i1', {
      catalogId: 'catalog-1', unitId: 'unit-1', quantity: 1, status: '', crewStatus: '',
      createdAt: new Date(), updatedAt: new Date()
    });
    const ref = doc(testEnvironment.unauthenticatedContext().firestore(), 'inventory/i1');

    await assertFails(deleteDoc(ref));
    await assertFails(updateDoc(ref, { catalogId: 'catalog-2', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { quantity: 'many', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { crewStatus: 'x'.repeat(2001), updatedAt: serverTimestamp() }));
  });

  it('allows only validated public oxygen status updates on the shared record', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();
    const sharedRef = doc(db, 'oxygenStock/shared');

    await assertSucceeds(setDoc(sharedRef, { dStatus: 'Low', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sharedRef, { sStatus: 'Out', updatedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(collection(db, 'oxygenStock')));
    await assertFails(setDoc(doc(db, 'oxygenStock/empty'), { updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'oxygenStock/other'), { dStatus: 'OK', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(sharedRef, { dStatus: 'Unknown', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(sharedRef, { isAdmin: true, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(sharedRef));
  });

  it('validates station need creation, editable details, history, and status transitions', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();
    const neededRef = doc(db, 'stationNeeds/need-1');
    await assertSucceeds(setDoc(neededRef, publicStationNeed()));
    await assertSucceeds(updateDoc(neededRef, {
      item: 'coffee', quantity: 3, store: 'Office Depot', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(neededRef, {
      quantity: deleteField(), unit: deleteField(), note: deleteField(), updatedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(neededRef, { status: 'Purchased', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(neededRef, { status: 'Stocked', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(neededRef, { status: 'Needed', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(neededRef, { note: 'Cannot edit history', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(neededRef));

    await assertFails(setDoc(doc(db, 'stationNeeds/invalid-status'), {
      ...publicStationNeed(), status: 'Stocked'
    }));
    await assertFails(setDoc(doc(db, 'stationNeeds/invalid-store'), {
      ...publicStationNeed(), store: 'Unlisted Store'
    }));
    await assertFails(setDoc(doc(db, 'stationNeeds/invalid-quantity'), {
      ...publicStationNeed(), quantity: 0
    }));
    await assertFails(setDoc(doc(db, 'stationNeeds/blank-item'), {
      ...publicStationNeed(), item: '   '
    }));
    await assertFails(setDoc(doc(db, 'stationNeeds/polluted'), {
      ...publicStationNeed(), medicalRequest: true
    }));
    await assertFails(setDoc(doc(db, 'stationNeeds/fractional'), {
      ...publicStationNeed(), quantity: 1.5
    }));
    await assertSucceeds(setDoc(doc(db, 'stationNeeds/no-store'), {
      item: 'hand soap', status: 'Needed', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(db, 'stationNeeds/needed-2'), publicStationNeed()));
    await assertFails(updateDoc(doc(db, 'stationNeeds/needed-2'), {
      status: 'Stocked', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(db, 'stationNeeds/needed-3'), publicStationNeed()));
    await assertSucceeds(updateDoc(doc(db, 'stationNeeds/needed-3'), {
      status: 'Cancelled', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(db, 'stationNeeds/purchased-1'), {
      ...publicStationNeed(), status: 'Needed'
    }));
    await assertSucceeds(updateDoc(doc(db, 'stationNeeds/purchased-1'), {
      status: 'Purchased', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(doc(db, 'stationNeeds/purchased-1'), {
      status: 'Cancelled', updatedAt: serverTimestamp()
    }));
  });
});

describe('admin and private access', () => {
  const verifiedStaff = () => testEnvironment.authenticatedContext('staff-1', {
    email: 'staff@gemfireems.org', email_verified: true
  }).firestore();

  it('allows the catalog and pricing form payloads for verified staff', async () => {
    const db = verifiedStaff();
    const catalogRef = doc(db, 'catalog/form-item');
    const pricingRef = doc(db, 'vendorPricing/form-price');
    const catalogData = removeUndefinedFields({
      itemName: 'Trauma Dressing',
      category: '',
      unit: 'Each',
      packSize: 1,
      parLevel: 3,
      isActive: true,
      altNames: ['Dressing'],
      itemReferences: [{ ref: 'TD-1', isCurrent: true, addedAt: new Date() }],
      updatedAt: serverTimestamp()
    });
    const pricingData = {
      catalogId: 'form-item',
      vendorId: 'vendor-1',
      unitPrice: 3.5,
      vendorOrderNumber: 'TD-1',
      vendorStatus: 'In Stock',
      updatedAt: serverTimestamp()
    };

    await assertSucceeds(setDoc(catalogRef, { ...catalogData, createdAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(catalogRef, { ...catalogData, itemName: 'Updated Dressing' }));
    const savedCatalog = await getDoc(catalogRef);
    expect(savedCatalog.data()?.updatedAt).toBeInstanceOf(Timestamp);
    expect(savedCatalog.data()?.itemReferences[0].addedAt).toBeInstanceOf(Timestamp);
    await assertSucceeds(setDoc(pricingRef, { ...pricingData, createdAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(pricingRef, { ...pricingData, unitPrice: 4 }));

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(publicDb, 'catalog/forbidden'), { ...catalogData, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(publicDb, 'vendorPricing/forbidden'), { ...pricingData, createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(publicDb, 'catalog/form-item'), { itemName: 'Forbidden' }));
    await assertFails(updateDoc(doc(publicDb, 'vendorPricing/form-price'), { unitPrice: 2 }));
  });

  it('allows bounded legacy catalog aliases when editing existing items', async () => {
    await seed('catalog/legacy-alias', { itemName: 'Legacy item', itemNameAlt: '' });
    const ref = doc(verifiedStaff(), 'catalog/legacy-alias');

    await assertSucceeds(updateDoc(ref, { itemName: 'Updated item', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { itemNameAlt: 'Alternative' }));
    await assertSucceeds(updateDoc(ref, { itemNameAlt: 'x'.repeat(200) }));
    await assertSucceeds(updateDoc(ref, { itemNameAlt: ['Alternative'] }));
    await assertSucceeds(updateDoc(ref, { itemNameAlt: Array(10).fill('Alternative') }));
    await assertFails(updateDoc(ref, { itemNameAlt: 'x'.repeat(201) }));
    await assertFails(updateDoc(ref, { itemNameAlt: Array(11).fill('Alternative') }));
    await assertFails(updateDoc(ref, { itemNameAlt: 123 }));
    await assertFails(updateDoc(doc(testEnvironment.unauthenticatedContext().firestore(), 'catalog/legacy-alias'), {
      itemName: 'Unauthorized'
    }));
  });

  it('allows a verified domain account to manage admin collections and requests', async () => {
    const db = verifiedStaff();
    await assertSucceeds(setDoc(doc(db, 'catalog/new'), {
      itemName: 'Trauma Dressing', itemRef: 'TD-1', createdAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(db, 'requests/new'), {
      catalogId: 'catalog-1', quantity: 0, status: 'Open', requesterEmail: 'staff@gemfireems.org',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertSucceeds(deleteDoc(doc(db, 'requests/new')));
  });

  it('rejects unverified domain accounts and verified accounts from another domain', async () => {
    const unverified = testEnvironment.authenticatedContext('staff-2', {
      email: 'staff@gemfireems.org', email_verified: false
    }).firestore();
    const outsider = testEnvironment.authenticatedContext('outside-1', {
      email: 'person@example.com', email_verified: true
    }).firestore();

    await assertFails(setDoc(doc(unverified, 'categories/new'), { name: 'Restricted' }));
    await assertFails(setDoc(doc(outsider, 'categories/new'), { name: 'Restricted' }));
  });

  it('lets only verified staff manage station quick-pick items', async () => {
    const staff = testEnvironment.authenticatedContext('staff-9', {
      email: 'staff@gemfireems.org', email_verified: true
    }).firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(setDoc(doc(staff, 'stationPresetItems/coffee'), { name: 'coffee' }));
    await assertSucceeds(getDoc(doc(publicDb, 'stationPresetItems/coffee')));
    await assertFails(setDoc(doc(publicDb, 'stationPresetItems/tea'), { name: 'tea' }));
    await assertFails(setDoc(doc(staff, 'stationPresetItems/bad'), { name: '' }));
    await assertFails(deleteDoc(doc(publicDb, 'stationPresetItems/coffee')));
    await assertSucceeds(deleteDoc(doc(staff, 'stationPresetItems/coffee')));
  });

  it('keeps user profiles owner-only and prevents role escalation', async () => {
    const owner = testEnvironment.authenticatedContext('owner-1', {
      email: 'owner@gemfireems.org', email_verified: true
    }).firestore();
    const other = testEnvironment.authenticatedContext('other-1', {
      email: 'other@gemfireems.org', email_verified: true
    }).firestore();

    await assertSucceeds(setDoc(doc(owner, 'users/owner-1'), {
      email: 'owner@gemfireems.org', displayName: 'Owner'
    }));
    await assertFails(getDoc(doc(other, 'users/owner-1')));
    await assertFails(updateDoc(doc(owner, 'users/owner-1'), { role: 'Admin' }));
    await assertFails(setDoc(doc(owner, 'users/owner-1'), {
      email: 'owner@gemfireems.org', isAdmin: true
    }));
  });

  it('denies unknown collections and all order writes', async () => {
    await assertFails(setDoc(doc(verifiedStaff(), 'orders/order-1'), { status: 'draft' }));
    await assertFails(setDoc(doc(verifiedStaff(), 'unknown/doc-1'), { value: true }));
  });
});
