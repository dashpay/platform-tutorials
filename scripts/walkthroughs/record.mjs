#!/usr/bin/env node
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const defaultUrl = 'http://127.0.0.1:5173/';
const captionsDir = path.join(__dirname, 'captions');

const appConfigs = {
  'dashnote-starter': {
    appDir: 'example-apps/dashnote-starter',
    fileStem: 'dashnote-starter',
    title: 'Dashnote Starter',
    previewAfter: 'sample notes',
    run: runDashnoteStarter,
  },
  dashnote: {
    appDir: 'example-apps/dashnote',
    fileStem: 'dashnote',
    title: 'Dashnote',
    previewAfter: 'settings',
    run: runDashnote,
  },
  'dashmint-lab': {
    appDir: 'example-apps/dashmint-lab',
    fileStem: 'dashmint-lab',
    title: 'DashMint Lab',
    previewAfter: 'how it works',
    run: runDashmintLab,
  },
  dashrate: {
    appDir: 'example-apps/dashrate',
    fileStem: 'dashrate',
    title: 'DashRate',
    previewAfter: 'my reviews',
    run: runDashrate,
    viewport: { width: 1440, height: 1000 },
  },
  'token-ops': {
    appDir: 'example-apps/token-ops',
    fileStem: 'token-ops',
    title: 'TokenOps',
    run: runTokenOps,
    viewport: { width: 1440, height: 1000 },
  },
};

const usage = `Usage:
  node scripts/walkthroughs/record.mjs <app> [--url http://127.0.0.1:5173/] [--env-file .env.walkthrough] [--no-login] [--headed]

Apps:
  dashnote-starter
  dashnote
  dashmint-lab
  dashrate
  token-ops

Output:
  walkthrough/<app>/<app>-walkthrough.webm
  walkthrough/<app>/<app>-preview.png

Environment:
  The recorder automatically loads .env.walkthrough when it exists. Supported
  mnemonic keys are WALKTHROUGH_MNEMONIC, PLATFORM_MNEMONIC,
  PLATFORM_TUTORIALS_IDENTITY_MNEMONIC, and MNEMONIC.

  PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium
    Optional browser executable override.

  PLAYWRIGHT_REQUIRE_PATH=/path/to/node_modules/playwright
    Optional Playwright module override. By default this script looks in the
    app and repo root.`;

function parseArgs(argv) {
  const args = {
    app: null,
    envFile: path.join(repoRoot, '.env.walkthrough'),
    login: true,
    url: defaultUrl,
    headed: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(usage);
      process.exit(0);
    } else if (arg === '--url') {
      args.url = argv[++i];
      if (!args.url) throw new Error('--url requires a value');
    } else if (arg === '--env-file') {
      const envFile = argv[++i];
      if (!envFile) throw new Error('--env-file requires a value');
      args.envFile = path.resolve(envFile);
    } else if (arg === '--no-login') {
      args.login = false;
    } else if (arg === '--headed') {
      args.headed = true;
    } else if (!args.app) {
      args.app = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!args.app || !appConfigs[args.app]) {
    throw new Error(`Choose one app: ${Object.keys(appConfigs).join(', ')}`);
  }

  return args;
}

async function loadEnvFile(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return true;
}

async function loadCaptionCopy(appName) {
  const filePath = path.join(captionsDir, `${appName}.json`);
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Missing caption file: ${filePath}`);
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid caption JSON in ${filePath}: ${err.message}`);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`Caption file must be a JSON object: ${filePath}`);
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`Caption "${key}" in ${filePath} must be a string`);
    }
  }

  return parsed;
}

