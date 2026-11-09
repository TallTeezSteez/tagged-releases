# Tagged desktop app (Windows)

A small window around the live site (tagged-xi.vercel.app). It holds no Tagged app code: the app itself is the website, so every Tagged update shows up by itself. Only change this folder to change the window. Windows only for now.

- `main.js`: the window, Window transparency (Windows acrylic, set by the page's Mocha look), opening outside links in the browser, and automatic updates (`electron-updater`, from this repo's releases: checks on launch and every 7 days, downloads in the background, installs when the app closes).
- `preload.js`: what the page can ask the window for (`window.taggedDesktop`).
- `offline.html`: shown when there's no connection.
- Try it: `npm install`, then `npm start`.

**Release a new version:** Actions → Release Tagged for Windows → Run workflow → type the version (like 1.0.1). It builds `Tagged-Setup-<version>.exe` and publishes it as a release here; installed apps update themselves. The version must be higher than the last one.

It isn't signed, so Windows warns on first run (More info → Run anyway).
