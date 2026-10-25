/**
 * RakshaPulse - 112 ERSS Police Command Center
 * Real-time GIS Radar Map, Automated Patrol Unit Interception & Telemetry
 */

let map = null;
let victimMarker = null;
let victimCircle = null;
let patrolMarkers = {};
let routePolyline = null;

let currentIncident = {
  id: 'SOS-SAMPLE',
  userName: 'Ananya Sharma',
  heartRate: 158,
  hrv: 12,
  fearIndex: 0.91,
  time24h: '23:42:18',
  address: 'Barakhamba Road, Connaught Place, New Delhi',
  latitude: 28.6139,
  longitude: 77.2090,
  audioMessage: 'EMERGENCY: Women safety alert from RakshaPulse. Physiological acute fear detected at Barakhamba Road, Connaught Place. Immediate police dispatch requested.'
};

let patrolUnits = [
  {
    id: 'PCR-112-ALPHA',
    callsign: 'PCR Van 14 (Central Sector)',
    officer: 'SI Rajesh Verma',
    contact: '+91 98112 00114',
    lat: 28.6219,
    lng: 77.2040,
    status: 'AVAILABLE',
    vehicleType: 'car'
  },
  {
    id: 'PCR-112-BRAVO',
    callsign: 'PCR Van 08 (Women Safety Squad)',
    officer: 'ASI Meena Kumari',
    contact: '+91 98112 00108',
    lat: 28.6019,
    lng: 77.2160,
    status: 'AVAILABLE',
    vehicleType: 'car'
  },
  {
    id: 'PCR-112-CHARLIE',
    callsign: 'PCR Motor-Bike 22 (Rapid Interceptor)',
    officer: 'Constable Amit Singh',
    contact: '+91 98112 00122',
    lat: 28.6179,
    lng: 77.2200,
    status: 'AVAILABLE',
    vehicleType: 'bike'
  }
];

// Initialize Leaflet Map
function initMap() {
  const defaultCenter = [currentIncident.latitude, currentIncident.longitude];
  map = L.map('policeMap').setView(defaultCenter, 14);

  // High-contrast Dark Tile Layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  renderVictimPin(currentIncident.latitude, currentIncident.longitude);
  renderPatrolMarkers();
}

