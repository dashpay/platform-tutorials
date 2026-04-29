#!/usr/bin/env node
// Generates _site/index.html for the GitHub Pages deploy.
// Argv: [appsJson, outPath]
//   appsJson : JSON array of { name, displayName, description }
//   outPath  : where to write the file
//
// Run locally to preview:
//   node .github/scripts/build-landing-page.mjs \
//     '[{"name":"dashmint-lab","displayName":"DashMint Lab","description":"..."}]' \
//     /tmp/index.html

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const CANONICAL_REPO = "dashpay/platform-tutorials";

const [, , appsJson, outPath] = process.argv;

if (!appsJson || !outPath) {
  console.error("Usage: build-landing-page.mjs <appsJson> <outPath>");
  process.exit(1);
}

const apps = JSON.parse(appsJson);
if (!Array.isArray(apps) || apps.length === 0) {
  console.error("appsJson must be a non-empty array");
  process.exit(1);
}

const escape = (str) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Simplified single-color Dash mark (derived from the apps' favicon.svg).
const DASH_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 46" fill="currentColor" aria-hidden="true"><path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/></svg>`;

const FAVICON_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  DASH_MARK.replace("currentColor", "#008de4"),
)}`;

const cards = apps
  .map((app) => {
    const name = escape(app.name);
    const title = escape(app.displayName || app.name);
    const tagline = app.description
      ? `<p class="card__tagline">${escape(app.description)}</p>`
      : "";
    return `      <a class="card" href="./${name}/">
        <div class="card__head">
          <h2 class="card__title">${title}</h2>
          <span class="card__arrow" aria-hidden="true">→</span>
        </div>
        ${tagline}
        <div class="card__path">/${name}/</div>
      </a>`;
  })
  .join("\n");

const repo = escape(CANONICAL_REPO);

const GITHUB_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#1a1530">
  <meta name="description" content="Tutorial apps built on @dashevo/evo-sdk for Dash Platform testnet.">
  <title>Dash Platform — example apps</title>
  <link rel="icon" type="image/svg+xml" href="${FAVICON_DATA_URI}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;500;600&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --bg: oklch(18% 0.012 260);
      --surface: oklch(22% 0.013 260);
      --surface-hover: oklch(26% 0.014 260);
      --line: oklch(30% 0.013 260);
      --ink: oklch(96% 0.008 90);
      --ink-2: oklch(82% 0.01 260);
      --ink-3: oklch(62% 0.012 260);
      --accent: #008de4;
      --accent-soft: rgba(0, 141, 228, 0.18);
      --gold: oklch(74% 0.16 55);
    }
    html, body { margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: var(--bg);
      background-image: radial-gradient(ellipse 70% 50% at 50% -10%, var(--accent-soft), transparent 70%);
      color: var(--ink-2);
      font-family: "Open Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 15px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    .wrap {
      max-width: 920px;
      margin: 0 auto;
      padding: 4rem 1.25rem 3rem;
    }
    .hero { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2.5rem; }
    .hero__brand { display: flex; align-items: center; gap: 0.75rem; }
    .hero__mark {
      width: 32px; height: 32px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--accent);
      filter: drop-shadow(0 0 12px rgba(0, 141, 228, 0.45));
    }
    .hero__mark svg { width: 100%; height: 100%; }
    .hero__pill {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--gold);
      border: 1px solid color-mix(in oklch, var(--gold) 50%, transparent);
      background: color-mix(in oklch, var(--gold) 10%, transparent);
      padding: 0.18rem 0.5rem;
      border-radius: 9999px;
    }
    .hero__title {
      font-family: "Montserrat", "Open Sans", system-ui, sans-serif;
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--ink);
      margin: 0.25rem 0 0;
      letter-spacing: -0.01em;
    }
    .hero__subtitle {
      color: var(--ink-3);
      margin: 0;
      font-size: 0.9375rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 1.25rem 1.25rem 1.1rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      color: var(--ink-2);
      text-decoration: none;
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }
    .card:hover, .card:focus-visible {
      transform: translateY(-2px);
      border-color: var(--accent);
      background: var(--surface-hover);
      box-shadow: 0 8px 24px -8px rgba(0, 141, 228, 0.45);
      outline: none;
    }
    .card:focus-visible {
      box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
    }
    .card__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .card__title {
      font-family: "Montserrat", "Open Sans", system-ui, sans-serif;
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: -0.005em;
    }
    .card__arrow {
      color: var(--ink-3);
      font-size: 1.1rem;
      transition: transform 160ms ease, color 160ms ease;
    }
    .card:hover .card__arrow { color: var(--accent); transform: translateX(2px); }
    .card__tagline {
      margin: 0;
      color: var(--ink-2);
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .card__path {
      font-family: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
      font-size: 11.5px;
      color: var(--ink-3);
      letter-spacing: 0.01em;
    }
    footer {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--line);
      font-size: 0.8125rem;
      color: var(--ink-3);
      display: flex;
      justify-content: center;
    }
    footer a {
      color: var(--ink-3);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    footer a:hover { color: var(--accent); }
    @media (max-width: 540px) {
      .wrap { padding: 2.5rem 1rem 2rem; }
      .hero__title { font-size: 1.4rem; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="hero">
      <div class="hero__brand">
        <span class="hero__mark">${DASH_MARK}</span>
        <span class="hero__pill">Testnet</span>
      </div>
      <h1 class="hero__title">Dash Platform — example apps</h1>
      <p class="hero__subtitle">Tutorial apps built on <code>@dashevo/evo-sdk</code>. Pick one to launch.</p>
    </div>

    <section class="grid">
${cards}
    </section>

    <footer>
      <a href="https://github.com/${repo}" target="_blank" rel="noreferrer">
        ${GITHUB_ICON}
        <span>View on GitHub</span>
      </a>
    </footer>
  </main>
</body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${apps.length} app${apps.length === 1 ? "" : "s"})`);
