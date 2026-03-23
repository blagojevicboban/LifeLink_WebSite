import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// === KONFIGURACIJA FIREBASE-A ===
// Zamenite ovo podacima iz vašeg Firebase projekta (Project Settings > Web App)
const firebaseConfig = {
    apiKey: "AIzaSyBKCa-ybxfSdrm4N8ow-Olh-3BSfHzs4-g",
    authDomain: "lifelink-a3581.firebaseapp.com",
    projectId: "lifelink-a3581",
    storageBucket: "lifelink-a3581.firebasestorage.app",
    messagingSenderId: "384903714979",
    appId: "1:384903714979:web:35581896791e3e518dc716"
};

// Inicijalizacija
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const devicesContainer = document.getElementById('devices-container');
const loadingOverlay = document.getElementById('loading');
const noDevicesMsg = document.getElementById('no-devices');
const connectionStatus = document.getElementById('connection-status');

// Rečnik aktivnih listenera i grafikona
const fallListeners = {};
const historyListeners = {};
const deviceCharts = {};
const deviceEnvCharts = {};

// Glavni listener za uređaje
onSnapshot(collection(db, "devices"), (snapshot) => {
    loadingOverlay.style.display = 'none';
    
    if (snapshot.empty) {
        noDevicesMsg.style.display = 'block';
        devicesContainer.innerHTML = '';
        return;
    }

    noDevicesMsg.style.display = 'none';
    connectionStatus.textContent = "Sistem Online";
    connectionStatus.className = "status-badge status-online";

    snapshot.docChanges().forEach((change) => {
        const deviceData = change.doc.data();
        const deviceId = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            updateDeviceUI(deviceId, deviceData);
            setupFallListener(deviceId);
            setupHistoryListener(deviceId);
        }
        
        if (change.type === "removed") {
            const card = document.getElementById(`device-${deviceId}`);
            if (card) card.remove();
            
            // Cleanup listeners
            if (fallListeners[deviceId]) fallListeners[deviceId]();
            if (historyListeners[deviceId]) historyListeners[deviceId]();
            if (deviceCharts[deviceId]) deviceCharts[deviceId].destroy();
            if (deviceEnvCharts[deviceId]) deviceEnvCharts[deviceId].destroy();
        }
    });
}, (error) => {
    console.error("Firestore error:", error);
    connectionStatus.textContent = "Greška u konekciji";
    connectionStatus.className = "status-badge status-offline";
});