function firstEnv(keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function getCredentials(loginEnabled) {
  if (!loginEnabled) return null;
  const mnemonic = firstEnv([
    'WALKTHROUGH_MNEMONIC',
    'PLATFORM_MNEMONIC',
    'PLATFORM_TUTORIALS_IDENTITY_MNEMONIC',
    'MNEMONIC',
  ]);
  if (!mnemonic) return null;

  const identityIndex = firstEnv([
    'WALKTHROUGH_IDENTITY_INDEX',
    'PLATFORM_IDENTITY_INDEX',
    'PLATFORM_TUTORIALS_IDENTITY_INDEX',
    'IDENTITY_INDEX',
  ]);

  return {
    identityIndex: Number.parseInt(identityIndex || '0', 10) || 0,
    mnemonic,
  };
}

function loadPlaywright(appDir) {
  const candidates = [];
  if (process.env.PLAYWRIGHT_REQUIRE_PATH) {
    candidates.push(process.env.PLAYWRIGHT_REQUIRE_PATH);
  }
  candidates.push(appDir);
  candidates.push(repoRoot);

  const errors = [];
  for (const candidate of candidates) {
    try {
      const req = createRequire(
        candidate.endsWith('playwright')
          ? path.join(candidate, 'package.json')
          : path.join(candidate, 'package.json'),
      );
      return req(candidate.endsWith('playwright') ? candidate : 'playwright');
    } catch (err) {
      errors.push(`${candidate}: ${err.message}`);
    }
  }

  throw new Error(
    `Unable to load Playwright. Install dependencies for the app, or set PLAYWRIGHT_REQUIRE_PATH.\n\n${errors.join('\n')}`,
  );
}

async function launchBrowser({ appDir, headed }) {
  const { chromium } = loadPlaywright(appDir);
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  return chromium.launch({
    headless: !headed,
    ...(executablePath ? { executablePath } : {}),
  });
}

async function addWalkthroughOverlay(page, accent = '#34d399') {
  await page.addStyleTag({
    content: `
      html { scroll-behavior: smooth; }
      #walkthrough-caption {
        position: fixed;
        left: calc(50% + var(--walkthrough-caption-offset, 0px));
        top: 8px;
        z-index: 999999;
        pointer-events: none;
        max-width: 560px;
        width: min(560px, calc(100vw - 540px));
        padding: 10px 16px;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.88);
        color: #f8fafc;
        border: 1px solid color-mix(in srgb, ${accent} 55%, transparent);
        text-align: center;
        font: 600 17px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 12px 32px rgba(0, 0, 0, .55);
        backdrop-filter: blur(12px);
        transform: translateX(-50%);
      }
      #walkthrough-cursor {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 1000000;
        width: 22px;
        height: 22px;
        border: 3px solid ${accent};
        border-radius: 999px;
        background: color-mix(in srgb, ${accent} 16%, transparent);
        box-shadow: 0 0 0 7px color-mix(in srgb, ${accent} 13%, transparent);
        transform: translate(-50%, -50%);
        pointer-events: none;
        transition: left .45s ease, top .45s ease, transform .18s ease;
      }
      #walkthrough-cursor.clicking {
        transform: translate(-50%, -50%) scale(.72);
        background: color-mix(in srgb, ${accent} 35%, transparent);
      }
    `,
  });

  await page.evaluate(() => {
    const caption = document.createElement('div');
    caption.id = 'walkthrough-caption';
    caption.textContent = '';
    document.body.appendChild(caption);

    const cursor = document.createElement('div');
    cursor.id = 'walkthrough-cursor';
    cursor.style.left = '1080px';
    cursor.style.top = '132px';
    document.body.appendChild(cursor);
  });
}

function makeDriver(page) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const captionCopy = page.walkthroughCaptions ?? {};
  const copy = (key) => {
    const value = captionCopy[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `Missing caption "${key}" in captions/${page.walkthroughApp}.json`,
      );
    }
    return value;
  };

  return {
    delay,
    async caption(text, ms = 3000) {
      await page.evaluate((value) => {
        const el = document.getElementById('walkthrough-caption');
        if (el) el.textContent = value;
      }, text);
      await delay(ms);
    },
    async captionKey(key, ms) {
      await this.caption(copy(key), ms);
    },
    async moveCursor(x, y) {
      await page.evaluate(
        ({ x, y }) => {
          const el = document.getElementById('walkthrough-cursor');
          if (el) {
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
          }
        },
        { x, y },
      );
      await delay(700);
    },
    async clickCursor(x, y) {
      await this.moveCursor(x, y);
      await page.evaluate(() => {
        document
          .getElementById('walkthrough-cursor')
          ?.classList.add('clicking');
      });
      await delay(180);
      await page.mouse.click(x, y);
      await page.evaluate(() => {
        document
          .getElementById('walkthrough-cursor')
          ?.classList.remove('clicking');
      });
      await delay(900);
    },
    async clickLocator(locator) {
      const count = await locator.count();
      if (count !== 1)
        throw new Error(`Expected 1 locator match, found ${count}`);
      const box = await locator.boundingBox();
      if (!box) throw new Error('Locator is not visible');
      await this.clickCursor(box.x + box.width / 2, box.y + box.height / 2);
    },
    async moveToLocator(locator) {
      const count = await locator.count();
      if (count !== 1)
        throw new Error(`Expected 1 locator match, found ${count}`);
      const box = await locator.boundingBox();
      if (!box) throw new Error('Locator is not visible');
      await this.moveCursor(box.x + box.width / 2, box.y + box.height / 2);
    },
    async scrollToLocator(locator, block = 'center') {
      const count = await locator.count();
      if (count !== 1)
        throw new Error(`Expected 1 locator match, found ${count}`);
      await locator.evaluate((el, scrollBlock) => {
        el.scrollIntoView({ behavior: 'smooth', block: scrollBlock });
      }, block);
      await delay(1000);
    },
    async scrollToFirstLocator(locator, block = 'center') {
      const count = await locator.count();
      if (count < 1) throw new Error('Expected at least 1 locator match');
      await locator.first().evaluate((el, scrollBlock) => {
        el.scrollIntoView({ behavior: 'smooth', block: scrollBlock });
      }, block);
      await delay(1000);
    },
    async scrollToTop() {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'smooth' }),
      );
      await delay(900);
    },
    async clickFirstLocator(locator) {
      const count = await locator.count();
      if (count < 1) throw new Error('Expected at least 1 locator match');
      const target = locator.first();
      const box = await target.boundingBox();
      if (!box) throw new Error('Locator is not visible');
      await this.clickCursor(box.x + box.width / 2, box.y + box.height / 2);
    },
    async clickLastLocator(locator) {
      const count = await locator.count();
      if (count < 1) throw new Error('Expected at least 1 locator match');
      const target = locator.nth(count - 1);
      const box = await target.boundingBox();
      if (!box) throw new Error('Locator is not visible');
      await this.clickCursor(box.x + box.width / 2, box.y + box.height / 2);
    },
  };
}

