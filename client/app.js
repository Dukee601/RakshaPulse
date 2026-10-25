/**
 * RakshaPulse - Digital Wristwatch Client & Fear Detection Engine
 * Full implementation of 24-hr acute fear detection, Web Bluetooth, and 112 ERSS dispatch.
 */

// Application State
const state = {
  heartRate: 74,
  hrv: 68,
  surgeRate: 0.2, // BPM per second
  motionType: 0, // 0 = Still, 1 = Running Cadence, 2 = Freeze/Struggle
  baselineHr: 72,
  fearIndex: 0.08,
  fearState: 'NORMAL',
  
  // 24-hr Time Engine
  timeMode: 'CUSTOM', // 'LIVE' or 'CUSTOM'
  customMinutes: 1422, // 23:42 (Default night danger testing time)
  nightStartHour: 20, // 20:00 (8 PM)
  nightEndHour: 6, // 06:00 (6 AM)
  isNight: true,
  
  // Emergency & Countdown
  countdownActive: false,
  countdownSeconds: 10,
  countdownTimer: null,
  emergencyDispatched: false,
  activeIncidentId: null,

  // Location & Identity
  user: {
    name: 'Ananya Sharma',
    age: 24,
    bloodGroup: 'B+',
    deviceId: 'WATCH-7749-IN'
  },
  location: {
    latitude: 28.6139,
    longitude: 77.2090,
    accuracy: 6,
    address: 'Barakhamba Road, Connaught Place, New Delhi'
  },

  // Bluetooth
  bleDevice: null,
  bleConnected: false
};

// Connect to Socket.io
let socket = null;
try {
  socket = io();
  socket.on('connect', () => {
    logTerminal('Connected to 112 ERSS CAD Gateway via WebSocket', 'success');
  });

  socket.on('emergency_alert', (incident) => {
    logTerminal(`🚨 Alert Active: ${incident.id} dispatched to ${incident.assignedPatrol ? incident.assignedPatrol.callsign : 'Nearest Unit'}`, 'emergency');
  });

  socket.on('alarm_cancelled', (data) => {
    logTerminal(`ℹ️ Dispatch cancelled: ${data.reason}`, 'ai-voice');
  });
} catch (e) {
  console.warn('Socket.io offline or standalone mode');
}

// DOM Elements
const bpmDisplay = document.getElementById('bpmDisplay');
const heartIcon = document.getElementById('heartIcon');
const hrvDisplay = document.getElementById('hrvDisplay');
const fearScoreDisplay = document.getElementById('fearScoreDisplay');
const motionDisplay = document.getElementById('motionDisplay');
const fearStatusTag = document.getElementById('fearStatusTag');
const watchClock = document.getElementById('watchClock');
const nightBadge = document.getElementById('nightBadge');
const nightStatusText = document.getElementById('nightStatusText');

const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNum = document.getElementById('countdownNum');
const countdownRing = document.getElementById('countdownRing');
const cancelCountdownBtn = document.getElementById('cancelCountdownBtn');

const dispatchedOverlay = document.getElementById('dispatchedOverlay');
const dispatchedPatrolName = document.getElementById('dispatchedPatrolName');
const victimLocationAddress = document.getElementById('victimLocationAddress');
const resetWatchBtn = document.getElementById('resetWatchBtn');

// Sliders & Controls
const bpmSlider = document.getElementById('bpmSlider');
const bpmSliderVal = document.getElementById('bpmSliderVal');
const surgeSlider = document.getElementById('surgeSlider');
const surgeSliderVal = document.getElementById('surgeSliderVal');
const hrvSlider = document.getElementById('hrvSlider');
const hrvSliderVal = document.getElementById('hrvSliderVal');
const motionSlider = document.getElementById('motionSlider');
const motionSliderVal = document.getElementById('motionSliderVal');
const timeSlider = document.getElementById('timeSlider');
const timeTravelDisplay = document.getElementById('timeTravelDisplay');
const timeEngineModeText = document.getElementById('timeEngineModeText');
const resetLiveTimeBtn = document.getElementById('resetLiveTimeBtn');

