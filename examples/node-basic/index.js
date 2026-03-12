const path = require('path');

const {
  createPolicyRouterFromConfig,
  loadRouterConfig,
  validateRouterConfig
} = require('../../packages/policy-router/src');
const { createPortkeyAdapter } = require('../../packages/gateway-adapter-portkey/src');
const { createLiteLLMAdapter } = require('../../packages/gateway-adapter-litellm/src');

function createDryRunInvoke() {
  return async ({ capability, track, candidate, request }) => ({
    mode: 'dry-run',
    capability,
    track,
    gateway: candidate.gateway || 'unspecified',
    provider: candidate.name,
    model: candidate.model,
    messageCount: Array.isArray(request.messages) ? request.messages.length : 0
  });
}

function createGatewayInvoke() {
  const portkey = createPortkeyAdapter({
    baseUrl: process.env.PORTKEY_BASE_URL || 'http://127.0.0.1:8787/v1'
  });
  const litellm = createLiteLLMAdapter({
    baseUrl: process.env.LITELLM_BASE_URL || 'http://127.0.0.1:4000/v1',
    apiKey: process.env.LITELLM_API_KEY || ''
  });

  const adapters = {
    portkey,
    litellm
  };

  return async ({ candidate, request }) => {
    const gateway = String(candidate.gateway || '').trim();
    const adapter = adapters[gateway];

    if (!adapter) {
      throw new Error(`no adapter configured for gateway ${gateway || 'unknown'}`);
    }

    return adapter.chat(candidate, request);
  };
}

async function main() {
  const liveGateway = process.argv.includes('--live-gateway') || process.argv.includes('--live-portkey');
  const invoke = liveGateway ? createGatewayInvoke() : createDryRunInvoke();
  const configDir = process.env.LLM_FOUNDATION_CONFIG_DIR
    ? path.resolve(process.env.LLM_FOUNDATION_CONFIG_DIR)
    : path.join(__dirname, 'config');
  const loaded = loadRouterConfig({ configDir });
  const validation = validateRouterConfig(loaded);

  if (validation.errors.length > 0) {
    throw new Error(`invalid config: ${validation.errors.join('; ')}`);
  }

  const router = createPolicyRouterFromConfig({
    configDir,
    invoke
  });

  const result = await router.execute('localization.translate', {
    messages: [
      { role: 'system', content: 'Return structured JSON.' },
      { role: 'user', content: 'Translate hello to Chinese.' }
    ]
  });

  console.log(JSON.stringify({
    cwd: path.resolve(__dirname),
    configDir,
    liveGateway,
    validation,
    result
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
