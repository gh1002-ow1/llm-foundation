const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  createPolicyRouter,
  validateRouterConfig
} = require('../packages/policy-router/src');
const { createPortkeyAdapter } = require('../packages/gateway-adapter-portkey/src');

function parseLooseJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (_) {
    return Function(`"use strict"; return (${raw});`)();
  }
}

function get(obj, pathList, fallback = '') {
  let current = obj;
  for (const key of pathList) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return fallback;
    }
    current = current[key];
  }
  return current;
}

function loadLocalCredentials() {
  const openclawPath = process.env.OPENCLAW_CONFIG_PATH || path.join(os.homedir(), '.openclaw', 'openclaw.json');
  const autoMediaKeysPath = process.env.LLM_FOUNDATION_API_KEYS_PATH
    || path.join(os.homedir(), 'projects', 'auto-media', 'config', 'api-keys.json');

  const openclaw = fs.existsSync(openclawPath) ? parseLooseJson(openclawPath) : {};
  const apiKeys = fs.existsSync(autoMediaKeysPath) ? parseLooseJson(autoMediaKeysPath) : {};
  const providers = get(openclaw, ['models', 'providers'], {});

  const openrouter = providers.openrouter || {};
  const aliyuncs = providers.aliyuncs || {};

  return {
    sources: {
      openclawPath,
      autoMediaKeysPath
    },
    openrouter: {
      baseUrl: openrouter.baseUrl || get(apiKeys, ['openrouter', 'api_base'], 'https://openrouter.ai/api/v1'),
      apiKey: openrouter.apiKey || get(apiKeys, ['openrouter', 'api_key'], ''),
      model: process.env.LLM_FOUNDATION_OPENROUTER_MODEL || 'openrouter/free'
    },
    aliyuncs: {
      baseUrl: aliyuncs.baseUrl || get(apiKeys, ['aliyuncs', 'api_base'], 'https://coding.dashscope.aliyuncs.com/v1'),
      apiKey: aliyuncs.apiKey || get(apiKeys, ['aliyuncs', 'api_key'], ''),
      model: process.env.LLM_FOUNDATION_ALIYUNCS_MODEL || 'qwen3.5-plus'
    }
  };
}

function buildRouterConfig(credentials) {
  return {
    defaults: {
      track: 'free',
      fallbackTrackByTrack: {
        free: 'paid'
      }
    },
    capabilities: {
      'localization.translate': {
        track: 'free',
        fallbackTrack: 'paid'
      },
      'generation.longform': {
        track: 'paid'
      }
    },
    tracks: {
      free: [
        {
          name: 'openrouter-free-live',
          gateway: 'portkey',
          provider: 'openai',
          apiKey: credentials.openrouter.apiKey,
          customHost: credentials.openrouter.baseUrl,
          model: credentials.openrouter.model
        }
      ],
      paid: [
        {
          name: 'aliyuncs-paid-live',
          gateway: 'portkey',
          provider: 'openai',
          apiKey: credentials.aliyuncs.apiKey,
          customHost: credentials.aliyuncs.baseUrl,
          model: credentials.aliyuncs.model
        }
      ]
    }
  };
}

function createInvoke() {
  const adapter = createPortkeyAdapter({
    baseUrl: process.env.PORTKEY_BASE_URL || 'http://127.0.0.1:8787/v1'
  });

  return async ({ candidate, request }) => adapter.chat(candidate, request);
}

function summarizeResult(result) {
  return {
    ok: result.ok,
    error: result.error || null,
    route: result.route || null,
    fallbackCount: result.fallbackCount || 0,
    modelResponsePreview: result.output?.choices?.[0]?.message?.content
      ? String(result.output.choices[0].message.content).slice(0, 200)
      : null
  };
}

async function run() {
  const credentials = loadLocalCredentials();
  const config = buildRouterConfig(credentials);
  const validation = validateRouterConfig(config);
  if (validation.errors.length > 0) {
    throw new Error(`invalid local live config: ${validation.errors.join('; ')}`);
  }

  if (!credentials.openrouter.apiKey) {
    throw new Error('missing openrouter api key in local config');
  }
  if (!credentials.aliyuncs.apiKey) {
    throw new Error('missing aliyuncs api key in local config');
  }

  const router = createPolicyRouter({
    defaults: config.defaults,
    capabilities: config.capabilities,
    tracks: config.tracks,
    invoke: createInvoke()
  });

  const cases = [
    {
      name: 'free-track translation',
      capability: 'localization.translate',
      request: {
        messages: [
          { role: 'system', content: 'Return short JSON only.' },
          { role: 'user', content: 'Translate "hello world" to Chinese and return {"text":"..."}.' }
        ]
      }
    },
    {
      name: 'paid-track generation',
      capability: 'generation.longform',
      request: {
        messages: [
          { role: 'system', content: 'Return short JSON only.' },
          { role: 'user', content: 'Return {"title":"...","summary":"..."} about model routing in less than 20 words.' }
        ]
      }
    }
  ];

  const reports = [];
  for (const item of cases) {
    const startedAt = Date.now();
    try {
      const result = await router.execute(item.capability, item.request);
      reports.push({
        name: item.name,
        capability: item.capability,
        latencyMs: Date.now() - startedAt,
        ...summarizeResult(result)
      });
    } catch (error) {
      reports.push({
        name: item.name,
        capability: item.capability,
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: error.message,
        route: null,
        fallbackCount: 0,
        modelResponsePreview: null
      });
    }
  }

  console.log(JSON.stringify({
    sources: credentials.sources,
    providerSummary: {
      openrouter: {
        baseUrl: credentials.openrouter.baseUrl,
        hasApiKey: Boolean(credentials.openrouter.apiKey),
        model: credentials.openrouter.model
      },
      aliyuncs: {
        baseUrl: credentials.aliyuncs.baseUrl,
        hasApiKey: Boolean(credentials.aliyuncs.apiKey),
        model: credentials.aliyuncs.model
      }
    },
    validation,
    reports
  }, null, 2));
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
