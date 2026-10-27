#!/usr/bin/env node

/**
 * Creative Assignment & Approval Workflow — Standalone E2E Test Runner
 *
 * Requirements: Node.js >= 20
 * Dependencies: Zero external testing dependencies (uses native fetch, node:assert, node:http)
 *
 * Usage:
 *   node scripts/test-creative-workflow-e2e.js
 *   node scripts/test-creative-workflow-e2e.js --tier 1
 *   node scripts/test-creative-workflow-e2e.js --tier 2
 *   node scripts/test-creative-workflow-e2e.js --tier 3
 *   node scripts/test-creative-workflow-e2e.js --tier 4
 *   node scripts/test-creative-workflow-e2e.js --scenario A1
 *   node scripts/test-creative-workflow-e2e.js --help
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

function findBackendRoot() {
  const candidates = [
    path.resolve(__dirname, '../mint-more-backend'),
    path.resolve(__dirname, '../../mint-more-backend'),
    path.resolve(__dirname, 'mint-more-backend'),
    path.resolve(__dirname, '..'),
    process.cwd(),
    path.resolve(process.cwd(), 'mint-more-backend'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'src/app.js'))) {
      return c;
    }
  }
  return process.cwd();
}

const backendRoot = findBackendRoot();

// Add backend's node_modules to module resolution paths
const backendNodeModules = path.join(backendRoot, 'node_modules');
if (fs.existsSync(backendNodeModules) && !module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

// Zero-dependency pure JS .env parser
function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(path.join(backendRoot, '.env'));

const { HttpClient } = require('./e2e/http-client');
const { FixtureManager, pool } = require('./e2e/fixtures');
const { runTier1 } = require('./e2e/tier1-feature-coverage');
const { runTier2 } = require('./e2e/tier2-boundary-cases');
const { runTier3 } = require('./e2e/tier3-combinations');
const {
  runTier4,
  runScenarioA1,
  runScenarioA2,
  runScenarioA3,
  runScenarioA4,
  runScenarioA5,
} = require('./e2e/tier4-scenarios');

// Parse CLI Arguments
const args = process.argv.slice(2);
const options = {
  tier: null,
  scenario: null,
  all: false,
  help: false,
  verbose: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else if (arg === '--all') {
    options.all = true;
  } else if (arg === '--verbose' || arg === '-v') {
    options.verbose = true;
  } else if (arg === '--tier' || arg === '-t') {
    options.tier = args[++i];
  } else if (arg.startsWith('--tier=')) {
    options.tier = arg.split('=')[1];
  } else if (arg === '--scenario' || arg === '-s') {
    options.scenario = args[++i]?.toUpperCase();
  } else if (arg.startsWith('--scenario=')) {
    options.scenario = arg.split('=')[1]?.toUpperCase();
  }
}

if (!options.tier && !options.scenario) {
  options.all = true;
}

function printHelp() {
  console.log(`
================================================================================
  MINT-MORE CREATIVE ASSIGNMENT & APPROVAL WORKFLOW — E2E TEST RUNNER
================================================================================

Description:
  Independent, opaque-box E2E test suite verifying the Admin-Designer-Client
  creative workflow against live or ephemeral Express server.

Usage:
  node scripts/test-creative-workflow-e2e.js [options]

Options:
  --all                 Run all 4 test tiers (Default)
  --tier <1|2|3|4>      Run tests for a specific tier:
                          1: Feature Coverage (45 tests across F1-F9)
                          2: Boundary & Corner Cases (45 tests)
                          3: Cross-Feature Combinations (10 tests)
                          4: Real-World Scenarios (A1-A5)
  --scenario <A1..A5>   Run a specific real-world acceptance scenario:
                          A1: Notifications Verification
                          A2: Review Queue Verification
                          A3: Rejection Feedback Loops
                          A4: Intelligent Routing Engine
                          A5: Admin Direct Upload
  --verbose, -v         Enable detailed debug logging
  --help, -h            Show this help message

Environment Variables:
  API_BASE_URL          Base URL of running server (e.g. http://127.0.0.1:5000/api/v1).
                        If omitted, tests spawn an ephemeral in-process Express server.

Examples:
  node scripts/test-creative-workflow-e2e.js
  node scripts/test-creative-workflow-e2e.js --tier 1
  node scripts/test-creative-workflow-e2e.js --scenario A4
  API_BASE_URL=http://localhost:5000/api/v1 node scripts/test-creative-workflow-e2e.js
================================================================================
`);
}

async function main() {
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const startTime = Date.now();
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
    errors: [],
  };

  const recordTest = async (name, fn) => {
    const testStart = Date.now();
    try {
      await fn();
      const duration = Date.now() - testStart;
      results.passed++;
      results.tests.push({ name, passed: true, duration });
      console.log(`  \x1b[32m✔ PASS\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
    } catch (err) {
      const duration = Date.now() - testStart;
      results.failed++;
      results.tests.push({ name, passed: false, duration, error: err.message });
      results.errors.push({ name, error: err.message, stack: err.stack });
      console.log(`  \x1b[31m✖ FAIL\x1b[0m ${name} \x1b[90m(${duration}ms)\x1b[0m`);
      console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
      if (options.verbose && err.stack) {
        console.log(`\x1b[90m${err.stack}\x1b[0m`);
      }
    }
  };

  let server = null;
  let baseUrl = process.env.API_BASE_URL || process.env.TEST_BASE_URL || null;
  let fixtures = null;

  try {
    console.log(`\n================================================================================`);
    console.log(`  MINT-MORE CREATIVE ASSIGNMENT & APPROVAL WORKFLOW — E2E TEST SUITE`);
    console.log(`================================================================================`);
    console.log(`Node Runtime : ${process.version}`);
    console.log(`Backend Path : ${backendRoot}`);

    // 1. Setup Server Binding
    if (baseUrl) {
      console.log(`Server Mode  : Remote / Pre-Running (${baseUrl})`);
    } else {
      const app = require(path.join(backendRoot, 'src/app.js'));
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      console.log(`Server Mode  : Ephemeral In-Process Server on port ${port} (${baseUrl})`);
    }

    const httpClient = new HttpClient(baseUrl);

    // 2. Setup Test Fixtures
    console.log(`\n📦 Seeding dynamic test fixtures (Admin, Designers, Clients)...`);
    fixtures = new FixtureManager();
    await fixtures.setup();
    console.log(`✅ Fixtures ready. Run ID: ${fixtures.runId}`);

    // 3. Execute Selected Tiers / Scenarios
    if (options.scenario) {
      switch (options.scenario) {
        case 'A1':
          await runScenarioA1(httpClient, fixtures, recordTest);
          break;
        case 'A2':
          await runScenarioA2(httpClient, fixtures, recordTest);
          break;
        case 'A3':
          await runScenarioA3(httpClient, fixtures, recordTest);
          break;
        case 'A4':
          await runScenarioA4(httpClient, fixtures, recordTest);
          break;
        case 'A5':
          await runScenarioA5(httpClient, fixtures, recordTest);
          break;
        default:
          throw new Error(`Unknown scenario "${options.scenario}". Valid scenarios are: A1, A2, A3, A4, A5`);
      }
    } else if (options.tier) {
      switch (String(options.tier)) {
        case '1':
          await runTier1(httpClient, fixtures, recordTest);
          break;
        case '2':
          await runTier2(httpClient, fixtures, recordTest);
          break;
        case '3':
          await runTier3(httpClient, fixtures, recordTest);
          break;
        case '4':
          await runTier4(httpClient, fixtures, recordTest);
          break;
        default:
          throw new Error(`Unknown tier "${options.tier}". Valid tiers are: 1, 2, 3, 4`);
      }
    } else {
      // Run All Tiers (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4)
      await runTier1(httpClient, fixtures, recordTest);
      await runTier2(httpClient, fixtures, recordTest);
      await runTier3(httpClient, fixtures, recordTest);
      await runTier4(httpClient, fixtures, recordTest);
    }
  } catch (fatalErr) {
    results.failed++;
    results.errors.push({ name: 'Fatal Test Harness Execution', error: fatalErr.message, stack: fatalErr.stack });
    console.error(`\n\x1b[31m💥 FATAL ERROR:\x1b[0m ${fatalErr.message}`);
    if (fatalErr.stack) console.error(fatalErr.stack);
  } finally {
    // 4. Guaranteed Teardown
    console.log(`\n🧹 Cleaning up test fixtures & closing connections...`);
    if (fixtures) {
      await fixtures.teardown();
      console.log(`✅ Test fixtures sanitized.`);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log(`✅ Ephemeral HTTP server closed.`);
    }

    try {
      await pool.end();
      console.log(`✅ Database pool closed.`);
    } catch (_) {}

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTests = results.passed + results.failed;

    console.log(`\n================================================================================`);
    console.log(`                          E2E TEST RUN SUMMARY`);
    console.log(`================================================================================`);
    console.log(`Total Tests Executed : ${totalTests}`);
    console.log(`Tests Passed         : \x1b[32m${results.passed}\x1b[0m`);
    console.log(`Tests Failed         : \x1b[${results.failed > 0 ? '31' : '32'}m${results.failed}\x1b[0m`);
    console.log(`Total Duration       : ${totalDuration}s`);
    console.log(`Result Status        : ${results.failed === 0 ? '\x1b[32m✔ ALL TESTS PASSED\x1b[0m' : '\x1b[31m✖ TEST FAILURES DETECTED\x1b[0m'}`);
    console.log(`================================================================================\n`);

    if (results.failed > 0) {
      console.log(`\x1b[31mFailed Test Details:\x1b[0m`);
      results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. \x1b[1m${err.name}\x1b[0m`);
        console.log(`     Error: ${err.error}\n`);
      });
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  }
}

main();
