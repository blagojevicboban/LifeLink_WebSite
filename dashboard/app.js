

// Firebase removed. System now uses direct MariaDB polling.

const devicesContainer = document.getElementById('devices-container');
const loadingOverlay = document.getElementById('loading');
const noDevicesMsg = document.getElementById('no-devices');
const connectionStatus = document.getElementById('connection-status');
const notifyPill = document.getElementById('notify-pill');

// Rečnik aktivnih grafikona i mapa
const deviceCharts = {};
const deviceEnvCharts = {};
const deviceMaps = {};
const deviceMarkers = {};
const deviceRanges = {}; 

window.toggleHelp = function() {
    const modal = document.getElementById('help-modal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
};

window.onclick = function(event) {
    const modal = document.getElementById('help-modal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// === POLL DEVICES (ZAMENA ZA onSnapshot) ===
async function pollDevices() {
    try {
        const response = await fetch('../api/get_data.php?action=devices');
        const devices = await response.json();
        
        loadingOverlay.style.display = 'none';
        
        if (!devices || devices.length === 0) {
            noDevicesMsg.style.display = 'block';
            devicesContainer.innerHTML = '';
            return;
        }

        noDevicesMsg.style.display = 'none';
        connectionStatus.textContent = "Sistem Online";
        connectionStatus.className = "status-badge status-online";

        // Mapiramo trenutno prikazane uređaje da bismo znali šta da uklonimo
        const currentIds = Array.from(devicesContainer.children).map(c => c.id.replace('device-', ''));
        const newIds = devices.map(d => d.device_id);

        // Ukloni uređaje kojih više nema u bazi
        currentIds.forEach(id => {
            if (!newIds.includes(id)) {
                const card = document.getElementById(`device-${id}`);
                if (card) card.remove();
                cleanupDeviceResources(id);
            }
        });

        // Dodaj ili ažuriraj uređaje
        devices.forEach(device => {
            updateDeviceUI(device.device_id, device);
        });

    } catch (error) {
        console.error("API Error:", error);
        connectionStatus.textContent = "Greška u konekciji";
        connectionStatus.className = "status-badge status-offline";
    }
}

// Pokreni polling svakih 5 sekundi
setInterval(pollDevices, 5000);
pollDevices(); // Prvi poziv odmah

function cleanupDeviceResources(id) {
    if (deviceCharts[id]) deviceCharts[id].destroy();
    if (deviceEnvCharts[id]) deviceEnvCharts[id].destroy();
    if (deviceMaps[id]) {
        deviceMaps[id].remove();
        delete deviceMaps[id];
    }
}

function updateDeviceUI(id, data) {
    let card = document.getElementById(`device-${id}`);
    
    if (!card) {
        card = document.createElement('div');
        card.id = `device-${id}`;
        card.className = 'device-card';
        devicesContainer.appendChild(card);
        
        // Postavi inicijalni range
        deviceRanges[id] = '1h';
    }

    const isOnline = parseInt(data.isOnline) === 1;
    card.className = `device-card ${isOnline ? '' : 'offline'}`;
    
    const sourceClass = data.source === 'wifi' ? 'source-wifi' : 'source-ble';
    const sourceText = data.source === 'wifi' ? 'WiFi Direct' : 'via App (BLE)';

    if (!card.querySelector('.chart-container')) {
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="device-name">${data.name || 'LifeLink Sat'}</div>
                    <div class="device-id">ID: ${id}</div>
                </div>
                <div class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
                    ${isOnline ? 'Online' : 'Offline'}
                </div>
            </div>

            <div class="metrics-row">
                <div class="metric-box metric-pulse">
                    <div class="metric-label">❤️ Puls</div>
                    <div class="metric-value" data-field="pulse">--</div>
                </div>
                <div class="metric-box metric-spo2">
                    <div class="metric-label">💧 SpO2</div>
                    <div class="metric-value" data-field="spo2">--</div>
                </div>
                <div class="metric-box metric-battery">
                    <div class="metric-label">🔋 Baterija</div>
                    <div class="metric-value" data-field="battery">--</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">📉 G-Sila</div>
                    <div class="metric-value" data-field="gForce">--</div>
                </div>
            </div>

            <div class="history-section">
                <div class="section-header">
                    <h3><span style="color: #ff5252">Puls</span></h3>
                    <h3><span style="color: #448aff">SpO2</span></h3>
                </div>
                <div class="chart-container">
                    <canvas id="chart-${id}"></canvas>
                </div>
            </div>

            <div class="time-zoom-wrapper">
                <div class="time-controls" data-device-id="${id}">
                    <button class="time-btn active" data-range="1h">1h</button>
                    <button class="time-btn" data-range="today">Danas</button>
                    <button class="time-btn" data-range="1w">7d</button>
                    <button class="time-btn" data-range="1m">30d</button>
                </div>
            </div>

            <div class="history-section">
                <div class="section-header">
                    <h3><span style="color: #00e5ff">G-Sila</span></h3>
                    <h3><span style="color: #00e676">Baterija</span></h3>
                </div>
                <div class="chart-container">
                    <canvas id="chart-env-${id}"></canvas>
                </div>
            </div>

            <div class="source-indicator ${sourceClass}">
                <div class="source-icon"></div>
                <span>Izvor: ${sourceText}</span>
            </div>
            <div class="fall-history">
                <h3>Nedavni Padovi</h3>
                <div id="falls-${id}">
                    <div style="opacity: 0.5; font-size: 0.8rem;">Provera istorije...</div>
                </div>
            </div>

            <div class="monitor-guide">
                <h3>Uputstvo za Live Monitor</h3>
                <div class="guide-grid">
                    <div class="guide-item">
                        <span class="guide-label"><i class="fas fa-heartbeat"></i> Puls</span>
                        <span class="guide-text">60-100 BPM</span>
                    </div>
                    <div class="guide-item">
                        <span class="guide-label"><i class="fas fa-tint"></i> SpO2</span>
                        <span class="guide-text">95-100%</span>
                    </div>
                    <div class="guide-item">
                        <span class="guide-label"><i class="fas fa-clock" style="color: var(--accent);"></i> Plavo</span>
                        <span class="guide-text">Sat</span>
                    </div>
                    <div class="guide-item">
                        <span class="guide-label"><i class="fas fa-mobile-screen" style="color: var(--success);"></i> Zeleno</span>
                        <span class="guide-text">Telefon</span>
                    </div>
                </div>
            </div>

            <div class="map-section">
                <h3><i class="fas fa-map-location-dot"></i> Lokacija (Sat i Telefon)</h3>
                <div id="map-${id}" class="map-container"></div>
            </div>
        `;
        initCharts(id);
        initMap(id, data);
        
        // Inicijalno učitavanje istorije i padova
        fetchHistory(id, deviceRanges[id]);
        fetchFalls(id);
    }

    card.querySelector('[data-field="pulse"]').innerHTML = `${data.pulse || 0} <small>BPM</small>`;
    card.querySelector('[data-field="spo2"]').innerHTML = `${data.spo2 || 0}<small>%</small>`;
    card.querySelector('[data-field="battery"]').innerHTML = `${data.battery || 0}<small>%</small>`;
    card.querySelector('[data-field="gForce"]').innerHTML = data.gForce ? parseFloat(data.gForce).toFixed(2) : '0.00';
    
    const badge = card.querySelector('.status-badge');
    badge.className = `status-badge ${isOnline ? 'status-online' : 'status-offline'}`;
    badge.textContent = isOnline ? 'Online' : 'Offline';
    
    const sourceInd = card.querySelector('.source-indicator');
    sourceInd.className = `source-indicator ${sourceClass}`;
    sourceInd.querySelector('span').textContent = `Izvor: ${sourceText}`;

    updateMarkers(id, data);

    const timeButtons = card.querySelectorAll('.time-btn');
    timeButtons.forEach(btn => {
        if (!btn.hasListener) {
            btn.onclick = () => {
                const range = btn.dataset.range;
                deviceRanges[id] = range;
                timeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                fetchHistory(id, range);
            };
            btn.hasListener = true;
        }
    });

    // Osveži istoriju Periodično ako smo na range-u 1h
    if (!card.historyPoller) {
        card.historyPoller = setInterval(() => {
            if (deviceRanges[id] === '1h') {
                fetchHistory(id, '1h');
                fetchFalls(id);
            }
        }, 15000); // Svakih 15 sekundi osveži grafikone ako je 1h pogled
    }
}

async function fetchHistory(deviceId, range = '1h') {
    try {
        const response = await fetch(`../api/get_data.php?action=history&device_id=${deviceId}&range=${range}`);
        let history = await response.json();
        
        if (!deviceCharts[deviceId] || !deviceEnvCharts[deviceId]) return;
        
        // SQL vraća desc (najnoviji prvo), reversujemo za grafikone
        history = history.reverse();
        
        const labels = history.map(d => {
            const dt = new Date(d.timestamp);
            if (range === '1h' || range === 'today') return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return dt.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        
        deviceCharts[deviceId].data.labels = labels;
        deviceCharts[deviceId].data.datasets[0].data = history.map(d => d.pulse);
        deviceCharts[deviceId].data.datasets[1].data = history.map(d => d.spo2);
        deviceCharts[deviceId].update('none');

        deviceEnvCharts[deviceId].data.labels = labels;
        deviceEnvCharts[deviceId].data.datasets[0].data = history.map(d => d.gForce);
        deviceEnvCharts[deviceId].data.datasets[1].data = history.map(d => d.battery);
        deviceEnvCharts[deviceId].update('none');
    } catch (e) {
        console.error("History error:", e);
    }
}

async function fetchFalls(deviceId) {
    try {
        const response = await fetch(`../api/get_data.php?action=falls&device_id=${deviceId}`);
        const falls = await response.json();
        const fallContainer = document.getElementById(`falls-${deviceId}`);
        if (!fallContainer) return;

        if (!falls || falls.length === 0) {
            fallContainer.innerHTML = '<div style="opacity: 0.3; font-size: 0.8rem;">Nema zabeleženih padova</div>';
            return;
        }

        fallContainer.innerHTML = '';
        falls.forEach((fall) => {
            const dt = new Date(fall.timestamp);
            const item = document.createElement('div');
            item.className = 'fall-item';
            item.innerHTML = `
                <span class="fall-time">${dt.toLocaleTimeString()} ${dt.toLocaleDateString()}</span>
                <span>G: ${fall.gForce ? parseFloat(fall.gForce).toFixed(1) : '-'}</span>
            `;
            fallContainer.appendChild(item);
        });
    } catch (e) {
        console.error("Falls error:", e);
    }
}

function initMap(deviceId, data) {
    const mapElement = document.getElementById(`map-${deviceId}`);
    if (!mapElement || deviceMaps[deviceId]) return;

    const lat = data.lat || 44.7866;
    const lon = data.lon || 20.4489;

    const map = L.map(`map-${deviceId}`).setView([lat, lon], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    deviceMaps[deviceId] = map;
    deviceMarkers[deviceId] = { watch: null, phone: null };
    updateMarkers(deviceId, data);
}

function updateMarkers(deviceId, data) {
    const map = deviceMaps[deviceId];
    if (!map) return;

    if (data.lat && data.lon) {
        if (!deviceMarkers[deviceId].watch) {
            const watchIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="marker-watch"><i class="fas fa-clock"></i><div class="marker-label">SAT</div></div>`,
                iconSize: [30, 42],
                iconAnchor: [15, 42]
            });
            deviceMarkers[deviceId].watch = L.marker([data.lat, data.lon], { icon: watchIcon }).addTo(map);
        } else {
            deviceMarkers[deviceId].watch.setLatLng([data.lat, data.lon]);
        }
    }

    if (data.phoneLat && data.phoneLon) { // MariaDB bi mogao imati phoneLat polja ako ih dodamo
        if (!deviceMarkers[deviceId].phone) {
            const phoneIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="marker-phone"><i class="fas fa-mobile-screen"></i><div class="marker-label">TEL</div></div>`,
                iconSize: [30, 42],
                iconAnchor: [15, 42]
            });
            deviceMarkers[deviceId].phone = L.marker([data.phoneLat, data.phoneLon], { icon: phoneIcon }).addTo(map);
        } else {
            deviceMarkers[deviceId].phone.setLatLng([data.phoneLat, data.phoneLon]);
        }
    }

    const group = [];
    if (deviceMarkers[deviceId].watch) group.push(deviceMarkers[deviceId].watch.getLatLng());
    if (group.length > 0) map.panTo(group[0]);
}

function initCharts(deviceId) {
    const ctxHealth = document.getElementById(`chart-${deviceId}`).getContext('2d');
    deviceCharts[deviceId] = new Chart(ctxHealth, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Puls',
                    data: [],
                    borderColor: '#ff5252',
                    backgroundColor: 'rgba(255, 82, 82, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    radius: 0
                },
                {
                    label: 'SpO2',
                    data: [],
                    borderColor: '#448aff',
                    backgroundColor: 'rgba(68, 138, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    radius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#78909c', font: { size: 9 }, maxTicksLimit: 6 } },
                y: { min: 40, max: 180, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#78909c' } },
                y1: { position: 'right', min: 80, max: 100, ticks: { color: '#78909c' } }
            },
            plugins: { legend: { display: false } }
        }
    });

    const ctxEnv = document.getElementById(`chart-env-${deviceId}`).getContext('2d');
    deviceEnvCharts[deviceId] = new Chart(ctxEnv, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'G-Sila',
                    data: [],
                    borderColor: '#00e5ff',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    radius: 0
                },
                {
                    label: 'Baterija',
                    data: [],
                    borderColor: '#00e676',
                    backgroundColor: 'rgba(0, 230, 118, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    radius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#78909c', font: { size: 9 }, maxTicksLimit: 6 } },
                y: { min: 0, max: 5, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#78909c' } },
                y1: { position: 'right', min: 0, max: 100, ticks: { color: '#78909c' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// === PUSH NOTIFICATIONS ===
window.requestNotifications = async function() {
    alert("Notifikacije trenutno nisu dostupne nakon migracije sa Firebase-a.");
};


// === PWA INSTALL PROMPT ===
let deferredPrompt;
const installPill = document.getElementById('install-pill');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installPill.style.display = 'flex';
});

window.installPWA = async function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    deferredPrompt = null;
    installPill.style.display = 'none';
};

window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    installPill.style.display = 'none';
});

// === PWA SERVICE WORKER REGISTRATION ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('LifeLink SW Registered!', reg))
            .catch(err => console.log('SW Registration Failed:', err));
    });
}
