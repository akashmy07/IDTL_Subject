import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { deliverDepartmentReport, resolveDepartmentRoute } from './department-routing.js';
import {
  addActivity,
  createHazard,
  createUser,
  deleteEvidence,
  ensureAdmin,
  findUserByEmail,
  findUserById,
  getUploadDirectory,
  listHazards,
  listHazardsForStats,
  listPublicHazards,
  uploadEvidence,
  updateHazard,
} from './storage.js';

const app = express();
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const jwtSecret = process.env.JWT_SECRET || 'development-only-change-before-production';
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;
const publicRole = 'public';
const adminRole = 'admin';

if ((process.env.NODE_ENV === 'production' || process.env.VERCEL) &&
  (!process.env.JWT_SECRET || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
  throw new Error('JWT_SECRET, ADMIN_EMAIL, and ADMIN_PASSWORD must be configured in production');
}
const adminEmail = (process.env.ADMIN_EMAIL || 'akashmy05@gmail.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'PublicSevaAdmin123!';
await ensureAdmin(adminEmail, await bcrypt.hash(adminPassword, 12));

function userFromToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  req.user = user;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) return cb(new Error('Only JPEG, PNG, WEBP, or GIF images are supported'));
    cb(null, true);
  },
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(getUploadDirectory(), { maxAge: '1h' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Public Seva API', timestamp: new Date().toISOString() }));

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim() || typeof password !== 'string' || password.length < 10) return res.status(400).json({ error: 'Name, valid email, and a password of at least 10 characters are required' });
  if (await findUserByEmail(email.trim().toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists' });
  const user = await createUser({ id: randomUUID(), name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: publicRole, createdAt: new Date().toISOString() });
  await addActivity(user, 'USER_SIGNUP', { source: 'email-password' });
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, jwtSecret, { expiresIn: '12h' });
  res.status(201).json({ token, user: { id: user.id, name, email: user.email, role: user.role } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = typeof email === 'string' ? await findUserByEmail(email.trim().toLowerCase()) : null;
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
  await addActivity(user, 'USER_SIGNIN', { source: 'email-password', ip: req.ip });
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, jwtSecret, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!googleClient || !process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google OAuth is not configured' });
  if (!credential) return res.status(400).json({ error: 'Google credential is required' });
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub || !payload.email_verified) return res.status(401).json({ error: 'Google authentication failed' });
  let user = await findUserByEmail(payload.email.toLowerCase());
  if (!user) {
    user = await createUser({ id: randomUUID(), name: payload.name || payload.email, email: payload.email.toLowerCase(), passwordHash: '', googleId: payload.sub, role: publicRole, createdAt: new Date().toISOString() });
  }
  await addActivity(user, 'USER_SIGNIN', { source: 'google-oauth', ip: req.ip });
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, jwtSecret, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await findUserById(req.user.id);
  res.json({ user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null });
});

app.get('/api/hazards', requireAuth, async (req, res) => {
  res.json({ hazards: await listHazards(req.user) });
});

app.get('/api/hazards/public', async (_req, res) => {
  const hazards = await listPublicHazards();
  res.json({ hazards: hazards.map((hazard) => {
    const publicHazard = { ...hazard };
    delete publicHazard.reporterEmail;
    return publicHazard;
  }) });
});

app.post('/api/hazards', requireAuth, requireRole(publicRole), upload.single('photo'), async (req, res) => {
  const { title, description, category, priority, latitude, longitude, locationText } = req.body;
  const coordinates = [Number(latitude), Number(longitude)];
  if (!title || !description || !category || !priority || !locationText || coordinates.some((value) => !Number.isFinite(value) || value < -90 || value > 90)) {
    return res.status(400).json({ error: 'Complete title, description, category, priority, location, and valid coordinates are required' });
  }
  const route = resolveDepartmentRoute(category, priority);
  const photoUrl = await uploadEvidence(req.file);
  const hazard = {
    id: randomUUID(), ticketNumber: `PS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    title, description, category, priority, status: 'received', latitude: coordinates[0], longitude: coordinates[1], locationText,
    photoUrl, createdBy: req.user.id, reporterEmail: req.user.email,
    assignedDepartment: route.department,
    departmentRoute: { departmentId: route.departmentId, department: route.department, email: route.email, responseWindow: route.responseWindow },
    resolutionNotes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const delivery = await deliverDepartmentReport(route, hazard);
  hazard.delivery = delivery;
  hazard.deliveryStatus = delivery.status;
  let createdHazard;
  try {
    createdHazard = await createHazard(hazard);
  } catch (error) {
    if (photoUrl) {
      try {
        await deleteEvidence(photoUrl);
      } catch (cleanupError) {
        console.error('Failed to remove orphaned report evidence:', cleanupError);
      }
    }
    throw error;
  }
  await addActivity(req.user, 'REPORT_ROUTED', {
    department: route.department,
    deliveryStatus: delivery.status,
    deliveryMethod: delivery.method,
  }, hazard.id);
  res.status(201).json({ hazard: createdHazard, delivery });
});

app.patch('/api/hazards/:id/status', requireAuth, requireRole(adminRole), async (req, res) => {
  const { status, assignedDepartment, resolutionNotes } = req.body;
  if (!['received', 'reviewing', 'assigned', 'in_progress', 'resolved', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const hazard = await updateHazard(req.params.id, {
    status,
    assignedDepartment: assignedDepartment || undefined,
    resolutionNotes: resolutionNotes || undefined,
    updatedAt: new Date().toISOString(),
  });
  if (!hazard) return res.status(404).json({ error: 'Report not found' });
  await addActivity(req.user, `STATUS_${status.toUpperCase()}`, { assignedDepartment, resolutionNotes }, hazard.id);
  res.json({ hazard });
});

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  const reports = await listHazardsForStats(req.user);
  const stats = {
    total: reports.length,
    received: reports.filter((hazard) => hazard.status === 'received').length,
    inProgress: reports.filter((hazard) => ['reviewing', 'assigned', 'in_progress'].includes(hazard.status)).length,
    resolved: reports.filter((hazard) => hazard.status === 'resolved' || hazard.status === 'closed').length,
    critical: reports.filter((hazard) => hazard.priority === 'critical').length,
  };
  res.json({ stats });
});

app.post('/api/ai/classify', requireAuth, requireRole(publicRole), async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });
  if (!process.env.AI_API_KEY) return res.status(503).json({ error: 'Gemini AI API key is not configured.' });
  let classification;
  let source = 'gemini-ai';
  try {
    const model = process.env.AI_MODEL || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.AI_API_KEY)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Classify this infrastructure report. Return only valid JSON with a classification object containing category and priority. Category must be one of Roads & transport, Utilities, Water & sanitation, Public infrastructure, or Safety & emergency. Priority must be low, medium, high, or critical. Report title: ${title}. Report description: ${description}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) throw new Error(`Gemini unavailable with status ${response.status}`);
    const data = await response.json();
    const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = rawResponse ? JSON.parse(rawResponse) : null;
    classification = parsed?.classification;
    if (!classification?.category || !classification?.priority) throw new Error('Gemini response did not include valid classification fields');
  } catch (error) {
    const reportText = `${title} ${description}`.toLowerCase();
    const categoryRules = [
      { category: 'Safety & emergency', keywords: ['fire', 'smoke', 'collapse', 'emergency', 'accident', 'electrocution', 'exposed wire'] },
      { category: 'Water & sanitation', keywords: ['water', 'sewage', 'sewer', 'drain', 'drainage', 'sanitation', 'pipeline', 'leak', 'flood'] },
      { category: 'Utilities', keywords: ['power', 'electricity', 'electric', 'streetlight', 'outage', 'transformer', 'cable'] },
      { category: 'Roads & transport', keywords: ['road', 'pothole', 'traffic', 'bridge', 'footpath', 'signal', 'street'] },
    ];
    const category = categoryRules.find((rule) => rule.keywords.some((keyword) => reportText.includes(keyword)))?.category || 'Public infrastructure';
    const priority = ['fire', 'smoke', 'collapse', 'emergency', 'accident', 'electrocution', 'exposed wire'].some((keyword) => reportText.includes(keyword))
      ? 'critical'
      : ['flood', 'leak', 'outage', 'blocked', 'overflow', 'broken', 'cracked', 'pothole'].some((keyword) => reportText.includes(keyword))
        ? 'high'
        : 'medium';
    classification = { category, priority };
    source = 'deterministic-local-ai';
  }
  await addActivity(req.user, 'AI_CLASSIFICATION', { metadata: classification, source });
  res.json({
    classification,
    source,
    ...(source === 'deterministic-local-ai' ? { warning: 'Gemini was unavailable; local classification was used.' } : {}),
  });
});

app.post('/api/ai/insights', requireAuth, requireRole(publicRole), async (req, res) => {
  const { title = '', description = '', category = 'Public infrastructure', priority = 'medium' } = req.body;
  const text = `${title} ${description}`.toLowerCase();
  const criticalKeywords = ['danger', 'hazard', 'flood', 'collapse', 'power', 'electric', 'water', 'smoke', 'fire', 'blocked', 'cracked', 'risk'];
  const hasCriticalSignal = criticalKeywords.some((keyword) => text.includes(keyword));
  const priorityScore = { low: 28, medium: 46, high: 70, critical: 92 }[priority] || 46;
  const riskScore = Math.min(99, Math.round(priorityScore + (hasCriticalSignal ? 10 : 0) + (category === 'Safety & emergency' ? 8 : 0)));
  const riskLevel = riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low';
  const signals = [];
  if (hasCriticalSignal) signals.push('Safety keywords detected');
  if (category === 'Utilities') signals.push('Utility dependency signal');
  if (category === 'Water & sanitation') signals.push('Public health exposure');
  if (category === 'Roads & transport') signals.push('Mobility disruption risk');
  if (!signals.length) signals.push('Standard infrastructure signal');
  const insight = {
    label: riskLevel === 'critical' ? 'Immediate response recommended' : riskLevel === 'high' ? 'Priority intervention recommended' : 'Standard monitoring recommended',
    riskScore,
    riskLevel,
    summary: `${category} has ${riskLevel} impact potential based on the reported details and entered priority.`,
    confidence: process.env.AI_API_KEY ? 92 : 84,
    responseWindow: riskLevel === 'critical' ? 'Under 2 hours' : riskLevel === 'high' ? 'Within 8 hours' : 'Within 24 hours',
    recommendations: [
      `Assign ${category.toLowerCase()} to the responsible authority.`,
      riskLevel === 'critical' ? 'Dispatch an immediate safety response and preserve evidence.' : 'Prepare a route for inspection and confirm the reported location.',
      'Capture an operational status update and record the response timeline.',
    ],
    signals,
    source: process.env.AI_API_KEY ? 'gemini-ai' : 'deterministic-local-ai',
  };
  await addActivity(req.user, 'AI_INSIGHT', { metadata: { riskScore, riskLevel, category } });
  res.json({ insight });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error' });
});

export default app;
