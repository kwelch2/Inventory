# Firestore model and access analysis

Target: Firebase project `supplies-ems`, `(default)` database, Standard edition,
Native mode, `us-west1`.

This document records the application behavior that the security rules must
preserve. The public access described below is an explicit product requirement:
general staff use Dashboard, Expiry, and Requests without signing in. The Admin
route is the only authenticated area and is available to verified Google
accounts whose email ends in `@gemfireems.org`.

## Collections and access

| Collection | Public access | Admin access | Primary fields and constraints |
| --- | --- | --- | --- |
| `catalog` | Read | CRUD | `itemName` string; optional category/unit/reference strings, numeric pack/par fields, booleans, bounded alias/barcode/reference lists, timestamps |
| `units` | Read | CRUD | `name` required string; optional active/type/location/default-par map and timestamps |
| `compartments` | Read | CRUD | `name` required string; optional timestamps |
| `categories` | Read | CRUD | `name` required string; optional timestamps |
| `vendors` | Read | CRUD | `name` required string; optional contact/account/URL/notes strings, numeric fee, timestamps |
| `vendorPricing` | Read | CRUD | catalog/vendor links, unit price, order/status strings, optional legacy fields and timestamps |
| `inventory` | Read, create, restricted update | CRUD | item identity, unit, compartment, timestamp expiry, bounded quantity, status/note and timestamps |
| `requests` | Read, create, restricted update | CRUD | item identity, bounded quantity/unit/note, workflow status, timestamps and optional vendor/admin metadata |
| `users/{uid}` | None | Owner read/create/update only | email bound to Auth token, optional display name/photo; role cannot be escalated |
| `orders` | None | Read only | Currently unused; writes remain denied until a concrete schema and workflow exist |

Live schema sampling was read-only and returned 249 catalog, 307 request, 9
vendor, 6 category, 288 pricing, 676 inventory, 9 unit, and 8 compartment
documents. Validators retain observed legacy aliases and legacy number/date
representations so existing documents remain editable while new anonymous
writes use the current schema.

## Anonymous operations that must continue to work

- Requests: list/read, create an Open request, edit its note, edit quantity,
  merge a duplicate request's quantity/unit/note, and transition an active
  request to Received.
- Inventory: list/read, create an expiry item, edit unit/compartment/quantity/
  crew note/expiry, and change status to Pending, OK, or Replaced.
- Reference data: list/read catalog, units, compartments, categories, vendors,
  and vendor pricing.

Anonymous deletes are not used by the UI and are denied. Anonymous updates are
restricted to the exact field sets above. All public creates and updates use
strict allowlists, type/range/size validation, and server timestamps.

## Queries and indexes

- Requests uses `status in [...]`, orders by `updatedAt desc`, and, for history,
  filters `updatedAt` above or below a cutoff with limits of 300/400 or the
  archive limit.
- Admin dependency checks query `vendorPricing` by `catalogId`, `itemId`, and
  `vendorId`, and `requests` by `catalogId`, `itemId`, `vendorId`, and
  `overrideVendorId`, each with limit 1.
- Other collection listeners are unfiltered collection reads.
- `firestore.indexes.json` contains the composite requests index on status and
  descending updatedAt used by the active/history/archive request queries.

## Security boundary and accepted residual risk

No-login editing means Firestore cannot distinguish a general staff member from
an arbitrary Internet client. The rules can prevent schema pollution, oversized
payloads, deletion, admin-field changes, and invalid workflow transitions, but
they cannot prevent an anonymous actor from repeatedly submitting otherwise
valid requests or changing the allowed public fields. Solving that identity and
rate-abuse risk requires an authentication, App Check, trusted-network, or
server-side enforcement layer and would be a deliberate product change.

Vendor contact data and any requester email stored on request documents are
also visible through public reads. That exposure is retained only because the
public pages are an explicit requirement; sensitive values should not be stored
in publicly readable documents.

## Devil's-advocate checklist

The emulator suite exercises public reads, valid anonymous creates/updates,
unauthorized delete/admin-field changes, update bypasses, oversized strings,
invalid types/ranges, createdAt tampering, schema pollution, invalid state
transitions, verified-domain access, unverified-domain rejection, other-domain
rejection, user-profile isolation, and privilege-escalation attempts. The
intentional anonymous write capability remains an accepted policy exception,
not an identity security guarantee.