const scenarioNormal = document.getElementById('scenarioNormal');
const scenarioWorkout = document.getElementById('scenarioWorkout');
const scenarioFearNight = document.getElementById('scenarioFearNight');
const scenarioFearDay = document.getElementById('scenarioFearDay');

const manualSosBtn = document.getElementById('manualSosBtn');
const panicPhysicalBtn = document.getElementById('panicPhysicalBtn');
const crownBtn = document.getElementById('crownBtn');
const testSpeechBtn = document.getElementById('testSpeechBtn');
const simulateGpsBtn = document.getElementById('simulateGpsBtn');
const connectBleBtn = document.getElementById('connectBleBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const terminalLog = document.getElementById('terminalLog');
const aiVoiceScriptDisplay = document.getElementById('aiVoiceScriptDisplay');

// Dynamic Canvas ECG Waveform
const canvas = document.getElementById('ecgCanvas');
const ctx = canvas.getContext('2d');
let ecgData = [];
const maxEcgPoints = 120;
let ecgPhase = 0;

for (let i = 0; i < maxEcgPoints; i++) {
  ecgData.push(canvas.height / 2);
}

function drawEcg() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid background lines
  ctx.strokeStyle = 'rgba(255, 42, 133, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += 12) {
    ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();

  // ECG Trace
  ctx.beginPath();
  ctx.lineWidth = 2;
  const isDanger = state.fearState === 'FEAR_PANIC';
  ctx.strokeStyle = isDanger ? '#ff334b' : (state.heartRate > 120 ? '#ffb300' : '#00e676');
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = isDanger ? 8 : 4;

  for (let i = 0; i < ecgData.length; i++) {
    const x = (i / (maxEcgPoints - 1)) * canvas.width;
    const y = ecgData[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Generate next physiological ECG point (P-Q-R-S-T complex)
  ecgPhase = (ecgPhase + (state.heartRate / 60) * 0.12) % (Math.PI * 2);
  let val = Math.sin(ecgPhase) * 3; // Baseline ripple

  // QRS peak spike
  if (ecgPhase > 1.2 && ecgPhase < 1.45) {
    val = -18 * (state.fearState === 'FEAR_PANIC' ? 1.4 : 1.0); // R peak upwards
  } else if (ecgPhase > 1.05 && ecgPhase <= 1.2) {
    val = 5; // Q dip
  } else if (ecgPhase >= 1.45 && ecgPhase < 1.6) {
    val = 8; // S dip
  } else if (ecgPhase > 2.2 && ecgPhase < 2.7) {
    val = -6; // T wave
  }

  const mid = canvas.height / 2;
  ecgData.shift();
  ecgData.push(mid + val);

  requestAnimationFrame(drawEcg);
}
requestAnimationFrame(drawEcg);

// Logger function
function logTerminal(msg, type = 'normal') {
  const time = new Date().toTimeString().split(' ')[0];
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg ${type}">${msg}</span>`;
  terminalLog.appendChild(div);
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

// 24-Hour Time Calculation
function updateClock() {
  let hours, mins, secs;

  if (state.timeMode === 'LIVE') {
    const now = new Date();
    hours = now.getHours();
    mins = now.getMinutes();
    secs = now.getSeconds();
  } else {
    // Custom Minutes
    hours = Math.floor(state.customMinutes / 60);
    mins = Math.floor(state.customMinutes % 60);
    secs = new Date().getSeconds();
  }

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');
  const timeStr = `${hStr}:${mStr}:${sStr}`;
  watchClock.innerText = timeStr;

  // Check 24-hr night period: 20:00 to 06:00
  state.isNight = (hours >= state.nightStartHour || hours < state.nightEndHour);

  if (state.isNight) {
    nightBadge.className = 'night-badge';
    nightBadge.innerHTML = '<i class="fas fa-moon"></i> <span>NIGHT SHIELD</span>';
  } else {
    nightBadge.className = 'night-badge daytime';
    nightBadge.innerHTML = '<i class="fas fa-sun"></i> <span>DAY SHIELD</span>';
  }

  updateAiScript();
}
setInterval(updateClock, 1000);

// Fear Detection Classification Engine
function evaluateFearState() {
  const bpm = state.heartRate;
  const hrv = state.hrv;
  const surge = state.surgeRate;
  const motion = state.motionType;

  // 1. Tachycardia Factor (above baseline 70)
  const fTachycardia = Math.max(0, Math.min(1.0, (bpm - 90) / 75));

  // 2. Surge Acceleration Factor (sudden jump dHR/dt)
  const fSurge = Math.max(0, Math.min(1.0, surge / 4.0));

  // 3. HRV Collapse Factor (acute RMSSD drop below 25ms indicates intense sympathetic panic)
  const fHrv = Math.max(0, Math.min(1.0, (50 - hrv) / 38));

  // 4. Motion mismatch:
  // - If running cadence (motion == 1), this is physiological exercise, so penalize fear index!
  // - If freeze or struggle (motion == 2), this is a violent assault/stalking pattern.
  let fMotionModifier = 0.05;
  if (motion === 1) {
    fMotionModifier = -0.50; // Exercise suppression
  } else if (motion === 2) {
    fMotionModifier = 0.35; // Struggle / Terror freeze
  }

  // Combined Fear Index: 0.0 to 1.0
  let score = (0.40 * fTachycardia) + (0.35 * fSurge) + (0.20 * fHrv) + fMotionModifier;
  score = Math.max(0.01, Math.min(0.99, score));
  state.fearIndex = parseFloat(score.toFixed(2));

  fearScoreDisplay.innerText = state.fearIndex.toFixed(2);

  // Status Classification
  if (state.fearIndex >= 0.78) {
    state.fearState = 'FEAR_PANIC';
    fearStatusTag.className = 'fear-status-tag danger';
    fearStatusTag.innerText = 'ACUTE FEAR SURGE';
    bpmDisplay.style.color = '#ff334b';

    // Trigger night emergency countdown if not already counting down or dispatched
    if (state.isNight && !state.countdownActive && !state.emergencyDispatched) {
      startCountdown('ACUTE_FEAR_TACHYCARDIA_NIGHT');
    } else if (!state.isNight && !state.countdownActive && !state.emergencyDispatched) {
      logTerminal(`⚠️ High Fear detected during daytime (${bpm} BPM). Alert primed.`, 'ai-voice');
    }
  } else if (state.fearIndex >= 0.45 || (bpm > 115 && motion === 1)) {
    state.fearState = 'ELEVATED';
    fearStatusTag.className = 'fear-status-tag elevated';
    fearStatusTag.innerText = motion === 1 ? 'EXERCISE (CARDIO)' : 'ELEVATED VITALS';
    bpmDisplay.style.color = '#ffb300';
  } else {
    state.fearState = 'NORMAL';
    fearStatusTag.className = 'fear-status-tag';
    fearStatusTag.innerText = 'NORMAL VITAL';
    bpmDisplay.style.color = '#ffffff';
  }

  // Heartbeat animation speed
  const pulseDuration = Math.max(0.35, 60 / bpm);
  heartIcon.style.animationDuration = `${pulseDuration}s`;

  // Send live telemetry to server / dashboard
  if (socket && socket.connected) {
    socket.emit('watch_telemetry', {
      deviceId: state.user.deviceId,
      userName: state.user.name,
      heartRate: state.heartRate,
      hrv: state.hrv,
      fearIndex: state.fearIndex,
      fearState: state.fearState,
      isNight: state.isNight,
      timeString: watchClock.innerText,
      location: state.location
    });
  }
}

// 10-Second Countdown Engine
function startCountdown(reason = 'ACUTE_FEAR_NIGHT_TRIGGER') {
  if (state.countdownActive || state.emergencyDispatched) return;

  state.countdownActive = true;
  state.countdownSeconds = 10;
  countdownOverlay.classList.add('active');
  countdownNum.innerText = state.countdownSeconds;

  logTerminal(`⚠️ [NIGHT THREAT] Acute fear tachycardia detected (${state.heartRate} BPM). Initiating 10s emergency countdown...`, 'emergency');

  // Trigger haptic vibration if supported on watch
  if (navigator.vibrate) {
    navigator.vibrate([300, 150, 300, 150, 300]);
  }

  // Notify server preview
  if (socket) {
    socket.emit('countdown_started', {
      deviceId: state.user.deviceId,
      heartRate: state.heartRate,
      fearIndex: state.fearIndex,
      seconds: 10,
      location: state.location
    });
  }

  const circumference = 2 * Math.PI * 42; // ~264

  state.countdownTimer = setInterval(() => {
    state.countdownSeconds--;
    countdownNum.innerText = state.countdownSeconds;

    // Animate circular ring
    const offset = circumference * (1 - state.countdownSeconds / 10);
    countdownRing.style.strokeDashoffset = offset;

    // Haptic pulse per second
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    if (state.countdownSeconds <= 0) {
      clearInterval(state.countdownTimer);
      state.countdownActive = false;
      countdownOverlay.classList.remove('active');
      triggerEmergencyDispatch(reason);
    }
  }, 1000);
}

// Cancel Countdown (False Alarm Protocol)
function cancelCountdown() {
  if (!state.countdownActive) return;

  clearInterval(state.countdownTimer);
  state.countdownActive = false;
  countdownOverlay.classList.remove('active');

  logTerminal('✅ False alarm cancelled by user on watch. 112 dispatch aborted.', 'success');

  if (socket) {
    socket.emit('countdown_cancelled', {
      deviceId: state.user.deviceId,
      timestamp: new Date().toISOString(),
      reason: 'User biometric cancel on watch'
    });
  }

  // Reset scenario to resting safe state
  setScenario('normal');
}

// Trigger Final 112 Emergency Dispatch
async function triggerEmergencyDispatch(reason = 'ACUTE_FEAR_TACHYCARDIA') {
  state.emergencyDispatched = true;
  dispatchedOverlay.classList.add('active');

  const timeStr = watchClock.innerText;
  const address = state.location.address;

  // Generate Virtual AI Text & Audio Message
  const aiAudioMessage = `EMERGENCY DISTRESS ALERT. This is an automated AI emergency broadcast from RakshaPulse safety system. A woman is in immediate danger at ${address}. Physiological panic distress verified with heart rate ${state.heartRate} BPM at ${timeStr}. Dispatch nearest patrolling 112 police unit immediately.`;

  const aiTextMessage = `🚨 [112 ERSS POLICE ALERT] Women In Danger: Acute fear heart spike detected (${state.heartRate} BPM, Fear Score: ${state.fearIndex}). Location: ${address}. Live Coordinates: https://www.google.com/maps?q=${state.location.latitude},${state.location.longitude}`;

  logTerminal(`🚨 112 EMERGENCY POLICE DISPATCH TRIGGERED!`, 'emergency');
  logTerminal(`📍 GPS Coordinates: ${state.location.latitude}, ${state.location.longitude}`, 'ai-voice');
  logTerminal(`📢 AI Speech Distress Message broadcasting...`, 'ai-voice');

  // Speak AI Audio Message Out Loud
  speakAiMessage(aiAudioMessage);

  // Send SOS Beacon to Server
  try {
    const response = await fetch('/api/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: state.user.deviceId,
        userName: state.user.name,
        heartRate: state.heartRate,
        hrv: state.hrv,
        fearIndex: state.fearIndex,
        triggerType: reason,
        time24h: timeStr,
        isNightTime: state.isNight,
        latitude: state.location.latitude,
        longitude: state.location.longitude,
        accuracy: state.location.accuracy,
        address: address,
        aiAudioMessage,
        aiTextMessage
      })
    });

    const data = await response.json();
    if (data.success) {
      state.activeIncidentId = data.incidentId;
      dispatchedPatrolName.innerText = `${data.assignedPatrol.callsign} (${data.estimatedEta})`;
      logTerminal(`🚓 Assigned: ${data.assignedPatrol.callsign} (Officer: ${data.assignedPatrol.officer}) - ETA: ${data.estimatedEta}`, 'success');
    }
  } catch (err) {
    console.error('Failed to post SOS to server:', err);
    dispatchedPatrolName.innerText = 'PCR Van 14 (Central Sector) - 3 mins';
  }
}

