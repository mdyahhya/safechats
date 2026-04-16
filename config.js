// ============================================================
// Safe Chats – config.js | Supabase + Shared Utilities
// Developer: Yahya Mundewadi (yahya.in)
// ============================================================

// ⚠️ Replace with your actual Supabase project values
const SUPABASE_URL = 'https://rzfsrczlfwqiomxtzpht.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZnNyY3psZndxaW9teHR6cGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzQ0NzgsImV4cCI6MjA5MTkxMDQ3OH0.wXqftd4f9PZbZgqqm814qJ6RVKj5RUq7gXUvzwjV_wY';

// VAPID public key from your push notification setup (see guide below)
const VAPID_PUBLIC_KEY = 'BELCT0Uy_yvenQQKIYhnICRbfpaLvbM5qK75aIPasNZR7f8WRKE94op6WyyfWleRpDNuoGGnUMTkXX2P7mgoBbU';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// AUTH HELPERS
// ============================================================
async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const { data } = await sb.from('users').select('*').eq('auth_id', session.user.id).single();
  return data;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = 'profile.html'; return null; }
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'profile.html'; return null; }
  return user;
}

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================
const LS = {
  set(key, val) { localStorage.setItem('sc_' + key, JSON.stringify(val)); },
  get(key) { try { return JSON.parse(localStorage.getItem('sc_' + key)); } catch { return null; } },
  remove(key) { localStorage.removeItem('sc_' + key); },
  setUser(user) { this.set('user', user); },
  getUser() { return this.get('user'); },
  setChatHistory(chatId, msgs) { this.set('chat_' + chatId, msgs); },
  getChatHistory(chatId) { return this.get('chat_' + chatId) || []; },
  appendMessage(chatId, msg) {
    const msgs = this.getChatHistory(chatId);
    if (!msgs.find(m => m.id === msg.id)) {
      msgs.push(msg);
      if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
      this.setChatHistory(chatId, msgs);
    }
  }
};

// ============================================================
// TIME FORMAT
// ============================================================
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 604800000) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// AVATAR INITIALS FALLBACK
// ============================================================
function avatarInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  const colors = ['#2d2d2d', '#1a1a2e', '#16213e', '#0f3460', '#533483', '#2b2d42'];
  let hash = 0;
  for (let c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function renderAvatar(name, avatar, size = 42) {
  if (avatar) return `<img src="${avatar}" alt="${name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
  const bg = avatarColor(name);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:${Math.floor(size * 0.35)}px;flex-shrink:0;">${avatarInitials(name)}</div>`;
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function toast(msg, type = 'info') {
  let el = document.getElementById('sc-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sc-toast';
    el.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:24px;font-size:13px;font-weight:600;z-index:9999;transition:opacity 0.3s;pointer-events:none;`;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'error' ? '#e53935' : type === 'success' ? '#1b5e20' : '#111';
  el.style.color = '#fff';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2800);
}

// ============================================================
// NO CACHE SERVICE WORKER UPDATE CHECK
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available — force reload
          nw.postMessage({ type: 'SKIP_WAITING' });
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
        }
      });
    });
  });
}
