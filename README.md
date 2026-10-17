# Lyre

A minimalist virtual instrument inspired by the ancient Greek lyre. Pluck and strum seven strings with your fingers. Every sound is synthesized in real time, with no audio samples.

> **Status:** early prototype. The instrument is playable. Settings, the melody mode and offline install are still in progress.

## Features

- **Physically modeled strings.** The sound of a plucked string is generated as you play.
- **Strum freely.** Sweep across any number of neighboring strings, from two to all seven, in either direction.
- **Expressive playing.** Where you pluck changes the tone: bright near the bridge, soft toward the middle. How fast you move changes the volume.
- **Mute with your finger.** Rest a finger on a ringing string to silence it, just like on a real lyre.
- **Ancient Greek tunings.** Diatonic, chromatic and enharmonic tetrachords, based on Pythagorean and Archytan ratios.
- **Works anywhere.** Phone, tablet or desktop, in portrait or landscape. Built as an installable web app that will work offline.

### Planned

- Learning mode with guided melodies, starting with the *Song of Seikilos*, the oldest complete surviving musical composition
- Settings for tuning, scale and left-handed string order
- Offline support and installation to the home screen

## How to play

1. Open the app and press **Play**.
2. **Pluck** a string by dragging your finger across it, or by placing your finger on it and pulling away.
3. **Strum** by sweeping across several strings in one motion.
4. **Mute** a string by holding your finger still on it for half a second.

Just tapping a string does nothing. Like on a real instrument, the sound comes from the movement.

## Running locally

Lyre is plain HTML, CSS and JavaScript. It has no dependencies and no build step. Serve the folder with any static web server, for example:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>.

Audio worklets need a secure context, so the app only works over `localhost` or HTTPS. To try it on a phone, deploy it to GitHub Pages or another HTTPS host.

### Tests

The tests use Node.js (version 20 or newer):

```sh
npm test
```

## Built with

- Web Audio API (AudioWorklet) for sound synthesis
- Canvas 2D for drawing the strings
- Pointer Events for multi-touch input

## License

[MIT](LICENSE) © Jakub W. Adamczyk
