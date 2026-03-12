import assert from 'node:assert/strict';

/**
 * Assert that a tutorial run succeeded:
 * - Process was not killed (timeout)
 * - Exit code is 0
 * - No error patterns found in stdout or stderr
 * - All expected patterns found in stdout
 */
export function assertTutorialSuccess(result, entry) {
  assert.equal(
    result.killed,
    false,
    `Tutorial "${entry.name}" was killed (timeout)`,
  );

  assert.equal(
    result.exitCode,
    0,
    `Tutorial "${entry.name}" exited with code ${result.exitCode}.\n` +
      `STDERR: ${result.stderr}\nSTDOUT: ${result.stdout}`,
  );

  if (entry.errorPatterns) {
    for (const pat of entry.errorPatterns) {
      const re = new RegExp(pat);
      assert.equal(
        re.test(result.stderr) || re.test(result.stdout),
        false,
        `Tutorial "${entry.name}" output matched error pattern: ${pat}\n` +
          `STDERR: ${result.stderr}\nSTDOUT: ${result.stdout}`,
      );
    }
  }

  if (entry.expectedPatterns) {
    for (const pat of entry.expectedPatterns) {
      assert.match(
        result.stdout,
        new RegExp(pat),
        `Tutorial "${entry.name}" stdout missing expected pattern: ${pat}\n` +
          `STDOUT: ${result.stdout}`,
      );
    }
  }
}

/**
 * Extract a captured value from tutorial stdout using a regex with a capture group.
 * Returns the first capture group match, or null if no match.
 */
export function extractFromOutput(stdout, regex) {
  const match = stdout.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract an `id` field from util.inspect or JSON output.
 * Handles both `id: 'VALUE'` (inspect) and `"id": "VALUE"` (JSON).
 */
export function extractId(stdout) {
  return (
    extractFromOutput(stdout, /"id"\s*:\s*"([^"]+)"/) ??
    extractFromOutput(stdout, /id:\s*'([^']+)'/)
  );
}
