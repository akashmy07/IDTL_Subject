import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { deliverDepartmentReport, resolveDepartmentRoute } from './department-routing.js';

test('routes every supported category to its concerned department', () => {
  const routes = {
    'Roads & transport': 'Transport Department',
    Utilities: 'Utilities Department',
    'Water & sanitation': 'Water & Sanitation Department',
    'Public infrastructure': 'Public Infrastructure Department',
    'Safety & emergency': 'Safety & Emergency Department',
  };

  for (const [category, department] of Object.entries(routes)) {
    const route = resolveDepartmentRoute(category, 'critical');
    assert.equal(route.department, department);
    assert.equal(route.departmentId, route.queue);
    assert.match(route.email, /@/);
  }
});

test('uses the free local queue when no external delivery configuration exists', async () => {
  const route = resolveDepartmentRoute('Utilities', 'high');
  const result = await deliverDepartmentReport(route, {
    ticketNumber: 'PS-2026-0011',
    title: 'Power line issue',
    category: 'Utilities',
    priority: 'high',
    locationText: 'Central Road',
    latitude: 28.6,
    longitude: 77.2,
  });
  assert.equal(result.status, 'queued');
  assert.equal(result.method, 'free-local-queue');
  assert.equal(result.recipient, route.email);
});

test('sends a complete report to the category department through SMTP', async (t) => {
  const commands = [];
  const server = createServer((socket) => {
    let receivingData = false;
    socket.write('220 localhost ESMTP ready\r\n');
    socket.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line) continue;
        if (receivingData) {
          if (line === '.') {
            receivingData = false;
            socket.write('250 Message accepted\r\n');
          }
          continue;
        }
        commands.push(line);
        if (line.startsWith('EHLO')) socket.write('250-localhost\r\n250 PIPELINING\r\n');
        else if (line.startsWith('MAIL FROM:')) socket.write('250 OK\r\n');
        else if (line.startsWith('RCPT TO:')) socket.write('250 OK\r\n');
        else if (line === 'DATA') {
          receivingData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (line.startsWith('QUIT')) socket.write('221 Bye\r\n');
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const previousSmtpPassword = process.env.SMTP_PASSWORD;
  process.env.SMTP_PASSWORD = '';
  t.after(() => {
    if (previousSmtpPassword === undefined) delete process.env.SMTP_PASSWORD;
    else process.env.SMTP_PASSWORD = previousSmtpPassword;
  });
  const address = server.address();
  const route = resolveDepartmentRoute('Water & sanitation', 'critical');
  process.env.SMTP_CONFIG = JSON.stringify({
    host: '127.0.0.1',
    port: address.port,
    secure: false,
    from: 'reports@publicseva.local',
  });
  route.email = 'water-department@example.test';

  const result = await Promise.race([
    deliverDepartmentReport(route, {
      ticketNumber: 'PS-2026-0012',
      title: 'Broken water line',
      category: 'Water & sanitation',
      priority: 'critical',
      locationText: 'River Road',
      latitude: 28.6,
      longitude: 77.2,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP delivery timed out')), 1000)),
  ]);

  assert.equal(result.status, 'delivered');
  assert.equal(result.method, 'free-smtp');
  assert.equal(result.recipient, 'water-department@example.test');
  assert.ok(commands.some((command) => command.startsWith('MAIL FROM:')));
  assert.ok(commands.some((command) => command.startsWith('RCPT TO:')));
  assert.ok(commands.some((command) => command.startsWith('DATA')));
});
