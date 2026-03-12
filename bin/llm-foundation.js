#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const {
  createPolicyRouterFromConfig,
  loadRouterConfig,
  validateRouterConfig
} = require('../packages/policy-router/src');
const { importAutoMedia } = require('../scripts/lib/import-auto-media-lib');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    if (key in args) {
      args[key] = Array.isArray(args[key]) ? [...args[key], next] : [args[key], next];
    } else {
      args[key] = next;
    }
    i += 1;
  }
  return args;
}

function rootDir() {
  return path.resolve(__dirname, '..');
}

function presetsDir() {
  return path.join(rootDir(), 'configs', 'presets');
}

function listPresets() {
  if (!fs.existsSync(presetsDir())) return [];
  return fs.readdirSync(presetsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function collectApiKeyEnvs(config = {}) {
  const envs = new Set();
  for (const providers of Object.values(config.tracks || {})) {
    for (const provider of providers || []) {
      if (provider.apiKeyEnv) envs.add(provider.apiKeyEnv);
    }
  }
  return Array.from(envs).sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!key) continue;
    values[key] = value;
  }
  return values;
}

function printHelp() {
  console.log(`llm-foundation

Commands:
  init             Create a config directory from a preset and select providers
  validate         Validate a config directory
  simulate         Resolve and dry-run a capability route
  doctor           Check config, env coverage, and gateway reachability
  import-auto-media Import auto-media config into a local directory
  smoke-live       Run the local live smoke test

Examples:
  llm-foundation init
  llm-foundation init --dir ./llm-config --preset auto-media-balanced --yes
  llm-foundation init --dir ./llm-config --preset auto-media-balanced --free-providers openrouter-free-router,groq-llama3-70b-8192
  llm-foundation validate --config-dir ./llm-config
  llm-foundation simulate --config-dir ./llm-config --capability localization.translate
  llm-foundation doctor --config-dir ./llm-config
`);
}

async function prompt(question, fallback = '') {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const suffix = fallback ? ` [${fallback}]` : '';
    const answer = await rl.question(`${question}${suffix}: `);
    return String(answer || fallback).trim();
  } finally {
    rl.close();
  }
}

async function promptChoice(question, choices, fallback) {
  const lines = choices.map((choice, index) => `${index + 1}. ${choice}`).join('\n');
  console.log(lines);
  const raw = await prompt(question, fallback ? String(choices.indexOf(fallback) + 1) : '1');
  const index = Number(raw) - 1;
  if (Number.isInteger(index) && choices[index]) return choices[index];
  return fallback || choices[0];
}

async function promptYesNo(question, fallback = true) {
  const defaultLabel = fallback ? 'Y/n' : 'y/N';
  const raw = (await prompt(`${question} (${defaultLabel})`, '')).toLowerCase();
  if (!raw) return fallback;
  return ['y', 'yes'].includes(raw);
}

async function promptMultiChoice(question, choices, fallbackValues = []) {
  const lines = choices.map((choice, index) => `${index + 1}. ${choice}`).join('\n');
  console.log(lines);
  const fallback = fallbackValues.length > 0
    ? fallbackValues.map((value) => String(choices.indexOf(value) + 1)).join(',')
    : '1';
  const raw = await prompt(question, fallback);
  const selected = String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const index = Number(item) - 1;
      if (Number.isInteger(index) && choices[index]) return choices[index];
      return choices.includes(item) ? item : null;
    })
    .filter(Boolean);

  return selected.length > 0 ? Array.from(new Set(selected)) : fallbackValues;
}

function buildEnvFiles(config = {}) {
  const envs = collectApiKeyEnvs(config);
  const envExample = envs.map((name) => `${name}=`).join('\n') + (envs.length > 0 ? '\n' : '');
  const envLocal = envs.map((name) => `${name}=${process.env[name] || ''}`).join('\n') + (envs.length > 0 ? '\n' : '');

  return { envs, envExample, envLocal };
}

function applyProviderSelection(configDir, selections = {}) {
  const providersFile = path.join(configDir, 'providers.json');
  const providers = readJson(providersFile);
  const next = { ...providers, tracks: { ...(providers.tracks || {}) } };

  for (const [track, chosenNames] of Object.entries(selections)) {
    if (!Array.isArray(next.tracks[track])) continue;
    if (!Array.isArray(chosenNames) || chosenNames.length === 0) continue;
    next.tracks[track] = next.tracks[track].filter((provider) => chosenNames.includes(provider.name));
  }

  writeJson(providersFile, next);
  return loadRouterConfig({ configDir });
}

