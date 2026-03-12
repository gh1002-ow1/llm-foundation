const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function writeConfig(dir) {
  fs.writeFileSync(path.join(dir, 'providers.json'), JSON.stringify({
    tracks: {
      free: [{ name: 'free-1', model: 'm-free-1', gateway: 'portkey' }],
      paid: [{ name: 'paid-1', model: 'm-paid-1', gateway: 'portkey' }]
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
    path.resolve(__dirname, '../../../bin/llm-foundation.js'),
    'validate',
    '--config-dir',
    dir
  ], { encoding: 'utf8' });

  const parsed = JSON.parse(output);
  assert.equal(parsed.validation.errors.length, 0);
  assert.equal(parsed.tracks.free, 1);
});

test('cli simulate prints dry-run result', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-foundation-cli-'));
  writeConfig(dir);

  const output = execFileSync('node', [
    path.resolve(__dirname, '../../../bin/llm-foundation.js'),
    'simulate',
    '--config-dir',
    dir,
    '--capability',
    'localization.translate'
  ], { encoding: 'utf8' });

  const parsed = JSON.parse(output);
  assert.equal(parsed.result.ok, true);
  assert.equal(parsed.result.output.mode, 'dry-run');
  assert.equal(parsed.result.route.provider, 'free-1');
});
