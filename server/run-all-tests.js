/**
 * Run all test suites sequentially for combined coverage reporting.
 * Cross-platform alternative to `sh -c "node test.unit.js && ..."`.
 *
 * Usage:
 *   node run-all-tests.js
 *   npx c8 --include="src/**" node run-all-tests.js
 */

import { execSync } from 'node:child_process';

try {
  execSync('node test.unit.js', { stdio: 'inherit' });
  execSync('node test.integration.js', { stdio: 'inherit' });
  execSync('node test.js', { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
