# Ondessa

A private, paid cycle, fertility and pregnancy companion. Local-first: health data lives on the user's device, predictions are deterministic and explained, and nothing about anyone's body is sent to a server.

> **Ondessa** is a working name pending trademark clearance. It replaces the original "Luma Cycle" placeholder.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173 (preview pass available in dev)
npm test               # 54 unit tests
npm run test:tz        # same suite in 4 time zones (DST and half-hour DST)
npm run build          # production build with strict CSP in dist/
npm run licenses       # OSS license inventory
```

A production build hides the preview pass. To deploy a reviewable preview, build with `VITE_PREVIEW_PASS=true`. Set `VITE_ENTITLEMENT_PUBLIC_JWK` to the entitlement server's public key once Phase 6 ships.

## Layout

```
src/engine/    Pure TypeScript prediction engine and rules (no I/O)
src/data/      IndexedDB vault, AES-GCM crypto, backups, entitlement keys
src/content/   Static, versioned education content with sources
src/app/       Store, router, tour data
src/screens/   All 13 screens plus lock and recovery states
src/ui/        Components and the cycle ring
docs/          Spec, ADRs, threat model, screen map, storage, engine, checklist
public/        PWA manifest, icon, service worker, security headers
```

## Docs

1. [Product spec](docs/01-product-spec.md)
2. [Architecture decisions](docs/02-architecture.md)
3. [Threat model](docs/03-threat-model.md)
4. [Screen map](docs/04-screen-map.md)
5. [Storage model](docs/05-storage-model.md)
6. [Prediction engine](docs/06-prediction-engine.md)
7. [Development checklist and phase report](docs/07-development-checklist.md)
8. [Editorial policy](docs/08-editorial-policy.md)

## Not medical advice

Ondessa is a wellness and education product, not a medical device, and not contraception. Educational content is draft and awaiting clinical review.