function updateDeviceUI(id, data) {
    let card = document.getElementById(`device-${id}`);
    
    if (!card) {
        card = document.createElement('div');
        card.id = `device-${id}`;
        card.className = 'device-card';
        devicesContainer.appendChild(card);
    }

    const isOnline = data.isOnline !== false;
    card.className = `device-card ${isOnline ? '' : 'offline'}`;
    
    const sourceClass = data.uploadSource === 'wifi' ? 'source-wifi' : 'source-ble';
    const sourceText = data.uploadSource === 'wifi' ? 'WiFi Direct' : 'via App (BLE)';

    // Samo ako kartica nema grafikon sekciju, ubacujemo HTML
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
                <h3>Vreme: Puls & SpO2</h3>
                <div class="chart-container">
                    <canvas id="chart-${id}"></canvas>
                </div>
            </div>

            <div class="history-section" style="margin-top: 2rem;">
                <h3>Vreme: G-Sila & Baterija</h3>
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
        `;
        initCharts(id);
    }

    // Ažuriranje vrednosti bez osvežavanja celog HTML-a (za glatki UI)
    card.querySelector('[data-field="pulse"]').innerHTML = `${data.pulse || 0} <small>BPM</small>`;
    card.querySelector('[data-field="spo2"]').innerHTML = `${data.spo2 || 0}<small>%</small>`;
    card.querySelector('[data-field="battery"]').innerHTML = `${data.battery || 0}<small>%</small>`;
    card.querySelector('[data-field="gForce"]').innerHTML = data.gForce ? data.gForce.toFixed(2) : '0.00';
    
    const badge = card.querySelector('.status-badge');
    badge.className = `status-badge ${isOnline ? 'status-online' : 'status-offline'}`;
    badge.textContent = isOnline ? 'Online' : 'Offline';
    
    const sourceInd = card.querySelector('.source-indicator');
    sourceInd.className = `source-indicator ${sourceClass}`;
    sourceInd.querySelector('span').textContent = `Izvor: ${sourceText}`;
}

function initCharts(deviceId) {
    // 1. Chart za Puls i SpO2
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
                    pointRadius: 0
                },
                {
                    label: 'SpO2',
                    data: [],
                    borderColor: '#448aff',
                    backgroundColor: 'rgba(68, 138, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: {
                    min: 40,
                    max: 180,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#78909c', font: { size: 10 } }
                },
                y1: {
                    position: 'right',
                    min: 80,
                    max: 100,
                    display: false
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // 2. Chart za G-Silu i Bateriju
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
                    pointRadius: 0
                },
                {
                    label: 'Baterija',
                    data: [],
                    borderColor: '#00e676',
                    backgroundColor: 'rgba(0, 230, 118, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: {
                    min: 0,
                    max: 5,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#78909c', font: { size: 10 } }
                },
                y1: {
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: { display: false },
                    ticks: { color: '#78909c', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function setupHistoryListener(deviceId) {
    if (historyListeners[deviceId]) return;

    const historyQuery = query(
        collection(db, "devices", deviceId, "health_snapshots"),
        orderBy("timestamp", "desc"),
        limit(20)
    );

    historyListeners[deviceId] = onSnapshot(historyQuery, (snapshot) => {
        if (!deviceCharts[deviceId] || !deviceEnvCharts[deviceId]) return;

        const history = [];
        snapshot.forEach(doc => history.push(doc.data()));
        
        // Obrćemo jer GraphQL limit(20) vadi najnovije, a grafikon ide sleva nadesno
        history.reverse();

        const labels = history.map(d => d.timestamp ? new Date(d.timestamp.toDate()).toLocaleTimeString() : '');
        
        // Ažuriranje Health Chart (Puls & SpO2)
        deviceCharts[deviceId].data.labels = labels;
        deviceCharts[deviceId].data.datasets[0].data = history.map(d => d.pulse);
        deviceCharts[deviceId].data.datasets[1].data = history.map(d => d.spo2);
        deviceCharts[deviceId].update('none');

        // Ažuriranje Environment Chart (G-Force & Battery)
        deviceEnvCharts[deviceId].data.labels = labels;
        deviceEnvCharts[deviceId].data.datasets[0].data = history.map(d => d.gForce);
        deviceEnvCharts[deviceId].data.datasets[1].data = history.map(d => d.battery);
        deviceEnvCharts[deviceId].update('none');
    });
}

function setupFallListener(deviceId) {
    if (fallListeners[deviceId]) return;

    const fallsQuery = query(
        collection(db, "devices", deviceId, "fall_events"),
        orderBy("timestamp", "desc"),
        limit(3)
    );

    fallListeners[deviceId] = onSnapshot(fallsQuery, (snapshot) => {
        const fallContainer = document.getElementById(`falls-${deviceId}`);
        if (!fallContainer) return;

        if (snapshot.empty) {
            fallContainer.innerHTML = '<div style="opacity: 0.3; font-size: 0.8rem;">Nema zabeleženih padova</div>';
            return;
        }

        fallContainer.innerHTML = '';
        snapshot.forEach((doc) => {
            const fall = doc.data();
            const time = fall.timestamp ? new Date(fall.timestamp.toDate()).toLocaleTimeString() : 'Upravo sad';
            const date = fall.timestamp ? new Date(fall.timestamp.toDate()).toLocaleDateString() : '';
            
            const item = document.createElement('div');
            item.className = 'fall-item';
            item.innerHTML = `
                <span class="fall-time">${time} ${date}</span>
                <span>G: ${fall.gForce ? fall.gForce.toFixed(1) : '-'}</span>
            `;
            fallContainer.appendChild(item);
        });
    });
}
