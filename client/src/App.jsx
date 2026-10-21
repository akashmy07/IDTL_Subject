import { useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, Building2, ChevronRight, CircleUserRound, Clock3, FileImage, Gauge, LogIn, LogOut, MapPin, Menu, MessageSquare, Navigation, Plus, Search, ShieldCheck, Siren, Upload, X, Zap } from 'lucide-react';
import CityScene from './components/CityScene.jsx';

const api = async (path, options = {}) => {
  const token = localStorage.getItem('seva-token');
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
};

function Logo() {
  return <Link className="logo" to="/"><span className="logo-mark"><Building2 size={21} /></span><span>PUBLIC <strong>SEVA</strong></span></Link>;
}

function Header({ user, logout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const go = (path) => { setOpen(false); navigate(path); };
  return <header className="site-header"><Logo /><nav className={open ? 'nav-links open' : 'nav-links'}><button onClick={() => go('/')}>Home</button><button onClick={() => go('/reports')}>Public reports</button><button onClick={() => go('/how-it-works')}>How it works</button>{user ? <button onClick={() => go(user.role === 'admin' ? '/admin' : '/dashboard')}>Dashboard</button> : <button onClick={() => go('/login')}>Login</button>}</nav><div className="header-actions">{user ? <><span className="user-chip"><CircleUserRound size={16} />{user.name.split(' ')[0]}</span><button className="icon-button" onClick={logout}><LogOut size={17} /></button></> : <button className="button button-primary button-small" onClick={() => go('/signup')}><LogIn size={15} /> Sign in</button>}<button className="menu-button" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div></header>;
}

function Hero({ go }) {
  return <section className="hero"><div className="hero-grid" /><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot" /> Civic infrastructure intelligence</div><h1>Every city problem.<br /><span>One clear path.</span></h1><p>Report infrastructure hazards, capture exact location and evidence, and move every issue to the department responsible for resolution.</p><div className="hero-actions"><button className="button button-primary" onClick={() => go('/report')}>Report a hazard <ArrowRight size={18} /></button><button className="button button-ghost" onClick={() => go('/reports')}>Track public reports <ChevronRight size={18} /></button></div><div className="trust-row"><span><ShieldCheck size={15} /> Secure reporting</span><span><MapPin size={15} /> GPS verified</span><span><FileImage size={15} /> Photo evidence</span></div></div><div className="hero-visual"><div className="orb orb-one" /><div className="orb orb-two" /><div className="scene-frame"><CityScene /></div><div className="floating-card card-top"><span className="icon-icon teal"><Navigation size={18} /></span><div><small>Live location</small><strong>GPS captured</strong></div><span className="live-dot">LIVE</span></div><div className="floating-card card-bottom"><span className="icon-icon blue"><Activity size={18} /></span><div><small>System activity</small><strong>All routes monitored</strong></div></div></div></section>;
}

function FeatureGrid() {
  const items = [{ icon: Siren, title: 'Hazard reporting', text: 'Structured reports for roads, utilities, water, public spaces, and emergency infrastructure.', color: 'teal' }, { icon: MapPin, title: 'GPS location capture', text: 'Pin the exact location and preserve coordinates for the responsible team.', color: 'blue' }, { icon: FileImage, title: 'Photo evidence', text: 'Upload real images securely and attach them to the report lifecycle.', color: 'violet' }, { icon: Gauge, title: 'Priority workflow', text: 'Classify urgent risks and route them to the correct department automatically.', color: 'orange' }];
  return <section className="section"><div className="section-heading"><div><span className="section-kicker">Built for real-world action</span><h2>Technology that moves<br />from report to resolution.</h2></div><p>Public Seva keeps every community issue visible, accountable, and traceable.</p></div><div className="feature-grid">{items.map(({ icon: Icon, title, text, color }) => <article className="feature-card" key={title}><span className={`feature-icon ${color}`}><Icon /></span><h3>{title}</h3><p>{text}</p><button>Explore capability <ArrowRight size={14} /></button></article>)}</div></section>;
}

function Workflow() {
  const items = [{ icon: MessageSquare, title: 'Submit', text: 'Citizens report the issue with location, category, priority, and evidence.' }, { icon: Zap, title: 'Route', text: 'The platform assigns the report to the appropriate authority.' }, { icon: Activity, title: 'Resolve', text: 'Departments update work, communicate status, and close the case.' }];
  return <section className="section workflow"><div className="workflow-visual"><div className="network-ring"><span><ShieldCheck /></span></div><div className="metric-pill one"><span>Critical</span><strong>Priority detected</strong></div><div className="metric-pill two"><span>Ticket</span><strong>Auto-generated</strong></div></div><div className="workflow-copy"><span className="section-kicker">Complete response loop</span><h2>From citizen signal<br />to accountable action.</h2><div className="steps">{items.map(({ icon: Icon, title, text }, index) => <div className="step" key={title}><span className="step-index">0{index + 1}</span><span className="step-icon"><Icon size={19} /></span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>;
}

function Auth({ mode, setUser }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleInitialized = useRef(false);
  const googleButtonRef = useRef(null);
  const googleCallbackRef = useRef(null);
  const navigate = useNavigate();
  const signup = mode === 'signup';
  const storeSession = async (result) => { localStorage.setItem('seva-token', result.token); localStorage.setItem('seva-user', JSON.stringify(result.user)); setUser(result.user); navigate(result.user.role === 'admin' ? '/admin' : '/dashboard'); };
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  googleCallbackRef.current = async ({ credential }) => {
    try {
      const result = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
      await storeSession(result);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;
    const renderButton = () => {
      if (!window.google?.accounts?.id || googleInitialized.current || !googleButtonRef.current) return false;
      googleButtonRef.current.style.display = 'flex';
      googleButtonRef.current.style.justifyContent = 'center';
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: (response) => googleCallbackRef.current?.(response) });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(400, Math.floor(googleButtonRef.current.clientWidth || 400)),
      });
      googleInitialized.current = true;
      return true;
    };
    if (renderButton()) return undefined;
    const script = document.getElementById('google-identity-script');
    if (!script) return undefined;
    const onLoad = () => {
      if (!renderButton()) setError('Google sign-in could not load. Check your internet connection and reload.');
    };
    script.addEventListener('load', onLoad);
    return () => script.removeEventListener('load', onLoad);
  }, [googleClientId]);
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(''); try { const result = await api(signup ? '/auth/signup' : '/auth/login', { method: 'POST', body: JSON.stringify(form) }); await storeSession(result); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  return <section className="auth-page"><div className="auth-panel"><div className="auth-brand"><Logo /></div><div className="auth-heading"><span>{signup ? 'Join the public network' : 'Welcome back'}</span><h1>{signup ? 'Create your citizen account' : 'Sign in to Public Seva'}</h1><p>{signup ? 'Submit reports and track every action with your secure account.' : 'Access your reports or administrator operations.'}</p></div><form onSubmit={submit}>{signup && <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></label>}<label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label><label>Password<input required minLength="10" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 10 characters" /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary full" disabled={loading}>{loading ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button></form><div className="google-divider"><span>or continue with</span></div>{googleClientId ? <div className="google-signin full" ref={googleButtonRef} /> : <div className="form-error">Google sign-in is not configured for this website.</div>}<p className="auth-switch">{signup ? 'Already have an account?' : 'New to Public Seva?'} <button onClick={() => navigate(signup ? '/login' : '/signup')}>{signup ? 'Sign in' : 'Create account'}</button></p><div className="auth-note"><ShieldCheck size={16} /> Passwords and sessions are protected server-side.</div></div><div className="auth-visual"><div className="auth-visual-orb" /><div><span className="section-kicker">Trusted public infrastructure</span><h2>Security is built into every action.</h2><p>Public users submit issues. Authorized departments resolve them. Every transition is recorded and traceable.</p><div className="auth-benefits"><span><ShieldCheck /> Role-based access</span><span><Activity /> Live status tracking</span><span><FileImage /> Evidence archive</span></div></div></div></section>;
}

function ReportForm({ notify }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'Roads & transport', priority: 'medium', latitude: '', longitude: '', locationText: '', photo: null });
  const [photoName, setPhotoName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const gps = () => navigator.geolocation?.getCurrentPosition(({ coords }) => setForm({ ...form, latitude: coords.latitude, longitude: coords.longitude, locationText: 'Current GPS location captured' }), () => notify('Location unavailable. Enter coordinates manually.'), { enableHighAccuracy: true, timeout: 10000 });
  const classify = async () => { try { const result = await api('/ai/classify', { method: 'POST', body: JSON.stringify({ title: form.title, description: form.description }) }); setForm({ ...form, category: result.classification.category, priority: result.classification.priority }); notify(result.source === 'deterministic-local-ai' ? 'Gemini unavailable; local classification applied.' : 'AI classification applied.'); } catch (error) { notify(error.message); } };
  const submit = async (event) => { event.preventDefault(); setLoading(true); const data = new FormData(); Object.entries(form).forEach(([key, value]) => { if (key !== 'photo') data.append(key, value); }); if (form.photo) data.append('photo', form.photo); try { const response = await fetch('/api/hazards', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('seva-token')}` }, body: data }); const body = await response.json(); if (!response.ok) throw new Error(body.error); notify(`Report ${body.hazard.ticketNumber} routed to ${body.hazard.assignedDepartment}. Delivery: ${body.delivery.status}.`); navigate('/dashboard'); } catch (e) { notify(e.message); } finally { setLoading(false); } };
  return <section className="page-shell report-page"><div className="page-title"><span className="section-kicker">Public reporting</span><h1>Report a hazard</h1><p>Submit real conditions affecting your community. Evidence and location are required for a complete response.</p></div><form className="report-form" onSubmit={submit}><div className="form-card"><div className="card-header"><div><span>01</span><h2>Issue details</h2></div><p>Describe what you observed.</p></div><div className="form-grid"><label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Roads & transport</option><option>Utilities</option><option>Water & sanitation</option><option>Public infrastructure</option><option>Safety & emergency</option></select></label><label className="full">Description<textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><button type="button" className="button button-ghost" onClick={classify}><Zap size={16} /> AI classify</button></div></div><div className="form-card"><div className="card-header"><div><span>02</span><h2>Location & evidence</h2></div><p>Use secure GPS capture or coordinates.</p></div><div className="form-grid"><label>Latitude<input required type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></label><label>Longitude<input required type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></label><label className="full">Location description<input required value={form.locationText} onChange={(e) => setForm({ ...form, locationText: e.target.value })} /></label><button type="button" className="button button-secondary" onClick={gps}><Navigation size={16} /> Capture GPS</button><label className="photo-upload full"><Upload size={22} /><span><strong>Upload photo evidence</strong><small>{photoName || 'JPEG, PNG, WEBP, or GIF up to 4 MB'}</small></span><input type="file" accept="image/*" onChange={(e) => { setForm({ ...form, photo: e.target.files[0] }); setPhotoName(e.target.files[0]?.name || ''); }} /></label></div></div><div className="form-actions"><p><ShieldCheck size={16} /> Server-side authorization protects every submission.</p><button className="button button-primary" disabled={loading}>{loading ? 'Submitting…' : 'Submit report'} <ArrowRight size={17} /></button></div></form></section>;
}

function Metric({ icon: Icon, label, value }) { return <article className="metric-card"><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>; }
function Empty({ title, text, path }) { return <div className="empty-state"><span><Siren /></span><h3>{title}</h3><p>{text}</p><Link className="button button-primary" to={path}>Create report</Link></div>; }

function Dashboard({ user, notify }) {
  const [data, setData] = useState({ stats: {}, hazards: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api('/dashboard/stats'), api('/hazards')]).then(([statsResult, hazardsResult]) => setData({ stats: statsResult.stats, hazards: hazardsResult.hazards })).catch((error) => notify(error.message)).finally(() => setLoading(false)); }, [notify]);
  const reports = data.hazards || [];
  return <section className="page-shell dashboard"><div className="page-title"><span className="section-kicker">{user.role === 'admin' ? 'Authority operations' : 'Citizen workspace'}</span><h1>{user.role === 'admin' ? 'Operations dashboard' : 'Your reports'}</h1><p>{user.role === 'admin' ? 'Monitor, prioritize, assign, and resolve community infrastructure issues.' : 'Track every report you submit and follow its resolution journey.'}</p></div><div className="metric-grid"><Metric icon={Siren} label="Total reports" value={data.stats.total || 0} /><Metric icon={Clock3} label="In progress" value={data.stats.inProgress || 0} /><Metric icon={ShieldCheck} label="Resolved" value={data.stats.resolved || 0} /><Metric icon={AlertTriangle} label="Critical" value={data.stats.critical || 0} /></div><div className="dashboard-grid"><div className="table-card"><div className="table-heading"><h2>Reports</h2><Link to="/report">New report <Plus size={15} /></Link></div>{loading ? <div className="empty-state">Loading…</div> : reports.length ? <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Issue</th><th>Department</th><th>Priority</th><th>Status</th><th>Delivery</th><th>Updated</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td><strong>{report.ticketNumber}</strong></td><td>{report.title}</td><td>{report.assignedDepartment || report.departmentRoute?.department || 'Unassigned'}</td><td><span className={`priority ${report.priority}`}>{report.priority}</span></td><td><span className={`status ${report.status}`}>{report.status.replace('_', ' ')}</span></td><td><span className={`status ${report.deliveryStatus || 'queued'}`}>{(report.deliveryStatus || 'queued').replace('_', ' ')}</span></td><td>{new Date(report.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <Empty title="No reports yet" text="Submit a real issue to begin its resolution workflow." path="/report" />}</div><aside className="activity-card"><h2>System health</h2><div className="health-ring"><span><strong>99.9%</strong><small>Availability</small></span></div><div className="activity-list"><div><span><ShieldCheck /></span><p><strong>Secure access</strong><small>Role-based authorization active</small></p></div><div><span><MapPin /></span><p><strong>GPS ready</strong><small>Location data is validated</small></p></div><div><span><FileImage /></span><p><strong>Evidence ready</strong><small>Photo uploads are managed</small></p></div></div></aside></div></section>;
}

function PublicReports() { return <section className="page-shell public-reports"><div className="page-title"><span className="section-kicker">Public visibility</span><h1>Community reports</h1><p>Current infrastructure concerns shared across the public reporting network.</p></div><div className="public-report-grid"><div className="public-report-main"><span><Search /></span><h2>Find an issue</h2><p>Search by ticket, category, location, or status through your authenticated dashboard.</p></div><div className="public-report-panel"><h3>Public reporting process</h3><p>Every report receives a ticket number, priority, status, and accountable route to resolution.</p><Link to="/signup">Create public account <ArrowRight /></Link></div></div></section>; }
function HowItWorks() { const steps = ['Create account', 'Submit report', 'Route to department', 'Resolve & close']; return <section className="page-shell process-page"><div className="page-title"><span className="section-kicker">Clear process</span><h1>How Public Seva works</h1></div><div className="process-grid">{steps.map((title, index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{index === 0 ? 'Public users and authorized administrators authenticate with separate roles.' : index === 1 ? 'Capture the issue, priority, coordinates, and photo evidence.' : index === 2 ? 'The concerned department receives a ticket and accountable workflow.' : 'The report is resolved, documented, and made visible through its final status.'}</p></article>)}</div></section>; }

function AppShell() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('seva-user')); } catch { return null; } });
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const notify = (message) => setToast(message);
  const logout = () => { localStorage.removeItem('seva-token'); localStorage.removeItem('seva-user'); setUser(null); navigate('/'); };
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3800); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (!user && ['/dashboard', '/admin', '/report'].includes(window.location.pathname)) navigate('/login'); }, [user, navigate]);
  const go = (path) => navigate(path);
  return <><Header user={user} logout={logout} /><main><Routes><Route path="/" element={<><Hero go={go} /><FeatureGrid /><Workflow /></>} /><Route path="/login" element={<Auth mode="login" setUser={setUser} />} /><Route path="/signup" element={<Auth mode="signup" setUser={setUser} />} /><Route path="/report" element={<ReportForm notify={notify} />} /><Route path="/dashboard" element={<Dashboard user={user} notify={notify} />} /><Route path="/admin" element={<Dashboard user={user} notify={notify} />} /><Route path="/reports" element={<PublicReports />} /><Route path="/how-it-works" element={<HowItWorks />} /></Routes></main><Footer />{toast && <div className="toast"><ShieldCheck size={18} />{toast}</div>}</>;
}

function Footer() { return <footer><Logo /><p>Resilient cities begin with visible, actionable infrastructure intelligence.</p><div className="footer-links"><a href="#privacy">Privacy</a><a href="#security">Security</a><a href="#support">Support</a></div></footer>; }
export default function App() { return <AppShell />; }
