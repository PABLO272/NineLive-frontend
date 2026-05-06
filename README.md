# Ninelive

Ninelive is a mobile live-commerce platform where streamers showcase products and viewers buy in real time.

## Monorepo Layout

- `apps/mobile`: React Native (Expo) app shell.
- `services/api`: Node.js API service shell.
- `packages/shared`: Shared TypeScript contracts and business types.
- `docs`: Product and technical planning docs.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start API:
   ```bash
   npm run api:dev
   ```
3. Start mobile app:
   ```bash
   npm run mobile:start
   ```

## Current Status

This repository is an initial greenfield scaffold for Ninelive MVP planning and implementation.
