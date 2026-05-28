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

// Check if device is active (last reading within 60 seconds)
function isDeviceActive(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  return seconds < 60;
}

// Get device status message
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

// ========== Fetch Data from Backend ==========
async function fetchReadings() {
  try {
    statusBadge.className = 'online';
    statusBadge.textContent = '● Online';
    const response = await fetch(`${API_BASE}/api/sensor/latest`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderCards(data);
    updateLastUpdated();
  } catch (error) {
    console.error('Fetch error:', error);
    statusBadge.className = 'offline';
    statusBadge.textContent = '● Offline';
    grid.innerHTML = '<div class="error-msg">⚠️ Cannot reach server. Make sure the backend is running.</div>';
  }
}

function renderCards(readings) {
  if (!readings || readings.length === 0) {
    grid.innerHTML = '<div class="error-msg">📡 No sensor data yet. Waiting for your ESP8266 device...</div>';
    return;
  }
  grid.innerHTML = '';
  readings.forEach(reading => {
    const tempClass = getTempClass(reading.temperature);
    const humidityClass = getHumidityClass(reading.humidity);
    const soilClass = getSoilClass(reading.soil_moisture);
    const deviceActive = isDeviceActive(reading.recorded_at);
    const deviceStatusHtml = getDeviceStatus(reading.recorded_at);
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

// ========== Auto Refresh ==========
let refreshInterval;

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(fetchReadings, 10000);
}

// ========== Manual Refresh ==========
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    showSkeleton();
    fetchReadings();
  });
}

// ========== Initial Load ==========
showSkeleton();
fetchReadings();
startAutoRefresh();
// Fetch and display alerts
async function fetchAlerts() {
    try {
        const response = await fetch(`${API_BASE}/api/alerts/active`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch alerts');
        const alerts = await response.json();
        displayAlerts(alerts);
    } catch (error) {
        console.error('Alert fetch error:', error);
    }
}

function displayAlerts(alerts) {
    const container = document.getElementById('alerts-container');
    const alertCount = document.getElementById('alert-count');
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<div class="no-alerts">✅ No active alerts. All conditions are good!</div>';
        if (alertCount) alertCount.textContent = '0';
        return;
    }
    
    if (alertCount) alertCount.textContent = alerts.length;
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item alert-${alert.severity}">
            <div class="alert-message">
                <div class="alert-title">${alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ CAUTION'}: ${alert.type.replace('_', ' ').toUpperCase()}</div>
                <div class="alert-text">${alert.message}</div>
                <div class="alert-time">${alert.farm_name || 'Farm'} • ${timeAgo(alert.created_at)}</div>
            </div>
            <button class="acknowledge-btn" onclick="acknowledgeAlert(${alert.id})">✓ Acknowledge</button>
        </div>
    `).join('');
}

async function acknowledgeAlert(alertId) {
    try {
        const response = await fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (response.ok) {
            fetchAlerts(); // Refresh alerts list
        }
    } catch (error) {
        console.error('Error acknowledging alert:', error);
    }
}

// Add to your existing loadDashboard or fetchReadings function
// Call fetchAlerts() alongside fetchReadings()

// Fetch and display alerts
async function fetchAlerts() {
    try {
        const response = await fetch(`${API_BASE}/api/alerts/active`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch alerts');
        const alerts = await response.json();
        displayAlerts(alerts);
    } catch (error) {
        console.error('Alert fetch error:', error);
    }
}

function displayAlerts(alerts) {
    const container = document.getElementById('alerts-container');
    const alertCount = document.getElementById('alert-count');
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<div class="no-alerts">✅ No active alerts. All conditions are good!</div>';
        if (alertCount) alertCount.textContent = '0';
        return;
    }
    
    if (alertCount) alertCount.textContent = alerts.length;
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item alert-${alert.severity}">
            <div class="alert-message">
                <div class="alert-title">${alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ CAUTION'}: ${alert.type.replace('_', ' ').toUpperCase()}</div>
                <div class="alert-text">${alert.message}</div>
                <div class="alert-time">${alert.farm_name || 'Farm'} • ${timeAgo(alert.created_at)}</div>
            </div>
            <button class="acknowledge-btn" onclick="acknowledgeAlert(${alert.id})">✓ Acknowledge</button>
        </div>
    `).join('');
}

async function acknowledgeAlert(alertId) {
    try {
        const response = await fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (response.ok) {
            fetchAlerts(); // Refresh alerts list
        }
    } catch (error) {
        console.error('Error acknowledging alert:', error);
    }
}

// Add to your existing loadDashboard or fetchReadings function
// Call fetchAlerts() alongside fetchReadings()
