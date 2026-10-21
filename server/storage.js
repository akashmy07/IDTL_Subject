import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(currentDirectory, '..');
const dataPath = path.join(currentDirectory, 'data', 'store.json');
const uploadDir = path.join(currentDirectory, 'uploads');
dotenv.config({ path: path.join(root, '.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if ((supabaseUrl || serviceKey) && !(supabaseUrl && serviceKey)) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be configured');
}

export const usingSupabase = Boolean(supabaseUrl && serviceKey);
if ((process.env.NODE_ENV === 'production' || process.env.VERCEL) && !usingSupabase) {
  throw new Error('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before deploying the API');
}

const supabase = usingSupabase
  ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'report-evidence';
let localStore = { users: [], hazards: [], audit: [] };

if (!usingSupabase) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });
  try {
    localStore = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await persistLocal();
  }
}

function throwIfError(error, operation) {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
}

function persistLocal() {
  return fs.writeFile(dataPath, JSON.stringify(localStore, null, 2));
}

function userFromRow(row) {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    passwordHash: row.password_hash || '',
    googleId: row.google_id || undefined,
    role: row.role,
    createdAt: row.created_at,
  };
}

function hazardFromRow(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    locationText: row.location_text,
    photoUrl: row.photo_url,
    createdBy: row.created_by,
    reporterEmail: row.reporter_email,
    assignedDepartment: row.assigned_department,
    departmentRoute: row.department_route,
    delivery: row.delivery,
    deliveryStatus: row.delivery_status,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureAdmin(adminEmail, adminPasswordHash) {
  if (!usingSupabase) {
    const exists = localStore.users.some((user) => user.email.toLowerCase() === adminEmail);
    if (!exists) {
      localStore.users.push({
        id: randomUUID(),
        name: 'System Administrator',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
      await persistLocal();
    }
    return;
  }

  const { data, error } = await supabase.from('users').select('id').eq('email', adminEmail).maybeSingle();
  throwIfError(error, 'admin lookup');
  if (!data) {
    const { error: insertError } = await supabase.from('users').upsert({
      email: adminEmail,
      display_name: 'System Administrator',
      password_hash: adminPasswordHash,
      role: 'admin',
    }, { onConflict: 'email', ignoreDuplicates: true });
    throwIfError(insertError, 'admin provisioning');
  }
}

export async function findUserByEmail(email) {
  if (!usingSupabase) return localStore.users.find((user) => user.email.toLowerCase() === email) || null;
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  throwIfError(error, 'user lookup');
  return data ? userFromRow(data) : null;
}

export async function findUserById(id) {
  if (!usingSupabase) return localStore.users.find((user) => user.id === id) || null;
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'user lookup');
  return data ? userFromRow(data) : null;
}

export async function createUser(user) {
  if (!usingSupabase) {
    localStore.users.push(user);
    await persistLocal();
    return user;
  }
  const { data, error } = await supabase.from('users').insert({
    id: user.id,
    email: user.email,
    display_name: user.name,
    password_hash: user.passwordHash || null,
    google_id: user.googleId || null,
    role: user.role,
  }).select('*').single();
  throwIfError(error, 'user creation');
  return userFromRow(data);
}

export async function addActivity(user, action, metadata = {}, hazardId = null) {
  const activity = {
    id: randomUUID(),
    actorId: user.id,
    hazardId,
    action,
    metadata,
    createdAt: new Date().toISOString(),
  };
  if (!usingSupabase) {
    localStore.audit.push(activity);
    await persistLocal();
    return;
  }
  const { error } = await supabase.from('audit_logs').insert({
    id: activity.id,
    actor_id: activity.actorId,
    hazard_id: activity.hazardId,
    action: activity.action,
    metadata: activity.metadata,
    created_at: activity.createdAt,
  });
  throwIfError(error, 'audit write');
}

export async function listHazards(user) {
  if (!usingSupabase) {
    return localStore.hazards
      .filter((hazard) => user.role === 'admin' || hazard.createdBy === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  let query = supabase.from('hazards').select('*').order('created_at', { ascending: false });
  if (user.role !== 'admin') query = query.eq('created_by', user.id);
  const { data, error } = await query;
  throwIfError(error, 'report lookup');
  return data.map(hazardFromRow);
}

export async function listPublicHazards() {
  if (!usingSupabase) {
    return localStore.hazards
      .filter((hazard) => hazard.status !== 'closed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const { data, error } = await supabase.from('hazards')
    .select('*').neq('status', 'closed').order('created_at', { ascending: false });
  throwIfError(error, 'public report lookup');
  return data.map(hazardFromRow);
}

export async function uploadEvidence(file) {
  if (!file) return null;
  const name = `${Date.now()}-${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)}`;
  if (!usingSupabase) {
    await fs.writeFile(path.join(uploadDir, name), file.buffer);
    return `/uploads/${name}`;
  }
  const { error } = await supabase.storage.from(bucket).upload(name, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  throwIfError(error, 'evidence upload');
  const { data } = supabase.storage.from(bucket).getPublicUrl(name);
  return data.publicUrl;
}

export async function deleteEvidence(photoUrl) {
  if (!usingSupabase || !photoUrl) return;
  const prefix = `/storage/v1/object/public/${bucket}/`;
  const index = photoUrl.indexOf(prefix);
  if (index < 0) return;
  const objectPath = decodeURIComponent(photoUrl.slice(index + prefix.length));
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  throwIfError(error, 'evidence cleanup');
}

export async function createHazard(hazard) {
  if (!usingSupabase) {
    localStore.hazards.push(hazard);
    await persistLocal();
    return hazard;
  }
  const { data, error } = await supabase.from('hazards').insert({
    id: hazard.id,
    ticket_number: hazard.ticketNumber,
    title: hazard.title,
    description: hazard.description,
    category: hazard.category,
    priority: hazard.priority,
    status: hazard.status,
    latitude: hazard.latitude,
    longitude: hazard.longitude,
    location_text: hazard.locationText,
    photo_url: hazard.photoUrl,
    created_by: hazard.createdBy,
    reporter_email: hazard.reporterEmail,
    assigned_department: hazard.assignedDepartment,
    department_route: hazard.departmentRoute,
    delivery: hazard.delivery,
    delivery_status: hazard.deliveryStatus,
    resolution_notes: hazard.resolutionNotes,
    created_at: hazard.createdAt,
    updated_at: hazard.updatedAt,
  }).select('*').single();
  throwIfError(error, 'report creation');
  return hazardFromRow(data);
}

export async function updateHazard(id, patch) {
  if (!usingSupabase) {
    const hazard = localStore.hazards.find((entry) => entry.id === id);
    if (!hazard) return null;
    Object.assign(hazard, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
    await persistLocal();
    return hazard;
  }
  const values = Object.fromEntries(Object.entries({
    status: patch.status,
    assigned_department: patch.assignedDepartment,
    resolution_notes: patch.resolutionNotes,
    updated_at: patch.updatedAt,
  }).filter(([, value]) => value !== undefined));
  const { data, error } = await supabase.from('hazards').update(values).eq('id', id).select('*').maybeSingle();
  throwIfError(error, 'report update');
  return data ? hazardFromRow(data) : null;
}

export async function listHazardsForStats(user) {
  return listHazards(user);
}

export function getUploadDirectory() {
  return uploadDir;
}