function writeEnvTemplates(targetDir, config) {
  const { envs, envExample, envLocal } = buildEnvFiles(config);
  fs.writeFileSync(path.join(targetDir, '.env.example'), envExample);
  fs.writeFileSync(path.join(targetDir, '.env.local'), envLocal);
  return envs;
}

function normalizeAssignedEnv(flagValue) {
  const items = Array.isArray(flagValue) ? flagValue : (flagValue ? [flagValue] : []);
  const pairs = {};
  for (const item of items) {
    const text = String(item || '');
    const index = text.indexOf('=');
    if (index <= 0) continue;
    pairs[text.slice(0, index)] = text.slice(index + 1);
  }
  return pairs;
}

async function fillEnvLocal(targetDir, envs, args) {
  const envLocalPath = path.join(targetDir, '.env.local');
  const existing = readEnvFile(envLocalPath);
  const assigned = normalizeAssignedEnv(args['set-env']);

  let shouldPrompt = false;
  if (args.yes) {
    shouldPrompt = false;
  } else if (args['write-env'] !== undefined) {
    shouldPrompt = String(args['write-env']) !== 'false';
  } else {
    shouldPrompt = await promptYesNo('Write values to .env.local now?', true);
  }

  const values = { ...existing };
  for (const envName of envs) {
    const fallback = assigned[envName] || process.env[envName] || values[envName] || '';
    if (!shouldPrompt) {
      values[envName] = fallback;
      continue;
    }
    values[envName] = await prompt(`Value for ${envName}`, fallback);
  }

  const body = envs.map((envName) => `${envName}=${values[envName] || ''}`).join('\n') + (envs.length > 0 ? '\n' : '');
  fs.writeFileSync(envLocalPath, body);

  return {
    wroteEnvLocal: true,
    envsWithValues: envs.filter((envName) => Boolean(values[envName]))
  };
}

function summarizeTracks(loaded = {}) {
  return Object.fromEntries(
    Object.entries(loaded.tracks || {}).map(([track, providers]) => [track, providers.length])
  );
}

async function probeUrl(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.host}/`;
    const response = await fetch(origin, {
      method: 'GET',
      signal: controller.signal
    });
    return {
      ok: true,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

function copyPreset(presetName, targetDir, overwrite = false) {
  const presetDir = path.join(presetsDir(), presetName);
  if (!fs.existsSync(presetDir)) {
    throw new Error(`unknown preset ${presetName}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  for (const fileName of ['capabilities.json', 'policies.json', 'providers.json']) {
    const sourceFile = path.join(presetDir, fileName);
    const targetFile = path.join(targetDir, fileName);
    if (fs.existsSync(targetFile) && !overwrite) {
      throw new Error(`target file already exists: ${targetFile}`);
    }
    fs.copyFileSync(sourceFile, targetFile);
  }

  return {
    presetName,
    targetDir
  };
}

