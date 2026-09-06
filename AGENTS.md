# Sponsors Agent Guide

This repository hosts the sponsor wall and generated sponsor board. See `README.md` for development and embedding instructions.

## Source and Generated Files

- `cats.html` and `cats.css` define the wall and cat animation.
- `tailwind.css` is the source for `build.css`; regenerate with `npm run build`.
- `scripts/generate-sponsors.js` produces `assets/sponsors.svg` through `npm run sponsors`.
- `.github/workflows/update-sponsors.yml` regenerates the board daily and commits generated outputs.

## Verification and Boundaries

Run `npm run build` for style changes and inspect the rendered wall. `npm run sponsors` fetches GitHub data and writes the board, so it is not a read-only check; run it only when refreshing sponsors is in scope and the required environment is configured. Keep its token out of source, logs, and documentation. Preserve unrelated working changes when committing generated outputs.
