export function createEncounterSFX(sound, initialState) {
  const seen = new Set((initialState?.events ?? []).map(event => event.id));
  const active = new Set();
  let noise;
  let disposed = false;

  function play(kind) {
    const context = sound.context;
    if (disposed || !sound.enabled || !context || context.state !== 'running' || !sound.master) return;
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();
    let source;
    const duration = kind === 'powder' ? .32 : .12;
    if (kind === 'powder') {
      if (!noise) {
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const samples = noise.getChannelData(0);
        let seed = 87191;
        for (let index = 0; index < samples.length; index++) { seed = (seed * 1664525 + 1013904223) >>> 0; samples[index] = seed / 2147483648 - 1; }
      }
      source = context.createBufferSource();
      source.buffer = noise;
      filter.type = 'lowpass';
      filter.frequency.value = 1700;
    } else {
      source = context.createOscillator();
      source.type = 'triangle';
      source.frequency.setValueAtTime(kind === 'blocked' ? 760 : 190, context.currentTime);
      source.frequency.exponentialRampToValueAtTime(kind === 'blocked' ? 250 : 70, context.currentTime + duration);
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
    }
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.linearRampToValueAtTime(kind === 'powder' ? .55 : .22, context.currentTime + .006);
    envelope.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(sound.master);
    const entry = {source, filter, envelope};
    active.add(entry);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); active.delete(entry); };
    source.start();
    source.stop(context.currentTime + duration + .02);
  }

  return {
    update(state) {
      if (disposed) return;
      for (const event of state?.events ?? []) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        if (event.id?.startsWith('carthage:report:')) play('powder');
        else if (['blocked', 'hit', 'incapacitated'].includes(event.result)) play(event.result);
      }
      while (seen.size > 64) seen.delete(seen.values().next().value);
    },
    dispose() {
      disposed = true;
      for (const entry of active) {
        entry.source.onended = null;
        try { entry.source.stop(); } catch {}
        entry.source.disconnect(); entry.filter.disconnect(); entry.envelope.disconnect();
      }
      active.clear();
      seen.clear();
      noise = null;
    },
  };
}
