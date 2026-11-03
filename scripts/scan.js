// Fast LAN probe for LG webOS TVs (no nmap required).
// Probes common webOS / dev-mode ports across the /24 and prints open ones.
const net = require('net');

const BASE = process.argv[2] || '192.168.1';
const PORTS = [9922, 3000, 3001, 9080, 9999, 26101, 8009, 8008, 80, 443, 8080, 1900];
const TIMEOUT = 350;
const CONCURRENCY = 256;

function probe(host, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(open ? port : null);
    };
    sock.setTimeout(TIMEOUT);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, host);
  });
}

async function scanHost(ip) {
  const results = await Promise.all(PORTS.map((p) => probe(ip, p)));
  const open = results.filter(Boolean);
  if (open.length) {
    console.log(`${ip}  OPEN: ${open.join(', ')}`);
  }
  return { ip, open };
}

(async () => {
  const ips = Array.from({ length: 254 }, (_, i) => `${BASE}.${i + 1}`);
  const queue = [...ips];
  const found = [];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const ip = queue.shift();
      const r = await scanHost(ip);
      if (r.open.length) found.push(r);
    }
  });
  await Promise.all(workers);
  console.log(`\nDone. ${found.length} host(s) with open ports.`);
})();
