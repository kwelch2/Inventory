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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

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
});

describe('admin and private access', () => {
  const verifiedStaff = () => testEnvironment.authenticatedContext('staff-1', {
    email: 'staff@gemfireems.org', email_verified: true
  }).firestore();

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