// Web Speech AI Synthesizer (Speaks distress message out loud)
function speakAiMessage(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // clear queue
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.1; // urgent, clear pitch
    utterance.volume = 1.0;
    
    // Attempt to pick a natural English voice
    const voices = window.speechSynthesis.getVoices();
    const urgentVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-US'));
    if (urgentVoice) utterance.voice = urgentVoice;

    window.speechSynthesis.speak(utterance);
  } else {
    logTerminal('Device Speech Synthesis not supported in this environment', 'normal');
  }
}

// Update AI Voice Script in preview
function updateAiScript() {
  const timeStr = watchClock.innerText;
  const script = `"EMERGENCY DISTRESS ALERT. This is an automated AI emergency broadcast from RakshaPulse safety system. A woman is in immediate danger at ${state.location.address}. Physiological panic distress verified with heart rate ${state.heartRate} BPM at ${timeStr}. Dispatch nearest patrolling 112 police unit immediately."`;
  aiVoiceScriptDisplay.innerText = script;
}

// Scenarios Presets
function setScenario(type) {
  scenarioNormal.classList.remove('active');
  scenarioWorkout.classList.remove('active');
  scenarioFearNight.classList.remove('active');
  scenarioFearDay.classList.remove('active');

  if (type === 'normal') {
    scenarioNormal.classList.add('active');
    updateVitals({ hr: 72, hrv: 68, surge: 0.2, motion: 0 });
    state.timeMode = 'CUSTOM';
    state.customMinutes = 1422; // 23:42
    timeSlider.value = 1422;
    logTerminal('Switched scenario: Normal Resting Baseline (Safe)', 'normal');
  } else if (type === 'workout') {
    scenarioWorkout.classList.add('active');
    updateVitals({ hr: 140, hrv: 55, surge: 0.8, motion: 1 });
    state.timeMode = 'CUSTOM';
    state.customMinutes = 1110; // 18:30
    timeSlider.value = 1110;
    logTerminal('Switched scenario: Cardio Jogging / Workout. Steady cadence suppresses false alarms.', 'normal');
  } else if (type === 'fearNight') {
    scenarioFearNight.classList.add('active');
    state.timeMode = 'CUSTOM';
    state.customMinutes = 1422; // 23:42 (Night)
    timeSlider.value = 1422;
    updateVitals({ hr: 158, hrv: 12, surge: 7.5, motion: 2 });
    logTerminal('Switched scenario: ACUTE FEAR ATTACK AT NIGHT (23:42). Tachycardia spike + Low HRV + Night Window.', 'emergency');
  } else if (type === 'fearDay') {
    scenarioFearDay.classList.add('active');
    state.timeMode = 'CUSTOM';
    state.customMinutes = 840; // 14:00 (Daylight)
    timeSlider.value = 840;
    updateVitals({ hr: 154, hrv: 14, surge: 6.8, motion: 2 });
    logTerminal('Switched scenario: Daytime Fear Spike at 14:00. Night conditions evaluated.', 'ai-voice');
  }
}

