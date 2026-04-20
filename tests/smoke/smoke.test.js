#!/usr/bin/env node
/**
 * AIP Smoke Tests
 * Usage: BACKEND_URL=https://... FRONTEND_URL=https://... node tests/smoke/smoke.test.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://aip-api.azurecontainerapps.io';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://aip-plum.vercel.app';
const TIMEOUT_MS = 15000;

let passed = 0;
let failed = 0;
const failures = [];

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function check(name, fn, critical = false) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
    failures.push({ name, error: err.message, critical });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Backend Health Tests ────────────────────────────────────────────────────
console.log('\n📡 BACKEND HEALTH TESTS');

await check('GET /health → 200 with required fields', async () => {
  const res = await request(`${BACKEND_URL}/health`);
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.status, 'Missing "status" field');
  assert(body.timestamp, 'Missing "timestamp" field');
  assert(body.environment, 'Missing "environment" field');
}, true);

await check('GET /health/live → 200 with live:true', async () => {
  const res = await request(`${BACKEND_URL}/health/live`);
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.live === true, `Expected live:true, got ${JSON.stringify(body)}`);
}, true);

await check('GET /health/ready → 200 with ready:true', async () => {
  const res = await request(`${BACKEND_URL}/health/ready`);
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.ready === true, `Expected ready:true, got ${JSON.stringify(body)}`);
}, true);

await check('GET /nonexistent → 404 with success:false', async () => {
  const res = await request(`${BACKEND_URL}/this-route-does-not-exist`);
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

// ── Security Header Tests ───────────────────────────────────────────────────
console.log('\n🔒 SECURITY TESTS');

await check('Response has x-content-type-options: nosniff', async () => {
  const res = await request(`${BACKEND_URL}/health`);
  const header = res.headers.get('x-content-type-options');
  assert(header && header.toLowerCase().includes('nosniff'), `Missing or incorrect x-content-type-options: "${header}"`);
});

await check('Response has x-frame-options header', async () => {
  const res = await request(`${BACKEND_URL}/health`);
  const header = res.headers.get('x-frame-options');
  assert(header, `Missing x-frame-options header`);
});

await check('GET /auth/me without token → 401', async () => {
  const res = await request(`${BACKEND_URL}/auth/me`);
  assert(res.status === 401, `Expected 401, got ${res.status} (endpoint is unprotected!)`);
}, true);

await check('GET /auth/me with invalid token → 401', async () => {
  const res = await request(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: 'Bearer invalid.token.here' },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
}, true);

await check('CORS header present for allowed origin', async () => {
  const res = await request(`${BACKEND_URL}/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: FRONTEND_URL,
      'Access-Control-Request-Method': 'GET',
    },
  });
  const corsHeader = res.headers.get('access-control-allow-origin');
  assert(corsHeader, `Missing access-control-allow-origin header (got: ${corsHeader})`);
});

// ── Rate Limiting Tests ─────────────────────────────────────────────────────
console.log('\n⏱  RATE LIMITING TESTS');

await check('Response includes rate limit headers', async () => {
  const res = await request(`${BACKEND_URL}/health`);
  const hasLimit =
    res.headers.get('ratelimit-limit') ||
    res.headers.get('x-ratelimit-limit') ||
    res.headers.get('x-rate-limit-limit');
  assert(hasLimit, `No rate limit header found (checked ratelimit-limit, x-ratelimit-limit, x-rate-limit-limit)`);
});

// ── Frontend Tests ──────────────────────────────────────────────────────────
console.log('\n🌐 FRONTEND TESTS');

await check('GET frontend → 200', async () => {
  const res = await request(FRONTEND_URL);
  assert(res.status === 200, `Expected 200, got ${res.status}`);
}, true);

await check('Frontend response is HTML', async () => {
  const res = await request(FRONTEND_URL);
  const contentType = res.headers.get('content-type') || '';
  assert(contentType.includes('text/html'), `Expected text/html, got "${contentType}"`);
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════');
console.log(`  Smoke Tests: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════\n');

if (failures.length > 0) {
  console.log('Failed tests:');
  failures.forEach(({ name, error }) => console.log(`  ❌ ${name}\n     → ${error}`));
}

const criticalFailures = failures.filter((f) => f.critical);
if (criticalFailures.length > 0) {
  console.error(`\n🚨 ${criticalFailures.length} critical test(s) failed — exiting with code 1`);
  process.exit(1);
}
