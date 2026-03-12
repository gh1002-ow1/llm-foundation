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

    args[key] = next;
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

function printHelp() {
  console.log(`llm-foundation

Commands:
  init             Create a config directory from a preset
  validate         Validate a config directory
  simulate         Resolve and dry-run a capability route
  import-auto-media Import auto-media config into a local directory
  smoke-live       Run the local live smoke test

Examples:
  llm-foundation init
  llm-foundation init --dir ./llm-config --preset auto-media-balanced --yes
  llm-foundation validate --config-dir ./llm-config
  llm-foundation simulate --config-dir ./llm-config --capability localization.translate
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

  const loaded = loadRouterConfig({ configDir: targetDir });
  const envs = collectApiKeyEnvs(loaded);
  const envExample = envs.map((name) => `${name}=`).join('\n') + (envs.length > 0 ? '\n' : '');
  fs.writeFileSync(path.join(targetDir, '.env.example'), envExample);

  return {
    presetName,
    targetDir,
    envs
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
  console.log(JSON.stringify(result, null, 2));
}

function handleValidate(args) {
  const configDir = path.resolve(args['config-dir'] || args.dir || process.cwd());
  const loaded = loadRouterConfig({ configDir });
  const validation = validateRouterConfig(loaded);
  console.log(JSON.stringify({
    configDir,
    validation,
    tracks: Object.fromEntries(
      Object.entries(loaded.tracks || {}).map(([track, providers]) => [track, providers.length])
    )
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
