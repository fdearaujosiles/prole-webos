const dgram=require('dgram');
const s=dgram.createSocket('udp4');
const msg=Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n');
s.on('message',(b,r)=>{console.log('--- from',r.address);console.log(b.toString());});
s.bind(()=>{s.send(msg,0,msg.length,1900,'192.168.1.50');setTimeout(()=>{s.close();process.exit(0)},4000);});
