#!/usr/bin/env node
/**
 * Generate the sponsor board SVG and keep the friend list embedded in CSS in sync.
 *
 * Usage:
 *   node scripts/generate-sponsors.js
 *
 * The script will look for SPONSORS_TOKEN / GH_TOKEN / GITHUB_TOKEN to request
 * sponsor data from the GitHub GraphQL API. When no token is available it falls
 * back to rendering only the friend list and a call-to-action link.
 */
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRIENDS_PATH = path.join(ROOT, 'data', 'friends.json');
const COMPANY_SPONSORS_PATH = path.join(ROOT, 'data', 'company-sponsors.json');
const CSS_PATH = path.join(ROOT, 'tailwind.css');
const OUTPUT_DIR = path.join(ROOT, 'assets');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'sponsors.svg');
const CONFIG_SPONSORS_TOKEN_PATH = path.join(os.homedir(), '.config', 'miaoyan', 'sponsors-token');
const SPONSORS_URL = 'https://github.com/sponsors/tw93';
const OWNER_LOGIN = 'tw93';
const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";
// Kami warm greys; the dark set follows the viewer's colour scheme because the board has no background of its own.
const TEXT_STYLE = `
      .title { fill: #3d3d3a; }
      .label { fill: #504e49; }
      .body { fill: #6b6a64; }
      .placeholder { fill: rgba(20, 20, 19, 0.05); }
      .backdrop { fill: none; }
      .friend { fill: #3d3d3a; fill-opacity: calc(1 - var(--age, 0) * 0.29); }
      @media (prefers-color-scheme: dark) {
        .title { fill: #e8e6dc; }
        .label { fill: #c9c7bd; }
        .body { fill: #9c9a92; }
        .placeholder { fill: rgba(232, 230, 220, 0.08); }
        .backdrop { fill: #e8e6dc; }
        .friend { fill: #e8e6dc; fill-opacity: calc(1 - var(--age, 0) * 0.43); }
      }`;
const GITHUB_SECTION_TITLE = 'GitHub Sponsors';
const FRIENDS_SECTION_TITLE = 'Supportive Friends';
const ACTIVE_RING_COLOR = '#FAC965';
const SECTION_GAP = 72;
const SECTION_TITLE_SIZE = 22;
const SECTION_CONTENT_TOP = 48;

async function main() {
  const [friends, companySponsors] = await Promise.all([
    loadFriends(),
    loadCompanySponsors(),
  ]);
  await Promise.all([
    updateTailwindCss(friends),
    ensureDir(OUTPUT_DIR),
  ]);

  const sponsorToken = await loadSponsorToken();

  const sponsors = await fetchSponsors(sponsorToken);
  const svgContent = await buildSvg({ companySponsors, sponsors, friends });
  await fsp.writeFile(OUTPUT_PATH, svgContent, 'utf8');
  console.log(
    `Generated ${path.relative(ROOT, OUTPUT_PATH)} with ${companySponsors.length} company sponsors, ${sponsors.length} GitHub sponsors, and ${friends.length} friends.`,
  );
}

async function loadSponsorToken() {
  const envToken =
    process.env.SPONSORS_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN;
  if (envToken) {
    return envToken.trim();
  }

  try {
    const raw = await fsp.readFile(CONFIG_SPONSORS_TOKEN_PATH, 'utf8');
    const envStyleMatch = raw.match(/(?:^|\n)\s*(?:export\s+)?(?:SPONSORS_TOKEN|GH_TOKEN|GITHUB_TOKEN)\s*=\s*['"]?([^'"\n]+)['"]?/);
    if (envStyleMatch && envStyleMatch[1]) {
      return envStyleMatch[1].trim();
    }

    const firstLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    return firstLine || '';
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return '';
    }
    throw err;
  }
}

async function loadFriends() {
  const raw = await fsp.readFile(FRIENDS_PATH, 'utf8');
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) {
    throw new Error(`Friend data must be an array in ${FRIENDS_PATH}`);
  }
  return list.map((name) => String(name).trim()).filter(Boolean);
}

