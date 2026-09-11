const STORAGE_KEY = 'focus_desk_guardian';
const DEFAULT_STATE = {
    policy: { language: 'English', subject: 'Computer science', focusGoal: 120, dailyLimit: 45, strictness: 'Balanced', counseling: 'Practical and brief', overnight: true, escalation: true },
    events: [],
    focusSeconds: 0,
    socialMinutes: 0,
    interruptions: 0,
    sessionActive: false,
    counselingShown: false,
    lockUntil: 0
};
let state = loadState();
let sessionTimer = null;
let sessionSeconds = 25 * 60;
let sessionStartedAt = 0;

function loadState() {
    try { return { ...DEFAULT_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; } catch (error) { return structuredClone(DEFAULT_STATE); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function now() { return new Date(); }
function timestamp() { return now().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function isLocked() { return state.lockUntil > Date.now(); }
function remainingLock() { return Math.max(0, Math.ceil((state.lockUntil - Date.now()) / 60000)); }
function $(id) { return document.getElementById(id); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

function addEvent(type, source, detail, decision, action) {
    state.events.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), time: timestamp(), type, source, detail, decision, action });
    if (state.events.length > 200) state.events.length = 200;
    saveState(); renderAll();
}
function currentStateLabel() {
    if (isLocked()) return `Locked · ${remainingLock()}m`;
    if (state.sessionActive) return 'Focused';
    return 'Ready';
}
function switchView(viewId) {
    document.querySelectorAll('.page-view').forEach(view => view.classList.toggle('hidden', view.id !== viewId));
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === viewId));
}
function renderAll() {
    const today = new Date().toDateString();
    const todayEvents = state.events.filter(event => new Date(event.time).toDateString() === today);
    $('focus-today').textContent = `${String(Math.floor(state.focusSeconds / 60)).padStart(2, '0')}:${String(state.focusSeconds % 60).padStart(2, '0')}`;
    $('focus-goal').textContent = state.policy.focusGoal;
    $('interruptions-today').textContent = state.interruptions;
    $('policy-state').textContent = currentStateLabel();
    $('lock-summary').textContent = isLocked() ? `Social media locked for ${remainingLock()}m` : 'Overnight rule armed';
    $('limit-used').textContent = state.socialMinutes;
    $('daily-limit-label').textContent = state.policy.dailyLimit;
    $('session-state').textContent = state.sessionActive ? 'Active' : 'Inactive';
    $('session-title').textContent = state.sessionActive ? 'Deep work in progress' : 'No active session';
    $('session-description').textContent = state.sessionActive ? 'The guardian is observing policy-relevant signals while you work.' : 'Start a focus session to make the policy active for your intended task.';
    $('session-clock').textContent = `${String(Math.floor(sessionSeconds / 60)).padStart(2, '0')}:${String(sessionSeconds % 60).padStart(2, '0')}`;
    $('last-decision').textContent = state.events[0] ? `“${state.events[0].decision}”` : '“Policy loaded. Waiting for an event.”';
    $('last-decision-time').textContent = state.events[0]?.time || 'No events yet';
    $('decision-headline').textContent = isLocked() ? `Social media locked for ${remainingLock()} minutes.` : state.sessionActive ? 'Your focus session is protected.' : 'Ready for a focused session.';
    $('decision-detail').textContent = state.events[0]?.decision || 'No interruptions detected. Your policy is loaded and enforcement is available.';
    $('policy-state').className = isLocked() ? 'locked-state' : '';
    renderEvents(todayEvents);
    renderPolicy();
    updatePlanProgress();
}
function renderEvents(todayEvents) {
    $('event-list').innerHTML = state.events.length ? state.events.map(event => `<article class="event-row"><div class="event-marker ${event.type}"></div><div class="event-body"><div class="event-meta"><span>${escapeHtml(event.time)}</span><b>${escapeHtml(event.source)}</b><em>${escapeHtml(event.type)}</em></div><strong>${escapeHtml(event.detail)}</strong><p><span>Decision:</span> ${escapeHtml(event.decision)}</p><p><span>Action:</span> ${escapeHtml(event.action)}</p></div></article>`).join('') : '<div class="empty-state"><span class="empty-icon">+</span><h2>No decisions yet.</h2><p>Your local event record will appear here as the guardian observes activity.</p></div>';
}
function renderPolicy() {
    $('preferred-language').value = state.policy.language;
    $('primary-subject').value = state.policy.subject;
    $('focus-goal-input').value = state.policy.focusGoal;
    $('daily-limit').value = state.policy.dailyLimit;
    $('strictness').value = state.policy.strictness;
    $('counseling-style').value = state.policy.counseling;
    $('overnight-rule').checked = state.policy.overnight;
    $('escalation-rule').checked = state.policy.escalation;
}
function updatePlanProgress() {
    const checks = [...document.querySelectorAll('.plan-check')];
    $('plan-progress').textContent = `${checks.filter(check => check.checked).length} / ${checks.length}`;
}
function startFocus() {
    if (state.sessionActive) return;
    state.sessionActive = true;
    state.counselingShown = false;
    sessionSeconds = 25 * 60;
    sessionStartedAt = Date.now();
    addEvent('actioned', 'Study session', 'Focus session started', 'Policy activated for the intended study task.', 'Monitoring active');
    clearInterval(sessionTimer);
    sessionTimer = setInterval(() => {
        if (!state.sessionActive) return;
        sessionSeconds -= 1;
        state.focusSeconds += 1;
        if (sessionSeconds <= 0) endFocus('Focus session completed');
        renderAll();
        saveState();
    }, 1000);
}
function showSelfStudyWarning() { $('self-study-warning').classList.remove('hidden'); }
async function beginSelfStudy() {
    $('self-study-warning').classList.add('hidden');
    $('mode-picker').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    startFocus();
    switchView('monitor-view');
    try {
        await document.documentElement.requestFullscreen();
        if (navigator.keyboard?.lock) await navigator.keyboard.lock(['Escape']);
    } catch (error) {
        addEvent('actioned', 'Self-study mode', 'Fullscreen request was unavailable', 'The browser or host did not grant fullscreen access.', 'Session continues with visible warning');
    }
}
function chooseTutorMode() {
    $('mode-picker').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    switchView('learn-view');
    addEvent('actioned', 'Mode chooser', 'AI tutor mode selected', 'The learner chose the learning desk instead of protected fullscreen.', 'Tutor workspace opened');
}
async function emergencyExit() {
    if (!state.sessionActive) return;
    endFocus('Emergency exit requested with the I key');
    if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (error) { /* Host may deny the request. */ }
    }
    if (navigator.keyboard?.unlock) navigator.keyboard.unlock();
    switchView('overview-view');
}
function endFocus(reason = 'Focus session ended by user') {
    if (!state.sessionActive) return;
    state.sessionActive = false;
    clearInterval(sessionTimer);
    addEvent('actioned', 'Study session', reason, 'The active focus state was closed by the user or timer.', 'Monitoring paused');
}
function observeStudyTool() {
    addEvent('observed', 'Study tool', 'Approved study activity detected', 'Activity matches the approved study context.', 'No restriction applied');
}
function observeSocial() {
    state.interruptions += 1;
    state.socialMinutes += 5;
    const afterCounseling = state.counselingShown;
    const overLimit = state.socialMinutes >= Number(state.policy.dailyLimit);
    if (isLocked()) { addEvent('actioned', 'Social domain', 'Configured social-media target requested during an active lock', 'The three-hour lock is still active.', 'Access denied'); return; }
    if (state.policy.overnight && (new Date().getHours() >= 23 || new Date().getHours() < 5)) {
        state.lockUntil = Date.now() + 3 * 60 * 60 * 1000;
        addEvent('actioned', 'Social domain', 'Configured social-media target opened during overnight protection', 'Overnight rule applies from 11:00 PM to 5:00 AM.', 'Blocked immediately');
        return;
    }
    if (afterCounseling || overLimit) {
        state.lockUntil = Date.now() + 3 * 60 * 60 * 1000;
        addEvent('actioned', 'Social domain', 'Continued social-media use after counseling', `${state.interruptions} interruption(s) recorded after the reset step.`, 'All configured social media locked for three hours');
        closeCounseling();
        return;
    }
    addEvent('inferred', 'Social domain', 'Social-media interruption detected during the current focus context', 'A first interruption gets a brief, respectful reset before escalation.', 'Counseling shown');
    state.counselingShown = true;
    saveState();
    openCounseling();
}
function openCounseling() { $('counseling-modal').classList.remove('hidden'); $('counseling-copy').textContent = `You opened a configured social site during a focus session. ${state.interruptions} interruption(s) are recorded. What would help now?`; }
function closeCounseling() { $('counseling-modal').classList.add('hidden'); }
function chooseCounseling(choice) {
    closeCounseling();
    if (choice === 'resume') addEvent('actioned', 'Counseling', 'Learner chose to resume', 'The learner acknowledged the reset and returned to the task.', 'Focus monitoring continues');
    if (choice === 'break') { endFocus('Learner chose a break'); addEvent('actioned', 'Counseling', 'Learner chose a break', 'A break was selected before continued use.', 'Focus monitoring paused'); }
    if (choice === 'end') endFocus('Learner ended the session after counseling');
}
function explainTopic() {
    const topic = $('explain-topic').value.trim() || state.policy.subject;
    $('explain-output').classList.remove('hidden');
    $('explain-output').innerHTML = `<strong>${escapeHtml(topic)}</strong><p>Start with the simplest useful model: define the idea, connect it to one concrete example, then explain what would change if one part changed. Write a two-sentence version in your own words before checking your notes.</p><small>Local study scaffold · no cloud processing</small>`;
}
function generatePractice() {
    $('practice-question').textContent = `Explain one important idea from ${state.policy.subject} without looking at your notes.`;
    $('practice-prompt').textContent = 'Give yourself two minutes, then compare your answer with your notes.';
    $('practice-answer').classList.remove('hidden');
    $('practice-answer').innerHTML = '<strong>Recall cue</strong><p>What is the problem this idea solves? What is one example? What is one common mistake?</p>';
}
function exportEvents() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), policy: state.policy, events: state.events }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'focus-desk-event-record.json'; link.click(); URL.revokeObjectURL(link.href);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
    $('choose-tutor').addEventListener('click', chooseTutorMode);
    $('choose-self-study').addEventListener('click', showSelfStudyWarning);
    $('cancel-self-study').addEventListener('click', () => $('self-study-warning').classList.add('hidden'));
    $('confirm-self-study').addEventListener('click', beginSelfStudy);
    $('start-focus-btn').addEventListener('click', showSelfStudyWarning);
    $('monitor-focus-btn').addEventListener('click', showSelfStudyWarning);
    $('stop-focus-btn').addEventListener('click', () => endFocus());
    $('simulate-interruption').addEventListener('click', observeSocial);
    $('simulate-study').addEventListener('click', observeStudyTool);
    $('simulate-counseling').addEventListener('click', openCounseling);
    document.querySelectorAll('[data-counseling-choice]').forEach(button => button.addEventListener('click', () => chooseCounseling(button.dataset.counselingChoice)));
    $('explain-btn').addEventListener('click', explainTopic);
    $('practice-btn').addEventListener('click', generatePractice);
    document.querySelectorAll('.plan-check').forEach(check => check.addEventListener('change', updatePlanProgress));
    $('policy-form').addEventListener('submit', event => { event.preventDefault(); state.policy = { language: $('preferred-language').value, subject: $('primary-subject').value.trim() || 'General study', focusGoal: Number($('focus-goal-input').value) || 120, dailyLimit: Number($('daily-limit').value) || 0, strictness: $('strictness').value, counseling: $('counseling-style').value, overnight: $('overnight-rule').checked, escalation: $('escalation-rule').checked }; saveState(); addEvent('actioned', 'Policy editor', 'Policy settings updated by learner', 'The user explicitly approved the new policy values.', 'Policy saved locally'); $('policy-saved').textContent = 'Saved locally'; setTimeout(() => $('policy-saved').textContent = '', 2400); });
    $('export-events').addEventListener('click', exportEvents);
    $('clear-events').addEventListener('click', () => { if (confirm('Delete the local event record? This cannot be undone.')) { state.events = []; saveState(); renderAll(); } });
    document.addEventListener('keydown', event => {
        if (event.key.toLowerCase() === 'i' && state.sessionActive) {
            event.preventDefault();
            emergencyExit();
        }
    });
    renderAll();
});
