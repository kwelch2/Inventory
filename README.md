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

## License

Copyright © 2026 Gem County FIRE-EMS. All rights reserved.
