// node test/browser.test.js [path-to-chromium]
// Drives a real (headless) Chromium with taps, and a fake microphone that plays a
// note we know. Node built-ins only: a tiny DevTools-protocol client over WebSocket.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { spawn } = require("child_process");

const CHROMIUM = process.argv[2] || process.env.CHROMIUM || "/usr/bin/chromium";
const ROOT = path.join(__dirname, "..");
const SHOTS = path.join(ROOT, "shots");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "porch-test-"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

// a mono 16-bit wav of a steady note, a whole number of cycles long so it loops cleanly;
// or, with pluck, one that is struck, rings, dies away into room noise, and is struck again
function writeNote(file, freq, pluck = false, rate = 48000) {
  // Half a minute, so no test reaches the end: Chromium's pretend microphone leaves a
  // gap of silence where the file loops, which no real note has.
  const n = rate * 30;
  const data = Buffer.alloc(44 + n * 2);
  data.write("RIFF", 0); data.writeUInt32LE(36 + n * 2, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const p = 2 * Math.PI * freq * i / rate;
    let v = 0.5 * Math.sin(p) + 0.3 * Math.sin(2 * p) + 0.15 * Math.sin(3 * p);
    if (pluck) {
      const t = (i % (rate * 1.5)) / rate;                 // a pluck every second and a half
      v = 0.4 * Math.exp(-2.5 * t) * Math.sin(p) + 0.5 * Math.exp(-4 * t) * Math.sin(2 * p) + 0.3 * Math.exp(-6 * t) * Math.sin(3 * p)
        + 0.2 * Math.exp(-60 * t) * (Math.random() * 2 - 1) + 0.004 * (Math.random() * 2 - 1);
    }
    data.writeInt16LE(Math.round(v * 0.5 * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, data);
}

async function browser(wav, run) {
  const dir = fs.mkdtempSync(path.join(tmp, "profile-"));
  const args = ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + dir, "--no-first-run",
    "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    "--use-fake-device-for-media-stream"];
  // with a note to play, say yes to the microphone prompt; with none, leave the answer to the test
  if (wav) args.push("--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=" + wav);
  const proc = spawn(CHROMIUM, args.concat("about:blank"), { stdio: ["ignore", "ignore", "pipe"] });
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let err = "";
      proc.stderr.on("data", d => { err += d; const m = err.match(/DevTools listening on (ws:\S+)/); if (m) resolve(m[1]); });
      proc.on("exit", () => reject(new Error("chromium exited:\n" + err)));
      setTimeout(() => reject(new Error("chromium didn't start:\n" + err)), 30000);
    });
    const port = new URL(wsUrl).port;
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = targets.find(t => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let nextId = 0;
    const waiting = new Map(), errors = [];
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && waiting.has(msg.id)) {
        const { res, rej } = waiting.get(msg.id);
        waiting.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        errors.push(msg.params.args.map(a => a.value || a.description).join(" "));
      }
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++nextId;
      waiting.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const b = {
      send, errors,
      async evaluate(expr) {
        const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async size(width, height, mobile) {
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile });
        await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
      },
      async open(url) {
        await send("Page.navigate", { url });
        for (let i = 0; i < 100 && !(await b.evaluate("!!window.porch").catch(() => false)); i++) await sleep(100);
      },
      // a real tap in the middle of an element: the page sees a user gesture, as it would from a finger
      async tap(selector) {
        const r = await b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
          el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        for (const type of ["mousePressed", "mouseReleased"]) {
          await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: "left", clickCount: 1 });
        }
        await sleep(60);
      },
      async shot(name) {
        const r = await send("Page.captureScreenshot", { format: "png" });
        fs.mkdirSync(SHOTS, { recursive: true });
        fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from(r.data, "base64"));
      },
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await run(b);
    assert.deepStrictEqual(errors, [], "the page logged errors");
    ws.close();
  } finally {
    proc.kill();
    await new Promise(r => proc.on("exit", r));
  }
}

// how loud is the kit's output right now? (peak over a short listen)
const LOUDNESS = `(async () => {
  const an = porch.audio.createAnalyser(); an.fftSize = 2048; porch.kit.master.connect(an);
  const buf = new Float32Array(2048); let peak = 0;
  for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 50)); an.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); }
  porch.kit.master.disconnect(an); return peak; })()`;

