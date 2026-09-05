# Drinoed OS

A fun little desktop OS that runs entirely in your browser — built with just HTML, CSS, and JavaScript. No frameworks, no build tools, no installs.

## Screenshots

<p align="center">
  <img src="ss/WEbos.png" alt="Drinoed OS Desktop Interface" width="80%">
</p>
## Features

- 🖥️ **Desktop** — click app icons to open them, drag to select multiple
- 🪟 **Windows** — draggable, minimizable, closable, and fullscreen-able
- 🚀 **Dock** — shows running & minimized apps, with an active-app indicator
- 🔍 **App Launcher** — search and launch any app (Spotlight-style)
- 🖱️ **Right-click menus** — on the desktop and on icons
- ⚙️ **Settings** — adjustable brightness and custom wallpapers
- 🧮 **Built-in apps** — Notepad, Calculator, Terminal, Files, Settings
- 🌐 **External apps** — YouTube, Spotify, Google Search, and more, opened in 16:9 windows
- 💾 **Persistence** — notes, wallpaper, and brightness are saved with `localStorage`
- ⌨️ **Keyboard shortcuts** — `Ctrl+Alt+T` (Terminal), `Ctrl+Alt+C` (Calculator), `Esc` (close menus)

## Getting Started

1. Download `index.html`, `os.js`, and `os.css`
2. Make sure your `src/` folder with icons and wallpapers is next to them
3. Open `index.html` in any browser — that's it, no server or build step needed

## File Structure

```
├── index.html      # Desktop, dock, top bar markup
├── os.js           # Window manager, dock, launcher, apps logic
├── os.css          # All styling
└── src/            # Icons and wallpaper images
```

## Adding a New App

Add an entry to the `apps` object in `os.js`:

```js
myApp: {
    name: "My App",
    icon: "src/myapp.png",
    type: "internal" // or "iframe"
    // url: "https://example.com"  (only for type: "iframe")
}
```

For an `internal` app, add its markup/logic alongside Notepad, Calculator, etc.

## A Known Limitation

Some external sites (Instagram, Gmail, WhatsApp, VS Code, Safari, etc.) send security headers (`X-Frame-Options` / `Content-Security-Policy`) that block them from being embedded in an iframe on any other site — that's a restriction enforced by the browser and the site itself, not something Drinoed OS can work around. Sites with an official embed mode (YouTube, Spotify, Google Search) work great; others are best opened in a real new tab.

## Tech Stack

Just vanilla **HTML5**, **CSS3**, and **JavaScript (ES6+)** — no dependencies.

## License

<<<<<<< HEAD
Feel free to use, modify, and share.
=======
Feel free to use, modify, and share.
>>>>>>> 77cbdf59ac9e0cc99bd98228aca257de8be107e3
