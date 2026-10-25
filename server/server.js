const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// In-Memory Data Store
let activeIncidents = [];
let incidentHistory = [];

// Simulated Patrolling Police Units (PCR Vans / 112 ERSS Units)
let patrolUnits = [
  {
    id: 'PCR-112-ALPHA',
    callsign: 'PCR Van 14 (Central Sector)',
    officer: 'SI Rajesh Verma',
    contact: '+91 98112 00114',
    lat: 28.6139,
    lng: 77.2090,
    status: 'AVAILABLE',
    vehicleType: 'Mahindra Scorpio / PCR Patrol',
    battery: '94%'
  },
  {
    id: 'PCR-112-BRAVO',
    callsign: 'PCR Van 08 (Metro Beat)',
    officer: 'ASI Meena Kumari (Women Safety Squad)',
    contact: '+91 98112 00108',
    lat: 28.6250,
    lng: 77.2180,
    status: 'AVAILABLE',
    vehicleType: 'Toyota Innova / Women PCR',
    battery: '88%'
  },
  {
    id: 'PCR-112-CHARLIE',
    callsign: 'PCR Motor-Bike 22 (Rapid Interceptor)',
    officer: 'Constable Amit Singh',
    contact: '+91 98112 00122',
    lat: 28.6080,
    lng: 77.2250,
    status: 'AVAILABLE',
    vehicleType: 'Royal Enfield / Quick Response',
    battery: '99%'
  }
];

// Haversine formula to compute distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Find nearest patrol unit
function findNearestPatrol(lat, lng) {
  if (!lat || !lng) return patrolUnits[0];
  let nearest = null;
  let minDistance = Infinity;

  patrolUnits.forEach(unit => {
    const dist = calculateDistance(lat, lng, unit.lat, unit.lng);
    unit.currentDistanceKm = dist;
    unit.estimatedMinutes = Math.max(1, Math.round((dist / 35) * 60)); // assuming 35km/h in city traffic
    if (dist < minDistance) {
      minDistance = dist;
      nearest = unit;
    }
  });

  return nearest;
}

// REST API Endpoints

// 1. Health check & status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'RakshaPulse 112 ERSS Emergency Gateway',
    timestamp: new Date().toISOString(),
    activeIncidentsCount: activeIncidents.length,
    patrolUnitsCount: patrolUnits.length
  });
});

// 2. Trigger SOS Incident (Receives from Smartwatch)
app.post('/api/sos', (req, res) => {
  const {
    deviceId,
    userName,
    heartRate,
    hrv,
    fearIndex,
    triggerType,
    time24h,
    isNightTime,
    latitude,
    longitude,
    accuracy,
    address,
    aiAudioMessage,
    aiTextMessage
  } = req.body;

  const incidentId = 'SOS-' + Date.now().toString(36).toUpperCase();
  const timestamp = new Date().toISOString();

  // Dynamically position patrols near user if coordinates provided
  if (latitude && longitude) {
    patrolUnits[0].lat = latitude + 0.008;
    patrolUnits[0].lng = longitude - 0.005;
    patrolUnits[1].lat = latitude - 0.012;
    patrolUnits[1].lng = longitude + 0.007;
    patrolUnits[2].lat = latitude + 0.004;
    patrolUnits[2].lng = longitude + 0.011;
  }

  const nearestPatrol = findNearestPatrol(latitude, longitude);

  const incident = {
    id: incidentId,
    timestamp,
    deviceId: deviceId || 'WATCH-7749',
    userName: userName || 'Ananya Sharma',
    userAge: 24,
    bloodGroup: 'B+',
    emergencyContacts: [
      { name: 'Mother (Sunita Sharma)', phone: '+91 98765 43210' },
      { name: 'Brother (Kunal Sharma)', phone: '+91 98765 43211' }
    ],
    vitals: {
      heartRate: heartRate || 152,
      hrv: hrv || 14.2,
      fearIndex: fearIndex || 0.91,
      baselineHr: 72
    },
    location: {
      latitude: latitude || 28.6139,
      longitude: longitude || 77.2090,
      accuracy: accuracy || 8,
      address: address || 'Barakhamba Road, Connaught Place, New Delhi',
      mapsUrl: `https://www.google.com/maps?q=${latitude || 28.6139},${longitude || 77.2090}`
    },
    triggerDetails: {
      type: triggerType || 'AUTOMATIC_ACUTE_FEAR_SPIKE',
      time24h: time24h || new Date().toTimeString().split(' ')[0],
      isNightTime: isNightTime !== undefined ? isNightTime : true,
      detectionModel: 'RakshaPulse-BioFear v2.4'
    },
    aiAlert: {
      audioMessage: aiAudioMessage || `EMERGENCY: Women safety alert from RakshaPulse. Physiological acute fear detected at coordinates ${latitude || 28.6139}, ${longitude || 77.2090}. Nearest patrol 112 PCR Van dispatched immediately.`,
      textMessage: aiTextMessage || `🚨 [112 ERSS POLICE ALERT] Women In Danger: Acute fear heart spike detected (152 BPM). Location: ${address || 'Connaught Place, New Delhi'}. Live Map: https://www.google.com/maps?q=${latitude || 28.6139},${longitude || 77.2090}`
    },
    status: 'ACTIVE_DISPATCHED',
    assignedPatrol: nearestPatrol ? {
      ...nearestPatrol,
      status: 'EN_ROUTE_TO_VICTIM',
      dispatchedAt: timestamp
    } : null,
    dispatchLog: [
      { time: timestamp, event: 'Automated Fear Tachycardia detected by Wristwatch' },
      { time: timestamp, event: 'Night condition verified. 10s countdown completed without cancellation' },
      { time: timestamp, event: '112 Emergency CAD Server received distress broadcast' },
      { time: timestamp, event: `AI audio & text alert auto-dispatched to ${nearestPatrol ? nearestPatrol.callsign : '112 Control Room'}` }
    ]
  };

  activeIncidents.unshift(incident);
  incidentHistory.unshift(incident);

  // Broadcast to all connected police dashboards and monitoring clients
  io.emit('emergency_alert', incident);

  res.status(201).json({
    success: true,
    message: '112 Emergency Dispatch activated successfully',
    incidentId: incident.id,
    assignedPatrol: incident.assignedPatrol,
    estimatedEta: nearestPatrol ? `${nearestPatrol.estimatedMinutes} mins` : '3 mins'
  });
});

