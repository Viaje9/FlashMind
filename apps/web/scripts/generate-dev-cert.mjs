import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const certDir = path.resolve(rootDir, '.cert');
const keyPath = path.resolve(certDir, 'localhost-key.pem');
const certPath = path.resolve(certDir, 'localhost.pem');
const configPath = path.resolve(certDir, 'openssl.cnf');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('Dev HTTPS certificate already exists.');
  process.exit(0);
}

fs.mkdirSync(certDir, { recursive: true });

const opensslConfig = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
`.trim();

fs.writeFileSync(configPath, opensslConfig, 'utf8');

const result = spawnSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-days',
    '3650',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-subj',
    '/CN=localhost',
    '-extensions',
    'v3_req',
    '-config',
    configPath,
  ],
  { stdio: 'inherit' },
);

fs.rmSync(configPath, { force: true });

if (result.error) {
  console.error('Failed to run openssl:', result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('Dev HTTPS certificate generated in .cert/');
