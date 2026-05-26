// ========== CONFIGURATION ==========
// Change this to your backend URL (the one running on your computer)
const API_BASE = 'http://localhost:3000';

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
            <div class="skeleton-line" style="width:80%"></div>
            <div class="skeleton-line" style="width:40%"></div>
            <div class="skeleton-line" style="width:60%"></div>
        `;
        grid.appendChild(skeleton);
    }
}

function getTempClass(temp) {
    if (temp < 10 || temp > 40) return 'critical';
    if (temp < 15 || temp > 35) return 'warning';
    return 'normal';
}

function getHumidityClass(h) {
    if (h < 20 || h > 90) return 'critical';
    if (h < 40 || h > 80) return 'warning';
    return 'normal';
}

function getSoilClass(s) {
    if (s < 15 || s > 85) return 'critical';
    if (s < 30 || s > 70) return 'warning';
    return 'normal';
}

function timeAgo(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
}

// ========== Fetch Data ==========
async function fetchReadings() {
    try {
        statusBadge.className = 'online';
        statusBadge.textContent = '● Online';
        const response = await fetch(`${API_BASE}/api/sensor/latest`);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        renderCards(data);
        lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error(err);
        statusBadge.className = 'offline';
        statusBadge.textContent = '● Offline';
        grid.innerHTML = `<div class="error-msg">⚠️ Cannot reach server at ${API_BASE}</div>`;
    }
}

function renderCards(readings) {
    if (!readings || readings.length === 0) {
        grid.innerHTML = '<div class="error-msg">📡 No sensor data yet. Waiting for ESP8266...</div>';
        return;
    }
    grid.innerHTML = '';
    readings.forEach(r => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div class="device-id">📟 ${r.device_id}</div>
                <div class="last-seen">🕒 ${timeAgo(r.recorded_at)}</div>
            </div>
            <div class="metric">
                <span>🌡️ Temperature</span>
                <span class="metric-value ${getTempClass(r.temperature)}">${r.temperature.toFixed(1)}°C</span>
            </div>
            <div class="metric">
                <span>💧 Humidity</span>
                <span class="metric-value ${getHumidityClass(r.humidity)}">${r.humidity.toFixed(0)}%</span>
            </div>
            <div class="metric">
                <span>🌱 Soil Moisture</span>
                <span class="metric-value ${getSoilClass(r.soil_moisture)}">${r.soil_moisture}%</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

refreshBtn.addEventListener('click', () => {
    showSkeleton();
    fetchReadings();
});

// Auto-refresh every 10 seconds
showSkeleton();
fetchReadings();
setInterval(fetchReadings, 10000);