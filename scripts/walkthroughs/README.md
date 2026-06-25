# Walkthrough Recorder

Reusable Playwright scripts for generating narrated-by-caption walkthrough
videos of the example apps.

Start the target app first, then run one of:

```sh
npm run walkthrough:dashmint-lab
npm run walkthrough:dashnote
npm run walkthrough:dashnote-starter
npm run walkthrough:dashrate
```

The recorder assumes the app is available at `http://127.0.0.1:5173/`. Override
that when needed:

```sh
npm run walkthrough:dashmint-lab -- --url http://127.0.0.1:5174/
```

## Authenticated Walkthroughs

If `.env.walkthrough` exists at the repo root, it is loaded automatically. Put a
testnet mnemonic there to let walkthroughs sign in:

```sh
PLATFORM_TUTORIALS_IDENTITY_MNEMONIC="word1 word2 ..."
PLATFORM_TUTORIALS_IDENTITY_INDEX=0
```

The recorder also accepts `WALKTHROUGH_MNEMONIC`, `PLATFORM_MNEMONIC`, or
`MNEMONIC`.

The default authenticated walkthroughs show the signed-in UI, but intentionally
stop before writes such as creating notes, minting cards, purchasing, burning,
or registering contracts. To force a browse-only/no-login recording:

```sh
npm run walkthrough:dashmint-lab -- --no-login
```

Outputs are written beside each app:

```text
example-apps/<app>/walkthrough/<app>-walkthrough.webm
example-apps/<app>/walkthrough/<app>-preview.png
```

## Caption Copy

Overlay text lives in plain JSON files so copy can be edited without touching
the recorder code:

```text
scripts/walkthroughs/captions/dashnote.json
scripts/walkthroughs/captions/dashnote-starter.json
scripts/walkthroughs/captions/dashmint-lab.json
scripts/walkthroughs/captions/dashrate.json
```

Each entry is a stable step name with the text shown in the video:

```json
{
  "rememberedReload": "After logout, Dashnote reloads with remembered read-only access and cached notes."
}
```

Only edit the string values. The recorder keeps timing, clicks, waits, and
testnet write behavior in code. The JSON file is the sole source of caption copy
— the recorder errors out if the file is missing or a referenced key is absent
or blank.

## Browser Setup

The script looks for Playwright in the app's dependencies and the repo root. If
Playwright lives somewhere else, set `PLAYWRIGHT_REQUIRE_PATH` to that
`node_modules/playwright` location.

If the normal Playwright browser cache is not available, point at a Chromium
executable directly:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE="/path/to/chromium" \
  npm run walkthrough:dashmint-lab
```

In PowerShell, set environment variables before running npm:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = "C:\path\to\chromium.exe"
npm run walkthrough:dashmint-lab
```

For local debugging, add `--headed` after the npm argument separator:

```sh
npm run walkthrough:dashmint-lab -- --headed
```
