#!/usr/bin/env node

const http = require('node:http');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function parsePortkeyConfig(req) {
  const header = req.headers['x-portkey-config'];
  if (!header) {
    throw new Error('missing x-portkey-config header');
  }

  const parsed = JSON.parse(String(header));
  if (!parsed.custom_host) {
    throw new Error('x-portkey-config.custom_host is required');
  }

  return parsed;
}

async function proxyRequest(req, res, upstreamPath) {
  const config = parsePortkeyConfig(req);
  const body = await readBody(req);
  const upstreamBase = new URL(config.custom_host);
  const normalizedPath = upstreamBase.pathname.endsWith('/')
    ? upstreamBase.pathname.slice(0, -1)
    : upstreamBase.pathname;
  upstreamBase.pathname = `${normalizedPath}${upstreamPath}`;
  upstreamBase.search = '';
  upstreamBase.hash = '';

  const headers = {
    'content-type': 'application/json'
  };

  if (config.api_key) {
    headers.authorization = `Bearer ${config.api_key}`;
  }

  const response = await fetch(upstreamBase, {
    method: 'POST',
    headers,
    body
  });

  const text = await response.text();
  res.writeHead(response.status, {
    'content-type': response.headers.get('content-type') || 'application/json'
  });
  res.end(text);
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/v1' || url.pathname === '/v1/')) {
      json(res, 200, {
        ok: true,
        gateway: 'dev-portkey',
        chatCompletions: '/v1/chat/completions',
        embeddings: '/v1/embeddings'
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      await proxyRequest(req, res, '/chat/completions');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/embeddings') {
      await proxyRequest(req, res, '/embeddings');
      return;
    }

    json(res, 404, {
      ok: false,
      error: `unsupported route ${req.method} ${url.pathname}`
    });
  } catch (error) {
    json(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

const host = process.env.PORTKEY_DEV_HOST || '127.0.0.1';
const port = Number(process.env.PORTKEY_DEV_PORT || '8787');

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch((error) => {
    json(res, 500, {
      ok: false,
      error: error.message
    });
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    ok: true,
    gateway: 'dev-portkey',
    host,
    port
  }));
});
