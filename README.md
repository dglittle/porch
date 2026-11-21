# 🥁 porch

**A tuner and a pocket drummer for porch jams, in one web page.** Tune up, tap Play, and a soft acoustic kit counts you in and keeps time. Ask for a whole song and the drummer brings a guitar player: verses, choruses and a bridge to play a solo over. Every beat has a name and a one-line story, and there's always another one on the dice.

![The tuner showing a low E 20 cents flat, the drummer playing a beat called "Clover Biscuit", and a song in its bridge with the chord marked on a guitar neck](screenshot.png)

## Try it

**https://dglittle.github.io/porch/** on your phone (or a laptop). Nothing to install, and no account. Add it to your home screen if you like it.

Or run your own copy: it's one file. Open `index.html` over `https://` or `http://localhost` (browsers only give the microphone to those), for instance with `python3 -m http.server` in this folder.

## What it does

**Tune.** Pick an instrument (guitar, ukulele, mandolin or fiddle, banjo, bass, or "any note") and play a string.

- A big note name says what it hears, with how many cents flat or sharp and which way to turn.
- An ink line scrolls down the page showing the last four seconds of pitch, so you can watch a string settle into the green band as you turn the peg.
- Each string gets a ✓ once it has held in tune. When they all have one, a button offers to take you to the drums.
- Tap a string to hear it plucked and to lock the tuner onto it. That also works with no microphone at all, for tuning by ear.

**Drum.** Tap Play. You get a bar of sticks to count you in, then the beat.

- 🎲 **New beat** rolls a fresh one in the style you chose: Train Beat, Boom-Chick, Front-Porch Waltz, Back-Porch Shuffle, 6/8 Lullaby, Hambone or Porch Groove. Each has a strumming hint for the guitar player.
- Every beat gets a name and a story (*"Clover Biscuit", in which a one-eyed rooster sweeps the porch one board at a time*).
- Tap squares in the grid to change it: once for a hit, twice for an accent, drag to paint. Tap an instrument to hush it.
- Tempo (or tap it), swing, volume, a count-in you can turn off, and a little fill every fourth bar.
- 🔗 shares a link to the exact beat you're hearing, edits and all, to send to whoever you jam with.

**A whole song.** Switch from "Just a beat" to "A whole song" and a strummed guitar joins the drums: an intro, verses, choruses, a bridge and an ending, about two minutes of it. It's a band to practise lead playing over.

- The chord being played is written large, with the one coming next and how many bars away it is. Below is the chart for the part you're in, and a road map of the whole song. Tap a part to start from there.
- A neck (of whichever instrument the tuner is set to) shows the five notes that fit the whole song. The notes of the current chord light up as it comes round: those are the ones to land on.
- Choose the key, or leave it to the dice. The same song in another key keeps its shape.
- "Go round again" skips the ending and goes back to the first verse, for as long as you want to keep playing.
- The guitar has its own volume, and the link carries the song as well as the beat.

The tuner and the drums take turns: starting one stops the other, because a microphone that can hear the drums can't hear your guitar.

## How it works

Everything is in [`index.html`](index.html): plain HTML, CSS and JavaScript, with no build step, no libraries and no network requests after the page loads. [`DESIGN.md`](DESIGN.md) says why it is the way it is.

- **The kit is made, not recorded.** Each drum is a few oscillators and some filtered noise through the Web Audio API, with a small generated room around them. The reference notes are plucked strings (Karplus-Strong) tuned to within a hundredth of a semitone.
- **Time comes from the audio clock.** A timer wakes up every 25 ms and books the notes for the next 120 ms on the audio clock, so a busy page can make the lights stutter but not the beat. When the page is in the background it books further ahead.
- **The tuner finds pitch itself.** It uses the McLeod pitch method (a normalised autocorrelation): a quick pass on a downsampled copy to find the right peak, then a fine pass at full rate, then a parabola through the top for the last fraction of a sample. It runs in under a millisecond. The microphone is asked for raw sound (no echo cancelling or noise suppression, which mangle musical notes), and nothing it hears leaves the page.
- **The guitar is made the same way.** Each string is the same plucked-string loop, picked a fifth of the way along and put through a few filters standing in for a wooden box. A strum is three to six of them a few milliseconds apart, down or up, and the hand damps a string before it plays it again. The chords are the open shapes a guitarist learns first, and barre chords where there isn't one.
- **A beat is a seed.** The name, story and pattern all grow from one random number, and the whole beat (style, seed, tempo, swing, and the grid as you edited it) fits in the link after the `#`.
- **A song grows from the same seed.** The seed picks a key, an eight-bar progression each for the verse, chorus and bridge from lists of the usual ones, and an order to play them in. Each style has its own way of strumming them, busier in the chorus and held back in the bridge. Fills move to the last bar of each part, where a drummer would put them.
- **Phones first.** Audio starts on your first tap, as phones require; the screen stays awake while you play or tune; the microphone is let go the moment you leave the tuner.

## Tests

Node's built-ins only; nothing to install.

```
node test/pitch.test.js      # the pitch detector, against 600 notes whose pitch we know
node test/song.test.js       # 2,800 songs: the right parts, real chords a guitar can play, strums that fit the bar
node test/browser.test.js    # the real page in headless Chromium, with a pretend microphone
```

The browser test plays notes into a pretend microphone and checks that the tuner names them and gets the cents right, plays the drums and checks that no note was booked late and nothing clips, plays a song (changes its key, jumps to the bridge, lets it end by itself, checks the guitar's strings are in tune), refuses the microphone and checks the page says what to do, and takes phone- and laptop-sized screenshots into `shots/`. It looks for Chromium at `/usr/bin/chromium`; set `CHROMIUM` to point it somewhere else.

## Not yet

- **Tested on real phones by ear.** The tests drive desktop Chromium. The code follows the iPhone rules (audio from a tap, the right audio session, resume after an interruption), but nobody has yet checked it against a real guitar on a real porch.
- **A guitar tuned by ear.** The tests can measure that the song guitar is in tune, on time and about as loud as the drums. They can't say whether it sounds good. Its tone and level were set by measurement and still want a listener.
- **More kinds of song.** One chord to a bar, eight bars to a part, seven keys. No twelve-bar blues, no chords that change mid-bar, no capo, and no way to type in the chords of a song you know.
- **Other tunings.** Drop D, open G, a capo, or an A other than 440 Hz. "Any note" covers them for now.
- **Favourites.** There's no list of beats and songs you liked, other than saving their links. And the drum pattern is the same bar in the verse and the chorus; only how hard it's played changes.
- **Offline.** It needs a connection to load. After that it needs nothing, but it isn't an installable app with a service worker.
- **Tuning while the drums play.** They take turns.

## License

MIT
