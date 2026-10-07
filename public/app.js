// Frontend logic (alag file kyunke helmet inline scripts block kar deta hai)
const ROUTES = {
  login:    '/api/v1/auth/login',
  register: '/api/v1/auth/register',
  refresh:  '/api/v1/auth/refresh',
  logout:   '/api/v1/auth/logout',
  google:   '/auth/google',
  github:   '/auth/github',
  profile:  '/api/v1/employees/profile',
  payroll:  '/api/v1/payroll/approve',
  users:    '/api/v1/users'
};

let accessToken = null; // sirf memory mein (XSS se bachne ke liye localStorage use nahi kiya)

const $ = (id) => document.getElementById(id);
const out = $('output');
const statusEl = $('status');

function show(data) { out.textContent = JSON.stringify(data, null, 2); }

function decodeJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return null; }
}

function setToken(token) {
  accessToken = token || null;
  const u = token ? decodeJwt(token) : null;
  statusEl.textContent = u ? `Logged in as ${u.name || u.email} (${u.role})` : 'Not logged in';
}

async function request(method, url, body, useAuth) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && accessToken) headers.Authorization = 'Bearer ' + accessToken;
  const res = await fetch(url, {
    method, headers, credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  });
  let data;
  try { data = await res.json(); } catch { data = { message: res.statusText }; }
  return { status: res.status, ok: res.ok, data };
}

async function login() {
  const r = await request('POST', ROUTES.login, { email: $('email').value, password: $('password').value });
  if (r.ok) setToken(r.data.accessToken);
  show({ status: r.status, ...r.data });
}

async function registerUser() {
  const email = $('email').value;
  const r = await request('POST', ROUTES.register, { name: email.split('@')[0], email, password: $('password').value });
  show({ status: r.status, ...r.data });
}

async function logout() {
  const r = await request('POST', ROUTES.logout);
  setToken(null);
  show({ status: r.status, ...r.data });
}

async function refreshToken() {
  const r = await request('POST', ROUTES.refresh);
  if (r.ok) setToken(r.data.accessToken);
  show({ status: r.status, ...r.data });
}

async function callApi(method, url) {
  const r = await request(method, url, null, true);
  show({ status: r.status, ...r.data });
}

$('btn-login').addEventListener('click', login);
$('btn-register').addEventListener('click', registerUser);
$('btn-logout').addEventListener('click', logout);
$('btn-google').addEventListener('click', () => { location.href = ROUTES.google; });
$('btn-github').addEventListener('click', () => { location.href = ROUTES.github; });
$('btn-refresh').addEventListener('click', refreshToken);
$('btn-profile').addEventListener('click', () => callApi('GET', ROUTES.profile));
$('btn-payroll').addEventListener('click', () => callApi('POST', ROUTES.payroll));
$('btn-users').addEventListener('click', () => callApi('GET', ROUTES.users));

// OAuth ke baad URL mein ?token=... aata hai: utha lo aur URL saaf kar do
const params = new URLSearchParams(location.search);
if (params.get('token')) {
  setToken(params.get('token'));
  history.replaceState({}, '', location.pathname);
  show({ message: 'OAuth login successful' });
} else if (params.get('error')) {
  show({ message: 'OAuth login failed: ' + params.get('error') });
  history.replaceState({}, '', location.pathname);
} else {
  // Page reload par refresh cookie se session wapas lao (agar cookie maujood ho)
  request('POST', ROUTES.refresh).then((r) => { if (r.ok) setToken(r.data.accessToken); });
}
