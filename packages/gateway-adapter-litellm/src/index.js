function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || 'http://127.0.0.1:4000/v1').replace(/\/$/, '');
}

async function parseResponse(response) {
  if (response.ok) {
    return response.json();
  }

  const text = await response.text();
  throw new Error(`LiteLLM gateway error ${response.status}: ${text.slice(0, 240)}`);
}

function createLiteLLMAdapter(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('createLiteLLMAdapter requires fetch');
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const gatewayApiKey = options.apiKey || '';

  function buildHeaders(provider = {}) {
    const key = provider.gatewayApiKey || gatewayApiKey;
    const headers = {
      'content-type': 'application/json'
    };

    if (key) {
      headers.authorization = `Bearer ${key}`;
    }

    if (provider.extraHeaders && typeof provider.extraHeaders === 'object') {
      Object.assign(headers, provider.extraHeaders);
    }

    return headers;
  }

  return {
    async chat(provider, request = {}) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: buildHeaders(provider),
        body: JSON.stringify({
          model: request.model || provider.model,
          messages: request.messages || [],
          ...request.extra
        })
      });

      return parseResponse(response);
    },

    async embedding(provider, request = {}) {
      const response = await fetchImpl(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: buildHeaders(provider),
        body: JSON.stringify({
          model: request.model || provider.embeddingModel || provider.model,
          input: request.input
        })
      });

      return parseResponse(response);
    }
  };
}

module.exports = {
  createLiteLLMAdapter
};
