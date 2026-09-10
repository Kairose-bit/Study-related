let timer = null;
let targetTime = 0;
let secondsLeft = 0;
let isRunning = false;
let tabSwitchAlerts = 0;

let uploadedNotesSelf = "";
let uploadedNotesAi = "";
let currentMode = "self";
let secretUnlocked = false;

document.addEventListener('DOMContentLoaded', () => {
  const subInput = document.getElementById('subjectInput');
  if (subInput) {
    subInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') initiateStart();
    });
  }

  // File listener for Self-Study Mode
  const fileInputSelf = document.getElementById('notesFileInputSelf');
  if (fileInputSelf) {
    fileInputSelf.addEventListener('change', (e) => {
      handleFileUpload(e.target.files[0], (text) => { uploadedNotesSelf = text; }, 'fileNameDisplaySelf');
    });
  }

  // File listener for AI Tutor Mode
  const fileInputAi = document.getElementById('notesFileInputAi');
  if (fileInputAi) {
    fileInputAi.addEventListener('change', (e) => {
      handleFileUpload(e.target.files[0], (text) => { uploadedNotesAi = text; }, 'fileNameDisplayAi');
    });
  }
});

// SECRET UNLOCK KEY (L / l)
document.addEventListener('keydown', (e) => {
  if (isRunning && currentMode === 'self') {
    if (e.key === 'l' || e.key === 'L') {
      secretUnlocked = true;
      unlockScreenAndExit();
    }
  }
});

// BLOCK TAB CLOSING / ALT+F4 WITH BROWSER WARNING
window.addEventListener('beforeunload', (e) => {
  if (isRunning && currentMode === 'self' && !secretUnlocked) {
    e.preventDefault();
    e.returnValue = '';
  }
});

function handleFileUpload(file, textSetter, displayId) {
  const display = document.getElementById(displayId);
  if (file) {
    display.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (event) => textSetter(event.target.result);
    reader.readAsText(file);
  } else {
    textSetter("");
    display.textContent = "No file attached";
  }
}

// NAVIGATION BETWEEN SCREENS
function selectMode(mode) {
  currentMode = mode;
  document.getElementById('landingScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  const selfView = document.getElementById('selfStudyView');
  const aiView = document.getElementById('aiTutorView');

  if (mode === 'self') {
    selfView.classList.remove('hidden');
    aiView.classList.add('hidden');
  } else {
    aiView.classList.remove('hidden');
    selfView.classList.add('hidden');
  }
}

function backToLanding() {
  resetTimer();
  unlockScreenAndExit();
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('landingScreen').classList.remove('hidden');
}

function toggleInputs(disabled) {
  document.getElementById('hrsInput').disabled = disabled;
  document.getElementById('minsInput').disabled = disabled;
  document.getElementById('secsInput').disabled = disabled;
  document.getElementById('subjectInput').disabled = disabled;
}

function updateClock(totalSecs) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const fmt = num => String(num).padStart(2, '0');
  
  document.getElementById('timerDisplay').textContent = 
    h > 0 ? `${fmt(h)}:${fmt(m)}:${fmt(s)}` : `${fmt(m)}:${fmt(s)}`;
}

// START BUTTON CLICK TRIGGER
async function initiateStart() {
  if (isRunning) return;

  if (currentMode === 'self') {
    secretUnlocked = false;
    alert("Now your screen will be locked till you have completed your study.");
    
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        if ('keyboard' in navigator && 'lock' in navigator.keyboard) {
          await navigator.keyboard.lock(['Escape']);
        }
      } catch (err) {
        console.log("Fullscreen/Keyboard lock error:", err);
      }
    }
  }

  startTimer();
}

function startTimer() {
  if (isRunning) return;

  if (secondsLeft === 0) {
    const h = parseInt(document.getElementById('hrsInput').value) || 0;
    const m = parseInt(document.getElementById('minsInput').value) || 0;
    const s = parseInt(document.getElementById('secsInput').value) || 0;
    secondsLeft = h * 3600 + m * 60 + s;
  }

  if (secondsLeft <= 0) return;

  targetTime = Date.now() + secondsLeft * 1000;
  timer = setInterval(tick, 200);
  isRunning = true;
  toggleInputs(true);
}

function pauseTimer() {
  if (!isRunning) return;
  clearInterval(timer);
  secondsLeft = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
  isRunning = false;
}

function skipTimer() {
  secretUnlocked = true;
  clearInterval(timer);
  isRunning = false;
  secondsLeft = 0;
  updateClock(0);
  toggleInputs(false);

  unlockScreenAndExit();

  if (document.getElementById('soundToggle').checked) {
    playFinishSound();
  }

  handleSessionEnd();
}

