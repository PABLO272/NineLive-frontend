# Ninelive MVP Plan

## Product Vision

Ninelive enables creators to stream products live and lets viewers discover, interact, and purchase without leaving the app.

## MVP Scope (Phase 1)

- Viewer app:
  - Browse live stream feed.
  - Enter a stream room.
  - View featured products and prices.
  - Add to cart and checkout (hosted payment link in first version).
- Streamer tools:
  - Start/end stream.
  - Pin products during stream.
- Platform:
  - Basic authentication.
  - Order creation + payment intent handoff.
  - Stream metadata and inventory sync.

## System Architecture

- `apps/mobile`: React Native app for viewers and streamers.
- `services/api`: REST API for auth, feed, products, orders.
- Realtime service (next): WebSocket for chat, viewer count, product pin updates.
- Media service (next): RTMP ingest and HLS playback orchestration.
- `packages/shared`: Shared domain models and API contracts.

## Data Domains

- Users (viewer, streamer, admin)
- Streams (status, playback URL, category, viewer count)
- Products (inventory, price, availability)
- Orders (cart lines, totals, payment status)
- Events (chat, reactions, pin/unpin product)

## Milestones

1. Foundation (this scaffold)
- Monorepo + contracts + mock feed endpoints.
- Mobile feed UI shell.

2. Core commerce
- Auth, cart, checkout API.
- Product catalog and stock reservation rules.

3. Live interactions
- Stream room UI.
- Realtime chat/reactions/viewer counts.

4. Streaming pipeline
- Stream key management, ingest, playback URLs.
- Creator broadcast controls.

5. Trust and operations
- Moderation controls, fraud checks, analytics dashboards.
