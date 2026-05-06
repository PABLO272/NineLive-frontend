# Ninelive API v0

## Endpoints

- `GET /health`
  - Returns service health metadata.

- `GET /api/feed`
  - Returns mock live stream feed.
  - Response shape defined by `StreamFeedResponse` in `@ninelive/shared`.

## Next Endpoints

- `POST /api/auth/login`
- `GET /api/streams/:id`
- `POST /api/cart/items`
- `POST /api/orders`
