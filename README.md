# sponsors

Sponsor wall for tw93's open source projects, hosted at [cats.tw93.fun](https://cats.tw93.fun).

Supports all projects: [Pake](https://github.com/tw93/Pake), [MiaoYan](https://github.com/tw93/MiaoYan), [Mole](https://github.com/tw93/mole), [Kaku](https://github.com/tw93/kaku), [Waza](https://github.com/tw93/Waza), [Kami](https://github.com/tw93/Kami).

## Structure

- `cats.html`: the sponsor wall page; the board between `<!-- board:start -->` and `<!-- board:end -->` is generated
- `tailwind.css`: style source, built into `build.css` by `npm run build`
- `scripts/generate-sponsors.js`: fetches GitHub Sponsors via GraphQL, writes `assets/sponsors.svg`, `assets/avatars/` and the board in `cats.html`
- `cats.css`: the CSS cat animation
- `data/friends.json`: WeChat and Alipay friends, newest first
- `data/company-sponsors.json`: company sponsors config
- `assets/sponsors.svg`: generated sponsor board SVG for READMEs
- `assets/company-sponsors/`: company logo files
- `assets/img/`: cat photos, payment cards, the crowd sprite, project logos for `?name=` and the share image

## Development

```bash
npm install
SPONSORS_TOKEN=<ghp_xxx> npm run sponsors
npm run build
```

## Deployment

Deployed on Vercel. The `update-sponsors.yml` workflow runs daily at 02:00 UTC, regenerates the SVG, avatars and wall board, and commits back to main.

Required secret: `SPONSORS_TOKEN` (GitHub fine-grained token with read access to sponsorships).

## Usage

Link to the sponsor wall from any project:

```
https://cats.tw93.fun?name=<ProjectName>
```

Embed the sponsor SVG in any README:

```markdown
[![Sponsors](https://raw.githubusercontent.com/tw93/sponsors/main/assets/sponsors.svg)](https://cats.tw93.fun)
```