function resetTimer() {
  clearInterval(timer);
  isRunning = false;
  secondsLeft = 0;
  updateClock(0);
  toggleInputs(false);
  document.getElementById('postSessionCard').classList.add('hidden');
  document.getElementById('distractionOverlay').classList.add('hidden');
}

function tick() {
  const remaining = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
  updateClock(remaining);

  if (remaining <= 0) {
    secretUnlocked = true;
    clearInterval(timer);
    isRunning = false;
    secondsLeft = 0;
    toggleInputs(false);

    unlockScreenAndExit();

    if (document.getElementById('soundToggle').checked) {
      playFinishSound();
    }

    handleSessionEnd();
  }
}

function playFinishSound() {
  try {
    const vol = parseFloat(document.getElementById('volumeControl').value) || 0.2;
    if (vol === 0) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {}
}

function handleSessionEnd() {
  const postCard = document.getElementById('postSessionCard');
  postCard.classList.remove('hidden');
}

function unlockScreenAndExit() {
  if ('keyboard' in navigator && 'unlock' in navigator.keyboard) {
    navigator.keyboard.unlock();
  }
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  document.getElementById('distractionOverlay').classList.add('hidden');
}

// DISTRACTION & LOCK SCREEN LISTENERS (Self-Study Mode Only)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && isRunning && currentMode === 'self' && !secretUnlocked) {
    triggerDistractionAlert();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isRunning && currentMode === 'self' && !secretUnlocked) {
    triggerDistractionAlert();
  }
});

function triggerDistractionAlert() {
  // Pause the countdown timer during distraction
  if (isRunning) {
    pauseTimer();
    isRunning = true; 
  }

  tabSwitchAlerts++;
  document.getElementById('distractionCountDisplay').textContent = tabSwitchAlerts;
  document.getElementById('distractionOverlay').classList.remove('hidden');

  try {
    const vol = parseFloat(document.getElementById('volumeControl').value) || 0.2;
    if (vol > 0) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {}
}

// RESUME SPRINT & RE-ENTER FULLSCREEN WHEN BUTTON IS CLICKED
function dismissShield() {
  document.getElementById('distractionOverlay').classList.add('hidden');
  
  if (currentMode === 'self' && !secretUnlocked) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    isRunning = false;
    startTimer();
  }
}

// API CALL: Mode 1 Active Recall
async function fetchSelfStudyRecall() {
  const topic = document.getElementById('subjectInput').value.trim() || 'General Study';
  const output = document.getElementById('aiQuizOutputSelf');
  output.textContent = 'Generating active recall evaluation...';

  let promptMessage = "";
  if (uploadedNotesSelf.trim().length > 0) {
    const snippet = uploadedNotesSelf.slice(0, 2500);
    promptMessage = `Act as an expert tutor. The student finished studying "${topic}". Here are their study notes:\n\n"""\n${snippet}\n"""\n\nBased strictly on these notes, generate 2 active recall questions (with detailed answers) and 1 short motivational sentence.`;
  } else {
    promptMessage = `Act as an expert tutor. The student finished studying "${topic}". Generate 2 specific active recall questions (with detailed answers) on this topic, and 1 short motivational sentence.`;
  }

  await callOllama(promptMessage, output);
}

// API CALL: Mode 2 AI Tutor (Learn First + MCQs)
async function fetchAiTutorLesson() {
  const topic = document.getElementById('aiTutorTopicInput').value.trim() || 'General Science';
  const output = document.getElementById('aiTutorOutput');
  output.textContent = 'AI Tutor is generating your lesson and practice quiz...';

  let promptMessage = "";
  if (uploadedNotesAi.trim().length > 0) {
    const snippet = uploadedNotesAi.slice(0, 2500);
    promptMessage = `Act as an AI Tutor. Teach me about "${topic}" using these notes:\n\n"""\n${snippet}\n"""\n\n1. Provide a concise 3-bullet point lesson summary.\n2. Create 3 Multiple Choice Questions (MCQs) with options (A, B, C, D) and reveal correct answers at the bottom.`;
  } else {
    promptMessage = `Act as an AI Tutor. Teach me about "${topic}".\n\n1. Provide a concise 3-bullet point lesson summary explaining main concepts.\n2. Create 3 Multiple Choice Questions (MCQs) with options (A, B, C, D) and reveal correct answers at the bottom.`;
  }

  await callOllama(promptMessage, output);
}

async function callOllama(promptMessage, outputElement) {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: promptMessage,
        stream: false
      })
    });

    const data = await res.json();
    outputElement.textContent = data.response;
  } catch (err) {
    outputElement.textContent = 'Ollama connection failed. Run "$env:OLLAMA_ORIGINS="*"; ollama serve" in PowerShell.';
  }
}