/* =========================================================
   audio.js  —  Web Audio API sound engine
   All sounds are synthesised — no external files needed.
   ========================================================= */
'use strict';

const AudioManager = (() => {

    let ctx = null;
    let masterGain, musicGain, sfxGain;
    let musicNode = null;
    let musicOscillators = [];
    let enabled = true;

    // ── Init ────────────────────────────────────────────────
    function init() {
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.connect(ctx.destination);
            musicGain = ctx.createGain();
            sfxGain   = ctx.createGain();
            musicGain.connect(masterGain);
            sfxGain.connect(masterGain);
            setMusicVolume(Settings.get('musicVolume'));
            setSfxVolume(Settings.get('sfxVolume'));
        } catch (e) {
            console.warn('Web Audio not available', e);
        }
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    // ── Volume controls ─────────────────────────────────────
    function setMusicVolume(v) {
        if (!musicGain) return;
        musicGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    }

    function setSfxVolume(v) {
        if (!sfxGain) return;
        sfxGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    }

    // ── Utility helpers ─────────────────────────────────────
    function makeBuffer(duration, fn) {
        if (!ctx) return null;
        const sr     = ctx.sampleRate;
        const frames = Math.ceil(sr * duration);
        const buf    = ctx.createBuffer(1, frames, sr);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) fn(data, i, sr, frames);
        return buf;
    }

    function playBuffer(buf, dest = sfxGain, startOffset = 0) {
        if (!ctx || !buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(ctx.currentTime + startOffset);
        return src;
    }

    function createReverb(seconds = 0.4) {
        if (!ctx) return null;
        const convolver = ctx.createConvolver();
        convolver.buffer = makeBuffer(seconds, (d, i, sr, n) => {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
        });
        convolver.connect(sfxGain);
        return convolver;
    }

    // ── SFX — Wooden tap ────────────────────────────────────
    function playTap() {
        if (!ctx) return;
        resume();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        filt.type            = 'lowpass';
        filt.frequency.value = 800;
        osc.type             = 'sine';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(filt); filt.connect(gain); gain.connect(sfxGain);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
    }

    // ── SFX — Seed drop ─────────────────────────────────────
    function playSeedDrop() {
        if (!ctx) return;
        resume();
        const buf = makeBuffer(0.12, (d, i, sr, n) => {
            const t   = i / sr;
            const env = Math.exp(-t * 25);
            d[i] = (Math.random() * 2 - 1) * 0.4 * env +
                   Math.sin(2 * Math.PI * 600 * t) * 0.15 * env;
        });
        const src  = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = 0.6;
        const filt = ctx.createBiquadFilter();
        filt.type            = 'bandpass';
        filt.frequency.value = 800;
        filt.Q.value         = 1.5;
        src.connect(filt); filt.connect(gain); gain.connect(sfxGain);
        src.start();
    }

    // ── SFX — Capture ────────────────────────────────────────
    function playCapture() {
        if (!ctx) return;
        resume();
        const freqs = [523, 659, 784]; // C-E-G ascending arpeggio
        freqs.forEach((f, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            const t    = ctx.currentTime + i * 0.07;
            osc.type             = 'triangle';
            osc.frequency.value  = f;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain); gain.connect(sfxGain);
            osc.start(t); osc.stop(t + 0.3);
        });
    }

    // ── SFX — Turn switch ───────────────────────────────────
    function playTurnChange() {
        if (!ctx) return;
        resume();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type             = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(550, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain); gain.connect(sfxGain);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
    }

    // ── SFX — Victory ────────────────────────────────────────
    function playVictory() {
        if (!ctx) return;
        resume();
        const chord = [523, 659, 784, 1047]; // C major chord swell
        chord.forEach((f, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            const t    = ctx.currentTime + i * 0.05;
            osc.type             = 'triangle';
            osc.frequency.value  = f;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.15);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.8);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
            osc.connect(gain); gain.connect(sfxGain);
            osc.start(t); osc.stop(t + 2.2);
        });
    }

    // ── Background music ─────────────────────────────────────
    // Generative ambient loop using a pentatonic scale (traditional feel)
    const scale  = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66]; // C-pentatonic
    let musicTimer = null;
    let musicPlaying = false;

    function startMusic() {
        if (!ctx || musicPlaying) return;
        resume();
        musicPlaying = true;
        scheduleMusicNote();
    }

    function scheduleMusicNote() {
        if (!musicPlaying) return;
        const freq     = scale[Math.floor(Math.random() * scale.length)];
        const osc1     = ctx.createOscillator();
        const osc2     = ctx.createOscillator();
        const gain     = ctx.createGain();
        const reverb   = ctx.createConvolver();
        const revBuf   = makeBuffer(1.5, (d, i, sr, n) => {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2) * 0.5;
        });
        reverb.buffer  = revBuf;
        osc1.type      = 'sine';
        osc1.frequency.value = freq;
        osc2.type      = 'triangle';
        osc2.frequency.value = freq * 1.005; // slight detune
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.4);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
        osc1.connect(gain); osc2.connect(gain);
        gain.connect(reverb); reverb.connect(musicGain);
        osc1.start(); osc2.start();
        osc1.stop(ctx.currentTime + 2.8);
        osc2.stop(ctx.currentTime + 2.8);
        const interval = 1200 + Math.random() * 1800;
        musicTimer = setTimeout(scheduleMusicNote, interval);
    }

    function stopMusic() {
        musicPlaying = false;
        clearTimeout(musicTimer);
    }

    // ── Haptic feedback ──────────────────────────────────────
    function haptic(pattern = [10]) {
        if (Settings.get('haptics') && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    return {
        init, resume,
        setMusicVolume, setSfxVolume,
        playTap, playSeedDrop, playCapture, playTurnChange, playVictory,
        startMusic, stopMusic,
        haptic
    };
})();

window.AudioManager = AudioManager;
