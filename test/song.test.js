// node test/song.test.js
// Lifts the beat and song makers out of index.html and checks that every song
// they can make is a song: the right parts, real chords, strums that fit the bar.
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = html.split("// <song>")[1].split("// </song>")[0];
const { STYLES, KEYS, PITCHES, makeSong, makeChord } =
  new Function(src + "; return { STYLES, KEYS, PITCHES, makeSong, makeChord };")();

const pc = m => ((m % 12) + 12) % 12;

// the chords a guitarist would expect, by name
const expect = {
  G: [43, 47, 50, 55, 59, 67], C: [48, 52, 55, 60, 64], D: [50, 57, 62, 66], A: [45, 52, 57, 61, 64],
  E: [40, 47, 52, 56, 59, 64], Am: [45, 52, 57, 60, 64], Em: [40, 47, 52, 55, 59, 64], F: [41, 48, 53, 57, 60, 65],
  Bm: [47, 54, 59, 62, 66], B7: [47, 51, 57, 59, 66], "F♯m": [42, 49, 54, 57, 61, 66],
};
for (const [name, notes] of Object.entries(expect)) {
  const kind = name.endsWith("m") ? "m" : name.endsWith("7") ? "7" : "";
  const chord = makeChord(PITCHES.indexOf(name.slice(0, name.length - kind.length)), kind);
  assert.deepStrictEqual(chord.notes, notes, name + " is fingered wrong: " + chord.notes);
}

let songs = 0, shortest = Infinity, longest = 0;
const seen = new Set();
for (let seed = 1; seed <= 400; seed++) {
  for (const key of KEYS) {
    const song = makeSong(seed * 7919, key.id);
    songs++;
    const where = `seed ${seed} in ${key.id}`;
    assert.strictEqual(song.key.id, key.id);

    // the parts: an intro, at least two verses, two choruses and a bridge, an ending
    const kinds = song.sections.map(s => s.kind);
    assert.strictEqual(kinds[0], "intro", where);
    assert.strictEqual(kinds[kinds.length - 1], "end", where);
    assert(kinds.filter(k => k === "verse").length >= 2, where + ": too few verses");
    assert(kinds.filter(k => k === "chorus").length >= 2, where + ": too few choruses");
    assert.strictEqual(kinds.filter(k => k === "bridge").length, 1, where);
    song.sections.forEach(sec => {
      if (sec.kind !== "intro" && sec.kind !== "end") assert.strictEqual(sec.chords.length, 8, where);
    });
    const names = kind => song.sections.find(s => s.kind === kind).chords.map(c => c.name).join(" ");
    assert.notStrictEqual(names("verse"), names("chorus"), where + ": the chorus is the verse again");
    seen.add(names("verse") + " | " + names("chorus") + " | " + names("bridge"));

    // the bars line up with the parts
    assert.strictEqual(song.bars.length, song.sections.reduce((n, s) => n + s.chords.length, 0));
    song.sections.forEach((sec, s) => {
      assert.strictEqual(song.bars[sec.at].s, s);
      assert.strictEqual(song.bars[sec.at].i, 0);
    });
    assert.strictEqual(song.loopAt, song.sections[1].at);
    assert.strictEqual(song.endAt, song.bars.length - 3);
    shortest = Math.min(shortest, song.bars.length);
    longest = Math.max(longest, song.bars.length);

    // it starts and ends at home
    const home = song.bars[song.bars.length - 1].chord;
    assert.strictEqual(home.pc, key.tonic, where + ": doesn't end on the key note");
    assert.strictEqual(home.kind, key.minor ? "m" : "", where);

    // every chord is a real chord a guitar can play
    song.bars.forEach(({ chord }) => {
      assert(chord.notes.length >= 4 && chord.notes.length <= 6, where + ": " + chord.name);
      assert.strictEqual(pc(chord.root), chord.pc, where + ": " + chord.name + " has the wrong note in the bass");
      assert.strictEqual(pc(chord.fifth), (chord.pc + 7) % 12, where + ": " + chord.name);
      assert(chord.fifth >= 40, where + ": " + chord.name + "'s other bass note is below the guitar");
      chord.notes.forEach((m, i) => {
        assert(chord.tones.includes(pc(m)), where + ": " + chord.name + " has a wrong note");
        assert(m >= 40 && m <= 76, where + ": " + chord.name + " is off the neck");
        if (i) assert(m > chord.notes[i - 1], where + ": " + chord.name + " is out of order");
      });
      chord.tones.forEach(t => assert(chord.notes.some(m => pc(m) === t), where + ": " + chord.name + " is missing a note"));
    });

    // the scale suggested for soloing has the key note and five notes
    assert.strictEqual(song.scale.length, 5);
    assert.strictEqual(song.scale[0], key.tonic);
  }

  // the same seed makes the same song, and another key only moves it
  const a = makeSong(seed, "G"), b = makeSong(seed, "G"), c = makeSong(seed, "D");
  assert.deepStrictEqual(a.bars.map(x => x.chord.name), b.bars.map(x => x.chord.name));
  assert.deepStrictEqual(a.bars.map(x => (x.chord.pc + 5) % 12), c.bars.map(x => (x.chord.pc + 10) % 12));
  assert(KEYS.includes(makeSong(seed).key), "no key chosen");
}
assert(seen.size > 150, "only " + seen.size + " different songs");

// every style's strums land inside its bar and start on the one
for (const style of STYLES) {
  assert.strictEqual(style.plans.length, 3, style.id);
  style.strums.forEach((text, i) => {
    const plan = style.plans[i];
    assert.strictEqual(plan.length, style.steps, style.id);
    text.split(" ").forEach(part => {
      const [at, stroke] = part.split(":");
      assert(+at >= 0 && +at < style.steps, `${style.id}: a strum on step ${at} of ${style.steps}`);
      assert(/^[badDu123]$/.test(stroke), `${style.id}: what is "${stroke}"?`);
    });
    assert(plan[0], style.id + ": nothing on the one");
  });
}

console.log(`ok: ${songs} songs (${seen.size} different), ${shortest} to ${longest} bars`);