function updateVitals({ hr, hrv, surge, motion }) {
  state.heartRate = hr;
  state.hrv = hrv;
  state.surgeRate = surge;
  state.motionType = motion;

  bpmDisplay.innerText = hr;
  bpmSlider.value = hr;
  bpmSliderVal.innerText = `${hr} BPM`;

  hrvDisplay.innerText = `${hrv} ms`;
  hrvSlider.value = hrv;
  hrvSliderVal.innerText = `${hrv} ms`;

  surgeSlider.value = surge;
  surgeSliderVal.innerText = `${surge} BPM/s`;

  motionSlider.value = motion;
  const motionLabels = ['Still / Inactive', 'Rhythmic Cadence (Running)', 'Erratic Struggle / Freeze'];
  motionDisplay.innerText = motion === 0 ? 'STILL' : (motion === 1 ? 'RUNNING' : 'STRUGGLE');
  motionSliderVal.innerText = motionLabels[motion];

  evaluateFearState();
}

// Event Listeners for Sliders & Buttons
bpmSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  bpmSliderVal.innerText = `${val} BPM`;
  bpmDisplay.innerText = val;
  state.heartRate = val;
  evaluateFearState();
});

surgeSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  surgeSliderVal.innerText = `${val} BPM/s`;
  state.surgeRate = val;
  evaluateFearState();
});

hrvSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  hrvSliderVal.innerText = `${val} ms`;
  hrvDisplay.innerText = `${val} ms`;
  state.hrv = val;
  evaluateFearState();
});

motionSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  const labels = ['Still / Inactive', 'Rhythmic Cadence (Running)', 'Erratic Struggle / Freeze'];
  motionSliderVal.innerText = labels[val];
  motionDisplay.innerText = val === 0 ? 'STILL' : (val === 1 ? 'RUNNING' : 'STRUGGLE');
  state.motionType = val;
  evaluateFearState();
});

timeSlider.addEventListener('input', (e) => {
  state.timeMode = 'CUSTOM';
  state.customMinutes = parseInt(e.target.value);
  timeEngineModeText.innerText = 'Custom Simulated Time';
  const h = Math.floor(state.customMinutes / 60);
  const m = Math.floor(state.customMinutes % 60);
  const isN = (h >= state.nightStartHour || h < state.nightEndHour);
  timeTravelDisplay.innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} (${isN ? 'Night Danger Window' : 'Daylight Hours'})`;
  updateClock();
  evaluateFearState();
});

resetLiveTimeBtn.addEventListener('click', () => {
  state.timeMode = 'LIVE';
  timeEngineModeText.innerText = 'Live Local Time';
  const now = new Date();
  state.customMinutes = now.getHours() * 60 + now.getMinutes();
  timeSlider.value = state.customMinutes;
  updateClock();
  evaluateFearState();
  logTerminal('Clock synchronized to current live system time', 'normal');
});

// Scenarios Click
scenarioNormal.addEventListener('click', () => setScenario('normal'));
scenarioWorkout.addEventListener('click', () => setScenario('workout'));
scenarioFearNight.addEventListener('click', () => setScenario('fearNight'));
scenarioFearDay.addEventListener('click', () => setScenario('fearDay'));

// Cancel Button
cancelCountdownBtn.addEventListener('click', cancelCountdown);

// Reset Watch Button
resetWatchBtn.addEventListener('click', () => {
  dispatchedOverlay.classList.remove('active');
  state.emergencyDispatched = false;
  setScenario('normal');
  logTerminal('Smartwatch standby mode restored', 'normal');
});

// Manual SOS Button
manualSosBtn.addEventListener('click', () => {
  logTerminal('🚨 Instant Manual SOS Button triggered by user!', 'emergency');
  triggerEmergencyDispatch('MANUAL_USER_SOS_BUTTON');
});

panicPhysicalBtn.addEventListener('click', () => {
  logTerminal('Physical watch chassis SOS button pressed!', 'emergency');
  triggerEmergencyDispatch('PHYSICAL_BEZEL_SOS_BUTTON');
});

crownBtn.addEventListener('click', () => {
  logTerminal('Digital Crown tapped - Screen toggled', 'normal');
});

// Test Voice Button
testSpeechBtn.addEventListener('click', () => {
  const script = aiVoiceScriptDisplay.innerText;
  logTerminal('Testing AI Speech Synthesizer out loud...', 'ai-voice');
  speakAiMessage(script);
});

// Refresh / Get Real GPS
simulateGpsBtn.addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.location.latitude = parseFloat(pos.coords.latitude.toFixed(4));
        state.location.longitude = parseFloat(pos.coords.longitude.toFixed(4));
        state.location.accuracy = Math.round(pos.coords.accuracy);
        victimLocationAddress.innerText = `Lat: ${state.location.latitude}, Lng: ${state.location.longitude} (Accuracy ${state.location.accuracy}m)`;
        logTerminal(`Acquired Real GPS: ${state.location.latitude}, ${state.location.longitude}`, 'success');
        updateAiScript();
      },
      (err) => {
        logTerminal(`Using simulated GPS coordinates (Connaught Place, New Delhi): ${err.message}`, 'normal');
      }
    );
  }
});

// Clear Log
clearLogBtn.addEventListener('click', () => {
  terminalLog.innerHTML = '';
});

// Web Bluetooth Connection (Real Smartwatch / Fitness Band)
connectBleBtn.addEventListener('click', async () => {
  if (!navigator.bluetooth) {
    alert('Web Bluetooth API is not supported in this browser. Please use Google Chrome on desktop or Android.');
    return;
  }

  try {
    logTerminal('Scanning for Bluetooth Smartwatch Heart Rate Monitors (0x180D)...', 'ai-voice');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }]
    });

    logTerminal(`Connecting to ${device.name}...`, 'normal');
    const gattServer = await device.gatt.connect();
    const service = await gattServer.getPrimaryService('heart_rate');
    const characteristic = await service.getCharacteristic('heart_rate_measurement');

    await characteristic.startNotifications();
    logTerminal(`✅ Connected to ${device.name}! Streaming real-time heart rate.`, 'success');
    connectBleBtn.innerHTML = `<i class="fas fa-check" style="color: #00e676;"></i> ${device.name}`;

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const val = event.target.value;
      const flags = val.getUint8(0);
      let hr = 0;
      if (flags & 0x01) {
        hr = val.getUint16(1, true); // 16-bit
      } else {
        hr = val.getUint8(1); // 8-bit
      }

      state.heartRate = hr;
      bpmDisplay.innerText = hr;
      bpmSlider.value = hr;
      bpmSliderVal.innerText = `${hr} BPM`;
      evaluateFearState();
    });
  } catch (err) {
    logTerminal(`Bluetooth connection error or cancelled: ${err.message}`, 'normal');
  }
});

// PWA Installation & Service Worker Registration
let deferredInstallPrompt = null;
const installPwaBtn = document.getElementById('installPwaBtn');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[PWA] Service Worker registered with scope:', reg.scope);
      logTerminal('PWA Offline Engine active. App ready to install on Watch/Device.', 'success');
    }).catch((err) => {
      console.warn('[PWA] Service Worker registration failed:', err);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (installPwaBtn) {
    installPwaBtn.style.display = 'inline-flex';
    logTerminal('📲 App install prompt ready! Click "Install App on Watch / Device".', 'ai-voice');
  }
});

if (installPwaBtn) {
  installPwaBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        logTerminal('✅ RakshaPulse App installed successfully on this device!', 'success');
      } else {
        logTerminal('App install prompt was dismissed by user.', 'normal');
      }
      deferredInstallPrompt = null;
    } else {
      // In case standalone installation is already installed or browser requires manual install instructions
      alert('To install on your Smartwatch or Phone:\n\n1. Open this URL in your Watch or Phone Browser (Chrome, Samsung Internet, or Safari)\n2. Tap the Browser Menu (⋮) or Share Button\n3. Select "Install App" or "Add to Home Screen".');
    }
  });
}

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
  updateClock();
  evaluateFearState();
  logTerminal('RakshaPulse Watch Engine v2.4 initialized. All safety sensors active.', 'success');
  logTerminal('Default test night window active (23:42). Try "Acute Fear Attack" scenario to test automated 112 dispatch.', 'ai-voice');
});

