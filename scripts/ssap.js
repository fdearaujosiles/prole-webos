#!/usr/bin/env node
/* Minimal SSAP client for the TV (wss://HOST:3001).
 *
 * The Dev Mode CLI (ares-novacom / luna-send-pub) is restricted to app
 * install/launch and cannot touch settingsservice or capture the screen.
 * SSAP is the same protocol the LG remote app uses and is allowed to do both
 * after a one-time pairing the user accepts on the TV.
 *
 * Node >= 22 (global WebSocket + fetch). Self-signed cert: verification is
 * disabled for this process only; the key is pinned to the TV IP in
 * .ssap-client-key.
 *
 * Commands:
 *   pair                        pair (accept the prompt on the TV)
 *   request <ssap-uri> [json]   raw request
 *   apps                        list installed apps
 *   foreground                  current foreground app
 *   launch <appId> [json]       launch an app
 *   close <appId>               close an app
 *   screenshot <path.jpg>       capture the screen
 *   settings-get <category> [key...]
 *   settings-set <category> <json-object>
 *   luna <luna-uri> <json>      call an internal luna endpoint via createAlert
 */
'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ROOT = path.dirname(__dirname);
const HOST = process.env.LG_TV_HOST || '192.168.1.50';
const PORT = process.env.LG_TV_SSAP_PORT || '3001';
const KEY_FILE = path.join(ROOT, '.ssap-client-key.json');

const LUNA_SETTINGS = 'luna://com.webos.settingsservice/setSystemSettings';

const REGISTRATION = {
  manifest: {
    manifestVersion: 1,
    appVersion: '1.1',
    signed: {
      created: '20140509',
      appId: 'com.lge.test',
      vendorId: 'com.lge',
      localizedAppNames: { '': 'LG Remote App', 'ko-KR': '리모컨 앱' },
      localizedVendorNames: { '': 'LG Electronics' },
      permissions: [
        'TEST_SECURE', 'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD',
        'READ_INSTALLED_APPS', 'READ_LGE_SDX', 'READ_NOTIFICATIONS', 'SEARCH',
        'WRITE_SETTINGS', 'WRITE_NOTIFICATION_ALERT', 'CONTROL_POWER',
        'READ_CURRENT_CHANNEL', 'READ_RUNNING_APPS', 'READ_UPDATE_INFO',
        'UPDATE_FROM_REMOTE_APP', 'READ_LGE_TV_INPUT_EVENTS',
        'READ_TV_CURRENT_TIME',
      ],
      serial: '2f930e2d2cfe083771f68e4fe7bb07',
    },
    permissions: [
      'LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'CLOSE',
      'TEST_OPEN', 'TEST_PROTECTED', 'CONTROL_AUDIO', 'CONTROL_DISPLAY',
      'CONTROL_INPUT_JOYSTICK', 'CONTROL_INPUT_MEDIA_RECORDING',
      'CONTROL_INPUT_MEDIA_PLAYBACK', 'CONTROL_INPUT_TV',
      'CONTROL_MOUSE_AND_KEYBOARD', 'CONTROL_INPUT_TEXT', 'CONTROL_POWER',
      'READ_APP_STATUS', 'READ_CURRENT_CHANNEL', 'READ_INPUT_DEVICE_LIST',
      'READ_NETWORK_STATE', 'READ_RUNNING_APPS', 'READ_TV_CHANNEL_LIST',
      'WRITE_NOTIFICATION_TOAST', 'READ_POWER_STATE', 'READ_COUNTRY_INFO',
      'READ_SETTINGS', 'CONTROL_TV_SCREEN', 'CONTROL_TV_STANBY',
      'CONTROL_FAVORITE_GROUP', 'CONTROL_USER_INFO',
      'CHECK_BLUETOOTH_DEVICE', 'CONTROL_BLUETOOTH',
      'CONTROL_TIMER_INFO', 'STB_INTERNAL_CONNECTION',
      'CONTROL_RECORDING', 'READ_RECORDING_STATE',
      'WRITE_RECORDING_LIST', 'READ_RECORDING_LIST',
      'READ_RECORDING_SCHEDULE', 'WRITE_RECORDING_SCHEDULE',
    ],
    signatures: [
      {
        signatureVersion: 1,
        signature: 'eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw==',
      },
    ],
  },
};

