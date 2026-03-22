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

// Rečnik aktivnih listenera za padove kako bi izbegli dupliranje
const fallListeners = {};

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
        }
        
        if (change.type === "removed") {
            const card = document.getElementById(`device-${deviceId}`);
            if (card) card.remove();
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
                <div class="metric-value">${data.pulse || 0} <small>BPM</small></div>
            </div>
            <div class="metric-box metric-spo2">
                <div class="metric-label">💧 SpO2</div>
                <div class="metric-value">${data.spo2 || 0}<small>%</small></div>
            </div>
            <div class="metric-box metric-battery">
                <div class="metric-label">🔋 Baterija</div>
                <div class="metric-value">${data.battery || 0}<small>%</small></div>
            </div>
            <div class="metric-box">
                <div class="metric-label">📉 G-Sila</div>
                <div class="metric-value">${data.gForce ? data.gForce.toFixed(2) : '0.00'}</div>
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
