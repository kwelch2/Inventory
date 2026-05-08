# EMS Supplies - Inventory Management System

A modern, responsive inventory management system for EMS supplies built with React, TypeScript, and Vite.

## Features

- 🎨 Modern, clean UI with mobile-first responsive design
- 📱 Collapsible navigation menu for tablets and mobile devices
- 🔐 Google authentication with Firebase
- 📦 Inventory catalog management
- 🏢 Vendor and pricing management
- 📋 Supply requests and order tracking
- ⏰ Expiring supplies monitoring
- 🔥 Firebase Firestore backend

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Styling**: CSS with CSS Variables
- **Deployment**: Firebase Hosting

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kwelch2/Inventory.git
cd Inventory
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The build output will be in the `dist` directory.

### Deployment

This application is configured to deploy to Firebase Hosting:

```bash
npm run build
firebase deploy
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── config/          # Firebase and app configuration
├── contexts/        # React contexts (Auth, etc.)
├── hooks/           # Custom React hooks
├── pages/           # Page components
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Responsive Design

The application is fully responsive with:
- Desktop: Full navigation bar with all links visible
- Tablet (≤968px): Hamburger menu with slide-out navigation
- Mobile (≤600px): Optimized layout with touch-friendly controls

## Authentication

Admin features require authentication with a `@gemfireems.org` email address.

## Migration Runbook (Legacy qty/itemId Cleanup)

This app includes a one-off admin migration utility that normalizes legacy fields:

- `qty` -> `quantity` (number)
- `itemId` -> `catalogId`

### When to run

- Run once after deploying the refactor that expects numeric `quantity` and `catalogId`.
- Prefer off-peak hours to reduce concurrent edits during migration.

### How to run

1. Sign in with an authorized admin account (`@gemfireems.org`).
2. Go to **Admin** -> **Settings** -> **Vendors**.
3. Expand **Advanced Utilities**.
4. Click **Run Legacy Data Migration**.
5. Confirm the prompt.
6. Wait for completion and record the summary counts shown in the UI:
	 - Inventory scanned/updated/invalid
	 - Requests scanned/updated/invalid
	 - Failed updates

### Manual verification checklist (no data seeding)

1. Open Requests page and confirm active items still load and update normally.
2. Open Requests history and click **Load Archive**; confirm old records appear.
3. In Admin Orders, mark a multi-item selection as Ordered and confirm all selected rows update together.
4. Attempt deleting a catalog item with known linked pricing/requests; confirm deletion is blocked.
5. Attempt deleting a vendor with linked pricing/requests; confirm deletion is blocked.
6. Create a request with numeric quantity and unit, then merge duplicate; confirm quantity math is numeric and unit-safe.

### Rollback precautions

- Firestore document updates are not automatically reversible.
- Before running migration in production, ensure you have one of the following:
	- Scheduled Firestore export to Cloud Storage.
	- On-demand export/backup captured immediately pre-run.
- Keep a screenshot or copy of migration summary counts for audit.
- If failures are reported:
	1. Do not rerun immediately.
	2. Review failing document IDs from console logs.
	3. Resolve bad data shape and rerun (the migration is idempotent).

### Notes

- Migration runs in chunked batches and falls back to per-document updates if a batch fails.
- Safe to rerun after fixes; already-migrated docs are skipped.

## License

Copyright © 2026 Gem County FIRE-EMS. All rights reserved.
