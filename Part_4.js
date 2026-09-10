<<<<<<< HEAD
function saveSessionToStorage(topic) {
  const sessions = JSON.parse(localStorage.getItem('study_sessions') || '[]');
  const hrs = parseInt(document.getElementById('hrsInput').value) || 0;
  const mins = parseInt(document.getElementById('minsInput').value) || 0;
  const durationMinutes = hrs * 60 + mins;

  const newSession = {
    id: Date.now(),
    topic: topic,
    duration: durationMinutes,
    xpEarned: durationMinutes * 10,
    timestamp: new Date().toISOString()
  };

  sessions.push(newSession);
  localStorage.setItem('study_sessions', JSON.stringify(sessions));
  renderSessionHistory();
=======
function saveSessionToStorage(topic) {
  const sessions = JSON.parse(localStorage.getItem('study_sessions') || '[]');
  const hrs = parseInt(document.getElementById('hrsInput').value) || 0;
  const mins = parseInt(document.getElementById('minsInput').value) || 0;
  const durationMinutes = hrs * 60 + mins;

  const newSession = {
    id: Date.now(),
    topic: topic,
    duration: durationMinutes,
    xpEarned: durationMinutes * 10,
    timestamp: new Date().toISOString()
  };

  sessions.push(newSession);
  localStorage.setItem('study_sessions', JSON.stringify(sessions));
  renderSessionHistory();
>>>>>>> d217a1011e718ad36c2068bf67092fe212522ba0
}