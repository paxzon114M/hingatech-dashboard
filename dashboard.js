// ========== CONFIGURATION ==========
const API_BASE = 'https://hingatech-backend.onrender.com';

// ========== DOM Elements ==========
const statusBadge = document.getElementById('status-badge');
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdatedEl = document.getElementById('last-updated');
const grid = document.getElementById('grid');

// ========== Helper Functions ==========
function showSkeleton() {
  grid.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-card';
    skeleton.innerHTML = `
      <div class="skeleton-line long"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line medium"></div>
    `;
    grid.appendChild(skeleton);
  }
}

function getColorClass(value, normalMin, normalMax, warnMin, warnMax, critMin, critMax) {
  if (value < critMin || value > critMax) return 'critical';
  if (value < normalMin || value > normalMax) return 'warning';
  return 'normal';
}

function getTempClass(temp) {
  return getColorClass(temp, 15, 35, 10, 40, -40, 80);
}

function getHumidityClass(humidity) {
  return getColorClass(humidity, 40, 80, 20, 90, 0, 100);
}

function getSoilClass(soil) {
  return getColorClass(soil, 30, 70, 15, 85, 0, 100);
}

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// NEW FUNCTION: Check if device is active (last reading within 60 seconds)
function isDeviceActive(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  return seconds < 60;  // Active if less than 60 seconds old
}

// NEW FUNCTION: Get device status message
function getDeviceStatus(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (seconds < 60) {
    return '<span class="device-online">🟢 ONLINE - Sending data</span>';
  } else if (seconds < 300) {
    return '<span class="device-warning">🟡 WARNING - No data for ' + Math.floor(seconds / 60) + ' minutes</span>';
  } else {
    return '<span class="device-offline">🔴 OFFLINE - Device disconnected! Check power and Wi-Fi</span>';
  }
}

function updateLastUpdated() {
  lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// ========== API Calls with Token ==========
function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  if (!token) throw new Error('No token');
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (response.status === 401) {
    setToken(null);
    showAuthScreen();
    throw new Error('Unauthorized');
  }
  return response;
}

// ========== Dashboard Rendering ==========
async function fetchReadings() {
  if (!getToken()) return;
  try {
    statusBadge.className = 'online';
    statusBadge.textContent = '● Online';
    const response = await fetchWithAuth('/api/sensor/latest');
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    renderCards(data);
    updateLastUpdated();
  } catch (error) {
    console.error('Fetch error:', error);
    statusBadge.className = 'offline';
    statusBadge.textContent = '● Offline';
    grid.innerHTML = '<div class="error-msg">⚠️ Cannot reach server. Check your internet connection.</div>';
  }
}

function renderCards(readings) {
  if (!readings || readings.length === 0) {
    grid.innerHTML = '<div class="error-msg">📡 No sensor data yet. Waiting for device...</div>';
    return;
  }
  grid.innerHTML = '';
  readings.forEach(reading => {
    const tempClass = getTempClass(reading.temperature);
    const humidityClass = getHumidityClass(reading.humidity);
    const soilClass = getSoilClass(reading.soil_moisture);
    
    // Get device status based on last reading time
    const deviceActive = isDeviceActive(reading.recorded_at);
    const deviceStatusHtml = getDeviceStatus(reading.recorded_at);
    
    // Add warning border if device is offline
    const cardWarningClass = !deviceActive ? 'card-offline' : '';
    
    const card = document.createElement('div');
    card.className = `card ${cardWarningClass}`;
    card.innerHTML = `
      <div class="card-header">
        <div class="device-id">📟 ${reading.device_id}</div>
        <div class="last-seen">🕒 ${timeAgo(reading.recorded_at)}</div>
        <div class="device-status">${deviceStatusHtml}</div>
      </div>
      <div class="metric">
        <span class="metric-label">🌡️ Temperature</span>
        <span class="metric-value ${tempClass}">${reading.temperature.toFixed(1)}°C</span>
      </div>
      <div class="metric">
        <span class="metric-label">💧 Humidity</span>
        <span class="metric-value ${humidityClass}">${reading.humidity.toFixed(0)}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">🌱 Soil Moisture</span>
        <span class="metric-value ${soilClass}">${reading.soil_moisture}%</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ========== Authentication ==========
async function register(email, password, name) {
  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      registerError.textContent = data.error || 'Registration failed';
      return false;
    }
    setToken(data.token);
    return true;
  } catch (err) {
    registerError.textContent = 'Network error';
    return false;
  }
}

async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      loginError.textContent = data.error || 'Login failed';
      return false;
    }
    setToken(data.token);
    return true;
  } catch (err) {
    loginError.textContent = 'Network error';
    return false;
  }
}

function logout() {
  setToken(null);
  showAuthScreen();
}

function showDashboard() {
  authContainer.style.display = 'none';
  dashboardContainer.style.display = 'block';
  logoutBtn.style.display = 'block';
  showSkeleton();
  fetchReadings();
  if (window.refreshInterval) clearInterval(window.refreshInterval);
  window.refreshInterval = setInterval(fetchReadings, 10000);
}

function showAuthScreen() {
  if (window.refreshInterval) clearInterval(window.refreshInterval);
  authContainer.style.display = 'flex';
  dashboardContainer.style.display = 'none';
  logoutBtn.style.display = 'none';
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  if (loginError) loginError.textContent = '';
  if (registerError) registerError.textContent = '';
}

// ========== Event Listeners ==========
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const logoutBtn = document.getElementById('logout-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');

if (loginTab && registerTab) {
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  });

  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    loginError.textContent = '';
    const success = await login(email, password);
    if (success) showDashboard();
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    registerError.textContent = '';
    if (password.length < 8) {
      registerError.textContent = 'Password must be at least 8 characters';
      return;
    }
    const success = await register(email, password, name);
    if (success) showDashboard();
  });
}

if (logoutBtn) logoutBtn.addEventListener('click', logout);

// ========== Initial Check ==========
if (getToken()) {
  showDashboard();
} else {
  showAuthScreen();
}
