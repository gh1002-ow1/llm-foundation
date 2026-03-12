function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || 'http://127.0.0.1:8787/v1').replace(/\/$/, '');
}

function buildPortkeyConfig(provider = {}) {
  if (provider.portkeyConfig) {
    return provider.portkeyConfig;
  }

  const config = {
    provider: provider.provider || provider.vendor,
    api_key: provider.apiKey
  };

  if (provider.customHost) config.custom_host = provider.customHost;
  if (provider.requestTimeout) config.request_timeout = provider.requestTimeout;
  if (provider.strategy) config.strategy = provider.strategy;
  if (provider.targets) config.targets = provider.targets;
  if (provider.metadata) config.metadata = provider.metadata;

  return config;
}

async function parseResponse(response) {
  if (response.ok) {
    return response.json();
  }

  const text = await response.text();
  throw new Error(`Portkey gateway error ${response.status}: ${text.slice(0, 240)}`);
}

function createPortkeyAdapter(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('createPortkeyAdapter requires fetch');
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return {
    async chat(provider, request = {}) {
      const body = {
        model: request.model || provider.model,
        messages: request.messages || [],
        ...request.extra
      };
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-portkey-config': JSON.stringify(buildPortkeyConfig(provider))
        },
        body: JSON.stringify(body)
      });

      return parseResponse(response);
    },

    async embedding(provider, request = {}) {
      const body = {
        model: request.model || provider.embeddingModel || provider.model,
        input: request.input
      };
      const response = await fetchImpl(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-portkey-config': JSON.stringify(buildPortkeyConfig(provider))
        },
        body: JSON.stringify(body)
      });

      return parseResponse(response);
    }
  };
}

module.exports = {
  createPortkeyAdapter,
  buildPortkeyConfig
};
