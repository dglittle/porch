# Design

porch grew out of two small web toys by the same author:

- **Drum Fables**, "a pocket drummer for porch jams": a page that rolled up a gentle acoustic beat in one of six folk styles, gave it a name like "Muddy Creek", and let you edit it on a grid.
- **Guitar Tuner**: a black page with two scrolling pixel plots of the pitch it heard, one showing all six strings and one zoomed in on the nearest string.

This is one thing made from both. Below: what was kept, what changed, and why.

## The idea

A jam has an order: you tune, somebody counts in, you play. The page follows that order, and its subtitle says it: *tune up, count in, play*. There are two rooms, **Tune** and **Drum**, with one tap between them. On a phone they are tabs at the bottom, where a thumb is. On a laptop they sit side by side.

The name comes from the old tagline. A porch is where this gets used.

## Kept

**From the drummer**

- The kit, built from oscillators and noise with no samples: kick, brush snare, cross-stick, hi-hat, shaker, tambourine, in a small room.
- The six styles and the strumming hint that goes with each.
- A name for every beat.
- The grid: tap for a hit, again for an accent, tap an instrument to mute it.
- Tempo, swing, volume. The human touch: small random nudges to timing and loudness.
- The paper-and-ink look, the dice, and the dedication at the bottom.

**From the tuner**

- The two views of pitch. The wide one (where am I among the strings?) is now the row of string buttons with a bead that slides along it. The close one (how far off am I?) is the ink trace.
- Pitch drawn as a line through time. This is the best thing about the original: a needle only shows now, but a trace shows the string settling as you turn the peg.
- One tap to start.

## Changed, and why

**One page, two rooms that take turns.** Starting the tuner stops the drums, and Play lets go of the microphone. A microphone that hears the drums can't hear the guitar, and on phones an open microphone changes how the speaker sounds. Taking turns avoids both, and it matches what people do anyway.

**The tuner says what it hears.** The original drew dots and left the reading to you. Now there's a note name you can read from across the room, cents, and a plain instruction ("flat · tune up ↑"). The trace is centred on the string you're tuning, with a green band for close enough (±5 cents).

**It remembers which strings are done.** A string that holds in tune gets a ✓. When all have one, the page offers the way to the drums. Tuning has an end, and now the page knows it.

**More than a guitar.** Ukulele, mandolin and fiddle, banjo, bass, and "any note" for everything else.

**Reference notes.** Tap a string to hear it plucked, and to lock the tuner onto it. Locking helps with a string that's far off (the tuner would otherwise guess a neighbour), and the sound means the page is still a tuner when the microphone is refused or missing.

**Its own pitch detector.** The original loaded a library from a CDN at run time, so it broke without a connection and whenever the CDN changed. The detector here is about 90 lines in the page (the McLeod method, coarse then fine). It reads plucked notes within a couple of cents and synthetic ones within one, has tests, and takes under a millisecond a frame.

**Raw microphone sound.** The original asked for the default microphone, which on phones comes with echo cancelling, noise suppression and automatic gain, all built for speech and all bad for a sustained note. The page asks for those to be off, and filters out rumble and hiss before listening.

**Microphone manners.** Ask only when the tuner is started. If permission was already given, don't make people tap again. If it's refused, say so in words and say how to fix it. Let go when leaving the tuner or the page, so the phone's recording light goes out.

**A count-in.** One bar of sticks before the beat. Without it, starting together with a drum machine is a guess. It can be turned off.

**Fills.** Every fourth bar ends with a small turn-around, drawn from the beat's own instruments, so a loop sounds like a player and you can hear where the phrase ends. It can be turned off. Four dots show where you are in the phrase.

**Fables are now fables.** Every beat gets a one-line story as well as a name ("in which a sleepy mule races the 5:15 freight to the crossing"), and the story's ending is written for the style. A seventh style, Hambone, joins the six.

**A beat is a link.** The name, story and pattern grow from a seed, and the seed, the settings and your edits fit after the `#` in the address. Send it to someone and they hear what you hear. The page also remembers your last beat and settings.

**The first beat is always a Boom-Chick.** The first thing anyone hears should be the plainest, most useful beat. After that, "Surprise me".

**Hands.** Drag to paint the grid without blocking the page's scroll. Tap tempo. Space, N, T and arrow keys on a laptop. The screen stays awake while playing or tuning.

**Sturdier sound on phones.** One audio context, made on the first tap and woken again after a phone call or a locked screen. It asks for the playback audio session where the browser has one, so the silent switch doesn't mute the drums. Notes are booked on the audio clock a little ahead, and further ahead when the page goes to the background. Stop is instant, including notes already booked. A soft ceiling on the output, so a loud accent can't crackle.

**One file.** No libraries, no build, no requests after load. It can be served from anywhere, saved, or mailed.

**Dark mode,** following the device.

## The song

The first person to play along with the drummer asked for the rest of the band: chords, for a whole song, to practise single-note lead playing over. That is the second thing a porch jam needs after a beat, so it's a switch at the top of the drummer ("Just a beat" or "A whole song") and not a third room.

**A song is the beat, continued.** It grows from the same seed, keeps the beat's name and story, and travels in the same link with one more field for its key. An old link is still a beat.

**Ordinary on purpose.** The request was for a "random-normal" song, and normal is the point: you practise over the changes you'll meet. So the progressions are the common ones (I, IV, V and the relative minor; i, VII and VI in a minor key), eight bars to a part, one chord to a bar. The verse sits at home, the chorus opens somewhere else, the bridge ends wanting to come back. The order is one of four familiar ones, with a four-bar intro borrowed from the end of the verse and a three-bar ending that lands on the home chord and rings.

**It says where you are.** A soloist needs three things at a glance: the chord now, the chord next and when, and how far through the part we are. The chord is the biggest thing on the card. The road map shows the whole song, and tapping a part starts from there, because the bridge is the bit that needs the most goes.

**It shows what to play.** Under the chart is a neck with the five notes of the key's pentatonic scale, which fit over every chord in the song. As each chord comes round its own notes light up, including the ones outside the scale: those are the notes that sound like you meant it. The neck is that of whichever instrument the tuner is set to.

**The guitar plays like the style.** Each style has three ways of strumming: one for verses, a busier one for choruses, and a held chord for the bridge. Boom-Chick alternates bass notes with strums, the lullaby picks arpeggios, the waltz goes bass-strum-strum. The whole band plays the chorus a little harder and the bridge a little softer, and fills move from every fourth bar to the last bar of each part.

**Go round again.** A song ends, as songs do. For longer practice a toggle skips the ending and returns to the first verse.

**Keys you'd meet on a porch.** G, C, D, A, E, A minor and E minor: the keys of open chords. Changing key moves the same song, so you can try the same solo somewhere else on the neck.

## Left out on purpose

- **Tuning while the drums play.** See above.
- **Accounts, saved lists, a server.** A link is enough.
- **Sampled drums.** They would sound more real, and the page would stop being one small file that explains itself.
- **A needle.** The trace does the same job and shows more.
- **A melody.** The band leaves the tune to you.
