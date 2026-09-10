let audioCtx, noiseNode;

function toggleWhiteNoise() {
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    return;
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = buffer;
  noiseNode.loop = true;
  
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.05; // Low volume
  
  noiseNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  noiseNode.start();
}