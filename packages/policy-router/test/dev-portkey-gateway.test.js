const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function waitFor(url, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {
      // Retry until the server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${url}`);
}

test('dev portkey gateway preserves upstream base path and auth', async () => {
  let seen = null;
  const upstream = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    seen = {
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      body: JSON.parse(body)
    };

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '{"ok":true}'
          }
        }
      ]
    }));
  });

  const upstreamPort = await listen(upstream);
  const gatewayPort = upstreamPort + 1;
  const gateway = spawn('node', [
    path.resolve(__dirname, '../../../scripts/dev-portkey-gateway.js')
  ], {
    env: {
      ...process.env,
      PORTKEY_DEV_HOST: '127.0.0.1',
      PORTKEY_DEV_PORT: String(gatewayPort)
    },
    stdio: 'ignore'
  });

  try {
    await waitFor(`http://127.0.0.1:${gatewayPort}/v1`);

    const response = await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-portkey-config': JSON.stringify({
          custom_host: `http://127.0.0.1:${upstreamPort}/api/v1`,
          api_key: 'provider-secret'
        })
      },
      body: JSON.stringify({
        model: 'demo-model',
        messages: [
          { role: 'user', content: 'hello' }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, '/api/v1/chat/completions');
    assert.equal(seen.authorization, 'Bearer provider-secret');
    assert.equal(seen.body.model, 'demo-model');
    assert.equal(seen.body.messages[0].content, 'hello');
  } finally {
    gateway.kill('SIGTERM');
    await close(upstream);
  }
});
