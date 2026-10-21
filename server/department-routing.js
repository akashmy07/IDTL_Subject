import { createConnection } from 'node:net';
import tls from 'node:tls';

const ROUTES = {
  'Roads & transport': { department: 'Transport Department', email: process.env.DEPARTMENT_TRANSPORT_EMAIL || 'transport@publicseva.local', queue: 'transport', responseWindow: '8 hours' },
  Utilities: { department: 'Utilities Department', email: process.env.DEPARTMENT_UTILITIES_EMAIL || 'utilities@publicseva.local', queue: 'utilities', responseWindow: '8 hours' },
  'Water & sanitation': { department: 'Water & Sanitation Department', email: process.env.DEPARTMENT_WATER_EMAIL || 'water@publicseva.local', queue: 'water-sanitation', responseWindow: '4 hours' },
  'Public infrastructure': { department: 'Public Infrastructure Department', email: process.env.DEPARTMENT_PUBLIC_WORKS_EMAIL || 'public-works@publicseva.local', queue: 'public-infrastructure', responseWindow: '24 hours' },
  'Safety & emergency': { department: 'Safety & Emergency Department', email: process.env.DEPARTMENT_SAFETY_EMAIL || 'safety@publicseva.local', queue: 'safety-emergency', responseWindow: '2 hours' },
};

export function resolveDepartmentRoute(category, priority = 'medium') {
  const route = ROUTES[category] || ROUTES['Public infrastructure'];
  return { ...route, category, priority, departmentId: route.queue };
}

function parseSmtpEnvelope(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

class NativeSmtpClient {
  constructor(config) {
    this.config = config;
    this.buffer = '';
    this.pending = [];
    this.socket = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const options = { host: this.config.host, port: Number(this.config.port || 587), timeout: 15000 };
      const transport = (this.config.secure === true) ? tls : createConnection;
      this.socket = transport === tls
        ? tls.connect({ ...options, servername: this.config.host })
        : createConnection(options);
      const connectedEvent = transport === tls ? 'secureConnect' : 'connect';
      this.socket.once(connectedEvent, () => resolve(this));
      this.socket.once('error', reject);
      this.socket.on('data', (chunk) => this.#handleData(chunk));
      this.socket.on('error', (error) => this.#fail(error));
    });
  }

  #handleData(chunk) {
    this.buffer += chunk.toString('utf8');
    while (true) {
      const lineEnd = this.buffer.indexOf('\r\n');
      if (lineEnd === -1) return;
      const line = this.buffer.slice(0, lineEnd);
      this.buffer = this.buffer.slice(lineEnd + 2);
      const code = Number(line.slice(0, 3));
      const text = line.slice(4);
      const waiter = this.pending.shift();
      if (!waiter) continue;
      waiter({ code, text });
    }
  }

  #fail(error) {
    for (const waiter of this.pending) waiter.reject(error);
    this.pending = [];
  }

  request(command, expectedCode = 250) {
    if (!this.socket || !this.socket.writable) return Promise.reject(new Error('SMTP socket is not connected'));
    if (command) this.socket.write(`${command}\r\n`);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pending.indexOf(waiter);
        if (index >= 0) this.pending.splice(index, 1);
        reject(new Error(`SMTP response timed out for ${command || 'connection'}`));
      }, 15000);
      const waiter = async (response) => {
        clearTimeout(timeout);
        if (response.code !== expectedCode) reject(new Error(`SMTP returned ${response.code} for ${command || 'connection'}`));
        else resolve(response);
      };
      this.pending.push(waiter);
    });
  }

  write(data) {
    this.socket.write(data);
  }

  close() {
    this.socket?.destroy();
  }
}

async function sendSmtpEmail(config, route, report) {
  const from = config.from || process.env.SMTP_FROM_EMAIL;
  const user = config.user || process.env.SMTP_USER;
  const password = (config.password || process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');
  if (!config.host || !from) return null;

  const client = new NativeSmtpClient(config);
  await client.connect();
  try {
    await client.request('', 220);
    await client.request(`EHLO ${from.split('@')[0]}`);
    if (user && password) {
      await client.request('AUTH LOGIN', 334);
      await client.request(Buffer.from(user).toString('base64'), 334);
      await client.request(Buffer.from(password).toString('base64'), 235);
    }
    await client.request(`MAIL FROM:<${from}>`);
    await client.request(`RCPT TO:<${route.email}>`);
    await client.request('DATA', 354);
    const message = [
      `From: ${from}`, `To: ${route.email}`, 'Subject: New Public Seva infrastructure report',
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '',
      `Ticket: ${report.ticketNumber}`, `Title: ${report.title}`, `Category: ${report.category}`,
      `Priority: ${report.priority}`, `Department: ${route.department}`, `Location: ${report.locationText}`,
      `Coordinates: ${report.latitude}, ${report.longitude}`, `Response window: ${route.responseWindow}`,
    ].join('\r\n');
    client.write(`${message}\r\n.\r\n`);
    await client.request('', 250);
    return { status: 'delivered', method: 'free-smtp', recipient: route.email, deliveredAt: new Date().toISOString() };
  } finally {
    client.close();
  }
}

export async function deliverDepartmentReport(route, report) {
  const webhookUrl = process.env.DEPARTMENT_WEBHOOK_URL;
  const smtpConfig = parseSmtpEnvelope(process.env.SMTP_CONFIG);
  const payload = {
    ticketNumber: report.ticketNumber, title: report.title, category: report.category, priority: report.priority,
    location: report.locationText, coordinates: [report.latitude, report.longitude], department: route.department,
    recipient: route.email, responseWindow: route.responseWindow,
  };

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.DEPARTMENT_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.DEPARTMENT_WEBHOOK_TOKEN}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Department webhook returned ${response.status}`);
      return { status: 'delivered', method: 'webhook', recipient: route.email, deliveredAt: new Date().toISOString() };
    } catch (error) {
      console.warn('Department webhook failed; using free local queue:', error.message);
    }
  }

  if (smtpConfig) {
    try {
      const result = await sendSmtpEmail(smtpConfig, route, report);
      if (result?.status === 'delivered') return result;
    } catch (error) {
      console.warn('SMTP delivery failed; using free local queue:', error.message);
    }
  }

  return {
    status: 'queued', method: 'free-local-queue', recipient: route.email, queuedAt: new Date().toISOString(),
    deliveryNote: 'No paid provider was used. Configure SMTP_CONFIG or DEPARTMENT_WEBHOOK_URL for direct delivery.',
  };
}
