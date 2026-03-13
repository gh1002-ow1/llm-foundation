const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const cliPath = path.resolve(__dirname, '../../../bin/llm-foundation.js');

function runCli(args, options = {}) {
  return spawnSync('node', [cliPath, ...args], {
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '../../..'),
    ...options
  });
}

function writeConfig(dir) {
  fs.writeFileSync(path.join(dir, 'providers.json'), JSON.stringify({
    tracks: {
      free: [{ name: 'free-1', model: 'm-free-1', gateway: 'portkey', apiKeyEnv: 'FREE_API_KEY' }],
      paid: [{ name: 'paid-1', model: 'm-paid-1', gateway: 'portkey', apiKeyEnv: 'PAID_API_KEY' }]
    }
  }));
  fs.writeFileSync(path.join(dir, 'policies.json'), JSON.stringify({
    defaults: {
      track: 'free',
      fallbackTrackByTrack: { free: 'paid' }
    },
    capabilities: {
      'localization.translate': { track: 'free' }
    }
  }));
  fs.writeFileSync(path.join(dir, 'capabilities.json'), JSON.stringify({
    'localization.translate': { description: 'translate' }
  }));
}

test('cli validate prints validation summary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-foundation-cli-'));
  writeConfig(dir);

  const output = execFileSync('node', [
    cliPath,
    'validate',
    '--config-dir',
    dir
  ], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../..') });

  const parsed = JSON.parse(output);
  assert.equal(parsed.validation.errors.length, 0);
  assert.equal(parsed.tracks.free, 1);
  assert.equal(Array.isArray(parsed.providerReadiness), true);
  assert.equal(parsed.providerReadiness.length, 2);
});

test('cli simulate prints dry-run result', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-foundation-cli-'));
  writeConfig(dir);

  const output = execFileSync('node', [
    cliPath,
    'simulate',
    '--config-dir',
    dir,
    '--capability',
    'localization.translate'
  ], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../..') });

  const parsed = JSON.parse(output);
  assert.equal(parsed.result.ok, true);
  assert.equal(parsed.result.output.mode, 'dry-run');
  assert.equal(parsed.result.route.provider, 'free-1');
});

test('cli init writes selected providers and env templates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-foundation-init-'));
  const target = path.join(dir, 'config');

  const output = execFileSync('node', [
    cliPath,
    'init',
    '--dir',
    target,
    '--preset',
    'auto-media-balanced',
    '--yes',
    '--free-providers',
    'openrouter-free-router',
    '--paid-providers',
    'aliyuncs-qwen35-plus'
  ], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../..') });

  const parsed = JSON.parse(output);
  const providers = JSON.parse(fs.readFileSync(path.join(target, 'providers.json'), 'utf8'));
  const envExample = fs.readFileSync(path.join(target, '.env.example'), 'utf8');
  const envLocal = fs.readFileSync(path.join(target, '.env.local'), 'utf8');

  assert.equal(parsed.presetName, 'auto-media-balanced');
  assert.deepEqual(parsed.selections.free, ['openrouter-free-router']);
  assert.deepEqual(parsed.selections.paid, ['aliyuncs-qwen35-plus']);
  assert.equal(providers.tracks.free.length, 1);
  assert.equal(providers.tracks.free[0].name, 'openrouter-free-router');
  assert.equal(providers.tracks.paid.length, 1);
  assert.equal(providers.tracks.paid[0].name, 'aliyuncs-qwen35-plus');
  assert.equal(envExample.includes('OPENROUTER_API_KEY='), true);
  assert.equal(envExample.includes('ALIYUNCS_API_KEY='), true);
  assert.equal(envLocal.includes('OPENROUTER_API_KEY='), true);
  assert.equal(envLocal.includes('ALIYUNCS_API_KEY='), true);
});

test('cli init writes assigned env values in non-interactive mode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-foundation-init-env-'));
  const target = path.join(dir, 'config');

  const output = execFileSync('node', [
    cliPath,
    'init',
    '--dir',
    target,
    '--preset',
    'auto-media-balanced',
    '--yes',
    '--free-providers',
    'openrouter-free-router',
    '--paid-providers',
    'aliyuncs-qwen35-plus',
    '--set-env',
    'OPENROUTER_API_KEY=test-openrouter',
    '--set-env',
    'ALIYUNCS_API_KEY=test-aliyun'
  ], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../..') });

  const parsed = JSON.parse(output);
  const envLocal = fs.readFileSync(path.join(target, '.env.local'), 'utf8');

  assert.equal(parsed.envWrite.wroteEnvLocal, true);
  assert.deepEqual(parsed.envWrite.envsWithValues.sort(), ['ALIYUNCS_API_KEY', 'OPENROUTER_API_KEY']);
  assert.equal(envLocal.includes('OPENROUTER_API_KEY=test-openrouter'), true);
  assert.equal(envLocal.includes('ALIYUNCS_API_KEY=test-aliyun'), true);
});

test('cli doctor succeeds with env coverage when probes are skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-foundation-doctor-'));
  writeConfig(dir);
  fs.writeFileSync(path.join(dir, '.env.local'), 'FREE_API_KEY=free-secret\nPAID_API_KEY=paid-secret\n');

  const result = runCli([
    'doctor',
    '--config-dir',
    dir,
    '--skip-probe'
  ]);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.envStatus.length, 2);
  assert.equal(parsed.envStatus.every((item) => item.ok), true);
  assert.equal(Array.isArray(parsed.routePlans), true);
  assert.equal(parsed.routePlans[0].capability, 'localization.translate');
  assert.deepEqual(parsed.probes, []);
});

test('cli doctor fails when provider env vars are missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-foundation-doctor-missing-env-'));
  writeConfig(dir);

  const result = runCli([
    'doctor',
    '--config-dir',
    dir,
    '--skip-probe'
  ]);

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.envStatus.some((item) => item.ok === false), true);
  assert.equal(parsed.providerReadiness.some((item) => item.hasApiKey === false), true);
});
