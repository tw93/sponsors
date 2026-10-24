# Sponsors Agent Guide

This repository hosts the sponsor wall and generated sponsor board. See `README.md` for development and embedding instructions.

## Source and Generated Files

- `cats.html` is the wall. The block between `<!-- board:start -->` and `<!-- board:end -->` is generated; edit everything else by hand.
- `tailwind.css` is the source for `build.css`; regenerate with `npm run build`.
- `scripts/generate-sponsors.js` produces `assets/sponsors.svg`, `assets/avatars/` and the board block in `cats.html` through `npm run sponsors`. Its authored inputs are `data/friends.json` and `data/company-sponsors.json`.
- The page copy uses a Source Han Serif subset in `fonts/`. After editing Chinese copy in `cats.html`, run `python3 scripts/build-fonts.py`, then `python3 scripts/build-fonts.py --check`. Generated names use the system sans, so the daily refresh never needs a new subset.
- `.github/workflows/update-sponsors.yml` regenerates the board daily and commits generated outputs.

## Verification and Boundaries

Run `npm run build` for style changes and inspect the rendered wall at phone, tablet and desktop widths. `npm run sponsors` fetches GitHub data and writes the board, so it is not a read-only check; run it only when refreshing sponsors is in scope and the required environment is configured. Keep its token out of source, logs, and documentation. Preserve unrelated working changes when committing generated outputs.
