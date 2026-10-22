export class Soundscape {
  constructor() {
    this.enabled = true;
    this.voices = true;
    this.context = null;
    this.recordings = {};
    this.currentTake = null;
    fetch(new URL('audio/manifest.json', document.baseURI)).then(response => response.json()).then(value => { this.recordings = value.lines ?? {}; }).catch(() => {});
  }

  start() {
    if (this.context) { this.context.resume().catch(() => {}); return; }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.enabled ? .16 : 0;
    this.master.connect(this.context.destination);
    const length = this.context.sampleRate * 4;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < length; index++) { last = (last + (Math.random() * 2 - 1) * .02) / 1.02; data[index] = last * 2.7; }
    const wind = this.context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    wind.connect(filter);
    filter.connect(this.master);
    wind.start();
  }

  setEnabled(value) {
    this.enabled = value;
    if (this.master) this.master.gain.setTargetAtTime(value ? .16 : 0, this.context.currentTime, .3);
  }

  chime(kind = 'step') {
    if (!this.context || !this.enabled) return;
    const notes = kind === 'revelation' ? [261.63, 392, 523.25] : kind === 'complete' ? [293.66, 440, 587.33] : [392, 523.25];
    notes.forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const time = this.context.currentTime + index * .16;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(.13, time + .035);
      envelope.gain.exponentialRampToValueAtTime(.001, time + 1.8);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.start(time);
      oscillator.stop(time + 2);
    });
  }

  speak(line, chapterId, objectiveId, index) {
    this.stopVoice();
    if (!this.voices) return false;
    const key = `${chapterId}:${objectiveId}:${index}`;
    const file = this.recordings[line.lineId] ?? this.recordings[key] ?? this.recordings[`${line.speaker}|${line.text}`];
    if (!file) return false;
    this.currentTake = new Audio(new URL(file, new URL('audio/', document.baseURI)).href);
    this.currentTake.volume = .85;
    this.currentTake.play().catch(() => {});
    return true;
  }

  stopVoice() {
    if (this.currentTake) { this.currentTake.pause(); this.currentTake = null; }
  }
}
