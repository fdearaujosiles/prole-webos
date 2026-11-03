// SSDP (UPnP) discovery — finds TVs and prints LOCATION + SERVER headers.
const dgram = require('dgram');
const http = require('http');

const msg = Buffer.from(
  'M-SEARCH * HTTP/1.1\r\n' +
    'HOST: 239.255.255.250:1900\r\n' +
    'MAN: "ssdp:discover"\r\n' +
    'MX: 2\r\n' +
    'ST: ssdp:all\r\n\r\n'
);

const seen = new Map();
const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

sock.on('message', (buf, rinfo) => {
  const text = buf.toString();
  if (!/LG|webos|WebOS|SmartTV|DIAL/i.test(text) && !seen.has(rinfo.address)) {
    // still record generic responses; we filter later
  }
  const loc = (text.match(/LOCATION:\s*(\S+)/i) || [])[1];
  const server = (text.match(/SERVER:\s*(.+)/i) || [])[1];
  const st = (text.match(/\r\nST:\s*(.+)/i) || [])[1];
  const key = `${rinfo.address}|${loc || ''}|${st || ''}`;
  if (seen.has(key)) return;
  seen.set(key, true);
  if (loc) {
    console.log(`[SSDP] ${rinfo.address}  ${st || ''}`);
    console.log(`       LOCATION: ${loc}`);
    if (server) console.log(`       SERVER: ${server.trim()}`);
    // Fetch device description to get manufacturer/model
    http
      .get(loc, { timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          const grab = (tag) => (body.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i')) || [])[1];
          const m = grab('manufacturer');
          const model = grab('modelName');
          const fn = grab('friendlyName');
          if (m || model || fn) {
            console.log(`       DEVICE: ${m || '?'} | ${model || '?'} | ${fn || '?'}`);
          }
        });
      })
      .on('error', () => {});
  }
  if (!loc) {
    console.log(`[SSDP] ${rinfo.address}  ${st || ''}  ${server ? server.trim() : ''}`);
  }
});

sock.bind(1900, () => {
  sock.setBroadcast(true);
  sock.send(msg, 0, msg.length, 1900, '239.255.255.250');
  setTimeout(() => {
    console.log('\nDiscovery finished.');
    sock.close();
    process.exit(0);
  }, 5000);
});

sock.on('error', (e) => {
  console.error('SSDP error:', e.message);
  process.exit(1);
});