// 3. Cancel false alarm (if cancelled during countdown or resolved)
app.post('/api/cancel', (req, res) => {
  const { incidentId, reason } = req.body;
  const index = activeIncidents.findIndex(inc => inc.id === incidentId);

  const cancellationRecord = {
    incidentId: incidentId || 'LAST_COUNTDOWN',
    cancelledAt: new Date().toISOString(),
    reason: reason || 'User authenticated biometric cancellation on watch'
  };

  if (index !== -1) {
    const cancelled = activeIncidents.splice(index, 1)[0];
    cancelled.status = 'CANCELLED_BY_USER';
    cancelled.dispatchLog.push({
      time: cancellationRecord.cancelledAt,
      event: `Alarm cancelled: ${cancellationRecord.reason}`
    });
  }

  io.emit('alarm_cancelled', cancellationRecord);

  res.json({
    success: true,
    message: 'Alarm aborted. No police dispatch dispatched.',
    details: cancellationRecord
  });
});

// 4. Get active incidents
app.get('/api/incidents', (req, res) => {
  res.json({
    active: activeIncidents,
    history: incidentHistory.slice(0, 20)
  });
});

// 5. Get patrolling units
app.get('/api/patrols', (req, res) => {
  res.json(patrolUnits);
});

// 6. Manual dispatch from Police Dashboard
app.post('/api/dispatch', (req, res) => {
  const { incidentId, patrolId } = req.body;
  const incident = activeIncidents.find(inc => inc.id === incidentId);
  const patrol = patrolUnits.find(p => p.id === patrolId);

  if (!incident || !patrol) {
    return res.status(404).json({ error: 'Incident or Patrol unit not found' });
  }

  patrol.status = 'EN_ROUTE_TO_VICTIM';
  incident.assignedPatrol = patrol;
  incident.dispatchLog.push({
    time: new Date().toISOString(),
    event: `Manual command: ${patrol.callsign} dispatched by Control Room Operator`
  });

  io.emit('patrol_dispatched', { incidentId, patrol });
  res.json({ success: true, incident, patrol });
});

// Socket.io Realtime Events
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send initial data to client
  socket.emit('init_state', {
    activeIncidents,
    patrolUnits
  });

  // Wristwatch live vitals stream
  socket.on('watch_telemetry', (data) => {
    // Broadcast live telemetry to dashboard
    socket.broadcast.emit('live_vitals', data);
  });

  // Watch pre-alert countdown initiated (gives police preview before 10s expiration)
  socket.on('countdown_started', (data) => {
    socket.broadcast.emit('alert_pre_warning', data);
  });

  // Countdown cancelled
  socket.on('countdown_cancelled', (data) => {
    socket.broadcast.emit('alert_pre_warning_cancelled', data);
  });

  // Final SOS confirmed
  socket.on('sos_confirmed', (data) => {
    socket.broadcast.emit('emergency_alert', data);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

const os = require('os');

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const networkIp = getNetworkIp();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  🛡️  RakshaPulse Women Safety Emergency System`);
  console.log(`  🕒  24-Hour Smartwatch Fear Detection & 112 ERSS`);
  console.log(`  🌐  Accessible on Local & External Network:`);
  console.log(`      ➜ Local:        http://localhost:${PORT}`);
  console.log(`      ➜ External LAN: http://${networkIp}:${PORT}`);
  console.log(`  ⌚  Smartwatch App: http://${networkIp}:${PORT}/watch.html`);
  console.log(`  🚓  Police Radar:   http://${networkIp}:${PORT}/police-dashboard.html`);
  console.log(`=======================================================`);
});
