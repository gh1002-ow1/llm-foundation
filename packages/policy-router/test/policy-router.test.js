const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createPolicyRouter,
  createPolicyRouterFromConfig,
  loadRouterConfig,
  validateRouterConfig
} = require('../src');

function buildRouter(invoke) {
  return createPolicyRouter({
    defaults: {
      track: 'free',
      fallbackTrackByTrack: {
        free: 'paid'
      }
    },
    capabilities: {
      'generation.longform': { track: 'paid' },
      'localization.translate': { track: 'free', fallbackTrack: 'paid' }
    },
    tracks: {
      free: [
        { name: 'free-1', model: 'm-free-1' },
        { name: 'free-2', model: 'm-free-2' }
      ],
      paid: [
        { name: 'paid-1', model: 'm-paid-1' }
      ]
    },
    invoke
  });
}

test('resolve uses capability policy and fallback track', () => {
  const router = buildRouter(async () => ({}));
  const route = router.resolve('localization.translate');

  assert.equal(route.track, 'free');
  assert.equal(route.fallbackTrack, 'paid');
  assert.equal(route.candidates.length, 2);
});

test('execute falls back within the same track', async () => {
  const seen = [];
  const router = buildRouter(async ({ candidate }) => {
    seen.push(candidate.name);
    if (candidate.name === 'free-1') {
      throw new Error('free-1 failed');
    }
    return { provider: candidate.name };
  });

  const result = await router.execute('localization.translate', {
    messages: [{ role: 'user', content: 'hello' }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.route.provider, 'free-2');
  assert.equal(result.fallbackCount, 1);
  assert.deepEqual(seen, ['free-1', 'free-2']);
});

test('execute escalates to fallback track after primary track fails', async () => {
  const seen = [];
  const router = buildRouter(async ({ candidate }) => {
    seen.push(candidate.name);
    if (candidate.name.startsWith('free-')) {
      throw new Error(`${candidate.name} failed`);
    }
    return { provider: candidate.name };
  });

  const result = await router.execute('localization.translate', {
    messages: [{ role: 'user', content: 'hello' }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.route.track, 'paid');
  assert.equal(result.route.provider, 'paid-1');
  assert.equal(result.route.degradedFrom, 'free');
  assert.equal(result.fallbackCount, 2);
  assert.deepEqual(seen, ['free-1', 'free-2', 'paid-1']);
});

test('resolve supports forceTrack and forceProvider', () => {
  const router = buildRouter(async () => ({}));
  const route = router.resolve('localization.translate', {
    forceTrack: 'paid',
    forceProvider: 'paid-1'
  });

  assert.equal(route.track, 'paid');
  assert.equal(route.candidates.length, 1);
  assert.equal(route.candidates[0].name, 'paid-1');
});

test('loadRouterConfig reads config directory shape', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-router-config-'));
  fs.writeFileSync(path.join(dir, 'providers.json'), JSON.stringify({
    tracks: {
      free: [{ name: 'free-1', model: 'm-free-1' }]
    }
  }));
  fs.writeFileSync(path.join(dir, 'policies.json'), JSON.stringify({
    defaults: { track: 'free' },
    capabilities: {
      'localization.translate': { track: 'free' }
    }
  }));
  fs.writeFileSync(path.join(dir, 'capabilities.json'), JSON.stringify({
    'localization.translate': { description: 'translate' }
  }));

  const loaded = loadRouterConfig({ configDir: dir });
  const validation = validateRouterConfig(loaded);

  assert.equal(loaded.defaults.track, 'free');
  assert.equal(loaded.tracks.free.length, 1);
  assert.equal(loaded.capabilities['localization.translate'].track, 'free');
  assert.equal(loaded.capabilityMetadata['localization.translate'].description, 'translate');
  assert.equal(validation.errors.length, 0);
});

test('createPolicyRouterFromConfig builds router from files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-router-create-'));
  fs.writeFileSync(path.join(dir, 'providers.json'), JSON.stringify({
    tracks: {
      free: [{ name: 'free-1', model: 'm-free-1' }],
      paid: [{ name: 'paid-1', model: 'm-paid-1' }]
    }
  }));
  fs.writeFileSync(path.join(dir, 'policies.json'), JSON.stringify({
    defaults: {
      track: 'free',
      fallbackTrackByTrack: {
        free: 'paid'
      }
    },
    capabilities: {
      'localization.translate': { track: 'free' }
    }
  }));

  const seen = [];
  const router = createPolicyRouterFromConfig({
    configDir: dir,
    invoke: async ({ candidate }) => {
      seen.push(candidate.name);
      return { provider: candidate.name };
    }
  });

  const result = await router.execute('localization.translate', { messages: [] });

  assert.equal(result.ok, true);
  assert.equal(result.route.provider, 'free-1');
  assert.deepEqual(seen, ['free-1']);
});

test('validateRouterConfig rejects unknown defaults.track', () => {
  const validation = validateRouterConfig({
    defaults: {
      track: 'missing'
    },
    capabilities: {},
    tracks: {
      free: []
    }
  });

  assert.equal(validation.errors.includes('defaults.track refers to unknown track missing'), true);
});

test('bundled auto-media balanced preset validates and routes', () => {
  const presetDir = path.resolve(__dirname, '../../../configs/presets/auto-media-balanced');
  const loaded = loadRouterConfig({ configDir: presetDir });
  const validation = validateRouterConfig(loaded);
  const router = createPolicyRouter({
    defaults: loaded.defaults,
    capabilities: loaded.capabilities,
    tracks: loaded.tracks,
    invoke: async ({ candidate }) => ({ provider: candidate.name })
  });
  const route = router.resolve('localization.translate');

  assert.equal(validation.errors.length, 0);
  assert.equal(route.track, 'free');
  assert.equal(route.fallbackTrack, 'paid');
  assert.ok(route.candidates.length >= 1);
});