(async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(ROOT, "index.html")));
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const url = `http://localhost:${server.address().port}/`;
  const wav = (name, freq, pluck) => { const f = path.join(tmp, name + ".wav"); writeNote(f, freq, pluck); return f; };

  try {
    /* ---- a phone: the drums ---- */
    await browser(wav("a110", 110), async b => {
      await b.size(390, 844, true);
      await b.open(url);
      await b.shot("phone-drum");
      const first = await b.evaluate("porch.beat.style.id");
      assert.strictEqual(first, "boomchick", "a first visit starts on a friendly boom-chick");
      assert(await b.evaluate("document.documentElement.scrollWidth <= innerWidth"), "the page is wider than the phone");

      await b.tap("#playBtn");
      await sleep(1500);
      assert(await b.evaluate("porch.playing"), "play didn't start");
      assert.strictEqual(await b.evaluate("porch.audio.state"), "running");
      assert(await b.evaluate("document.querySelector('#bars b') !== null"), "no count-in showing");
      await sleep(4000);
      await b.shot("phone-drum-playing");
      const loud = await b.evaluate(LOUDNESS);
      assert(loud > 0.05, "the drums are playing but nothing is coming out (peak " + loud + ")");
      assert(loud < 1.5, "the drums are far too hot (peak " + loud + ")");
      // new beats, style changes and edits while it plays
      for (let i = 0; i < 8; i++) { await b.tap("#newBeatBtn"); await sleep(250); }
      await b.tap("#styleChips .chip:nth-child(4)");
      await b.tap(".cell[data-i='3'][data-s='5']");
      assert.strictEqual(await b.evaluate("porch.beat.cells.hat[5]"), 1, "tapping a square didn't turn it on");
      await sleep(3000);
      const stats = await b.evaluate("porch.stats");
      console.log("  drums:", JSON.stringify(stats), "peak", loud.toFixed(2));
      assert(stats.steps > 60, "the scheduler barely ran");
      assert.strictEqual(stats.late, 0, "notes were booked after their time (a stumble you can hear)");
      await b.tap("#playBtn");
      await sleep(2200);
      assert(!(await b.evaluate("porch.playing")));
      const quiet = await b.evaluate(LOUDNESS);
      assert(quiet < 0.01, "still making sound after stop (peak " + quiet + ")");

      // a beat survives a trip through its link
      const same = await b.evaluate(`(() => { const a = porch.encodeBeat(), c = porch.decodeBeat(a);
        return location.hash === "#" + a && c.title === porch.beat.title && c.story === porch.beat.story
          && JSON.stringify(c.cells) === JSON.stringify(porch.beat.cells); })()`);
      assert(same, "the link doesn't bring back the same beat");

      // the kit, rendered offline: no clipping, no silence, and hits where the grid says
      const off = await b.evaluate(`(async () => {
        const rate = 48000, dur = porch.stepDuration(), steps = porch.beat.steps, bars = 4;
        const ctx = new OfflineAudioContext(1, Math.ceil(rate * (dur * steps * bars + 1.5)), rate);
        const kit = porch.makeKit(ctx, ctx.destination);
        kit.master.gain.value = 1.1;                 // volume all the way up
        for (let bar = 0; bar < bars; bar++) for (let s = 0; s < steps; s++) porch.scheduleStep(bar, s, 0.05 + (bar * steps + s) * dur, kit);
        const d = (await ctx.startRendering()).getChannelData(0);
        let peak = 0, bad = 0, sum = 0;
        for (const v of d) { if (!isFinite(v)) bad++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
        return { peak, bad, rms: Math.sqrt(sum / d.length), seconds: d.length / rate };
      })()`);
      console.log("  offline:", JSON.stringify(off));
      assert.strictEqual(off.bad, 0);
      assert(off.peak < 1, "the kit clips at full volume (peak " + off.peak + ")");
      assert(off.rms > 0.01, "the offline render is silent");

      // the reference notes are themselves in tune (checked with the tuner's own ear)
      const plucks = await b.evaluate(`(async () => {
        const out = [];
        for (const m of [28, 40, 45, 50, 55, 59, 64, 69, 76]) {
          const ctx = new OfflineAudioContext(1, 48000, 48000);
          const g = ctx.createGain(); g.connect(ctx.destination);
          const kit = porch.makeKit(ctx, g);
          kit.bus.disconnect(); kit.bus.connect(ctx.destination);      // dry: no room, no compressor
          kit.pluck(440 * Math.pow(2, (m - 69) / 12), 0);
          const d = (await ctx.startRendering()).getChannelData(0);
          const r = porch.detect(d.subarray(4800, 4800 + 8192), 48000, 25, 1400);
          out.push(r ? 1200 * Math.log2(r.freq / (440 * Math.pow(2, (m - 69) / 12))) : null);
        }
        return out; })()`);
      console.log("  reference notes, cents off:", plucks.map(c => c == null ? "?" : c.toFixed(1)).join(" "));
      plucks.forEach(c => assert(c != null && Math.abs(c) < 3, "a reference note is out of tune: " + c));

      /* ---- a phone: the tuner hears A2 (110 Hz) ---- */
      await b.tap(".tab[data-tab='tune']");
      await sleep(300);
      await b.shot("phone-tune-gate");
      if (!(await b.evaluate("porch.listening"))) await b.tap("#micStart");
      await sleep(3500);
      assert(await b.evaluate("porch.listening"), "the tuner didn't start");
      const r = await b.evaluate("porch.reading");
      console.log("  tuner, 110 Hz:", JSON.stringify(r));
      assert(r, "the tuner heard nothing");
      assert.strictEqual(r.note, "A2");
      assert(Math.abs(r.cents) < 2, "110 Hz read " + r.cents + " cents off");
      assert.strictEqual(await b.evaluate("document.querySelector('#note').textContent"), "A2");
      assert.strictEqual(await b.evaluate("document.querySelector('#verdict').textContent"), "in tune ✓");
      assert(await b.evaluate("document.querySelector('.string[data-m=\"45\"]').classList.contains('tuned')"), "A didn't get its tick");
      await b.shot("phone-tune");
      // pressing play lets go of the microphone
      await b.tap(".tab[data-tab='drum']");
      assert(!(await b.evaluate("porch.listening")), "the microphone stayed on after leaving the tuner");
    });

    /* ---- out-of-tune strings read as out of tune, by the right amount ---- */
    const cases = [["low E, 20 cents flat", 40, -20, "E2"], ["high E, 12 cents sharp", 64, 12, "E4"], ["G, 35 cents sharp", 55, 35, "G3"],
      ["plucked D in a noisy room, 8 cents sharp", 50, 8, "D3", true], ["plucked low E, in tune", 40, 0, "E2", true]];
    for (const [name, midi, cents, note, pluck] of cases) {
      await browser(wav("note", midiToFreq(midi + cents / 100), pluck), async b => {
        await b.size(390, 844, true);
        await b.open(url);
        await b.tap(".tab[data-tab='tune']");
        if (!(await b.evaluate("porch.listening"))) await b.tap("#micStart");
        await sleep(1500);
        // watch it for a few seconds: every reading it shows has to be right, not just one
        const seen = [];
        for (let i = 0; i < 40; i++) { await sleep(100); const r = await b.evaluate("porch.reading"); if (r) seen.push(r); }
        const worst = Math.max(...seen.map(r => Math.abs(r.cents - cents)));
        console.log(`  tuner, ${name}: ${seen.length} readings, worst ${worst.toFixed(2)} cents from the truth`);
        assert(seen.length >= 20, name + ": heard it only " + seen.length + " times in 4 s");
        assert(seen.every(r => r.note === note), name + ": wrong string");
        assert(worst < 3, name + ": a reading was " + worst + " cents out");
        if (cents === -20) await b.shot("phone-tune-flat");
        if (pluck) await b.shot("phone-tune-pluck" + midi);
      });
    }

    /* ---- microphone refused: say so, kindly, and let them try again ---- */
    await browser(null, async b => {
      await b.send("Browser.setPermission", { permission: { name: "microphone" }, setting: "denied", origin: new URL(url).origin });
      await b.size(390, 844, true);
      await b.open(url);
      await b.tap(".tab[data-tab='tune']");
      await b.tap("#micStart");
      await sleep(800);
      const msg = await b.evaluate("document.querySelector('#micMsg').textContent");
      console.log("  refused:", msg.slice(0, 60) + "…");
      assert(/blocked/.test(msg), "no explanation when the microphone is refused");
      assert(!(await b.evaluate("porch.listening")));
      await b.shot("phone-tune-refused");
      // and tuning by ear still works: a string plays its note
      await b.tap(".string[data-m='45']");
      await sleep(200);
      assert((await b.evaluate(LOUDNESS)) > 0.02, "the reference note made no sound");
    });

    /* ---- a laptop: both side by side, light and dark ---- */
    await browser(wav("a110", 110), async b => {
      await b.size(1280, 800, false);
      await b.open(url + "#train.k3f9a.104.20.2qj4-jm8z4-0-0-1v4hs-0");
      assert.strictEqual(await b.evaluate("porch.beat.style.id"), "train", "a link didn't open its beat");
      await b.tap("#micStart");
      await sleep(2500);
      await b.shot("laptop");
      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
      await sleep(600);
      await b.shot("laptop-dark");
      // space plays, and the tuner steps aside for the drums
      await b.send("Input.dispatchKeyEvent", { type: "keyDown", code: "Space", key: " " });
      await sleep(1500);
      assert(await b.evaluate("porch.playing && !porch.listening"), "space didn't swap the tuner for the drums");
      await b.shot("laptop-dark-playing");
    });

    console.log("ok");
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(err => { console.error(err); process.exit(1); });
