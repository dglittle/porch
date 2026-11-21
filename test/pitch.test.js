// node test/pitch.test.js
// Lifts the pitch detector out of index.html and checks it against notes whose
// pitch we know: pure tones, plucked-string shapes, a weak fundamental, noise.
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = html.split("// <pitch>")[1].split("// </pitch>")[0];
const { makePitchDetector, midiToFreq, freqToMidi, noteName, noteOctave } =
  new Function(src + "; return { makePitchDetector, midiToFreq, freqToMidi, noteName, noteOctave };")();

const detect = makePitchDetector();
const cents = (f, ref) => 1200 * Math.log2(f / ref);
// the same "random" hiss every run, so a pass today is a pass tomorrow
let seed = 12345;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

// a plucked-string-ish note: harmonics that roll off, each decaying, higher ones faster
function note(freq, rate, n, { harmonics = [1, 0.6, 0.4, 0.25, 0.15, 0.1], decay = 3, noise = 0.01, phase = 0 } = {}) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0;
    harmonics.forEach((a, h) => {
      v += a * Math.exp(-decay * (h + 1) * t) * Math.sin(2 * Math.PI * freq * (h + 1) * t + phase * (h + 1));
    });
    buf[i] = 0.3 * v + noise * (random() * 2 - 1);
  }
  return buf;
}

let worst = 0, checks = 0;
function check(label, freq, rate, n, opts, fmin = 60, fmax = 1400, tolerance = 1.5) {
  const r = detect(note(freq, rate, n, opts), rate, fmin, fmax);
  assert(r, `${label}: no pitch found`);
  const err = cents(r.freq, freq);
  worst = Math.max(worst, Math.abs(err));
  checks++;
  assert(Math.abs(err) < tolerance, `${label}: ${freq.toFixed(2)} Hz read as ${r.freq.toFixed(2)} Hz (${err.toFixed(2)} cents off)`);
  assert(r.clarity > 0.8, `${label}: clarity only ${r.clarity.toFixed(2)}`);
}

// every semitone from low E on a guitar to the E two octaves above the top string,
// a little sharp and a little flat, at the sample rates phones and laptops use
for (const rate of [44100, 48000]) {
  for (let m = 40; m <= 88; m++) {
    for (const off of [-0.31, 0, 0.17]) {
      const f = midiToFreq(m + off);
      check(`plucked ${noteName(m)}${noteOctave(m)} @${rate}`, f, rate, 4096, { phase: m });
      check(`sine ${noteName(m)}${noteOctave(m)} @${rate}`, f, rate, 4096, { harmonics: [1], decay: 0, noise: 0 }, 60, 1400, 0.5);
    }
  }
}
// the six guitar strings with a fundamental much weaker than its overtones (small
// phone microphones barely hear the low E's fundamental)
for (const m of [40, 45, 50, 55, 59, 64]) {
  check(`weak fundamental ${noteName(m)}${noteOctave(m)}`, midiToFreq(m), 48000, 4096, { harmonics: [0.15, 1, 0.7, 0.5, 0.3, 0.2] });
}
// a bass, with the longer window the app uses for it
for (const m of [28, 33, 38, 43]) {
  check(`bass ${noteName(m)}${noteOctave(m)}`, midiToFreq(m), 48000, 8192, {}, 28, 400);
}
// a bluetooth headset's 16 kHz microphone
for (const m of [40, 52, 64, 76]) {
  check(`16 kHz ${noteName(m)}${noteOctave(m)}`, midiToFreq(m), 16000, 2048, {});
}

// noise and silence are not notes
for (let i = 0; i < 20; i++) {
  const buf = new Float32Array(4096).map(() => random() * 2 - 1);
  const r = detect(buf, 48000, 60, 1400);
  assert(!r || r.clarity < 0.6, `noise read as a note (clarity ${r && r.clarity.toFixed(2)})`);
}
assert.strictEqual(detect(new Float32Array(4096), 48000, 60, 1400), null, "silence read as a note");

// note names
assert.strictEqual(noteName(69) + noteOctave(69), "A4");
assert.strictEqual(noteName(40) + noteOctave(40), "E2");
assert(Math.abs(freqToMidi(110) - 45) < 1e-9);

// and it has to be fast enough to run every frame
const buf = note(110, 48000, 4096);
const t0 = process.hrtime.bigint();
for (let i = 0; i < 200; i++) detect(buf, 48000, 60, 1400);
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 200;
assert(ms < 4, `too slow: ${ms.toFixed(2)} ms per frame`);

console.log(`ok: ${checks} notes, worst error ${worst.toFixed(2)} cents, ${ms.toFixed(2)} ms per frame`);
