const fs = require('node:fs');
const path = require('node:path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function inferApiKeyEnv(provider = {}) {
  if (provider.apiKeyEnv) return provider.apiKeyEnv;

  const text = [
    provider.name,
    provider.baseUrl,
    provider.model
  ].filter(Boolean).join(' ').toLowerCase();

  if (text.includes('openrouter')) return 'OPENROUTER_API_KEY';
  if (text.includes('dashscope') || text.includes('aliyuncs')) return 'ALIYUNCS_API_KEY';
  if (text.includes('groq')) return 'GROQ_API_KEY';
  if (text.includes('aisa')) return 'AISA_API_KEY';
  if (text.includes('qianfan') || text.includes('baidu')) return 'BAIDU_CODING_PLAN_API_KEY';
  return 'LLM_PROVIDER_API_KEY';
}

function sanitizeProvider(provider = {}) {
  return {
    name: provider.name,
    gateway: 'portkey',
    provider: 'openai',
    apiKeyEnv: inferApiKeyEnv(provider),
    customHost: provider.baseUrl,
    model: provider.model,
    ...(provider.embeddingModel ? { embeddingModel: provider.embeddingModel } : {}),
    ...(provider.tags ? { tags: provider.tags } : {})
  };
}

function convertPolicies(input = {}) {
  const defaults = input.defaults || {};
  const out = {
    defaults: {
      track: defaults.track || 'free'
    },
    capabilities: {}
  };

  if (defaults.track === 'free') {
    out.defaults.fallbackTrackByTrack = {
      free: 'paid'
    };
  }

  for (const [capability, rule] of Object.entries(input.capabilities || {})) {
    const next = {};
    if (rule.track) next.track = rule.track;
    if (rule.allowPaidEscalation) next.fallbackTrack = 'paid';
    if (rule.allowFreeDegrade) next.fallbackTrack = 'free';
    out.capabilities[capability] = next;
  }

  return out;
}

function main() {
  const sourceDir = path.resolve(process.argv[2] || path.join(process.cwd(), '..', 'auto-media', 'config', 'model-router'));
  const outputDir = path.resolve(process.argv[3] || path.join(process.cwd(), '.local', 'imported-auto-media'));

  const free = readJson(path.join(sourceDir, 'llm-free.json'));
  const paid = readJson(path.join(sourceDir, 'llm-paid.json'));
  const policy = readJson(path.join(sourceDir, 'llm-policy.json'));

  const providers = {
    tracks: {
      free: (free.providers || []).filter((provider) => provider.enabled !== false).map(sanitizeProvider),
      paid: (paid.providers || []).filter((provider) => provider.enabled !== false).map(sanitizeProvider)
    }
  };
  const policies = convertPolicies(policy);
  const capabilities = Object.fromEntries(
    Object.keys(policies.capabilities || {}).map((capability) => [capability, { description: 'Imported from auto-media preset' }])
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'providers.json'), JSON.stringify(providers, null, 2));
  fs.writeFileSync(path.join(outputDir, 'policies.json'), JSON.stringify(policies, null, 2));
  fs.writeFileSync(path.join(outputDir, 'capabilities.json'), JSON.stringify(capabilities, null, 2));

  console.log(JSON.stringify({
    sourceDir,
    outputDir,
    freeProviders: providers.tracks.free.length,
    paidProviders: providers.tracks.paid.length,
    capabilities: Object.keys(capabilities)
  }, null, 2));
}

main();
