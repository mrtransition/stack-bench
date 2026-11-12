// Agent P1 端点实测脚本。用法：AGENT_TOKEN=xxx node tests/agent-manual.mjs
const token = process.env.AGENT_TOKEN;
const base = 'http://127.0.0.1:7420';
const H = { 'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:8321', 'X-Agent-Token': token };

async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: H, body: JSON.stringify(body) });
  return r.json();
}

const K8S_OK = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`;
const DOCKER_OK = `services:
  web:
    image: nginx
  db:
    image: postgres
`;
const DOCKER_BAD = `services:
  web:
    ports:
      - "80:80"
`;
const SYNTAX_BAD = 'a: [1, 2\n';
const MULTI = `---
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm1
---
apiVersion: v1
kind: Pod
metadata:
  name: p1
`;

console.log('k8s ok doc   :', JSON.stringify(await post('/yaml-check', { kind: 'k8s', text: K8S_OK })));
console.log('docker ok    :', JSON.stringify(await post('/yaml-check', { kind: 'docker', text: DOCKER_OK })));
console.log('docker bad   :', JSON.stringify(await post('/yaml-check', { kind: 'docker', text: DOCKER_BAD })));
console.log('syntax bad   :', JSON.stringify(await post('/yaml-check', { kind: 'k8s', text: SYNTAX_BAD })));
console.log('multi doc    :', JSON.stringify(await post('/yaml-check', { kind: 'k8s', text: MULTI })));
console.log('cert bad pem :', JSON.stringify(await post('/cert', { pem: 'not a pem' })));
console.log('hmac         :', JSON.stringify(await post('/hmac', { algo: 'sha256', key: 'my-secret', text: 'hello world' })));
