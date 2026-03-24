import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, limit, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js";

// === KONFIGURACIJA FIREBASE-A ===
// Zamenite ovo podacima iz vašeg Firebase projekta (Project Settings > Web App)
const firebaseConfig = {
    apiKey: "BIf5p9mZamyZwcbTwA93-tEGK_lOiAHyDwyUuOW-4yaf2NrZH2GJhosqy0SIa3gR3vXb8JmJ5cvDACXctc_-iP8",
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
const notifyPill = document.getElementById('notify-pill');

// Messaging
const messaging = getMessaging(app);

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

// Rečnik aktivnih listenera i grafikona
const fallListeners = {};
const historyListeners = {};
const deviceCharts = {};
const deviceEnvCharts = {};
const deviceMaps = {};
const deviceMarkers = {};

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
            if (deviceMaps[deviceId]) {
                deviceMaps[deviceId].remove();
                delete deviceMaps[deviceId];
            }
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

    // Update markers from device doc (Mainly Phone location)
    updateMarkers(id, data);
}

function initMap(deviceId, data) {
    const mapElement = document.getElementById(`map-${deviceId}`);
    if (!mapElement || deviceMaps[deviceId]) return;

    // Use default coordinates if none provided (e.g., Belgrade)
    const lat = data.lat || 44.7866;
    const lon = data.lon || 20.4489;

    const map = L.map(`map-${deviceId}`).setView([lat, lon], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    deviceMaps[deviceId] = map;
    deviceMarkers[deviceId] = {
        watch: null,
        phone: null
    };

    updateMarkers(deviceId, data);
}

function updateMarkers(deviceId, data) {
    const map = deviceMaps[deviceId];
    if (!map) return;

    // 1. Update Watch Marker
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

    // 2. Update Phone Marker
    if (data.phoneLat && data.phoneLon) {
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

    // Auto-pan if markers exist and are valid
    const group = [];
    if (deviceMarkers[deviceId].watch) group.push(deviceMarkers[deviceId].watch.getLatLng());
    if (deviceMarkers[deviceId].phone) group.push(deviceMarkers[deviceId].phone.getLatLng());
    
    if (group.length > 0) {
        const bounds = L.latLngBounds(group);
        if (group.length === 1) {
            map.panTo(group[0]);
        } else {
            map.fitBounds(bounds, { padding: [30, 30] });
        }
    }
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
                legend: { display: false },
                annotation: {
                    annotations: {
                        pulseRange: {
                            type: 'box',
                            yScaleID: 'y',
                            yMin: 60,
                            yMax: 100,
                            backgroundColor: 'rgba(255, 82, 82, 0.03)',
                            borderWidth: 0,
                            label: {
                                display: true,
                                content: 'Normal (60-100)',
                                position: 'start',
                                color: 'rgba(255, 82, 82, 0.4)',
                                font: { size: 9 }
                            }
                        },
                        spo2Range: {
                            type: 'box',
                            yScaleID: 'y1',
                            yMin: 95,
                            yMax: 100,
                            backgroundColor: 'rgba(68, 138, 255, 0.03)',
                            borderWidth: 0,
                            label: {
                                display: true,
                                content: 'Saturacija (95+)',
                                position: 'end',
                                color: 'rgba(68, 138, 255, 0.4)',
                                font: { size: 9 }
                            }
                        }
                    }
                }
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

        // Check for GPS in snapshots (for WiFi uploads)
        const latestSnapshot = history[history.length - 1];
        if (latestSnapshot && latestSnapshot.lat && latestSnapshot.lon) {
            updateMarkers(deviceId, { 
                lat: latestSnapshot.lat, 
                lon: latestSnapshot.lon 
            });
        }

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

// === PUSH NOTIFICATIONS ===
window.requestNotifications = async function() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Zameni sa tvojim VAPID ključem iz Firebase konzole
            const vapidKey = 'Blf5p9mZamyZwcbTwA93-tEGK_lOiAHyDwyUuOW-4yaf2NrZH2GJhosqyOSla3gR3vXb8JmJ5cVDACXctc_-iP8'; 
            
            const token = await getToken(messaging, { vapidKey });
            
            if (token) {
                console.log("FCM Token:", token);
                await setDoc(doc(db, "fcm_tokens", token), {
                    platform: "web",
                    lastUpdated: new Date(),
                    active: true
                });
                
                notifyPill.classList.add('active');
                notifyPill.innerHTML = '<i class="fas fa-check-circle"></i> Aktivne';
                alert("Uspešno ste aktivirali notifikacije za hitne slučajeve!");
            }
        } else {
            alert("Morate dozvoliti notifikacije u pretraživaču.");
        }
    } catch (error) {
        console.error("Greška kod notifikacija:", error);
        alert("Došlo je do greške prilikom aktivacije. Proverite VAPID ključ.");
    }
};

onMessage(messaging, (payload) => {
    console.log('Poruka primljena u foreground-u: ', payload);
    const { title, body } = payload.notification;
    new Notification(title, { body, icon: '../img/favicon.png' });
});

// === PWA SERVICE WORKER REGISTRATION ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('LifeLink SW Registered!', reg))
            .catch(err => console.log('SW Registration Failed:', err));
    });
}
