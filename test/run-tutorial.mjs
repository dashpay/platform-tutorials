import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

/**
 * Run a tutorial script as a subprocess and capture its output.
 *
 * @param {string} scriptPath - Path relative to repo root (e.g. 'connect.mjs')
 * @param {object} [options]
 * @param {object} [options.env] - Extra environment variables to merge
 * @param {number} [options.timeoutMs=120000] - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, killed: boolean}>}
 */
export function runTutorial(scriptPath, options = {}) {
  const { env = {}, timeoutMs = 120_000 } = options;
  const absolutePath = resolve(REPO_ROOT, scriptPath);

  return new Promise((resolveP) => {
    execFile(
      'node',
      [absolutePath],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...env },
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolveP({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: error?.code ?? (error ? 1 : 0),
          killed: error?.killed ?? false,
        });
      },
    );
  });
}
