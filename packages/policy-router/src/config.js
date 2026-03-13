const fs = require('node:fs');
const path = require('node:path');

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;

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

function applyEnvValues(values = {}) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function hydrateProvider(provider = {}) {
  const apiKey = provider.apiKey
    || (provider.apiKeyEnv ? String(process.env[provider.apiKeyEnv] || '') : '');

  return {
    ...provider,
    ...(apiKey ? { apiKey } : {})
  };
}

function normalizeTrackProviders(tracks = {}) {
  const normalized = {};
  for (const [track, providers] of Object.entries(tracks || {})) {
    normalized[track] = Array.isArray(providers)
      ? providers
        .map((provider) => hydrateProvider(provider))
        .filter((provider) => provider && provider.name && provider.model)
      : [];
  }
  return normalized;
}

function validateRouterConfig(config = {}) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object') {
    return { errors: ['config must be an object'], warnings };
  }

  if (!config.tracks || typeof config.tracks !== 'object') {
    errors.push('tracks is required');
  }

  if (!config.capabilities || typeof config.capabilities !== 'object') {
    errors.push('capabilities is required');
  }

  if (config.defaults?.track && !config.tracks?.[config.defaults.track]) {
    errors.push(`defaults.track refers to unknown track ${config.defaults.track}`);
  }

  for (const [track, fallbackTrack] of Object.entries(config.defaults?.fallbackTrackByTrack || {})) {
    if (!config.tracks?.[track]) {
      warnings.push(`defaults.fallbackTrackByTrack refers to unknown track ${track}`);
    }
    if (fallbackTrack && !config.tracks?.[fallbackTrack]) {
      warnings.push(`defaults.fallbackTrackByTrack points to unknown fallback track ${fallbackTrack}`);
    }
  }

  for (const [track, providers] of Object.entries(config.tracks || {})) {
    if (!Array.isArray(providers)) {
      errors.push(`track ${track} must be an array`);
      continue;
    }

    if (providers.length === 0) {
      warnings.push(`track ${track} has no providers`);
    }

    for (const provider of providers) {
      if (!provider.name) errors.push(`track ${track} contains provider without name`);
      if (!provider.model) errors.push(`track ${track} contains provider without model`);
      if (!provider.apiKey && provider.apiKeyEnv) {
        warnings.push(`track ${track} provider ${provider.name} has no resolved value for ${provider.apiKeyEnv}`);
      }
      if (!provider.customHost && !provider.baseUrl) {
        warnings.push(`track ${track} provider ${provider.name} has no customHost/baseUrl`);
      }
    }
  }

  for (const [capability, rule] of Object.entries(config.capabilities || {})) {
    if (rule.track && !config.tracks?.[rule.track]) {
      warnings.push(`capability ${capability} refers to unknown track ${rule.track}`);
    }
    if (rule.fallbackTrack && !config.tracks?.[rule.fallbackTrack]) {
      warnings.push(`capability ${capability} refers to unknown fallbackTrack ${rule.fallbackTrack}`);
    }
  }

  return { errors, warnings };
}

function loadRouterConfig(options = {}) {
  const configDir = path.resolve(options.configDir || process.cwd());
  const providersFile = options.providersFile || path.join(configDir, 'providers.json');
  const policiesFile = options.policiesFile || path.join(configDir, 'policies.json');
  const capabilitiesFile = options.capabilitiesFile || path.join(configDir, 'capabilities.json');
  const envLocalFile = options.envLocalFile || path.join(configDir, '.env.local');

  applyEnvValues(parseEnvFile(envLocalFile));

  const providers = readJson(providersFile, {});
  const policies = readJson(policiesFile, {});
  const capabilitiesMeta = readJson(capabilitiesFile, {});

  return {
    configDir,
    defaults: policies.defaults || {},
    capabilities: policies.capabilities || {},
    capabilityMetadata: capabilitiesMeta || {},
    tracks: normalizeTrackProviders(providers.tracks || {})
  };
}

module.exports = {
  loadRouterConfig,
  validateRouterConfig,
  parseEnvFile
};
