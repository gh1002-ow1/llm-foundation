const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createPortkeyAdapter } = require('../src');

test('portkey adapter sends x-portkey-config and chat body', async () => {
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

  const adapter = createPortkeyAdapter({
    baseUrl: `http://127.0.0.1:${port}/v1`
  });

  const payload = await adapter.chat({
    provider: 'openai',
    apiKey: 'sk-test',
    model: 'gpt-4o-mini',
    customHost: 'http://mock-upstream.local/v1'
  }, {
    messages: [{ role: 'user', content: 'hello' }]
  });

  const config = JSON.parse(seen.headers['x-portkey-config']);

  assert.deepEqual(payload, { ok: true });
  assert.equal(config.provider, 'openai');
  assert.equal(config.api_key, 'sk-test');
  assert.equal(config.custom_host, 'http://mock-upstream.local/v1');
  assert.equal(seen.body.model, 'gpt-4o-mini');
  assert.equal(seen.body.messages[0].content, 'hello');

  await new Promise((resolve) => server.close(resolve));
});
