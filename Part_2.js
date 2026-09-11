const HISTORY_KEY = 'focus_desk_sessions';
let timerId = null;
let secondsLeft = 25 * 60;
let sessionRunning = false;
let studyMaterials = [];
let electronIpc = null;
try { electronIpc = require('electron').ipcRenderer; } catch (error) { /* Browser builds do not expose Electron IPC. */ }

const $ = id => document.getElementById(id);
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function resetApp() {
    clearInterval(timerId);
    sessionRunning = false;
    secondsLeft = 25 * 60;
    $('timer').textContent = formatTime(secondsLeft);
    hide('self-study-warning');
    hide('app-shell');
    show('mode-picker');
    hide('tutor-view');
    hide('self-view');
}
function openTutor() {
    hide('mode-picker');
    show('app-shell');
    show('tutor-view');
    hide('self-view');
}
function openSelfStudy() {
    hide('mode-picker');
    show('app-shell');
    hide('tutor-view');
    show('self-view');
}
async function startSession() {
    hide('self-study-warning');
    sessionRunning = true;
    secondsLeft = 25 * 60;
    $('timer').textContent = formatTime(secondsLeft);
    $('self-status').textContent = 'Session active. Stay with your task.';
    $('start-session').classList.add('hidden');
    show('end-session');
    try {
        await document.documentElement.requestFullscreen();
        if (navigator.keyboard?.lock) await navigator.keyboard.lock(['Escape']);
    } catch (error) {
        $('self-status').textContent = 'Fullscreen was not available, but your timer is running.';
    }
    timerId = setInterval(() => {
        secondsLeft -= 1;
        $('timer').textContent = formatTime(secondsLeft);
        if (secondsLeft <= 0) finishSession('Session complete. Nice work.');
    }, 1000);
}
async function finishSession(message = 'Session finished.') {
    if (!sessionRunning) return;
    clearInterval(timerId);
    sessionRunning = false;
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ finishedAt: new Date().toISOString(), remaining: secondsLeft }));
    if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (error) { /* Fullscreen may already be closed. */ }
    }
    if (navigator.keyboard?.unlock) navigator.keyboard.unlock();
    $('self-status').textContent = message;
    $('start-session').classList.remove('hidden');
    hide('end-session');
}
async function emergencyExit() {
    if (!sessionRunning) return;
    await finishSession('Emergency exit used. Your session was saved.');
    openSelfStudy();
}
function addTutorMessage(text, className) {
    const message = document.createElement('div');
    message.className = `chat-message ${className}`;
    message.textContent = text;
    $('chat-box').appendChild(message);
    $('chat-box').scrollTop = $('chat-box').scrollHeight;
}
function answerLocally(question) {
    const lower = question.toLowerCase();
    if (lower.includes('plan') || lower.includes('study')) return 'Start with one small task. Set a 25-minute timer, remove one distraction, and write a two-sentence summary when you finish.';
    if (lower.includes('explain')) return 'Break the idea into three parts: what it is, why it matters, and one simple example. Then explain it again in your own words.';
    return 'Local Ollama is unavailable right now. Try again with Ollama running, or ask me to create a simple study step from your notes.';
}
function renderMaterials() {
    $('file-list').innerHTML = studyMaterials.map((material, index) => `<div class="file-item"><span>${material.name}</span><button type="button" data-remove-file="${index}" aria-label="Remove ${material.name}">x</button></div>`).join('');
    document.querySelectorAll('[data-remove-file]').forEach(button => button.addEventListener('click', () => { studyMaterials.splice(Number(button.dataset.removeFile), 1); renderMaterials(); }));
}
async function readMaterial(file) {
    try {
        const text = await file.text();
        return { name: file.name, type: file.type || 'unknown', content: text.slice(0, 12000) };
    } catch (error) {
        return { name: file.name, type: file.type || 'binary', content: `[${file.name} is attached, but its contents could not be read in the browser.]` };
    }
}
async function addMaterials(files) {
    const incoming = [...files];
    const materials = await Promise.all(incoming.map(readMaterial));
    studyMaterials = [...studyMaterials, ...materials].slice(-8);
    renderMaterials();
}
async function askOllama(question) {
    const context = studyMaterials.length ? `\nStudy materials:\n${studyMaterials.map(material => `--- ${material.name} ---\n${material.content}`).join('\n')}` : '';
    const response = await fetch('http://localhost:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama3.2', prompt: `You are a concise, friendly study tutor. Answer clearly and use the attached material when relevant. If the material is not readable, say so.\n${context}\n\nQuestion: ${question}`, stream: false, options: { num_predict: 300 } }) });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    return data.response || 'Ollama returned an empty answer.';
}
async function checkOllama() {
    try { const response = await fetch('http://localhost:11434/api/tags'); $('ollama-status').textContent = response.ok ? 'Local AI: Ollama llama3.2 ready' : 'Local AI: start Ollama to answer'; }
    catch (error) { $('ollama-status').textContent = 'Local AI: offline until Ollama is running'; }
}
document.addEventListener('DOMContentLoaded', () => {
    $('choose-tutor').addEventListener('click', openTutor);
    $('choose-self-study').addEventListener('click', () => { openSelfStudy(); show('self-study-warning'); });
    $('confirm-self-study').addEventListener('click', startSession);
    $('cancel-self-study').addEventListener('click', () => hide('self-study-warning'));
    $('start-session').addEventListener('click', () => show('self-study-warning'));
    $('end-session').addEventListener('click', () => finishSession());
    $('change-mode').addEventListener('click', resetApp);
    $('tutor-back').addEventListener('click', resetApp);
    $('file-input').addEventListener('change', event => addMaterials(event.target.files));
    $('file-drop').addEventListener('dragover', event => { event.preventDefault(); $('file-drop').classList.add('dragging'); });
    $('file-drop').addEventListener('dragleave', () => $('file-drop').classList.remove('dragging'));
    $('file-drop').addEventListener('drop', event => { event.preventDefault(); $('file-drop').classList.remove('dragging'); addMaterials(event.dataTransfer.files); });
    $('chat-form').addEventListener('submit', async event => { event.preventDefault(); const question = $('chat-input').value.trim(); if (!question) return; addTutorMessage(question, 'user-message'); $('chat-input').value = ''; addTutorMessage('Thinking with local Ollama...', 'tutor-message thinking'); try { const answer = await askOllama(question); document.querySelector('.thinking:last-child').textContent = answer; } catch (error) { document.querySelector('.thinking:last-child').textContent = answerLocally(question); } });
    checkOllama();
    document.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'l' && sessionRunning) { event.preventDefault(); emergencyExit(); } });
    window.addEventListener('force-exit-self-study', emergencyExit);
    electronIpc?.on('force-exit-self-study', emergencyExit);
});