function buildRegistration(clientKey, mode) {
  const payload = JSON.parse(JSON.stringify(REGISTRATION));
  if (mode === 'unsigned') {
    const signed = payload.manifest.signed || {};
    delete payload.manifest.signed;
    delete payload.manifest.signatures;
    payload.manifest.permissions = Array.from(
      new Set([...(payload.manifest.permissions || []), ...(signed.permissions || [])])
    ).sort();
  }
  payload.pairingType = mode === 'pin' ? 'PIN' : 'PROMPT';
  payload.forcePairing = false;
  if (clientKey) payload['client-key'] = clientKey;
  return payload;
}

function loadKey() {
  try {
    return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveKey(clientKey, unsigned) {
  const record = { host: HOST, key: clientKey, unsigned: !!unsigned };
  fs.writeFileSync(KEY_FILE, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
  console.error(`saved client key to ${KEY_FILE}`);
}

function connect(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://${HOST}:${PORT}`);
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error(`timed out connecting to wss://${HOST}:${PORT}`));
    }, timeoutMs);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws); });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`could not open wss://${HOST}:${PORT} (TV off or SSAP port closed?)`));
    });
  });
}

function attach(ws) {
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
    const handler = pending.get(msg.id);
    if (handler) { pending.delete(msg.id); handler(msg); }
  });
  return pending;
}

function request(ws, pending, uri, payload, timeoutMs = 15000) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`no reply for ${uri} after ${timeoutMs} ms`));
    }, timeoutMs);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      if (msg.type === 'error') reject(new Error(`${uri}: ${msg.error || 'error'}`));
      else resolve(msg.payload || {});
    });
    ws.send(JSON.stringify({ type: 'request', id, uri, payload: payload || {} }));
  });
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

/* Register on an open socket. Resolves with a client key. If `existing` is
 * given the TV should accept silently; any pairingType message means the key
 * was not remembered, so we only prompt then. */
function register(ws, existing, opts = {}) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    let pinId = null;
    let mode = opts.unsigned ? 'unsigned' : 'prompt';
    let settled = false;
    const timer = setTimeout(() => {
      done(reject, new Error('registration timed out (did you accept the prompt on the TV?)'));
    }, opts.timeoutMs || 120000);

    function done(fn, arg) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('close', onClose);
      fn(arg);
    }
    function onClose() {
      done(reject, new Error('TV closed the SSAP connection during registration'));
    }
    async function onMessage(ev) {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
      if (msg.id !== id && msg.id !== pinId) return;
      const payload = msg.payload || {};
      if (msg.type === 'error') {
        const err = String(msg.error || '');
        if (/blacklisted certificate/i.test(err) && !opts.unsigned) {
          done(reject, new Error('BLACKLISTED'));
        } else {
          done(reject, new Error(`registration failed: ${err}`));
        }
        return;
      }
      if ((msg.type === 'registered' || msg.type === 'response') && payload['client-key']) {
        done(resolve, payload['client-key']);
        return;
      }
      const pairingType = String(payload.pairingType || '').toUpperCase();
      if (pairingType === 'PROMPT') {
        if (existing) {
          done(reject, new Error('TV asked to pair again; the stored key was not accepted. Run "pair" to re-pair.'));
        } else {
          console.error('>>> Look at the TV and accept the pairing request. <<<');
        }
        return;
      }
      if (pairingType === 'PIN' && !pinId) {
        try {
          const pin = await ask('Enter the 8-digit PIN shown on the TV: ');
          if (!/^\d{8}$/.test(pin)) {
            done(reject, new Error('PIN must be exactly 8 digits'));
            return;
          }
          pinId = crypto.randomUUID();
          ws.send(JSON.stringify({ type: 'request', id: pinId, uri: 'ssap://pairing/setPin', payload: { pin } }));
        } catch (e) {
          done(reject, e);
        }
      }
    }

    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
    ws.send(JSON.stringify({ type: 'register', id, payload: buildRegistration(existing, mode) }));
  });
}

async function openPairing(opts = {}) {
  const stored = loadKey();
  const existing = opts.fresh ? null : stored && stored.host === HOST ? stored.key : null;
  let unsigned = !!(stored && stored.host === HOST && stored.unsigned);
  for (let attempt = 0; attempt < 2; attempt++) {
    const ws = await connect();
    const pending = attach(ws);
    try {
      const key = await register(ws, existing, { unsigned });
      if (key !== existing || !stored || stored.host !== HOST) saveKey(key, unsigned);
      return { ws, pending, key, unsigned };
    } catch (e) {
      ws.close();
      if (e.message === 'BLACKLISTED') { unsigned = true; continue; }
      throw e;
    }
  }
  throw new Error('registration failed');
}

