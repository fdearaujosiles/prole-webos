#!/usr/bin/env node
/* Evaluate an expression in the running TV app via the ares-inspect proxy.
 *
 *   ares-inspect -d tv -a com.fdear.prolewebos     (keep this running)
 *   node scripts/cdp-eval.js "expression"
 *
 * The proxy prints its port; set CDP_PORT or pass it as --port.
 * Set CDP_PORT env or --port N to skip discovery.
 */
'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function discover(port) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    http.get({ host: '127.0.0.1', port, path: '/json' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const list = JSON.parse(body);
          const page = list.find((t) => t.type === 'page') || list[0];
          if (!page) return reject(new Error('no page target'));
          resolve(page.webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error('ws error'));
  });
}

function evaluate(ws, expression) {
  return new Promise((resolve, reject) => {
    const id = 1;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      if (msg.error) return reject(new Error(JSON.stringify(msg.error)));
      resolve(msg.result);
    };
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true, userGesture: true }
    }));
    setTimeout(() => reject(new Error('eval timeout')), 10000);
  });
}

(async () => {
  const args = process.argv.slice(2);
  let port = process.env.CDP_PORT;
  const pIdx = args.indexOf('--port');
  if (pIdx !== -1) { port = args[pIdx + 1]; args.splice(pIdx, 2); }
  const expression = args.join(' ');
  if (!expression) {
    console.error('usage: cdp-eval.js [--port N] "<expression>"');
    process.exit(1);
  }
  if (!port) {
    const fs = require('fs');
    const path = require('path');
    const out = fs.readFileSync(path.join(__dirname, '..', 'backup', '.inspector-port'), 'utf8').trim();
    port = out;
  }
  const url = await discover(port);
  const ws = await connect(url);
  try {
    const result = await evaluate(ws, expression);
    if (result.exceptionDetails) {
      console.error('EXCEPTION:', JSON.stringify(result.exceptionDetails, null, 2));
      process.exit(2);
    }
    console.log(JSON.stringify(result.result.value, null, 2));
  } finally {
    ws.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