async function handleInit(args) {
  const presetNames = listPresets();
  if (presetNames.length === 0) {
    throw new Error('no presets available');
  }

  const targetDir = path.resolve(args.dir || await prompt('Config directory', './llm-config'));
  const presetName = args.preset || await promptChoice('Choose preset', presetNames, 'auto-media-balanced');
  const overwrite = Boolean(args.yes || args.overwrite);

  const result = copyPreset(presetName, targetDir, overwrite);
  let loaded = loadRouterConfig({ configDir: targetDir });
  const selections = {};

  for (const [track, providers] of Object.entries(loaded.tracks || {})) {
    if (!Array.isArray(providers) || providers.length === 0) continue;
    const names = providers.map((provider) => provider.name);
    const flagName = `${track}-providers`;
    if (args[flagName]) {
      selections[track] = String(args[flagName]).split(',').map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (args.yes) {
      selections[track] = names.slice(0, Math.min(2, names.length));
      continue;
    }

    console.log(`\nTrack: ${track}`);
    selections[track] = await promptMultiChoice(`Choose provider(s) for ${track}`, names, names.slice(0, Math.min(2, names.length)));
  }

  loaded = applyProviderSelection(targetDir, selections);
  const envs = writeEnvTemplates(targetDir, loaded);
  const envWrite = await fillEnvLocal(targetDir, envs, args);
  const validation = validateRouterConfig(loaded);

  console.log(JSON.stringify({
    ...result,
    selections,
    envs,
    envWrite,
    validation
  }, null, 2));
}

function handleValidate(args) {
  const configDir = path.resolve(args['config-dir'] || args.dir || process.cwd());
  const loaded = loadRouterConfig({ configDir });
  const validation = validateRouterConfig(loaded);
  console.log(JSON.stringify({
    configDir,
    validation,
    tracks: summarizeTracks(loaded)
  }, null, 2));
  if (validation.errors.length > 0) {
    process.exitCode = 1;
  }
}

async function handleSimulate(args) {
  const configDir = path.resolve(args['config-dir'] || args.dir || process.cwd());
  const capability = args.capability || await prompt('Capability', 'localization.translate');
  const loaded = loadRouterConfig({ configDir });
  const validation = validateRouterConfig(loaded);
  if (validation.errors.length > 0) {
    throw new Error(`invalid config: ${validation.errors.join('; ')}`);
  }

  const router = createPolicyRouterFromConfig({
    configDir,
    invoke: async ({ candidate, capability: currentCapability, track, request }) => ({
      mode: 'dry-run',
      capability: currentCapability,
      track,
      gateway: candidate.gateway || 'unspecified',
      provider: candidate.name,
      model: candidate.model,
      messageCount: Array.isArray(request.messages) ? request.messages.length : 0
    })
  });

  const result = await router.execute(capability, {
    messages: [
      { role: 'system', content: 'Return JSON.' },
      { role: 'user', content: `Simulate ${capability}.` }
    ]
  }, {
    ...(args['force-track'] ? { forceTrack: args['force-track'] } : {}),
    ...(args['force-provider'] ? { forceProvider: args['force-provider'] } : {})
  });

  console.log(JSON.stringify({
    configDir,
    capability,
    result
  }, null, 2));
}

async function handleDoctor(args) {
  const configDir = path.resolve(args['config-dir'] || args.dir || process.cwd());
  const loaded = loadRouterConfig({ configDir });
  const validation = validateRouterConfig(loaded);
  const envLocal = readEnvFile(path.join(configDir, '.env.local'));
  const requiredEnvs = collectApiKeyEnvs(loaded);
  const envStatus = requiredEnvs.map((name) => ({
    name,
    hasProcessEnv: Boolean(process.env[name]),
    hasEnvLocal: Boolean(envLocal[name]),
    ok: Boolean(process.env[name] || envLocal[name])
  }));

  const gatewaysUsed = Array.from(new Set(
    Object.values(loaded.tracks || {})
      .flat()
      .map((provider) => provider.gateway)
      .filter(Boolean)
  )).sort();

  const probes = [];
  if (!args['skip-probe']) {
    for (const gateway of gatewaysUsed) {
      if (gateway === 'portkey') {
        probes.push({
          gateway,
          baseUrl: process.env.PORTKEY_BASE_URL || 'http://127.0.0.1:8787/v1',
          ...(await probeUrl(process.env.PORTKEY_BASE_URL || 'http://127.0.0.1:8787/v1'))
        });
      } else if (gateway === 'litellm') {
        probes.push({
          gateway,
          baseUrl: process.env.LITELLM_BASE_URL || 'http://127.0.0.1:4000/v1',
          ...(await probeUrl(process.env.LITELLM_BASE_URL || 'http://127.0.0.1:4000/v1'))
        });
      } else {
        probes.push({
          gateway,
          ok: null,
          note: 'no built-in probe for this gateway'
        });
      }
    }
  }

  const summary = {
    configDir,
    validation,
    tracks: summarizeTracks(loaded),
    envStatus,
    probes,
    ok: validation.errors.length === 0 && envStatus.every((item) => item.ok) && probes.every((item) => item.ok !== false)
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    process.exitCode = 1;
  }
}

function handleImportAutoMedia(args) {
  const sourceDir = path.resolve(args.source || path.join(process.cwd(), '..', 'auto-media', 'config', 'model-router'));
  const outputDir = path.resolve(args.output || path.join(process.cwd(), '.local', 'imported-auto-media'));
  console.log(JSON.stringify(importAutoMedia(sourceDir, outputDir), null, 2));
}

async function handleSmokeLive() {
  require('../scripts/live-smoke');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  if (command === 'init') {
    await handleInit(args);
    return;
  }

  if (command === 'validate') {
    handleValidate(args);
    return;
  }

  if (command === 'simulate') {
    await handleSimulate(args);
    return;
  }

  if (command === 'doctor') {
    await handleDoctor(args);
    return;
  }

  if (command === 'import-auto-media') {
    handleImportAutoMedia(args);
    return;
  }

  if (command === 'smoke-live') {
    await handleSmokeLive();
    return;
  }

  throw new Error(`unknown command ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
