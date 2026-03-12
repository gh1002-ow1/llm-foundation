const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createLiteLLMAdapter } = require('../src');

test('litellm adapter sends authorization and OpenAI-compatible body', async () => {
  const seen = { headers: null, body: null };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      seen.headers = req.headers;
      seen.body = JSON.parse(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const adapter = createLiteLLMAdapter({
    baseUrl: `http://127.0.0.1:${port}/v1`,
    apiKey: 'gateway-secret'
  });

  const payload = await adapter.chat({
    model: 'foundation.longform'
  }, {
    messages: [{ role: 'user', content: 'hello' }]
  });

  assert.deepEqual(payload, { ok: true });
  assert.equal(seen.headers.authorization, 'Bearer gateway-secret');
  assert.equal(seen.body.model, 'foundation.longform');
  assert.equal(seen.body.messages[0].content, 'hello');

  await new Promise((resolve) => server.close(resolve));
});
