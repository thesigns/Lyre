# Lyre

A minimalist virtual instrument inspired by the ancient Greek lyre. Pluck and strum seven strings with your fingers. Every sound is synthesized in real time, with no audio samples.

**[Play online](https://thesigns.github.io/Lyre/)**

> **Status:** early version, under active development.

## Features

- **Physically modeled strings.** The sound of a plucked string is generated as you play.
- **Strum freely.** Sweep across any number of neighboring strings, from two to all seven, in either direction.
- **Expressive playing.** Where you pluck changes the tone: bright near the bridge, soft toward the middle. How fast you strum changes the volume.
- **Ancient Greek tunings.** Diatonic, chromatic and enharmonic tetrachords, based on Pythagorean and Archytan ratios, in several scales.
- **Learn a melody.** A red circle shows which string to pluck next. Start with the *Song of Seikilos*, the oldest complete surviving musical composition.
- **Works anywhere.** Phone, tablet or desktop, in portrait or landscape. Install it to your home screen and play offline.

## How to play

1. Open the app and press **Play**.
2. **Tap** a string to pluck it.
3. **Strum** by sweeping across several strings in one motion. Start between the strings to play only the strings you cross.

To learn a tune, choose **Melodies** in the menu. Press **Listen** to hear it first, then pluck the string marked with the red circle. The ring shows the note after it.

In **Settings** you can change the tuning, the pitch of the lowest string, the volume, and flip the strings for left-handed playing.

### Installing

- **Android and desktop Chrome or Edge:** open **Settings** and tap **Install app**.
- **iPhone and iPad:** tap **Share**, then **Add to Home Screen**.

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

### Releasing

The app is published from the `main` branch with GitHub Pages. Before pushing a new version, bump `VERSION` in `sw.js` so installed copies pick up the update. The offline cache is turned off on `localhost`; add `?sw` to the address to test it.

## Built with

- Web Audio API (AudioWorklet) for sound synthesis
- Canvas 2D for drawing the strings
- Pointer Events for multi-touch input

## License

[MIT](LICENSE) © Jakub W. Adamczyk