async function withConnection(fn) {
  const { ws, pending } = await openPairing();
  try {
    return await fn(ws, pending);
  } finally {
    ws.close();
  }
}

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

async function cmdPair() {
  const { ws, key } = await openPairing({ fresh: process.argv.includes('--fresh') });
  ws.close();
  console.log(`paired with ${HOST}. client key: ${key}`);
}

async function cmdRequest(uri, json) {
  if (!uri) die('usage: ssap.js request <ssap-uri> [json]');
  const payload = json ? JSON.parse(json) : {};
  const result = await withConnection((ws, pending) => request(ws, pending, uri, payload));
  printJson(result);
}

async function cmdApps() {
  const result = await withConnection((ws, pending) =>
    request(ws, pending, 'ssap://com.webos.applicationManager/listApps', {}, 20000));
  const apps = result.apps || [];
  if (process.argv.includes('--json')) { printJson(apps); return; }
  console.log(`${apps.length} apps`);
  for (const app of apps) {
    const flags = [
      app.visible === false ? 'hidden' : '',
      app.trustLevel && app.trustLevel !== 'default' ? app.trustLevel : '',
      app.default ? 'default' : '',
    ].filter(Boolean).join(',');
    console.log(`  ${app.id}${flags ? `  [${flags}]` : ''}  ${app.title || ''}`);
  }
}

async function cmdForeground() {
  const result = await withConnection((ws, pending) =>
    request(ws, pending, 'ssap://com.webos.applicationManager/getForegroundAppInfo', {}));
  printJson(result);
}

async function cmdLaunch(appId, json) {
  if (!appId) die('usage: ssap.js launch <appId> [json]');
  const payload = { id: appId, ...(json ? JSON.parse(json) : {}) };
  const result = await withConnection((ws, pending) =>
    request(ws, pending, 'ssap://system.launcher/launch', payload));
  printJson(result);
}

async function cmdClose(appId) {
  if (!appId) die('usage: ssap.js close <appId>');
  const result = await withConnection((ws, pending) =>
    request(ws, pending, 'ssap://system.launcher/close', { id: appId }));
  printJson(result);
}

