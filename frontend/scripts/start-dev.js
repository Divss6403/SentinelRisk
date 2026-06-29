const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || '3001';
const env = { ...process.env, PORT: port, BROWSER: 'none' };

const isWindows = process.platform === 'win32';
const command = isWindows ? 'cmd.exe' : 'npx';
const args = isWindows
  ? ['/d', '/s', '/c', 'npx craco start']
  : ['craco', 'start'];

function printServerUrl(text) {
  const urlMatch = text.match(/https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):(\d+)/i);
  if (urlMatch) {
    const host = urlMatch[1] === '[::1]' ? 'localhost' : urlMatch[1];
    const port = urlMatch[2];
    console.log(`[frontend] Dev server available at http://${host}:${port}`);
    return;
  }

  const localMatch = text.match(/Local:\s*(https?:\/\/[^\s]+)/i);
  if (localMatch) {
    console.log(`[frontend] Dev server available at ${localMatch[1]}`);
  }
}

console.log(`[frontend] Starting dev server on port ${port}...`);
console.log(`[frontend] Frontend will be available at: http://localhost:${port}`);

const child = spawn(command, args, {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: false,
});

child.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  printServerUrl(text);
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  process.stderr.write(text);
  printServerUrl(text);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to start frontend dev server:', error.message);
  process.exit(1);
});
