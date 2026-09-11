const HISTORY_KEY = 'focus_desk_sessions';
let timerId = null;
let secondsLeft = 25 * 60;
let sessionRunning = false;

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
    return 'Try this study move: define the question, write what you already know, and identify the one part that still feels unclear.';
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
    $('chat-form').addEventListener('submit', event => { event.preventDefault(); const question = $('chat-input').value.trim(); if (!question) return; addTutorMessage(question, 'user-message'); $('chat-input').value = ''; window.setTimeout(() => addTutorMessage(answerLocally(question), 'tutor-message'), 180); });
    document.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'i' && sessionRunning) { event.preventDefault(); emergencyExit(); } });
});