async function cmdScreenshot(outPath) {
  if (!outPath) die('usage: ssap.js screenshot <file.jpg>');
  const result = await withConnection((ws, pending) =>
    request(ws, pending, 'ssap://tv/executeOneShot', {}, 20000));
  const imageUri = result.imageUri;
  if (!imageUri) {
    printJson(result);
    die('TV did not return an imageUri');
  }
  const response = await fetch(imageUri, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) die(`download failed: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, data);
  console.log(`saved ${data.length} bytes to ${outPath} (${imageUri})`);
}

async function readSettings(category, keys) {
  return withConnection((ws, pending) =>
    request(ws, pending, 'ssap://settings/getSystemSettings', { category, keys: keys || [] }, 20000));
}

async function cmdSettingsGet(category, keys) {
  if (!category) die('usage: ssap.js settings-get <category> [key...]');
  printJson(await readSettings(category, keys));
}

/* Try every category/key combination on one connection and print the hits.
 * The TV rejects unknown keys with a 500, so a success means the key exists
 * and is readable over SSAP. */
async function cmdSettingsScan(categories, keys) {
  if (!categories || !keys) die('usage: ssap.js settings-scan <cat,cat> <key,key>');
  const cats = categories.split(',').map((s) => s.trim()).filter(Boolean);
  const names = keys.split(',').map((s) => s.trim()).filter(Boolean);
  const hits = [];
  const failures = [];
  await withConnection(async (ws, pending) => {
    for (const category of cats) {
      for (const key of names) {
        try {
          const r = await request(ws, pending, 'ssap://settings/getSystemSettings',
            { category, keys: [key] });
          const view = r.settings || r.data || {};
          hits.push({ category, key, value: view[key] });
          console.log(`OK   ${category}/${key} = ${JSON.stringify(view[key])}`);
        } catch (e) {
          failures.push(`${category}/${key}: ${e.message}`);
        }
      }
    }
  });
  console.log(`\nreadable: ${hits.length}, rejected: ${failures.length}`);
  if (failures.length && process.argv.includes('--verbose')) {
    for (const f of failures) console.log(`  ${f}`);
  }
  return hits;
}

/* Write via the alert workaround: on this firmware the settings service is
 * not registered as an SSAP endpoint, but an alert's onclose/onClick target
 * may be an internal luna:// URI and closing the alert fires it. */
async function lunaViaAlert(ws, pending, uri, params) {
  const alert = {
    message: ' ',
    buttons: [{ label: '', onClick: uri, params }],
    onclose: { uri, params },
    onfail: { uri, params },
  };
  const created = await request(ws, pending, 'ssap://system.notifications/createAlert', alert);
  if (!created.alertId) throw new Error(`createAlert returned no alertId: ${JSON.stringify(created)}`);
  await request(ws, pending, 'ssap://system.notifications/closeAlert', { alertId: created.alertId });
  return created.alertId;
}

/* Send remote-control key presses through the pointer input socket. */
async function cmdKey(list) {
  if (!list) die('usage: ssap.js key <NAME[,NAME...]>');
  const names = list.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  await withConnection(async (ws, pending) => {
    const info = await request(ws, pending,
      'ssap://com.webos.service.networkinput/getPointerInputSocket', {});
    if (!info.socketPath) throw new Error('TV returned no pointer socket');
    const input = new WebSocket(info.socketPath);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('pointer socket timeout')), 10000);
      input.addEventListener('open', () => { clearTimeout(t); resolve(); });
      input.addEventListener('error', () => { clearTimeout(t); reject(new Error('pointer socket failed')); });
    });
    for (const name of names) {
      input.send(JSON.stringify({ type: 'button', name }));
      console.log(`key ${name}`);
      await new Promise((r) => setTimeout(r, 350));
    }
    await new Promise((r) => setTimeout(r, 500));
    input.close();
  });
}

async function cmdSettingsSet(category, json) {
  if (!category || !json) die('usage: ssap.js settings-set <category> <json-object>');
  const settings = JSON.parse(json);
  const params = { category, settings };
  const outcome = await withConnection(async (ws, pending) => {
    let direct = null;
    try {
      direct = await request(ws, pending, 'ssap://com.webos.service.settings/setSystemSettings', params);
    } catch (e) {
      direct = { error: e.message };
    }
    if (direct && direct.returnValue !== false && !direct.error) {
      return { via: 'direct', response: direct };
    }
    const alertId = await lunaViaAlert(ws, pending, LUNA_SETTINGS, params);
    return { via: 'alert', alertId, direct };
  });
  printJson(outcome);

  // Verify after the alert round-trip, whatever path was used. Only a handful
  // of keys are exposed by the SSAP settings adapter; for the rest the caller
  // verifies against the on-disk store, so a read failure is not fatal here.
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const now = await readSettings(category, Object.keys(settings));
    const view = now.settings || now.data || now;
    const verified = {};
    for (const key of Object.keys(settings)) verified[key] = view[key];
    printJson({ after: verified });
  } catch (e) {
    printJson({ after: null, note: `SSAP read not available: ${e.message}` });
  }
}

async function cmdLuna(uri, json) {
  if (!uri || !json) die('usage: ssap.js luna <luna-uri> <json>');
  const params = JSON.parse(json);
  const result = await withConnection(async (ws, pending) => {
    const alertId = await lunaViaAlert(ws, pending, uri, params);
    return { alertId };
  });
  printJson(result);
}

async function main() {
  const [, , command, ...args] = process.argv;
  switch (command) {
    case 'pair': return cmdPair();
    case 'request': return cmdRequest(args[0], args[1]);
    case 'apps': return cmdApps();
    case 'foreground': return cmdForeground();
    case 'launch': return cmdLaunch(args[0], args[1]);
    case 'close': return cmdClose(args[0]);
    case 'screenshot': return cmdScreenshot(args[0]);
    case 'settings-get': return cmdSettingsGet(args[0], args.slice(1));
    case 'settings-scan': return cmdSettingsScan(args[0], args[1]);
    case 'key': return cmdKey(args[0]);
    case 'settings-set': return cmdSettingsSet(args[0], args[1]);
    case 'luna': return cmdLuna(args[0], args[1]);
    default:
      console.error('usage: ssap.js <pair|request|apps|foreground|launch|close|screenshot|settings-get|settings-set|luna> ...');
      process.exit(command ? 1 : 0);
  }
}

main().catch((e) => die(e && e.message ? e.message : String(e)));
