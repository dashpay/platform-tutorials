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
};

const usage = `Usage:
  node scripts/walkthroughs/record.mjs <app> [--url http://127.0.0.1:5173/] [--env-file .env.walkthrough] [--no-login] [--headed]

Apps:
  dashnote-starter
  dashnote
  dashmint-lab

Output:
  example-apps/<app>/walkthrough/<app>-walkthrough.webm
  example-apps/<app>/walkthrough/<app>-preview.png

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
      args.envFile = path.resolve(argv[++i]);
      if (!args.envFile) throw new Error('--env-file requires a value');
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
    if (err.code === 'ENOENT') return {};
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
        left: 50%;
        top: 22px;
        z-index: 999999;
        max-width: 640px;
        width: min(640px, calc(100vw - 48px));
        padding: 14px 18px;
        border-radius: 8px;
        background: rgba(8, 13, 24, 0.76);
        color: white;
        text-align: center;
        font: 600 20px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 12px 32px rgba(0, 0, 0, .28);
        backdrop-filter: blur(10px);
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
  const copy = (key, fallback) => {
    const value = captionCopy[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
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
    async captionKey(key, fallback, ms) {
      await this.caption(copy(key, fallback), ms);
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
  await driver.captionKey(
    'intro',
    'Dashnote Starter: a minimal React app for notes on Dash Platform testnet.',
  );
  await driver.captionKey(
    'identityAccess',
    'Start here: the app explains what it stores and asks for identity access only when you are ready.',
  );
  await driver.moveCursor(622, 348);
  await driver.captionKey(
    'signInForm',
    'The sign-in form keeps access local and links to the testnet identity setup path.',
  );
  if (page.walkthroughCredentials) {
    await driver.captionKey(
      'signedInWriteAccess',
      'Signing in unlocks the write actions that are otherwise unavailable in the starter preview.',
    );
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
    await driver.captionKey(
      'authenticatedWorkspace',
      'Authenticated view shows the resolved identity, active contract, note editor, and note list.',
    );
    await driver.moveCursor(596, 158);
    await driver.delay(700);
    await driver.captionKey(
      'noWritesDefault',
      'The default walkthrough does not create, update, or delete notes; it stops before any testnet write.',
    );
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
    await driver.captionKey(
      'writeAccessCrud',
      'With write access, this same flow can exercise a full CRUD demo when needed.',
      1800,
    );
    return;
  }

  await driver.clickLocator(page.locator('#mnemonic'));
  await page.keyboard.type('testnet mnemonic goes here', { delay: 45 });
  await driver.delay(600);
  await driver.captionKey(
    'readOnlyTour',
    'Without sign-in, the walkthrough stops before write actions and tours the read-only starter screen.',
  );
  await page.locator('#mnemonic').fill('');
  await driver.delay(500);
  await driver.captionKey(
    'sampleNotes',
    'Sample notes preview the authenticated workspace without loading the SDK or touching the network first.',
  );
  await page.evaluate(() => window.scrollTo({ top: 470, behavior: 'smooth' }));
  await driver.delay(1400);
  await driver.moveCursor(336, 376);
  await driver.captionKey(
    'exampleConcepts',
    'The examples call out the core concepts: identity-owned data, shared contracts, and revisions.',
  );
  await page.evaluate(() => window.scrollTo({ top: 760, behavior: 'smooth' }));
  await driver.delay(1400);
  await driver.captionKey(
    'aboutSection',
    'The About section summarizes how the starter maps React UI to a hardcoded Dash Platform contract.',
  );
  await driver.clickLocator(
    page.getByText('About this starter app', { exact: true }),
  );
  await driver.delay(1200);
  await driver.captionKey(
    'fullAppFlow',
    'With write access, the full app flow is create, list, edit, refresh, and delete notes.',
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await driver.delay(1500);
  await driver.captionKey(
    'outro',
    'That is Dashnote Starter: deliberately small, readable, and focused on the SDK calls.',
    1800,
  );
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
  await driver.captionKey(
    'intro',
    'Dashnote is the full notes app: a two-pane notebook backed by Dash Platform documents.',
  );

  if (page.walkthroughCredentials) {
    await driver.captionKey(
      'signInFullAccess',
      'Signing in restores full write access for this identity.',
    );
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
    await driver.captionKey(
      'identityFullAccess',
      'After login, the identity card switches to full access and the note list loads for that identity.',
    );
    await driver.captionKey(
      'identityMenu',
      'The identity card menu exposes Settings, Switch identity, and Log out options.',
    );
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
    await driver.captionKey(
      'rememberedReload',
      'After logout, reloading uses the remembered identity to show cached notes without signing in.',
    );
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
    await driver.captionKey(
      'rememberedSearch',
      'Search works in remembered read-only mode; these notes came from the starter preview messages.',
    );
    await driver.clickLocator(page.getByPlaceholder('Search'));
    await page.getByPlaceholder('Search').fill('Revisions');
    await page
      .getByText('Revisions prevent conflicts', { exact: true })
      .waitFor({ state: 'visible', timeout: 10000 });
    await driver.moveCursor(174, 290);
    await driver.delay(1200);
    await page.getByPlaceholder('Search').fill('');
    await driver.delay(900);

    await driver.captionKey(
      'signBackInCrud',
      'Signing back in restores write access for the controlled CRUD demo.',
    );
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
    await driver.captionKey(
      'readOnlyMode',
      'Without sign-in, the recording stays in read-only mode.',
    );
  }

  await driver.moveCursor(176, 258);
  await driver.captionKey(
    'leftPane',
    'The left pane has search, note counts, cached results, and background refresh state.',
  );
  await driver.moveCursor(622, 350);
  await driver.captionKey(
    'editorPane',
    'The editor pane shows title, body, revision metadata, timestamps, and a byte-budget progress bar.',
  );

  if (page.walkthroughCredentials) {
    const newButton = page.getByRole('button', { name: 'New note' });
    if ((await newButton.count()) === 1) {
      const uniqueTitle = `Walkthrough note ${Date.now().toString().slice(-6)}`;
      await driver.captionKey(
        'createNote',
        'Now the walkthrough creates a real note document on testnet.',
      );
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
      await driver.captionKey(
        'saveCreate',
        'Saving submits sdk.documents.create and the note appears with Platform metadata.',
      );
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
      await driver.captionKey(
        'createdMetadata',
        'The editor now shows the created note, including a revision chip and created/updated timestamps.',
      );
      await driver.moveCursor(508, 188);
      await driver.delay(900);
      await driver.moveCursor(688, 739);
      await driver.delay(900);

      await driver.captionKey(
        'updateNote',
        'Next the walkthrough updates the body, which bumps the document revision.',
      );
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
      await driver.captionKey(
        'updatedMetadata',
        'After update, the revision metadata reflects the newer on-chain document state.',
      );
      await driver.moveCursor(506, 188);
      await driver.delay(1200);

      await driver.captionKey(
        'deleteNote',
        'Finally, the delete flow uses a confirmation modal before calling sdk.documents.delete.',
      );
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
      await driver.captionKey(
        'deletedNote',
        'The temporary walkthrough note is removed, leaving the app clean after the demo.',
      );
    }
  } else {
    await driver.captionKey(
      'readOnlyEditPrompt',
      'In read-only mode, Dashnote can display remembered notes, but edit actions prompt for sign-in.',
    );
  }

  const activityButton = page.getByRole('button', { name: /Activity/ });
  if ((await activityButton.count()) === 1) {
    await driver.captionKey(
      'activityDrawer',
      'The activity drawer captures SDK operations and status messages as the app works.',
    );
    await driver.clickLocator(activityButton);
    await page.getByRole('dialog', { name: 'Activity log' }).waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.delay(1200);
    await page.keyboard.press('Escape');
    await driver.delay(700);
  }

  await driver.captionKey(
    'howItWorks',
    'How it works maps the UI back to the note contract and SDK helper files.',
  );
  await driver.clickLocator(page.getByRole('button', { name: 'How it works' }));
  await driver.delay(1400);
  await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'smooth' }));
  await driver.delay(1200);

  await driver.captionKey(
    'settings',
    'Settings collects identity, contract, local cache, and appearance controls in one place.',
  );
  await driver.clickLocator(page.getByRole('button', { name: 'Settings' }));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await driver.delay(1400);
  await driver.captionKey(
    'settingsRememberedIdentity',
    'Remembered identity keeps the identity ID and cached note bodies on this device, so notes are viewable read-only after logout.',
  );
  await driver.moveToLocator(page.getByTestId('settings-identity-block'));
  await driver.delay(700);
  await driver.moveToLocator(
    page.getByText('Clear local cache for this device', { exact: true }),
  );
  await driver.captionKey(
    'settingsClearCache',
    'Clear local cache removes browser-stored note bodies only; Platform documents are not deleted and the cache rebuilds on refresh.',
  );
  if (
    (await page.getByText('Forget this device', { exact: true }).count()) === 1
  ) {
    await driver.moveToLocator(
      page.getByText('Forget this device', { exact: true }),
    );
    await driver.captionKey(
      'settingsForgetDevice',
      'Forget this device removes the remembered identity and clears its cached notes from this browser.',
    );
  }
  await driver.moveToLocator(
    page.locator('input[placeholder="Paste a note contract ID"]'),
  );
  await driver.captionKey(
    'settingsContractOptions',
    'Contract controls let you paste a different note contract ID, switch with Use this ID, or register a fresh testnet contract.',
  );
  await driver.moveToLocator(page.getByRole('button', { name: 'Use this ID' }));
  await driver.delay(600);
  await driver.moveToLocator(
    page.getByRole('button', { name: 'Register a fresh contract' }),
  );
  await driver.delay(1000);
  await driver.captionKey(
    'outro',
    'That is Dashnote: read-friendly, write-capable, and careful about identity state and local cache.',
    1800,
  );
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
  page.logStep('Waiting for first card (Frost Warden) to load');
  await page.getByText('Frost Warden', { exact: true }).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await addWalkthroughOverlay(page, '#34d399');

  const driver = makeDriver(page);
  await driver.delay(900);
  await driver.captionKey(
    'intro',
    'DashMint Lab opens directly into browse-only mode on Dash Platform testnet.',
  );
  if (page.walkthroughCredentials) {
    page.logStep('Signing in with walkthrough mnemonic');
    await driver.captionKey(
      'signInUnlocks',
      'Signing in unlocks account-specific actions alongside the public marketplace data.',
    );
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
    await driver.captionKey(
      'afterLogin',
      'After login, the Yours tab and account balance become available alongside browse-only data.',
    );
    await driver.delay(900);
    await driver.clickLocator(page.getByRole('button', { name: 'All' }));
    await driver.delay(900);
  }
  await driver.captionKey(
    'collectionLive',
    'The Collection tab is live without signing in: cards are queried from the shared contract.',
  );
  await driver.moveCursor(514, 247);
  await driver.delay(900);
  await driver.captionKey(
    'cardDetails',
    'Each card shows rarity, document id, stats, owner, and marketplace actions when a price exists.',
  );
  await driver.moveCursor(1060, 700);
  await driver.delay(900);
  await driver.captionKey(
    'marketplace',
    'Switch to Marketplace to focus on cards that are listed for purchase.',
  );
  page.logStep('Switching to Marketplace tab');
  await driver.clickLocator(page.getByRole('button', { name: 'Marketplace' }));
  await driver.delay(1200);
  await driver.captionKey(
    'sorting',
    'Sorting is available in browse mode too; here it cycles the card grid ordering.',
  );
  await driver.clickLocator(page.getByRole('button', { name: /Sort:/ }));
  await driver.delay(1100);
  await driver.captionKey(
    page.walkthroughCredentials ? 'mintUnlocked' : 'mintReadOnly',
    page.walkthroughCredentials
      ? 'The Mint tab is unlocked after login; the form shows token balance and available mint actions.'
      : 'The Mint tab exposes the full form, but write operations are gated until login.',
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
    await driver.captionKey(
      'noMintDefault',
      'The default walkthrough does not mint cards; it stops before any token burn or testnet mutation.',
    );
    await page
      .locator('input[placeholder="e.g. Fire Dragon"]')
      .fill('Demo Card');
    await page
      .locator(
        'textarea[placeholder="e.g. A legendary beast from the volcanic plains"]',
      )
      .fill('Filled locally for the walkthrough, but not minted.');
    await driver.moveCursor(748, 409);
    await driver.delay(1200);
  } else {
    await driver.captionKey(
      'loginPath',
      'Opening Login shows the account access path without requiring a sign-in.',
    );
    const loginButtons = await page
      .getByRole('button', { name: 'Login' })
      .all();
    const loginBox = await loginButtons[loginButtons.length - 1].boundingBox();
    await driver.clickCursor(
      loginBox.x + loginBox.width / 2,
      loginBox.y + loginBox.height / 2,
    );
    await page.locator('input[type="password"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await driver.delay(1000);
    await driver.captionKey(
      'fundedIdentity',
      'A real funded testnet identity unlocks mint, transfer, pricing, purchase, and burn.',
    );
    await page.keyboard.press('Escape');
    await driver.delay(700);
  }
  await driver.captionKey(
    'howItWorks',
    'The How it works tab explains the SDK pieces behind the marketplace.',
  );
  page.logStep('Switching to How it works tab');
  await driver.clickLocator(page.getByRole('button', { name: 'How it works' }));
  await driver.delay(1400);
  await driver.captionKey(
    'outro',
    'DashMint Lab is useful as a live browse-only marketplace and as a map of every NFT operation.',
  );
  await page.evaluate(() => window.scrollTo({ top: 360, behavior: 'smooth' }));
  await driver.delay(1900);
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
  const outDir = path.join(appDir, 'walkthrough');
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    recordVideo: { dir: tmpVideoDir, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  page.walkthroughUrl = args.url;
  page.walkthroughCredentials = credentials;
  page.walkthroughCaptions = captions;
  page.logStep = logStep;

  logStep(`Recording ${config.title} at ${args.url}`);
  try {
    await config.run(page);
    logStep('Capturing preview screenshot');
    await page.screenshot({ path: targetPreview, fullPage: false });
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (video) {
      const source = await video.path();
      await fs.copyFile(source, targetWebm);
    }
  }

  console.log(`Recorded ${config.title}`);
  console.log(`Video: ${targetWebm}`);
  console.log(`Preview: ${targetPreview}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
