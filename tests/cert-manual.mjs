// 证书解析实测（真实自签证书）
import fs from 'node:fs';
const pem = fs.readFileSync('C:/Users/mrtra/AppData/Local/Temp/c.pem', 'utf8');
const token = process.env.AGENT_TOKEN;
const r = await fetch('http://127.0.0.1:7420/cert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:8321', 'X-Agent-Token': token },
  body: JSON.stringify({ pem })
});
const data = await r.json();
console.log(JSON.stringify(data, null, 2));
if (!data.ok) process.exit(1);
if (!data.subject || !data.subject.includes('devtools-test')) { console.log('FAIL: subject 缺少 CN'); process.exit(1); }
if (data.expired !== false) { console.log('FAIL: 30 天有效证书不应已过期'); process.exit(1); }
console.log('CERT-PARSE-PASS');