// Render pulsating victim pin
function renderVictimPin(lat, lng) {
  if (victimMarker) map.removeLayer(victimMarker);
  if (victimCircle) map.removeLayer(victimCircle);

  // Pulse circle
  victimCircle = L.circle([lat, lng], {
    color: '#ff334b',
    fillColor: '#ff2a85',
    fillOpacity: 0.25,
    radius: 350
  }).addTo(map);

  // Icon
  const pulseIcon = L.divIcon({
    className: 'custom-pulse-container',
    html: `<div class="pulse-marker"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  victimMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(map);
  victimMarker.bindPopup(`
    <div style="font-size: 0.8rem; line-height: 1.4;">
      <strong style="color: #ff334b;">🚨 HIGH RISK DISTRESS LOCATION</strong><br>
      <strong>Wearer:</strong> ${currentIncident.userName}<br>
      <strong>Vitals:</strong> ${currentIncident.heartRate} BPM (Acute Fear)<br>
      <strong>Address:</strong> ${currentIncident.address}
    </div>
  `).openPopup();
}

// Render Patrolling police cars and bikes
function renderPatrolMarkers() {
  patrolUnits.forEach(unit => {
    if (patrolMarkers[unit.id]) {
      map.removeLayer(patrolMarkers[unit.id]);
    }

    const isCar = unit.vehicleType === 'car';
    const iconHtml = isCar 
      ? `<div style="background: #1e3c72; border: 2px solid #00f2fe; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0, 242, 254, 0.6);"><i class="fas fa-car-side" style="color: #00f2fe; font-size: 14px;"></i></div>`
      : `<div style="background: #2b1f00; border: 2px solid #ffb300; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(255, 179, 0, 0.6);"><i class="fas fa-motorcycle" style="color: #ffb300; font-size: 14px;"></i></div>`;

    const customIcon = L.divIcon({
      className: 'patrol-icon',
      html: iconHtml,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const marker = L.marker([unit.lat, unit.lng], { icon: customIcon }).addTo(map);
    marker.bindPopup(`
      <div style="font-size: 0.8rem;">
        <strong>${unit.callsign}</strong><br>
        Officer: ${unit.officer}<br>
        Contact: ${unit.contact}<br>
        Status: <span style="color: #00e676; font-weight: 700;">${unit.status}</span>
      </div>
    `);

    patrolMarkers[unit.id] = marker;
  });

  updatePatrolListUI();
}

// Calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(2));
}

// Update UI Patrol Units list
function updatePatrolListUI() {
  const listContainer = document.getElementById('patrolUnitsList');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  patrolUnits.forEach(unit => {
    const dist = calculateDistance(currentIncident.latitude, currentIncident.longitude, unit.lat, unit.lng);
    const etaMins = Math.max(1, Math.round((dist / 32) * 60)); // 32 km/h city response speed

    const item = document.createElement('div');
    item.className = 'patrol-item';
    item.innerHTML = `
      <div>
        <div style="font-weight: 700; font-size: 0.82rem; color: #fff;">
          ${unit.callsign}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin: 2px 0;">
          ${unit.officer} &bull; ${unit.contact}
        </div>
        <div style="font-size: 0.72rem; color: ${unit.status === 'EN_ROUTE_TO_VICTIM' ? '#ff334b' : '#00e676'}; font-weight: 600;">
          <i class="fas fa-location-arrow"></i> ${dist} km away &bull; ETA: ~${etaMins} mins 
          ${unit.status === 'EN_ROUTE_TO_VICTIM' ? '(EN ROUTE)' : ''}
        </div>
      </div>
      <div>
        <button class="btn-dispatch" onclick="dispatchUnit('${unit.id}')">
          <i class="fas fa-paper-plane"></i> ${unit.status === 'EN_ROUTE_TO_VICTIM' ? 'Re-Route' : 'Dispatch'}
        </button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

// Dispatch specific unit
window.dispatchUnit = function(unitId) {
  const unit = patrolUnits.find(u => u.id === unitId);
  if (!unit) return;

  unit.status = 'EN_ROUTE_TO_VICTIM';
  
  // Draw route polyline from unit to victim
  if (routePolyline) map.removeLayer(routePolyline);
  routePolyline = L.polyline([
    [unit.lat, unit.lng],
    [currentIncident.latitude, currentIncident.longitude]
  ], {
    color: '#00f2fe',
    weight: 4,
    opacity: 0.8,
    dashArray: '8, 8'
  }).addTo(map);

  map.fitBounds([
    [unit.lat, unit.lng],
    [currentIncident.latitude, currentIncident.longitude]
  ], { padding: [50, 50] });

  updatePatrolListUI();
  playDispatchAudio(`Dispatch order confirmed. ${unit.callsign} is now en route to victim location.`);
};

// Play AI voice
function playDispatchAudio(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1.1;
    window.speechSynthesis.speak(utt);
  }
}

// Socket.io Realtime Listener
const socket = io();

socket.on('connect', () => {
  console.log('[Police Dashboard] Connected to CAD server');
});

socket.on('emergency_alert', (incident) => {
  currentIncident = incident;

  // Update UI Elements
  document.getElementById('alertTitle').innerText = `🚨 ${incident.userName} - ${incident.vitals.heartRate} BPM Acute Fear Alert`;
  document.getElementById('alertSummary').innerText = `Distress broadcast received at ${incident.triggerDetails.time24h}. Location: ${incident.location.address}`;
  document.getElementById('incidentTimeBadge').innerText = `${incident.triggerDetails.time24h} IST`;
  document.getElementById('victimName').innerText = `${incident.userName} (${incident.userAge} F)`;
  document.getElementById('victimBpm').innerText = `${incident.vitals.heartRate} BPM (Spike Detected)`;
  document.getElementById('victimFear').innerText = `${incident.vitals.hrv} ms / ${incident.vitals.fearIndex} (Critical Panic)`;
  document.getElementById('victimCoords').innerText = `${incident.location.latitude}° N, ${incident.location.longitude}° E (${incident.location.address})`;

  // Update Map
  renderVictimPin(incident.location.latitude, incident.location.longitude);
  map.setView([incident.location.latitude, incident.location.longitude], 14);

  // Play Emergency Voice
  playDispatchAudio(incident.aiAlert.audioMessage);

  if (incident.assignedPatrol) {
    const assigned = patrolUnits.find(u => u.id === incident.assignedPatrol.id);
    if (assigned) {
      window.dispatchUnit(assigned.id);
    }
  }
});

socket.on('alarm_cancelled', (data) => {
  document.getElementById('alertTitle').innerText = '✅ Incident Cancelled by Wearer (False Alarm)';
  document.getElementById('alertSummary').innerText = `User successfully verified safety on watch at ${data.cancelledAt}. Alarm aborted.`;
  document.getElementById('activeAlertBanner').style.background = 'rgba(0, 230, 118, 0.15)';
  document.getElementById('activeAlertBanner').style.borderColor = '#00e676';
  if (routePolyline) map.removeLayer(routePolyline);
});

// Event Listeners
document.getElementById('playPoliceAudioBtn').addEventListener('click', () => {
  const msg = currentIncident.audioMessage || 
    `Emergency distress alert. Women safety alert from RakshaPulse. Physiological acute fear detected at ${currentIncident.address}. Immediate police dispatch requested.`;
  playDispatchAudio(msg);
});

document.getElementById('relayAllPcrBtn').addEventListener('click', () => {
  patrolUnits.forEach(u => u.status = 'EN_ROUTE_TO_VICTIM');
  updatePatrolListUI();
  playDispatchAudio('Priority Code Red broadcasted to all sector PCR vehicles. Intercepting victim coordinates.');
});

document.getElementById('resolveIncidentBtn').addEventListener('click', () => {
  document.getElementById('alertTitle').innerText = 'Incident Resolved / Victim Assisted';
  document.getElementById('alertSummary').innerText = 'Patrol unit reached the scene. Situation secured.';
  document.getElementById('activeAlertBanner').style.background = 'rgba(33, 150, 243, 0.15)';
  document.getElementById('activeAlertBanner').style.borderColor = '#2196f3';
  if (routePolyline) map.removeLayer(routePolyline);
});

window.addEventListener('DOMContentLoaded', () => {
  initMap();
});
