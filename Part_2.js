// --- GLOBAL STATE ---
let timerInterval;
let timeLeft = 25 * 60; 
let isPaused = true; 
let currentSessionChat = [];
let currentMode = '';
let fileContext = '';
let sessionActuallyInteracted = false; 

// --- HISTORY & SIDEBAR LOGIC ---
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('study_history')) || [];
    const selfStudyLog = document.getElementById('self-study-log');
    const aiTutorLog = document.getElementById('ai-tutor-log');
    
    if (!selfStudyLog || !aiTutorLog) return;
    
    selfStudyLog.innerHTML = '';
    aiTutorLog.innerHTML = '';

    let hasSelfStudy = false;
    let hasAiTutor = false;

    history.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<div><b>${item.time}</b></div><div style="font-size:0.8rem; color:#94a3b8;">${item.detail || 'Completed'}</div>`;
        
        if (item.mode === 'Self-Study') {
            hasSelfStudy = true;
            selfStudyLog.appendChild(div);
        } else if (item.mode === 'AI Tutor') {
            hasAiTutor = true;
            div.onclick = () => recallAISession(item.chatLog);
            aiTutorLog.appendChild(div);
        }
    });

    const selfSection = document.getElementById('self-study-section');
    const aiSection = document.getElementById('ai-tutor-section');
    
    if (hasSelfStudy) selfSection.classList.remove('hidden');
    else selfSection.classList.add('hidden');

    if (hasAiTutor) aiSection.classList.remove('hidden');
    else aiSection.classList.add('hidden');
}

function saveToHistory(modeName, detail = null) {
    const history = JSON.parse(localStorage.getItem('study_history')) || [];
    const record = {
        mode: modeName,
        time: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    
    if (modeName === 'Self-Study') record.detail = detail;
    if (modeName === 'AI Tutor') record.chatLog = [...currentSessionChat];

    history.unshift(record);
    localStorage.setItem('study_history', JSON.stringify(history));
    loadHistory();
}

// --- TIMER CONTROLS ---
function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    if (display) display.innerText = `${m}:${s}`;
}

function startTimer() {
    clearInterval(timerInterval);
    isPaused = false;
    sessionActuallyInteracted = true; 
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.innerText = "Pause";
    
    timerInterval = setInterval(() => {
        if (!isPaused && timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
        } else if (timeLeft === 0) {
            clearInterval(timerInterval);
            alert("Focus Sprint Complete!");
            endSession('Self-Study');
        }
    }, 1000);
}

function pauseTimer() {
    if (isPaused) {
        startTimer();
    } else {
        isPaused = true;
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.innerText = "Resume";
    }
}

function resetTimer() {
    isPaused = true;
    clearInterval(timerInterval);
    timeLeft = 25 * 60;
    updateTimerDisplay();
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.innerText = "Start";
}

function adjustTimer() {
    const modal = document.getElementById('time-adjust-modal');
    if (modal) modal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    const okBtn = document.getElementById('modal-ok-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const input = document.getElementById('session-minutes-input');

    if (okBtn) {
        okBtn.onclick = () => {
            const mins = parseInt(input.value, 10);
            if (mins > 0) {
                timeLeft = mins * 60;
                updateTimerDisplay();
            }
            document.getElementById('time-adjust-modal').classList.add('hidden');
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            document.getElementById('time-adjust-modal').classList.add('hidden');
        };
    }

    loadHistory(); 
});
// --- UI & LOCKDOWN ---
function switchView(showId) {
    document.querySelectorAll('.app-container, .active-view').forEach(el => el.classList.add('hidden'));
    document.getElementById(showId).classList.remove('hidden');
}

async function startSelfStudy() {
    currentMode = 'Self-Study';
    sessionActuallyInteracted = false; 
    switchView('study-view');
    timeLeft = 25 * 60;
    isPaused = true; 
    updateTimerDisplay();
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.innerText = "Start";

    try {
        await document.documentElement.requestFullscreen();
        if ('keyboard' in navigator && navigator.keyboard.lock) {
            await navigator.keyboard.lock(['Escape']);
        }
    } catch (err) {}
}

document.addEventListener('fullscreenchange', () => {
    const studyView = document.getElementById('study-view');
    if (!studyView.classList.contains('hidden') && !document.fullscreenElement) {
        clearInterval(timerInterval);
        alert("⚠️ Lockdown Breach Detected! Session terminated early.");
        endSession('Self-Study');
    }
});

function startAITutor() {
    currentMode = 'AI Tutor';
    currentSessionChat = [];
    fileContext = '';
    document.getElementById('ai-chat-box').innerHTML = '';
    const dropZone = document.getElementById('file-drop-area');
    if(dropZone) dropZone.innerHTML = `📂 Drag & Drop Study Materials Here OR <label class="file-browse-btn">Browse Files <input type="file" id="file-input" style="display: none;" onchange="handleFileSelect(this)"></label>`;
    switchView('ai-view');
}

function openPostSessionModal() {
    if (currentSessionChat.length === 0) {
        finalizeAndExit(); 
        return;
    }
    const modal = document.getElementById('post-session-modal');
    document.getElementById('mcq-container').classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
}

function finalizeAndExit() {
    document.getElementById('post-session-modal').classList.add('hidden');
    endSession('AI Tutor');
}

async function endSession(modeName) {
    if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch(e) {}
    }
    if ('keyboard' in navigator && navigator.keyboard.unlock) {
        navigator.keyboard.unlock();
    }
    clearInterval(timerInterval);
    
    if (modeName === 'Self-Study' && sessionActuallyInteracted) {
        const durationText = document.getElementById('timer-display').innerText;
        saveToHistory('Self-Study', `Finished (${durationText} left)`);
    } else if (modeName === 'AI Tutor' && currentSessionChat.length > 0) {
        saveToHistory('AI Tutor');
    }
    
    switchView('dashboard-view');
    loadHistory(); 
}

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'l' && !document.getElementById('study-view').classList.contains('hidden')) {
        document.getElementById('emergency-exit').classList.toggle('hidden');
    }
});

// --- AI TUTOR & FAST CONCISE LLM ---
function handleFileSelect(input) {
    if (input.files.length > 0) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            fileContext = e.target.result;
            document.getElementById('file-drop-area').innerHTML = `📄 Loaded File: <b>${file.name}</b> (Context active)`;
        };
        reader.readAsText(file);
    }
}

async function askOllama() {
    const inputEl = document.getElementById('ai-prompt');
    const chatBox = document.getElementById('ai-chat-box');
    const text = inputEl.value.trim();
    if (!text) return;

    chatBox.innerHTML += `<div class="user-msg">${text}</div>`;
    currentSessionChat.push({ role: 'user', content: text });
    inputEl.value = '';
    
    const loadingId = 'loading-' + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="ai-msg"><b>Tutor:</b> Thinking...</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    const systemInstruction = "You are a concise, high-efficiency AI tutor. Keep explanations short, punchy, and structured with clear bullet points. Avoid overly long paragraphs so the student can learn quickly.";
    const fullPrompt = `${systemInstruction}\n\n${fileContext ? 'Context:\n' + fileContext + '\n\n' : ''}Student Question: ${text}`;

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: 'llama3.2', 
                prompt: fullPrompt, 
                stream: false,
                options: { num_predict: 250 } 
            })
        });
        const data = await response.json();
        document.getElementById(loadingId).innerHTML = `<b>Tutor:</b><br>${data.response.replace(/\n/g, '<br>')}`;
        currentSessionChat.push({ role: 'ai', content: data.response });
    } catch (error) {
        document.getElementById(loadingId).innerHTML = `<b style="color:red;">Error:</b> Could not reach local Ollama instance on port 11434.`;
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- MCQ GENERATOR FEATURE ---
async function startMCQChallenge() {
    const mcqContainer = document.getElementById('mcq-container');
    const qEl = document.getElementById('mcq-question');
    const optsEl = document.getElementById('mcq-options');
    const feedbackEl = document.getElementById('mcq-feedback');

    mcqContainer.classList.remove('hidden');
    qEl.innerText = "Generating MCQ based on your session...";
    optsEl.innerHTML = "";
    feedbackEl.innerText = "";

    const chatHistorySummary = currentSessionChat.map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `Based on this study session conversation, generate ONE multiple-choice question (MCQ) to test the student. 
    Format your response STRICTLY as JSON with this exact structure:
    {
      "question": "The question text here",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": 0
    }
    where 'correct' is the 0-based index of the correct option. Do not include markdown code blocks around the JSON if possible, just raw JSON.
    
    Session History:
    ${chatHistorySummary}`;

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama3.2', prompt: prompt, stream: false })
        });
        const data = await response.json();
        
        let cleanJsonStr = data.response.trim();
        if (cleanJsonStr.startsWith('```json')) cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        if (cleanJsonStr.startsWith('```')) cleanJsonStr = cleanJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        
        const mcqData = JSON.parse(cleanJsonStr);

        qEl.innerText = mcqData.question;
        optsEl.innerHTML = "";
        
        mcqData.options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'mcq-btn';
            btn.innerText = opt;
            btn.onclick = () => {
                if (index === mcqData.correct) {
                    feedbackEl.innerHTML = "✅ Correct! Great job mastering this concept.";
                    feedbackEl.style.color = "#10b981";
                } else {
                    feedbackEl.innerHTML = `❌ Incorrect. The correct answer was: ${mcqData.options[mcqData.correct]}`;
                    feedbackEl.style.color = "#ef4444";
                }
                Array.from(optsEl.children).forEach(b => b.disabled = true);
            };
            optsEl.appendChild(btn);
        });

    } catch (err) {
        qEl.innerText = "Could not generate MCQ automatically. You can finish session now.";
    }
}

function recallAISession(chatLog) {
    if (!chatLog || chatLog.length === 0) return;
    switchView('ai-view');
    currentSessionChat = [...chatLog];
    const chatBox = document.getElementById('ai-chat-box');
    chatBox.innerHTML = chatLog.map(msg => 
        msg.role === 'user' ? `<div class="user-msg">${msg.content}</div>` 
                            : `<div class="ai-msg"><b>Tutor:</b><br>${msg.content.replace(/\n/g, '<br>')}</div>`
    ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('file-drop-area');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                const reader = new FileReader();
                reader.onload = function(evt) {
                    fileContext = evt.target.result;
                    dropZone.innerHTML = `📄 Loaded File: <b>${file.name}</b> (Context active)`;
                };
                reader.readAsText(file);
            }
        });
    }
});