async function runDashnoteStarter(page) {
  await page.goto(page.walkthroughUrl, {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  await page
    .locator('h1')
    .filter({
      hasText: 'Personal notes, stored on a public blockchain.',
    })
    .waitFor({ state: 'visible', timeout: 10000 });
  await addWalkthroughOverlay(page, '#2563eb');

  const driver = makeDriver(page);
  await driver.delay(1000);
  await driver.captionKey('intro');
  await driver.captionKey('identityAccess');
  await driver.moveCursor(622, 348);
  await driver.captionKey('signInForm');
  if (page.walkthroughCredentials) {
    await driver.captionKey('signedInWriteAccess');
    await page.addStyleTag({
      content:
        '#mnemonic { color: transparent !important; caret-color: transparent !important; }',
    });
    await driver.clickLocator(page.locator('#mnemonic'));
    await page.locator('#mnemonic').fill(page.walkthroughCredentials.mnemonic);
    await driver.clickLocator(page.getByRole('button', { name: 'Sign in' }));
    await page.getByRole('heading', { name: 'Dashnote Starter' }).waitFor({
      state: 'visible',
      timeout: 60000,
    });
    await driver.captionKey('authenticatedWorkspace');
    await driver.moveCursor(596, 158);
    await driver.delay(700);
    await driver.captionKey('noWritesDefault');
    await driver.clickLocator(page.locator('#title'));
    await page.keyboard.type('Walkthrough draft', { delay: 35 });
    await driver.clickLocator(page.locator('#message'));
    await page.keyboard.type(
      'This field is filled locally, but not submitted.',
      {
        delay: 25,
      },
    );
    await driver.moveCursor(114, 405);
    await driver.delay(1400);
    await driver.captionKey('writeAccessCrud', 1800);
    return;
  }

  await driver.clickLocator(page.locator('#mnemonic'));
  await page.keyboard.type('testnet mnemonic goes here', { delay: 45 });
  await driver.delay(600);
  await driver.captionKey('readOnlyTour');
  await page.locator('#mnemonic').fill('');
  await driver.delay(500);
  await driver.captionKey('sampleNotes');
  await page.evaluate(() => window.scrollTo({ top: 470, behavior: 'smooth' }));
  await driver.delay(1400);
  await driver.moveCursor(336, 376);
  await driver.captionKey('exampleConcepts');
  await page.evaluate(() => window.scrollTo({ top: 760, behavior: 'smooth' }));
  await driver.delay(1400);
  await driver.captionKey('aboutSection');
  await driver.clickLocator(
    page.getByText('About this starter app', { exact: true }),
  );
  await driver.delay(1200);
  await driver.captionKey('fullAppFlow');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await driver.delay(1500);
  await driver.captionKey('outro', 1800);
}

async function runDashnote(page) {
  await page.goto(page.walkthroughUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.getByRole('heading', { name: 'Notes', exact: true }).waitFor({
    state: 'visible',
    timeout: 10000,
  });
  await page
    .getByText('Connected', { exact: true })
    .or(page.getByText('Read-only access', { exact: true }))
    .or(page.getByText('Full access', { exact: true }))
    .waitFor({ state: 'visible', timeout: 30000 });

  await addWalkthroughOverlay(page, '#d6a75b');
  const driver = makeDriver(page);

  await driver.delay(900);
  await driver.captionKey('intro');

  if (page.walkthroughCredentials) {
    await driver.captionKey('signInFullAccess');
    if ((await page.getByText('Full access', { exact: true }).count()) === 0) {
      const identityButton = page
        .locator('button')
        .filter({ hasText: /Guest|Signed out|Sign in|Read-only access/ });
      await driver.clickLastLocator(identityButton);
      await page.locator('input[type="password"]').waitFor({
        state: 'visible',
        timeout: 10000,
      });
      await driver.clickLocator(page.locator('input[type="password"]'));
      await page
        .locator('input[type="password"]')
        .fill(page.walkthroughCredentials.mnemonic);
      if (page.walkthroughCredentials.identityIndex !== 0) {
        await driver.clickLocator(
          page.getByRole('button', { name: 'Advanced settings' }),
        );
        await page
          .locator('input[type="number"]')
          .fill(String(page.walkthroughCredentials.identityIndex));
      }
      const submitSignIn = page
        .locator('form')
        .getByRole('button', { name: 'Sign in' });
      await driver.clickLocator(submitSignIn);
      await page.getByText('Full access', { exact: true }).waitFor({
        state: 'visible',
        timeout: 60000,
      });
    }
    await driver.captionKey('identityFullAccess');
    await driver.captionKey('identityMenu');
    await driver.clickLocator(
      page
        .locator('button[aria-haspopup="menu"]')
        .filter({ hasText: /Full access/ }),
    );
    await page.getByRole('menu').waitFor({ state: 'visible', timeout: 10000 });
    await driver.delay(1100);
    await driver.clickLocator(page.getByRole('menuitem', { name: 'Log out' }));
    await page.getByText('Read-only access', { exact: true }).waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.captionKey('rememberedReload');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await addWalkthroughOverlay(page, '#d6a75b');
    await page.getByText('Read-only access', { exact: true }).waitFor({
      state: 'visible',
      timeout: 30000,
    });
    await page
      .getByText('Revisions prevent conflicts', { exact: true })
      .waitFor({ state: 'visible', timeout: 60000 });
    await driver.delay(1000);
    await driver.captionKey('rememberedSearch');
    await driver.clickLocator(page.getByPlaceholder('Search'));
    await page.getByPlaceholder('Search').fill('Revisions');
    await page
      .getByText('Revisions prevent conflicts', { exact: true })
      .waitFor({ state: 'visible', timeout: 10000 });
    await driver.moveCursor(174, 290);
    await driver.delay(1200);
    await page.getByPlaceholder('Search').fill('');
    await driver.delay(900);

    await driver.captionKey('signBackInCrud');
    await driver.clickLastLocator(
      page.locator('button').filter({ hasText: /Read-only access/ }),
    );
    await page.locator('input[type="password"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.clickLocator(page.locator('input[type="password"]'));
    await page
      .locator('input[type="password"]')
      .fill(page.walkthroughCredentials.mnemonic);
    const rememberedSubmit = page
      .locator('form')
      .getByRole('button', { name: 'Sign in' });
    await driver.clickLocator(rememberedSubmit);
    await page.getByText('Full access', { exact: true }).waitFor({
      state: 'visible',
      timeout: 60000,
    });
  } else {
    await driver.captionKey('readOnlyMode');
  }

  await driver.moveCursor(176, 258);
  await driver.captionKey('leftPane');
  await driver.moveCursor(622, 350);
  await driver.captionKey('editorPane');

  if (page.walkthroughCredentials) {
    const newButton = page.getByRole('button', { name: 'New note' });
    if ((await newButton.count()) === 1) {
      const uniqueTitle = `Walkthrough note ${Date.now().toString().slice(-6)}`;
      await driver.captionKey('createNote');
      await driver.clickLocator(newButton);
      await page.getByLabel('Title').waitFor({
        state: 'visible',
        timeout: 10000,
      });
      await driver.clickLocator(page.getByLabel('Title'));
      await page.keyboard.type(uniqueTitle, { delay: 35 });
      await driver.clickLocator(page.getByLabel('Body'));
      await page.keyboard.type(
        'Created by the walkthrough recorder so we can show create, update, revision metadata, and delete.',
        { delay: 20 },
      );
      await driver.moveCursor(1040, 740);
      await driver.delay(1200);
      await driver.captionKey('saveCreate');
      await driver.clickLocator(
        page.getByRole('button', { name: 'Create note' }),
      );
      await page.getByText('Note created.', { exact: true }).first().waitFor({
        state: 'visible',
        timeout: 90000,
      });
      await page.getByText(uniqueTitle, { exact: true }).first().waitFor({
        state: 'visible',
        timeout: 30000,
      });
      await driver.captionKey('createdMetadata');
      await driver.moveCursor(508, 188);
      await driver.delay(900);
      await driver.moveCursor(688, 739);
      await driver.delay(900);

      await driver.captionKey('updateNote');
      await driver.clickLocator(page.getByLabel('Body'));
      await page.keyboard.press('End');
      await page.keyboard.type(
        '\n\nUpdated during the walkthrough to show revision changes.',
        { delay: 20 },
      );
      await driver.clickLocator(page.getByRole('button', { name: 'Save' }));
      await page.getByText('Note saved.', { exact: true }).first().waitFor({
        state: 'visible',
        timeout: 90000,
      });
      await driver.captionKey('updatedMetadata');
      await driver.moveCursor(506, 188);
      await driver.delay(1200);

      await driver.captionKey('deleteNote');
      await driver.clickLocator(page.getByRole('button', { name: 'Delete' }));
      await page.getByRole('dialog', { name: 'Delete note' }).waitFor({
        state: 'visible',
        timeout: 10000,
      });
      await driver.clickLocator(
        page
          .getByRole('dialog', { name: 'Delete note' })
          .getByRole('button', { name: 'Delete' }),
      );
      await page.getByText('Note deleted.', { exact: true }).first().waitFor({
        state: 'visible',
        timeout: 90000,
      });
      await driver.captionKey('deletedNote');
    }
  } else {
    await driver.captionKey('readOnlyEditPrompt');
  }

  const activityButton = page.getByRole('button', { name: /Activity/ });
  if ((await activityButton.count()) === 1) {
    await driver.captionKey('activityDrawer');
    await driver.clickLocator(activityButton);
    await page.getByRole('dialog', { name: 'Activity log' }).waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.delay(1200);
    await page.keyboard.press('Escape');
    await driver.delay(700);
  }

  await driver.captionKey('howItWorks');
  await driver.clickLocator(page.getByRole('button', { name: 'How it works' }));
  await driver.delay(1400);
  await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'smooth' }));
  await driver.delay(1200);

  await driver.captionKey('settings');
  await driver.clickLocator(page.getByRole('button', { name: 'Settings' }));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await driver.delay(1400);
  await driver.captionKey('settingsRememberedIdentity');
  await driver.moveToLocator(page.getByTestId('settings-identity-block'));
  await driver.delay(700);
  await driver.moveToLocator(
    page.getByText('Clear local cache for this device', { exact: true }),
  );
  await driver.captionKey('settingsClearCache');
  if (
    (await page.getByText('Forget this device', { exact: true }).count()) === 1
  ) {
    await driver.moveToLocator(
      page.getByText('Forget this device', { exact: true }),
    );
    await driver.captionKey('settingsForgetDevice');
  }
  await driver.moveToLocator(
    page.locator('input[placeholder="Paste a note contract ID"]'),
  );
  await driver.captionKey('settingsContractOptions');
  await driver.moveToLocator(page.getByRole('button', { name: 'Use this ID' }));
  await driver.delay(600);
  await driver.moveToLocator(
    page.getByRole('button', { name: 'Register a fresh contract' }),
  );
  await driver.delay(1000);
  await driver.captionKey('outro', 1800);
}

async function runDashmintLab(page) {
  page.logStep('Navigating to app');
  await page.goto(page.walkthroughUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  page.logStep('Waiting for Collection heading');
  await page.locator('h1', { hasText: 'Collection' }).waitFor({
    state: 'visible',
    timeout: 10000,
  });
  page.logStep('Waiting for SDK Connected indicator');
  await page.getByText('Connected', { exact: true }).waitFor({
    state: 'visible',
    timeout: 20000,
  });
  page.logStep('Waiting for first card to load');
  await page.getByRole('article').first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await addWalkthroughOverlay(page, '#fbbf24');
  await page.evaluate(() => {
    document.documentElement.style.setProperty(
      '--walkthrough-caption-offset',
      '104px',
    );
  });

  const driver = makeDriver(page);
  await driver.delay(900);
  await driver.captionKey('intro');
  await driver.captionKey('collectionLive');
  await driver.moveCursor(514, 247);
  await driver.delay(900);
  await driver.captionKey('cardDetails');
  await driver.moveCursor(1060, 700);
  await driver.delay(900);
  await driver.captionKey('marketplace');
  page.logStep('Switching to Marketplace tab');
  await driver.clickLocator(page.getByRole('button', { name: 'Marketplace' }));
  await driver.delay(1200);
  const buyButton = page
    .getByRole('button', { name: 'Buy', exact: true })
    .first();
  if ((await buyButton.count()) > 0) {
    await buyButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
    await driver.captionKey('marketplaceBuy');
    page.logStep('Hovering Buy button');
    await driver.moveToLocator(buyButton);
    await driver.delay(1200);
  }
  await driver.captionKey('sorting');
  await driver.clickLocator(page.getByRole('button', { name: /Sort:/ }));
  await driver.clickLocator(page.getByRole('button', { name: /Sort:/ }));
  await driver.clickLocator(page.getByRole('button', { name: /Sort:/ }));
  await driver.delay(1100);
  page.logStep('Returning to All tab');
  await driver.clickLocator(page.getByRole('button', { name: 'All' }));
  await driver.delay(900);
  if (page.walkthroughCredentials) {
    page.logStep('Signing in with walkthrough mnemonic');
    await driver.captionKey('signInUnlocks');
    await driver.clickLastLocator(page.getByRole('button', { name: 'Login' }));
    await page.locator('input[type="password"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await page
      .locator('input[type="password"]')
      .fill(page.walkthroughCredentials.mnemonic);
    if (page.walkthroughCredentials.identityIndex !== 0) {
      await driver.clickLocator(
        page.getByRole('button', { name: 'Advanced settings' }),
      );
      await page
        .locator('input[type="number"]')
        .fill(String(page.walkthroughCredentials.identityIndex));
    }
    const submitLogin = page
      .locator('form')
      .getByRole('button', { name: 'Login' });
    await driver.clickLocator(submitLogin);
    page.logStep('Waiting for signed-in UI (Yours tab)');
    await page.getByRole('button', { name: 'Yours' }).waitFor({
      state: 'visible',
      timeout: 60000,
    });
    await driver.captionKey('afterLogin');
    await driver.delay(900);
    page.logStep('Switching to Yours tab');
    await driver.clickLocator(page.getByRole('button', { name: 'Yours' }));
    await driver.delay(1200);
    const ownedCard = page.getByRole('article').first();
    if ((await ownedCard.count()) > 0) {
      await ownedCard.waitFor({ state: 'visible', timeout: 10000 });
      await driver.captionKey('ownedCardMenu');
      const menuButton = ownedCard.getByRole('button', {
        name: 'More actions',
      });
      page.logStep('Opening owned-card overflow menu');
      await driver.clickLocator(menuButton);
      await driver.delay(900);
      const ownerMenuItems = ['Transfer', 'Copy ID', 'View on Explorer'];
      for (const itemName of ownerMenuItems) {
        const item = page.getByRole('button', { name: itemName }).last();
        if ((await item.count()) > 0) {
          await driver.moveToLocator(item);
          await driver.delay(700);
        }
      }
      const burnItem = page.getByRole('button', { name: 'Burn Card' }).last();
      if ((await burnItem.count()) > 0) {
        await driver.moveToLocator(burnItem);
        await driver.delay(900);
      }
      page.logStep('Closing overflow menu');
      await page.keyboard.press('Escape');
      await page.mouse.click(20, 20);
      await driver.delay(600);
    }
    page.logStep('Returning to All tab');
    await driver.clickLocator(page.getByRole('button', { name: 'All' }));
    await driver.delay(900);
  }
  await driver.captionKey(
    page.walkthroughCredentials ? 'mintUnlocked' : 'mintReadOnly',
  );
  page.logStep('Switching to Mint tab');
  await driver.clickLocator(page.getByRole('button', { name: 'Mint' }));
  if (page.walkthroughCredentials) {
    await page.getByRole('button', { name: 'Mint Card' }).waitFor({
      state: 'visible',
      timeout: 10000,
    });
  } else {
    await page.getByText('Login to burn DashMint tokens').waitFor({
      state: 'visible',
      timeout: 10000,
    });
  }
  await driver.delay(1300);
  if (page.walkthroughCredentials) {
    const demoCardName = 'Token Forge Adept';
    await driver.captionKey('mintPrepare');
    await page
      .locator('input[placeholder="e.g. Fire Dragon"]')
      .fill(demoCardName);
    await page
      .locator(
        'textarea[placeholder="e.g. A legendary beast from the volcanic plains"]',
      )
      .fill('Forged with one DashMint token on Dash Platform testnet.');
    await driver.moveCursor(748, 409);
    await driver.delay(900);
    await driver.captionKey('mintSubmitting');
    await driver.clickLocator(page.getByRole('button', { name: 'Mint Card' }));
    await page.getByText(`Card "${demoCardName}" minted!`).waitFor({
      state: 'visible',
      timeout: 60000,
    });
    await driver.captionKey('mintComplete');
    await driver.delay(1200);

    page.logStep('Switching to Tokens tab');
    await driver.clickLocator(page.getByRole('button', { name: 'Tokens' }));
    await page.locator('h1', { hasText: 'Tokens' }).waitFor({
      state: 'visible',
      timeout: 10000,
    });
    const tokenBalanceLabel = page.getByText('Your DashMint balance', {
      exact: true,
    });
    await tokenBalanceLabel.waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.captionKey('tokensIntro');
    await driver.moveToLocator(tokenBalanceLabel);
    await driver.delay(900);
    await driver.captionKey('tokensTransfer');
    await driver.moveToLocator(
      page.getByRole('heading', {
        name: 'Transfer tokens',
      }),
    );
    await driver.delay(1200);
  } else {
    await driver.captionKey('loginPath');
    await driver.clickLastLocator(page.getByRole('button', { name: 'Login' }));
    await page.locator('input[type="password"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.delay(1000);
    await driver.captionKey('fundedIdentity');
    await page.keyboard.press('Escape');
    await driver.delay(700);
  }
  await driver.captionKey('howItWorks');
  page.logStep('Switching to How it works tab');
  await driver.clickLocator(page.getByRole('button', { name: 'How it works' }));
  await driver.delay(1400);
  await driver.captionKey('outro');
  await page.evaluate(() => window.scrollTo({ top: 360, behavior: 'smooth' }));
  await driver.delay(1900);
}

async function runDashrate(page) {
  page.logStep('Navigating to app');
  await page.goto(page.walkthroughUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.getByRole('heading', { name: 'DashRate', level: 1 }).waitFor({
    state: 'visible',
    timeout: 10000,
  });
  await page
    .locator('aside[aria-label="Tutorial resources"] button')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  await addWalkthroughOverlay(page, '#0ea5e9');
  await page.evaluate(() => {
    document.documentElement.style.setProperty(
      '--walkthrough-caption-offset',
      '90px',
    );
  });

  const driver = makeDriver(page);
  const saveButton = page
    .locator('.review-form')
    .getByRole('button', { name: 'Save review' });
  const reviewTextarea = page.locator('#review-comment');
  const reviewText = (label) =>
    `Walkthrough ${label} ${new Date().toISOString().slice(0, 19)}Z`;
  const waitForSaveToFinish = async () => {
    await page.waitForFunction(
      () => {
        const button = [...document.querySelectorAll('button')].find(
          (candidate) => candidate.textContent?.trim() === 'Save review',
        );
        return Boolean(button && !button.disabled);
      },
      null,
      { timeout: 90000 },
    );
  };
  const saveCurrentReview = async (captionKey) => {
    await driver.captionKey(captionKey);
    await driver.clickLocator(saveButton);
    await waitForSaveToFinish();
    await driver.delay(1200);
  };
  const navButton = (name) =>
    page
      .locator('nav[aria-label="Primary navigation"]')
      .getByRole('button', { name, exact: true });
  const goToNav = async (name, heading) => {
    await driver.scrollToTop();
    await driver.clickLocator(navButton(name));
    await driver.scrollToTop();
    await heading.waitFor({ state: 'visible', timeout: 15000 });
  };

  await driver.delay(900);
  await driver.captionKey('intro');
  await driver.moveToLocator(
    page.locator('aside[aria-label="Tutorial resources"] button').first(),
  );
  await driver.captionKey('resourceList');

  const preferredResource = page
    .locator('aside[aria-label="Tutorial resources"] button')
    .filter({ hasText: 'Dashnote' });
  if ((await preferredResource.count()) === 1) {
    await driver.clickLocator(preferredResource);
  }
  await page.getByRole('heading', { name: 'Dashnote', level: 2 }).waitFor({
    state: 'visible',
    timeout: 10000,
  });
  await driver.captionKey('resourceDetail');
  await driver.moveToLocator(
    page.locator('[aria-label="Aggregate rating stats"]'),
  );
  await driver.captionKey('aggregateStats');

  const histogramRows = page.locator('.histogram-row');
  if ((await histogramRows.count()) > 0) {
    await driver.captionKey('histogram');
    await driver.clickFirstLocator(histogramRows);
    await page.getByRole('heading', { name: /reviews$/ }).waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.scrollToFirstLocator(
      page.locator('.review-list-head'),
      'center',
    );
    await driver.captionKey('filteredReviews');
    const clearFilter = page.getByRole('button', { name: 'Clear filter' });
    if ((await clearFilter.count()) === 1) {
      await driver.clickLocator(clearFilter);
    }
  } else {
    await driver.captionKey('noHistogram');
  }

  await driver.scrollToFirstLocator(
    page.locator('.review-list-head'),
    'center',
  );
  await driver.captionKey('recentReviews');
  await driver.moveToLocator(
    page.getByRole('heading', { name: 'Recent reviews' }),
  );
  await driver.delay(700);

  if (page.walkthroughCredentials) {
    page.logStep('Signing in with walkthrough mnemonic');
    await driver.captionKey('settingsLogin');
    await goToNav('Settings', page.getByRole('heading', { name: 'Settings' }));
    await page.addStyleTag({
      content:
        '.settings input[type="password"] { color: transparent !important; caret-color: transparent !important; }',
    });
    await driver.clickLocator(page.locator('.settings input[type="password"]'));
    await page
      .locator('.settings input[type="password"]')
      .fill(page.walkthroughCredentials.mnemonic);
    if (page.walkthroughCredentials.identityIndex !== 0) {
      await driver.clickLocator(
        page.getByRole('button', { name: 'Advanced settings' }),
      );
      await page
        .locator('.settings input[type="number"]')
        .fill(String(page.walkthroughCredentials.identityIndex));
    }
    await driver.clickLocator(
      page.locator('.settings form').first().getByRole('button', {
        name: 'Sign in',
      }),
    );
    await page.getByRole('button', { name: 'Sign out' }).waitFor({
      state: 'visible',
      timeout: 60000,
    });
    await driver.captionKey('signedIn');
    await driver.captionKey('contractSettings');
    const advanced = page.getByRole('button', { name: 'Advanced settings' });
    const expanded = await advanced.getAttribute('aria-expanded');
    if (expanded !== 'true') await driver.clickLocator(advanced);
    await driver.moveToLocator(page.locator('input[name="contractId"]'));
    await driver.delay(800);

    page.logStep('Switching to My reviews');
    await goToNav(
      'My reviews',
      page.getByRole('heading', { name: 'My reviews' }),
    );
    await driver.captionKey('myReviews');

    const reviewCards = page.locator('.my-review-card');
    await Promise.race([
      reviewCards.first().waitFor({ state: 'visible', timeout: 12000 }),
      page
        .getByText('No reviews from this identity yet.')
        .waitFor({ state: 'visible', timeout: 12000 }),
    ]).catch(() => {});

    if ((await reviewCards.count()) > 0) {
      await driver.moveToLocator(reviewCards.first());
      await driver.captionKey('myReviewCards');
      await driver.captionKey('editReview');
      await driver.clickFirstLocator(
        page.getByRole('button', { name: 'Edit review' }),
      );
      await driver.scrollToTop();
      await page.getByRole('heading', { name: 'Your review' }).waitFor({
        state: 'visible',
        timeout: 10000,
      });
      await driver.scrollToLocator(page.locator('.review-form'), 'center');
      await driver.captionKey('prefilledReview');
      await driver.clickLocator(reviewTextarea);
      await reviewTextarea.fill(reviewText('review update'));
      await saveCurrentReview('saveUpdatedReview');
    } else {
      await driver.captionKey('emptyMyReviews');
      await goToNav(
        'Resources',
        page.getByRole('heading', { name: 'Dashnote', level: 2 }),
      );
      await driver.scrollToLocator(page.locator('.review-form'), 'center');
      await driver.captionKey('createReview');
      await driver.clickLocator(
        page.getByRole('radio', { name: '5 stars', exact: true }),
      );
      await driver.clickLocator(reviewTextarea);
      await reviewTextarea.fill(reviewText('review create'));
      await saveCurrentReview('saveCreatedReview');
      await driver.clickLocator(reviewTextarea);
      await reviewTextarea.fill(reviewText('review edit'));
      await saveCurrentReview('saveUpdatedReview');
    }

    await driver.scrollToLocator(page.locator('.review-form'), 'center');
    const versionsButton = page.getByRole('button', {
      name: 'Show previous versions',
    });
    try {
      await versionsButton.waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      // If the network has not returned the freshly saved review yet, continue
      // with the visible edit form instead of stalling the recording.
    }
    if ((await versionsButton.count()) === 1) {
      await driver.captionKey('showHistory');
      await driver.clickLocator(versionsButton);
      await page.locator('.review-history').waitFor({
        state: 'visible',
        timeout: 60000,
      });
      await driver.scrollToLocator(page.locator('.review-history'), 'center');
      await driver.captionKey('previousVersions');
    }
  } else {
    await driver.captionKey('readOnlyLoginPath');
    await goToNav('Settings', page.getByRole('heading', { name: 'Settings' }));
    await driver.moveToLocator(
      page.locator('.settings input[type="password"]'),
    );
    await driver.delay(1000);
  }

  await driver.captionKey('outro', 1900);
}

async function runTokenOps(page) {
  page.logStep('Navigating to app');
  await page.goto(page.walkthroughUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.getByRole('heading', { name: 'TokenOps', level: 1 }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await page
    .getByRole('heading', {
      name: /Governance at a glance|Your signature is needed/,
    })
    .waitFor({
      state: 'visible',
      timeout: 60000,
    });

  await addWalkthroughOverlay(page, '#008de4');
  await page.evaluate(() => {
    document.documentElement.style.setProperty(
      '--walkthrough-caption-offset',
      '80px',
    );
  });

  const driver = makeDriver(page);
  const navButton = (name) =>
    page.locator('.tabs').getByRole('button', { name, exact: true });
  const goToNav = async (name, target) => {
    await driver.scrollToTop();
    await driver.clickLocator(navButton(name));
    await driver.scrollToTop();
    await target.waitFor({ state: 'visible', timeout: 60000 });
    await driver.delay(900);
  };

  await driver.delay(900);
  await driver.captionKey('intro');

  if (page.walkthroughCredentials) {
    page.logStep('Signing in with walkthrough mnemonic');
    await driver.captionKey('signIn');
    await driver.clickLocator(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    );
    const secret = page.locator('#login-secret');
    await secret.waitFor({ state: 'visible', timeout: 10000 });
    await page.addStyleTag({
      content:
        '#login-secret { color: transparent !important; caret-color: transparent !important; }',
    });
    await secret.fill(page.walkthroughCredentials.mnemonic);
    if (page.walkthroughCredentials.identityIndex !== 0) {
      await driver.clickLocator(
        page.getByRole('button', { name: 'Show advanced settings' }),
      );
      await page
        .locator('#login-identity-index')
        .fill(String(page.walkthroughCredentials.identityIndex));
    }
    await driver.clickLocator(
      page
        .getByRole('dialog', { name: 'Sign in to TokenOps' })
        .getByRole('button', { name: 'Sign in', exact: true }),
    );
    await page.getByRole('button', { name: 'Sign out' }).waitFor({
      state: 'visible',
      timeout: 60000,
    });
    await driver.captionKey('signedIn');
  } else {
    await driver.captionKey('readOnly');
  }

  await driver.scrollToTop();
  await driver.moveToLocator(page.locator('.dashboard-priority-grid'));
  await driver.captionKey('proposalStatus');
  await driver.scrollToLocator(page.locator('.dashboard-control-panel'));
  await driver.captionKey('authoritySummary');
  await driver.scrollToLocator(page.locator('.dashboard-token-card'));
  await driver.captionKey('tokenDetails');

  page.logStep('Switching to Actions');
  await goToNav(
    'Actions',
    page.getByRole('heading', { name: 'Propose new action' }),
  );
  await driver.moveToLocator(page.locator('.proposal-selector'));
  await driver.captionKey('actionTypes');
  await driver.scrollToLocator(
    page.getByRole('heading', { name: 'Review pending actions' }),
    'start',
  );
  await driver.captionKey('pendingActions');
  const proposalCard = page.locator('.proposal-card').first();
  if ((await proposalCard.count()) === 1) {
    await driver.scrollToLocator(proposalCard);
    await driver.moveToLocator(proposalCard);
    await driver.captionKey('signingProgress');
  } else {
    await driver.captionKey('emptyActions');
  }

  page.logStep('Switching to Governance');
  await goToNav(
    'Governance',
    page.getByRole('heading', { name: 'Governance', level: 3 }),
  );
  await driver.scrollToLocator(
    page.getByRole('heading', { name: 'Capability authority' }),
    'start',
  );
  await driver.captionKey('accessControl');
  await driver.scrollToTop();
  await driver.clickLocator(page.getByRole('tab', { name: 'Groups' }));
  const firstGroup = page.locator('.group-row-main').first();
  await firstGroup.waitFor({ state: 'visible', timeout: 30000 });
  await driver.scrollToLocator(firstGroup);
  await driver.captionKey('groups');
  await driver.clickFirstLocator(page.locator('.group-row-main'));
  await page.locator('.group-detail-panel').waitFor({
    state: 'visible',
    timeout: 10000,
  });
  await driver.captionKey('groupDetails');

  page.logStep('Switching to Settings');
  await goToNav(
    'Settings',
    page.locator('h3').filter({ hasText: /^Contract$/ }),
  );
  await driver.captionKey(
    page.walkthroughCredentials ? 'authenticatedSettings' : 'readOnlySettings',
  );
  await driver.moveToLocator(page.getByPlaceholder('Contract or token ID'));
  await driver.captionKey('contractResolver');
  await driver.scrollToLocator(
    page.getByRole('heading', {
      name: 'Register a new contract',
      exact: true,
    }),
  );
  await driver.captionKey('registrationPath');
  await driver.captionKey('outro', 2200);
}

function logStep(label) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${label}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadEnvFile(args.envFile);
  const credentials = getCredentials(args.login);
  const config = appConfigs[args.app];
  const captions = await loadCaptionCopy(args.app);
  const appDir = path.join(repoRoot, config.appDir);
  const outDir = path.join(repoRoot, 'walkthrough', args.app);
  const tmpVideoDir = path.join(
    os.tmpdir(),
    `${config.fileStem}-video-${Date.now()}`,
  );
  const targetWebm = path.join(outDir, `${config.fileStem}-walkthrough.webm`);
  const targetPreview = path.join(outDir, `${config.fileStem}-preview.png`);

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(tmpVideoDir, { recursive: true });

  logStep(`Launching ${args.headed ? 'headed' : 'headless'} browser`);
  const browser = await launchBrowser({ appDir, headed: args.headed });
  const viewport = config.viewport ?? { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    recordVideo: { dir: tmpVideoDir, size: viewport },
  });
  const page = await context.newPage();
  page.walkthroughUrl = args.url;
  page.walkthroughApp = args.app;
  page.walkthroughCredentials = credentials;
  page.walkthroughCaptions = captions;
  page.logStep = logStep;

  let interrupted = false;
  const bail = new Promise((resolve) => {
    const onSignal = (signal) => {
      if (interrupted) return;
      interrupted = true;
      logStep(`Received ${signal}, finalizing video`);
      resolve();
    };
    process.once('SIGINT', () => onSignal('SIGINT'));
    process.once('SIGTERM', () => onSignal('SIGTERM'));
  });

  logStep(`Recording ${config.title} at ${args.url}`);
  let persistError = null;
  try {
    await Promise.race([config.run(page), bail]);
    if (!interrupted) {
      logStep('Capturing preview screenshot');
      await page.screenshot({ path: targetPreview, fullPage: false });
    }
  } finally {
    const video = page.video();
    try {
      await page.close({ runBeforeUnload: false });
    } catch (err) {
      logStep(`page.close failed: ${err.message}`);
    }
    if (video) {
      try {
        await video.saveAs(targetWebm);
      } catch (err) {
        logStep(`video.saveAs failed: ${err.message}`);
        try {
          const source = await video.path();
          await fs.copyFile(source, targetWebm);
        } catch (copyErr) {
          logStep(`video copy fallback failed: ${copyErr.message}`);
          persistError = copyErr;
        }
      }
    }
    try {
      await context.close();
    } catch (err) {
      logStep(`context.close failed: ${err.message}`);
    }
    try {
      await browser.close();
    } catch (err) {
      logStep(`browser.close failed: ${err.message}`);
    }
    try {
      await fs.rm(tmpVideoDir, { recursive: true, force: true });
    } catch (err) {
      logStep(`temporary video cleanup failed: ${err.message}`);
    }
  }

  if (persistError) {
    throw new Error(
      `Failed to persist walkthrough video: ${persistError.message}`,
    );
  }

  if (interrupted) {
    console.log(`Interrupted; saved partial video for ${config.title}`);
  } else {
    console.log(`Recorded ${config.title}`);
  }
  console.log(`Video: ${targetWebm}`);
  if (!interrupted) console.log(`Preview: ${targetPreview}`);
  if (interrupted) process.exit(130);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
