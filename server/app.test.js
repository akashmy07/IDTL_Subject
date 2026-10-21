import test from 'node:test';
import assert from 'node:assert/strict';

test('health endpoint exposes service status', async () => {
  const app = (await import('./app.js')).default;
  const server = app.listen(0);
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  server.close();
});
