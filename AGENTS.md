# Sponsors Agent Guide

This repository hosts the sponsor wall and generated sponsor board. See `README.md` for development and embedding instructions.

## Source and Generated Files

- `cats.html` is the wall. The block between `<!-- board:start -->` and `<!-- board:end -->` is generated; edit everything else by hand. Preserve the accepted green hero, CSS cat, coloured payment cards and walking crowd when improving content, accessibility or responsive layout; a new visual direction needs an explicit request. Payment captions and other readable copy belong in semantic HTML, not CSS `content`. Keep the `?name=` product marks and the existing fallback for unknown names.
- `tailwind.css` is the source for `build.css`; regenerate with `npm run build`.
- `scripts/generate-sponsors.js` produces `assets/sponsors.svg`, `assets/avatars/` and the board block in `cats.html` through `npm run sponsors`. Its authored inputs are `data/friends.json` and `data/company-sponsors.json`.
- `cats.css` draws the CSS cat. Its pseudo-element rule is scoped to `.all-wrap`; made global again, it inserts a block `::before` into every element, which breaks inline text and takes the first cell of every grid.
- `.github/workflows/update-sponsors.yml` regenerates the board daily and commits generated outputs.

## Verification and Boundaries

Run `npm run build` for style changes and inspect the rendered wall at phone, tablet and desktop widths. `npm run sponsors` fetches GitHub data and writes the board, so it is not a read-only check; run it only when refreshing sponsors is in scope and the required environment is configured. Keep its token out of source, logs, and documentation. Preserve unrelated working changes when committing generated outputs.
