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
    hide('practice-panel');
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
    electronIpc?.send('enter-protected-session');
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
    electronIpc?.send('exit-protected-session');
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ finishedAt: new Date().toISOString(), remaining: secondsLeft }));
    if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (error) { /* Fullscreen may already be closed. */ }
    }
    if (navigator.keyboard?.unlock) navigator.keyboard.unlock();
    $('self-status').textContent = message;
    $('start-session').classList.remove('hidden');
    hide('end-session');
    show('practice-panel');
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
    if (!$('file-list')) return;
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
async function askOllama(question, target) {
    const context = studyMaterials.length ? `\nStudy material:\n${studyMaterials.map(material => `--- ${material.name} ---\n${material.content}`).join('\n')}` : '';
    const response = await fetch('http://localhost:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama3.2', prompt: `You are a fast, friendly study tutor. Answer in 4-6 short sentences. Use the material when relevant.\n${context}\n\nQuestion: ${question}`, stream: true, keep_alive: '10m', options: { num_predict: 180, temperature: 0.2 } }) });
    if (!response.ok || !response.body) throw new Error(`Ollama returned ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (!line.trim()) continue;
            const part = JSON.parse(line);
            answer += part.response || '';
            target.textContent = answer;
            $('chat-box').scrollTop = $('chat-box').scrollHeight;
        }
    }
    return answer || 'Ollama returned an empty answer.';
}
async function generateQuiz() {
    const topic = $('study-topic').value.trim();
    const files = $('practice-file-input').files;
    if (files.length) await addMaterials(files);
    const materialContext = studyMaterials.length ? studyMaterials.map(material => `--- ${material.name} ---\n${material.content}`).join('\n') : 'No files were provided.';
    if (!topic && !studyMaterials.length) { $('quiz-status').textContent = 'Add a file or write what you studied first.'; return; }
    $('quiz-status').textContent = 'Local Ollama is creating your question...';
    $('quiz-card').classList.remove('hidden');
    $('quiz-question').textContent = 'Thinking...';
    $('quiz-options').innerHTML = '';
    $('quiz-feedback').textContent = '';
    const prompt = `Create one fair multiple-choice question for a student. Use the topic and materials below. Return ONLY valid JSON with this exact shape: {"question":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}. correct must be a number from 0 to 3. Topic: ${topic || 'Use the attached study material'}\nMaterials:\n${materialContext}`;
    try {
        const response = await fetch('http://localhost:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama3.2', prompt, stream: false, format: 'json', options: { num_predict: 350 } }) });
        const data = await response.json();
        const clean = data.response.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const quiz = JSON.parse(clean);
        $('quiz-status').textContent = 'Question ready.';
        $('quiz-question').textContent = quiz.question;
        quiz.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'quiz-option';
            button.textContent = option;
            button.addEventListener('click', () => {
                document.querySelectorAll('.quiz-option').forEach(item => { item.disabled = true; });
                $('quiz-feedback').textContent = index === quiz.correct ? `Correct. ${quiz.explanation}` : `Not quite. The answer is: ${quiz.options[quiz.correct]}. ${quiz.explanation}`;
                $('quiz-feedback').className = `quiz-feedback ${index === quiz.correct ? 'correct' : 'incorrect'}`;
            });
            $('quiz-options').appendChild(button);
        });
    } catch (error) {
        $('quiz-status').textContent = 'Ollama could not create the quiz. Check that llama3.2 is running.';
        $('quiz-question').textContent = 'Try again when local AI is ready.';
    }
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
    $('generate-quiz').addEventListener('click', generateQuiz);
    $('change-mode').addEventListener('click', resetApp);
    $('tutor-back').addEventListener('click', resetApp);
    $('file-input').addEventListener('change', event => addMaterials(event.target.files));
    $('file-drop').addEventListener('dragover', event => { event.preventDefault(); $('file-drop').classList.add('dragging'); });
    $('file-drop').addEventListener('dragleave', () => $('file-drop').classList.remove('dragging'));
    $('file-drop').addEventListener('drop', event => { event.preventDefault(); $('file-drop').classList.remove('dragging'); addMaterials(event.dataTransfer.files); });
    $('chat-form').addEventListener('submit', async event => { event.preventDefault(); const question = $('chat-input').value.trim(); if (!question) return; addTutorMessage(question, 'user-message'); $('chat-input').value = ''; addTutorMessage('Thinking with local Ollama...', 'tutor-message thinking'); const answerTarget = document.querySelector('.thinking:last-child'); try { await askOllama(question, answerTarget); answerTarget.classList.remove('thinking'); } catch (error) { answerTarget.classList.remove('thinking'); answerTarget.textContent = answerLocally(question); } });
    checkOllama();
    document.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'l' && sessionRunning) { event.preventDefault(); emergencyExit(); } });
    window.addEventListener('force-exit-self-study', emergencyExit);
    electronIpc?.on('force-exit-self-study', emergencyExit);
});