async function loadCompanySponsors() {
  try {
    const raw = await fsp.readFile(COMPANY_SPONSORS_PATH, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      throw new Error(`Company sponsor data must be an array in ${COMPANY_SPONSORS_PATH}`);
    }

    return list.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Company sponsor at index ${index} must be an object.`);
      }

      const name = String(item.name || '').trim();
      const logoPath = String(item.logoPath || '').trim();
      if (!name || !logoPath) {
        throw new Error(`Company sponsor at index ${index} must include "name" and "logoPath".`);
      }

      const label = String(item.label || 'Company Sponsor').trim() || 'Company Sponsor';
      const url = String(item.url || '').trim();

      return {
        name,
        logoPath,
        label,
        url,
      };
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function ensureDir(target) {
  await fsp.mkdir(target, { recursive: true });
}

async function updateTailwindCss(friends) {
  let css = await fsp.readFile(CSS_PATH, 'utf8');
  const listJoined = friends.join('、');
  css = replaceCssContent(css, /--data-friend:\s*'/, listJoined);

  const friendCount = friends.length;
  const zhDesc = `数据每日自动更新，当前 ${friendCount} 位朋友喜欢汤圆可乐`;
  const enDesc = `Daily sync · ${friendCount} friends like TangYuan & Coke`;
  css = replaceCssContent(css, /\.i18n-miao-people-desc:before\s*\{\s*content:\s*'/, zhDesc);
  css = replaceCssContent(
    css,
    /\[lang='en'\]\s*\.i18n-miao-people-desc:before\s*\{\s*content:\s*'/,
    enDesc,
  );

  await fsp.writeFile(CSS_PATH, css, 'utf8');
}

function replaceCssContent(css, markerRegex, value) {
  const match = css.match(new RegExp(`${markerRegex.source}([^']*)'`));
  if (!match) {
    throw new Error(`Unable to locate CSS marker: ${markerRegex}`);
  }
  const [snippet, existing] = match;
  const startIndex = match.index;
  const prefix = css.slice(0, startIndex);
  const suffix = css.slice(startIndex + snippet.length);
  return `${prefix}${snippet.replace(existing, value)}${suffix}`;
}

async function fetchSponsors(token) {
  if (!token) {
    const cachedSponsors = await loadCachedSponsors();
    if (cachedSponsors.length) {
      console.warn(`⚠️  No GitHub token available, reusing ${cachedSponsors.length} cached sponsor avatars from ${path.relative(ROOT, OUTPUT_PATH)}.`);
      return cachedSponsors;
    }

    console.warn('⚠️  No GitHub token available, sponsor avatars will be skipped.');
    return [];
  }

  const [allNodes, activeNodes] = await Promise.all([
    fetchSponsorshipNodes(token, false),
    fetchSponsorshipNodes(token, true),
  ]);
  const sponsorsByLogin = new Map();
  const activeByLogin = new Map();

  for (const node of allNodes) {
    const normalized = normalizeSponsorNode(node, false);
    if (!normalized) continue;
    const existing = sponsorsByLogin.get(normalized.login);
    if (!existing || shouldReplaceSponsor(existing, normalized)) {
      sponsorsByLogin.set(normalized.login, normalized);
    }
  }

  for (const node of activeNodes) {
    const normalized = normalizeSponsorNode(node, true);
    if (!normalized) continue;
    const existing = activeByLogin.get(normalized.login);
    if (!existing || shouldReplaceSponsor(existing, normalized)) {
      activeByLogin.set(normalized.login, normalized);
    }
  }

  const sponsors = [];
  for (const [login, sponsor] of sponsorsByLogin.entries()) {
    sponsors.push(activeByLogin.get(login) || sponsor);
  }

  for (const [login, sponsor] of activeByLogin.entries()) {
    if (!sponsorsByLogin.has(login)) {
      sponsors.push(sponsor);
    }
  }

  sponsors.sort((a, b) => {
    if (Number(b.isActive) !== Number(a.isActive)) return Number(b.isActive) - Number(a.isActive);
    if (b.amount !== a.amount) return b.amount - a.amount;
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return a.login.localeCompare(b.login);
  });

  return sponsors;
}

async function fetchSponsorshipNodes(token, activeOnly) {
  const nodes = [];
  let cursor = null;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'miaoyan-sponsor-bot',
  };

  while (true) {
    const body = {
      query: `
        query($login: String!, $cursor: String, $activeOnly: Boolean!) {
          user(login: $login) {
            sponsorships: sponsorshipsAsMaintainer(first: 100, after: $cursor, includePrivate: true, activeOnly: $activeOnly, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                sponsorEntity {
                  __typename
                  ... on User {
                    login
                    name
                    avatarUrl
                    url
                  }
                  ... on Organization {
                    login
                    name
                    avatarUrl
                    url
                    websiteUrl
                  }
                }
                tier {
                  monthlyPriceInDollars
                }
                createdAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      variables: {
        login: OWNER_LOGIN,
        cursor,
        activeOnly,
      },
    };

    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch sponsors (${res.status}): ${text}`);
    }

    const payload = await res.json();
    const data = payload?.data?.user?.sponsorships;
    if (!data) {
      throw new Error('Unexpected response from GitHub Sponsors API.');
    }

    nodes.push(...(data.nodes || []));

    if (!data.pageInfo?.hasNextPage) {
      break;
    }
    cursor = data.pageInfo.endCursor;
  }

  return nodes;
}

function normalizeSponsorNode(node, isActive) {
  const sponsor = node?.sponsorEntity;
  if (!sponsor?.login || !sponsor?.avatarUrl) return null;
  return {
    login: sponsor.login,
    name: sponsor.name || sponsor.login,
    avatarUrl: sponsor.avatarUrl,
    url: sponsor.websiteUrl || sponsor.url || `https://github.com/${sponsor.login}`,
    type: sponsor.__typename === 'Organization' ? 'Organization' : 'User',
    amount: node?.tier?.monthlyPriceInDollars || 0,
    createdAt: node?.createdAt,
    isActive,
  };
}

function shouldReplaceSponsor(existing, next) {
  if (Number(next.isActive) !== Number(existing.isActive)) {
    return Number(next.isActive) > Number(existing.isActive);
  }
  if (next.createdAt && existing.createdAt && next.createdAt !== existing.createdAt) {
    return new Date(next.createdAt) > new Date(existing.createdAt);
  }
  if (next.amount !== existing.amount) {
    return next.amount > existing.amount;
  }
  return next.login.localeCompare(existing.login) < 0;
}

async function loadCachedSponsors() {
  try {
    const svg = await fsp.readFile(OUTPUT_PATH, 'utf8');
    const sponsors = [];
    const sponsorRegex =
      /<g[^>]*data-login="([^"]+)"[^>]*data-active="([^"]+)"[^>]*transform="translate\([^)]*\)">\s*(?:<(?:circle|rect)[^>]*data-backdrop="true"[^>]*\/>\s*)?(?:<image[^>]*href="([^"]+)"[^>]*clip-path="url\(#cp-[^"]+\)"[^>]*\/>|<circle[^>]*\/>)(?:\s*<circle[^>]*data-active-ring="true"[^>]*\/>)?\s*<text[^>]*>([^<]*)<\/text>\s*<\/g>/g;

    let match;
    while ((match = sponsorRegex.exec(svg))) {
      const [block, login, isActive, avatar, name] = match;
      if (!login) continue;
      const typeMatch = block.match(/data-type="([^"]+)"/);
      sponsors.push({
        login,
        name: unescapeText(name) || login,
        avatar: avatar || '',
        url: `https://github.com/${login}`,
        type: typeMatch ? typeMatch[1] : 'User',
        amount: 0,
        isActive: isActive === 'true',
      });
    }

    return sponsors;
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function buildSvg({ companySponsors, sponsors, friends }) {
  const width = 1000;
  const outerPadding = 40;
  const innerPadding = 32;
  const contentWidth = width - outerPadding * 2;
  await embedAvatarData(sponsors);
  await embedCompanyLogoData(companySponsors);

  // Organizations sponsoring through GitHub sit in the company row instead of the avatar grid.
  const organizations = sponsors.filter((sponsor) => sponsor.type === 'Organization');
  const people = sponsors.filter((sponsor) => sponsor.type !== 'Organization');

  let cursorY = innerPadding;
  const defs = [];
  const sections = [];

  if (companySponsors.length || organizations.length) {
    const companyGrid = renderCompanySponsorGrid({
      companySponsors,
      organizations,
      x: 0,
      y: cursorY,
      width: contentWidth,
    });
    defs.push(...companyGrid.defs);
    sections.push(companyGrid.markup);
    cursorY += companyGrid.height + SECTION_GAP;
  }

  const sponsorGrid = renderSponsorGrid({
    sponsors: people,
    x: 0,
    y: cursorY,
    width: contentWidth,
  });
  defs.push(...sponsorGrid.defs);
  sections.push(sponsorGrid.markup);
  cursorY += sponsorGrid.height + SECTION_GAP;

  const friendTable = renderFriendTable({
    friends,
    x: 0,
    y: cursorY,
    width: contentWidth,
  });
  sections.push(friendTable.markup);
  cursorY += friendTable.height + innerPadding;

  const boardHeight = cursorY;
  const height = boardHeight + outerPadding * 2;

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img">
    <title>Tw93 Sponsors</title>
    <style>${TEXT_STYLE}
    </style>
    <defs>
      ${defs.join('\n')}
    </defs>
    <g transform="translate(${outerPadding}, ${outerPadding})" font-family="${FONT_FAMILY}">
      ${sections.join('\n')}
    </g>
  </svg>`;

  return svg;
}

async function embedCompanyLogoData(companySponsors) {
  await Promise.all(
    companySponsors.map(async (company) => {
      if (company.logo) return;
      company.logo = await fileDataUri(company.logoPath);
    }),
  );
}

async function fileDataUri(filePath) {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const mimeType =
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
    }[ext] || 'application/octet-stream';
  const buffer = await fsp.readFile(resolvedPath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function avatarDataUri(url) {
  const sizedUrl = url.includes('?') ? `${url}&s=160` : `${url}?s=160`;
  const res = await fetch(sizedUrl);
  if (!res.ok) {
    throw new Error(`Failed to download avatar: ${url}`);
  }
  const contentType = res.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function embedAvatarData(sponsors) {
  await Promise.all(
    sponsors.map(async (sponsor) => {
      if (sponsor.avatar) return;
      if (!sponsor.avatarUrl) return;
      try {
        sponsor.avatar = await avatarDataUri(sponsor.avatarUrl);
      } catch (err) {
        console.warn(`Unable to download avatar for ${sponsor.login}: ${err.message}`);
      }
    })
  );
}

function renderCompanySponsorGrid({ companySponsors, organizations, x, y, width }) {
  const logoSize = 64;
  const logoRadius = 14;
  const backdropInset = 6;
  const backdrop = `<rect data-backdrop="true" class="backdrop" x="${-backdropInset}" y="${-backdropInset}" width="${logoSize + backdropInset * 2}" height="${logoSize + backdropInset * 2}" rx="${logoRadius + backdropInset}" />`;
  const baseGap = 72;
  const gapY = 52;
  const items = [
    ...companySponsors.map((company) => ({ ...company, avatar: company.logo })),
    ...organizations.map((org) => ({ ...org, isOrganization: true })),
  ];
  let cols = Math.max(1, Math.floor((width + baseGap) / (logoSize + baseGap)));
  cols = Math.min(cols, items.length);
  const rows = Math.ceil(items.length / cols);
  const gridWidth = cols * logoSize + (cols - 1) * baseGap;
  const gridHeight = rows * logoSize + (rows - 1) * gapY;
  const offsetX = Math.max(0, (width - gridWidth) / 2);
  const centerX = width / 2;
  const sectionHeight = SECTION_CONTENT_TOP + gridHeight + 28;
  const sectionTitle = items.length === 1 ? 'Company Sponsor' : 'Company Sponsors';
  const clipDefs = [];
  let markup = `
    <g transform="translate(${x}, ${y})">
      <text x="${centerX}" y="0" text-anchor="middle" font-size="${SECTION_TITLE_SIZE}" font-weight="600" class="title">${sectionTitle}</text>
      <g transform="translate(0, ${SECTION_CONTENT_TOP})">
  `;

  items.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const rowCount = Math.min(cols, items.length - row * cols);
    const rowOffsetX = offsetX + ((cols - rowCount) * (logoSize + baseGap)) / 2;
    const logoX = rowOffsetX + col * (logoSize + baseGap);
    const logoY = row * (logoSize + gapY);
    const label = `<text x="${logoSize / 2}" y="${logoSize + 24}" text-anchor="middle" font-size="14" font-weight="600" class="label">${escapeText(truncateText(item.name, 22))}</text>`;
    let companyItem;

    if (item.isOrganization) {
      // GitHub org avatars are square, so clip them to the same rounded tile; the markup shape matches loadCachedSponsors.
      const clipId = `cp-${item.login}`;
      clipDefs.push(
        `<clipPath id="${clipId}">
        <rect x="0" y="0" width="${logoSize}" height="${logoSize}" rx="${logoRadius}" />
      </clipPath>`,
      );
      companyItem = `
      <g data-login="${escapeAttr(item.login)}" data-active="${item.isActive ? 'true' : 'false'}" data-type="Organization" transform="translate(${logoX}, ${logoY})">
        ${backdrop}
        ${
          item.avatar
            ? `<image href="${item.avatar}" x="0" y="0" width="${logoSize}" height="${logoSize}" clip-path="url(#${clipId})" />`
            : `<circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2}" class="placeholder" />`
        }
        ${label}
      </g>
    `;
    } else {
      companyItem = `
      <g transform="translate(${logoX}, ${logoY})">
        ${backdrop}
        ${
          item.avatar
            ? `<image href="${item.avatar}" x="0" y="0" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />`
            : `<circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2}" class="placeholder" />`
        }
        ${label}
      </g>
    `;
    }

    if (item.url) {
      markup += `<a xlink:href="${escapeAttr(item.url)}" target="_blank" aria-label="${escapeAttr(item.name)}">${companyItem}</a>`;
      return;
    }

    markup += companyItem;
  });

  markup += '</g></g>';

  return {
    markup,
    height: sectionHeight,
    defs: clipDefs,
  };
}

function renderSponsorGrid({ sponsors, x, y, width }) {
  const avatarSize = 72;
  const baseGap = 40;
  const gapY = 45;
  let cols = Math.floor(width / (avatarSize + baseGap));
  const rows = Math.max(1, Math.ceil(sponsors.length / cols));
  let spacing = baseGap;
  if (cols > 1) {
    spacing = (width - cols * avatarSize) / (cols - 1);
    if (spacing < baseGap) {
      spacing = baseGap;
      cols = Math.max(1, Math.floor((width + baseGap) / (avatarSize + baseGap)));
    }
  }
  const gridWidth = sponsors.length
    ? cols * avatarSize + Math.max(0, cols - 1) * spacing
    : width;
  const gridHeight = sponsors.length
    ? rows * avatarSize + Math.max(0, rows - 1) * gapY
    : 140;
  const sectionHeight = SECTION_CONTENT_TOP + gridHeight + 32;
  const centerX = width / 2;
  const offsetX = Math.max(0, (width - gridWidth) / 2);
  let markup = `
    <g transform="translate(${x}, ${y})">
      <text x="${centerX}" y="0" text-anchor="middle" font-size="${SECTION_TITLE_SIZE}" font-weight="600" class="title">${GITHUB_SECTION_TITLE}</text>
  `;
  const clipDefs = [];

    if (!sponsors.length) {
    markup += `
      <g transform="translate(0, 60)">
        <text x="${width / 2}" y="50" text-anchor="middle" font-size="20" font-weight="500" class="label">Become the first Sponsor</text>
        <a xlink:href="${SPONSORS_URL}" target="_blank">
          <text x="${width / 2}" y="85" text-anchor="middle" font-size="14" class="body">Click to support tw93</text>
        </a>
      </g>
    </g>`;
    return { markup, height: sectionHeight, defs: [] };
  }

  markup += `
    <g transform="translate(0, ${SECTION_CONTENT_TOP})">
  `;

  sponsors.forEach((sponsor, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const avatarX = offsetX + col * (avatarSize + spacing);
    const avatarY = row * (avatarSize + gapY);
    const clipId = `cp-${sponsor.login}`;
    clipDefs.push(
      `<clipPath id="${clipId}">
        <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" />
      </clipPath>`,
    );
    const sponsorCard = `
      <g data-login="${escapeAttr(sponsor.login)}" data-active="${sponsor.isActive ? 'true' : 'false'}" transform="translate(${avatarX}, ${avatarY})">
        <circle data-backdrop="true" class="backdrop" cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2 - 1}" />
        ${
          sponsor.avatar
            ? `<image href="${sponsor.avatar}" x="0" y="0" width="${avatarSize}" height="${avatarSize}" clip-path="url(#${clipId})" />`
            : `<circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" class="placeholder" />`
        }
        ${
          sponsor.isActive
            ? `<circle data-active-ring="true" cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2 - 1.5}" fill="none" stroke="${ACTIVE_RING_COLOR}" stroke-opacity="0.98" stroke-width="2.25" />`
            : ''
        }
        <text x="${avatarSize / 2}" y="${avatarSize + 22}" text-anchor="middle" font-size="12" class="body">${escapeText(sponsor.name).slice(0, 18)}</text>
      </g>
    `;

    if (sponsor.url) {
      markup += `<a xlink:href="${escapeAttr(sponsor.url)}" target="_blank" aria-label="${escapeAttr(sponsor.name)}">${sponsorCard}</a>`;
      return;
    }

    markup += sponsorCard;
  });

  markup += '</g></g>';

  return {
    markup,
    height: sectionHeight,
    defs: clipDefs,
  };
}

function estimateTextWidth(text, fontSize) {
  // SVG has no text layout, so line breaks use a conservative per-glyph estimate; each line is centred, so slack only shows as margin.
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code > 0x2e80) units += 1;
    else if (/[mwMW]/.test(ch)) units += 0.8;
    else if (/[A-Z]/.test(ch)) units += 0.64;
    else units += 0.54;
  }
  return units * fontSize;
}

function renderFriendTable({ friends, x, y, width }) {
  const fontSize = 14;
  const gap = 26;
  const lineHeight = 30;
  const maxLineWidth = width - 40;
  const lines = [];
  let current = [];
  let currentWidth = 0;
  for (const name of [...friends].reverse()) {
    const nameWidth = estimateTextWidth(name, fontSize);
    const nextWidth = current.length ? currentWidth + gap + nameWidth : nameWidth;
    if (current.length && nextWidth > maxLineWidth) {
      lines.push(current);
      current = [name];
      currentWidth = nameWidth;
    } else {
      current.push(name);
      currentWidth = nextWidth;
    }
  }
  if (current.length) lines.push(current);

  const centerX = width / 2;
  let markup = `
    <g transform="translate(${x}, ${y})">
      <text x="${centerX}" y="0" text-anchor="middle" font-size="${SECTION_TITLE_SIZE}" font-weight="600" class="title">${FRIENDS_SECTION_TITLE}</text>
      <g transform="translate(0, ${SECTION_CONTENT_TOP})">
  `;

  // Newest names lead at full ink and older lines fade like closing credits; the faintest still clears 4.5:1 in both schemes.
  const lastRow = Math.max(1, lines.length - 1);
  lines.forEach((names, row) => {
    const age = (row / lastRow).toFixed(3);
    const spans = names
      .map((name, index) => `<tspan${index ? ` dx="${gap}"` : ''}>${escapeText(name)}</tspan>`)
      .join('');
    markup += `<text x="${centerX}" y="${row * lineHeight + lineHeight / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" class="friend" style="--age: ${age}">${spans}</text>`;
  });

  markup += '</g></g>';

  return {
    markup,
    height: SECTION_CONTENT_TOP + lines.length * lineHeight,
  };
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeText(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, '&quot;');
}

function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
