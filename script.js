/* =========================================================
   DRINOED OS
   Complete Desktop / Window Manager / Dock / Settings
   v2 — consolidated + bugfixes
========================================================= */

(() => {
    "use strict";

    /* =========================================================
       CONFIG
    ========================================================= */

    const TOP_BAR_HEIGHT = 30;
    const DEFAULT_WINDOW_WIDTH = 700;
    const DEFAULT_WINDOW_HEIGHT = 520;

    // Apps that open at a fixed, non-resizable standard size
    // instead of the generic default window dimensions.
    const FIXED_APP_SIZES = {
        calculator: { width: 340, height: 520 }
    };

    // How much of the header must stay reachable on screen while dragging.
    const MIN_VISIBLE_RATIO = 0.2;      // 20% of header width
    const MIN_VISIBLE_HEIGHT = 40;      // px of the window kept visible vertically

    let highestZIndex = 100;

    const runningApps = new Map();   // appId -> window element
    const windowStates = new Map();  // appId -> {width,height,left,top} before fullscreen

    const fullscreenWindows = new Set(); // windows currently fullscreen (drives dock hide)

    let launcher = null;
    let contextMenu = null;

    /* =========================================================
       APP DATABASE
    ========================================================= */
    const apps = {
        notes:      { name: "Notepad",    icon: "src/note.png",       type: "internal" },
        vscode:     { name: "VS Code",    icon: "src/VScode.png",     type: "iframe", url: "https://onecompiler.com/embed/" },
        brave:      { name: "Brave",      icon: "src/Brave.png",      type: "iframe", url: "https://www.google.com/search?igu=1&q=" },
        terminal:   { name: "Terminal",   icon: "src/Terminal.png",   type: "internal" },
        settings:   { name: "Settings",   icon: "src/setting.png",    type: "internal" },
        calculator: { name: "Calculator", icon: "src/calculator.png", type: "internal" },
        safari:     { name: "Safari",     icon: "src/Safari.png",     type: "iframe", url: "https://www.google.com/search?igu=1&q=" },
        chrome:     { name: "Chrome",     icon: "src/Chrome.png",     type: "iframe", url: "https://www.google.com/search?igu=1&q=" },
        pinterest:  { name: "Pinterest",  icon: "src/Pinterest.png",  type: "iframe", url: "https://www.pinterest.com/" },
        discord:    { name: "kobayashi OS",    icon: "src/Kiyo.png",    type: "iframe", url: "https://dev-dock-ruddy.vercel.app/" },
        archery:  { name: "Archery",  icon: "src/Arch.png",      type: "iframe", url: "https://www.madkidgames.com/full/bowmasters-archery-shooting" },
        spotify:    { name: "Spotify",    icon: "src/Spotify.png",    type: "iframe", url: "https://open.spotify.com/embed/album/2ODvWsOgouMbaA5xf0RkJe?utm_source=oembed" },
        Youtube:   { name: "Youtube",   icon: "src/youtube.png",       type: "iframe", url: "https://www.youtube-nocookie.com/embed/2DFKIllyMOY?si=6Mb053DK-HC4gC44" },
        files:      { name: "Files",      icon: "src/Files.png",      type: "internal" },
        Block_Blast:      { name: "Block Blast",      icon: "src/Block.png",      type: "iframe", url: "https://www.madkidgames.com/full/block-blast-puzzle-game" }
    };

    /* =========================================================
       START
    ========================================================= */

    function init() {
        setupClock();
        setupExistingWindows();

        setupDesktopApps();
        setupDesktopSelection();
        setupDesktopContextMenu();

        setupDock();
        setupOSMenu();

        setupKeyboardShortcuts();
        setupGlobalDismiss();

        createBrightnessOverlay();
        loadSavedSettings();

        createBootScreen();
    }

    /* =========================================================
       CLOCK
    ========================================================= */

    function setupClock() {
        updateClock();
        updateDate();
        setInterval(updateClock, 1000);
        setInterval(updateDate, 60000);
    }

    function updateClock() {
        const el = document.getElementById("time-text");
        if (!el) return;
        el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function updateDate() {
        const el = document.getElementById("date-text");
        if (!el) return;
        el.textContent = new Date().toLocaleDateString([], {
            weekday: "short", day: "numeric", month: "short", year: "numeric"
        });
    }

    /* =========================================================
       DESKTOP APPS
    ========================================================= */

    function setupDesktopApps() {
        document.querySelectorAll(".desktopApps").forEach(icon => {
            const appId = icon.dataset.app;
            if (!appId || !apps[appId]) return;

            icon.addEventListener("click", e => {
                if (e.button !== 0) return;
                clearDesktopSelection();
                icon.classList.add("selected");
                openApp(appId);
            });

            icon.addEventListener("contextmenu", e => {
                e.preventDefault();
                e.stopPropagation();
                clearDesktopSelection();
                icon.classList.add("selected");
                showDesktopContextMenu(e.clientX, e.clientY, appId);
            });
        });
    }

    /* =========================================================
       OPEN APP
    ========================================================= */

    function openApp(appId) {
        const app = apps[appId];
        if (!app) return;

        closeContextMenu();
        closeLauncher();

        if (runningApps.has(appId)) {
            const win = runningApps.get(appId);
            restoreWindow(win);
            bringToFront(win);
            setDockState(appId, "active");
            return;
        }

        const win = createAppWindow(appId, app);
        document.body.appendChild(win);

        runningApps.set(appId, win);
        addToDock(appId, app);

        bringToFront(win);
        makeDraggable(win);
        setupWindowFocus(win);

        requestAnimationFrame(() => win.classList.add("window-open"));

        setDockState(appId, "active");
    }

    /* =========================================================
       CREATE APP WINDOW
    ========================================================= */

    function createAppWindow(appId, app) {
        const win = document.createElement("div");
        win.className = "window app-window";
        win.dataset.app = appId;

        const fixedSize = FIXED_APP_SIZES[appId];

        let width, height;

        if (fixedSize) {
            // Standard, fixed proportions — never stretched, never resized.
            width = Math.min(fixedSize.width, Math.max(260, window.innerWidth - 30));
            height = Math.min(fixedSize.height, Math.max(360, window.innerHeight - TOP_BAR_HEIGHT - 60));

            win.classList.add("fixed-size");
        } else if (app.type === "iframe") {
            // External/embedded apps default to a 16:9 window.
            const maxWidth = Math.max(480, window.innerWidth - 60);
            const maxHeight = Math.max(320, window.innerHeight - TOP_BAR_HEIGHT - 100);

            ({ width, height } = calculateAspectSize(16, 9, maxWidth, maxHeight));
        } else {
            width = Math.min(DEFAULT_WINDOW_WIDTH, Math.max(320, window.innerWidth - 30));
            height = Math.min(DEFAULT_WINDOW_HEIGHT, Math.max(240, window.innerHeight - TOP_BAR_HEIGHT - 80));
        }

        const left = Math.max(10, (window.innerWidth - width) / 2);
        const top = Math.max(TOP_BAR_HEIGHT + 15, (window.innerHeight - height) / 2);

        win.style.width = `${width}px`;
        win.style.height = `${height}px`;
        win.style.left = `${left}px`;
        win.style.top = `${top}px`;

        win.innerHTML = `
            <div class="header flex ac app-header">
                <div class="window_button flex ac">
                    <div class="clos window-close" title="Close"></div>
                    <div class="min window-min" title="Minimize"></div>
                    <div class="full window-full" title="Fullscreen"></div>
                </div>
                <div class="title">${escapeHTML(app.name)}</div>
            </div>
            <div class="container App_container">
                ${getAppContent(appId, app)}
            </div>
        `;

        win.querySelector(".window-close").addEventListener("click", e => {
            e.stopPropagation();
            closeApp(appId);
        });

        win.querySelector(".window-min").addEventListener("click", e => {
            e.stopPropagation();
            minimizeApp(appId);
        });

        win.querySelector(".window-full").addEventListener("click", e => {
            e.stopPropagation();
            toggleFullscreen(win);
        });

        setupInternalApp(appId, win);

        return win;
    }

    /* =========================================================
       APP CONTENT
    ========================================================= */

    function getAppContent(appId, app) {
        if (app.type === "iframe") {
            return `
                <iframe
                    src="${escapeAttribute(app.url)}"
                    title="${escapeAttribute(app.name)}"
                    allow="camera; microphone; fullscreen; autoplay; clipboard-read; clipboard-write"
                    loading="lazy"
                ></iframe>
            `;
        }

        switch (appId) {
            case "notes":      return getNotesApp();
            case "terminal":   return getTerminalApp();
            case "calculator": return getCalculatorApp();
            case "settings":   return getSettingsApp();
            case "files":      return getFilesApp();
            default:
                return `<div class="internal-app"><h2>${escapeHTML(app.name)}</h2></div>`;
        }
    }

    /* =========================================================
       NOTEPAD
    ========================================================= */

    function getNotesApp() {
        return `
            <div class="notes-app">
                <textarea id="notes-editor" placeholder="Start typing..." spellcheck="false"></textarea>
                <div class="notes-status">Saved locally</div>
            </div>
        `;
    }

    function setupNotes(win) {
        const editor = win.querySelector("#notes-editor");
        if (!editor) return;

        const saved = localStorage.getItem("drinoed-notes");
        if (saved !== null) editor.value = saved;

        editor.addEventListener("input", () => {
            localStorage.setItem("drinoed-notes", editor.value);
        });
    }

    /* =========================================================
       TERMINAL
    ========================================================= */

    function getTerminalApp() {
        return `
            <div class="terminal-app">
                <div class="terminal-output" id="terminal-output">
                    <div>Drinoed Terminal</div>
                    <div>Type "help" to see commands.</div>
                    <br>
                </div>
                <div class="terminal-input-row">
                    <span>user@drinoed:~$</span>
                    <input id="terminal-input" autocomplete="off" spellcheck="false">
                </div>
            </div>
        `;
    }

    function setupTerminal(win) {
        const input = win.querySelector("#terminal-input");
        const output = win.querySelector("#terminal-output");
        if (!input || !output) return;

        setTimeout(() => input.focus(), 100);

        input.addEventListener("keydown", e => {
            if (e.key !== "Enter") return;

            const command = input.value.trim();
            if (!command) return;

            const line = document.createElement("div");
            line.textContent = `user@drinoed:~$ ${command}`;
            output.appendChild(line);

            executeTerminalCommand(command, output);

            input.value = "";
            output.scrollTop = output.scrollHeight;
        });
    }

    function executeTerminalCommand(command, output) {
        const lower = command.toLowerCase();
        const result = document.createElement("div");

        switch (lower) {
            case "help":
                result.textContent = "help, clear, date, time, whoami, echo, neofetch, about, restart";
                output.appendChild(result);
                break;
            case "clear":
                output.innerHTML = "";
                break;
            case "date":
                result.textContent = new Date().toDateString();
                output.appendChild(result);
                break;
            case "time":
                result.textContent = new Date().toLocaleTimeString();
                output.appendChild(result);
                break;
            case "whoami":
                result.textContent = "user";
                output.appendChild(result);
                break;
            case "about":
                result.textContent = "Drinoed OS — HTML/CSS/JavaScript desktop environment.";
                output.appendChild(result);
                break;
            case "neofetch":
                result.textContent = "Drinoed OS\nCPU: Web Browser\nShell: Drinoed Terminal\nKernel: JavaScript";
                result.style.whiteSpace = "pre-line";
                output.appendChild(result);
                break;
            case "restart":
                location.reload();
                break;
            default:
                if (lower.startsWith("echo ")) {
                    result.textContent = command.substring(5);
                } else {
                    result.textContent = `Command not found: ${command}`;
                }
                output.appendChild(result);
        }
    }

    /* =========================================================
       CALCULATOR
       (single implementation — markup + wiring live together)
    ========================================================= */

    function getCalculatorApp() {
        return `
            <div class="calculator-app">
                <input class="calculator-display" id="calculator-display" type="text" value="0" readonly>
                <div class="calculator-buttons">
                    <button class="clear" data-value="C">C</button>
                    <button class="operator" data-value="(">(</button>
                    <button class="operator" data-value=")">)</button>
                    <button class="operator" data-value="/">÷</button>

                    <button data-value="7">7</button>
                    <button data-value="8">8</button>
                    <button data-value="9">9</button>
                    <button class="operator" data-value="*">×</button>

                    <button data-value="4">4</button>
                    <button data-value="5">5</button>
                    <button data-value="6">6</button>
                    <button class="operator" data-value="-">−</button>

                    <button data-value="1">1</button>
                    <button data-value="2">2</button>
                    <button data-value="3">3</button>
                    <button class="operator" data-value="+">+</button>

                    <button class="zero" data-value="0">0</button>
                    <button data-value=".">.</button>
                    <button class="equals" data-value="=">=</button>
                </div>
            </div>
        `;
    }

    function setupCalculator(win) {
        const display = win.querySelector("#calculator-display");
        const buttons = win.querySelectorAll(".calculator-buttons button");
        if (!display) return;

        let expression = "";

        const render = () => {
            display.value = expression
                ? expression.replace(/\*/g, "×").replace(/\//g, "÷")
                : "0";
        };

        const equals = () => {
            if (!expression.trim()) return;

            try {
                if (!/^[0-9+\-*/().\s]+$/.test(expression)) throw new Error("bad expression");

                const result = Function(`"use strict"; return (${expression})`)();

                if (!Number.isFinite(result)) throw new Error("bad result");

                expression = String(result);
                render();
            } catch {
                expression = "";
                display.value = "Error";
            }
        };

        buttons.forEach(button => {
            button.addEventListener("click", () => {
                const value = button.dataset.value;

                if (value === "C") {
                    expression = "";
                    render();
                    return;
                }

                if (value === "=") {
                    equals();
                    return;
                }

                expression += value;
                render();
            });
        });

        const keyboardHandler = e => {
            if (win.style.display === "none") return;
            if (!win.isConnected) return;

            const allowed = "0123456789+-*/().";

            if (allowed.includes(e.key)) {
                expression += e.key;
                render();
            } else if (e.key === "Enter") {
                equals();
            } else if (e.key === "Escape") {
                expression = "";
                render();
            } else if (e.key === "Backspace") {
                expression = expression.slice(0, -1);
                render();
            }
        };

        document.addEventListener("keydown", keyboardHandler);

        win._calculatorCleanup = () => {
            document.removeEventListener("keydown", keyboardHandler);
        };
    }

    /* =========================================================
       SETTINGS
    ========================================================= */

    function getSettingsApp() {
        return `
            <div class="settings-app">
                <div class="settings-sidebar">
                    <button class="settings-tab active" data-settings="appearance">Appearance</button>
                    <button class="settings-tab" data-settings="system">System</button>
                    <button class="settings-tab" data-settings="About">About</button>
                </div>

                <div class="settings-content">
                    <section class="settings-section" data-settings-page="appearance">
                        <h2>Appearance</h2>

                        <label>Brightness</label>
                        <input id="brightness-control" type="range" min="10" max="100" value="100">

                        <h3>Wallpaper</h3>
                        <div class="wallpaper-grid">
                            <button data-wallpaper="src/593257.jpg" style="background-image:url('src/593257.jpg')"></button>
                            <button data-wallpaper="src/5826308.jpg" style="background-image:url('src/5826308.jpg')"></button>
                            <button data-wallpaper="src/Gojo.png" style="background-image:url('src/Gojo.png')"></button>
                        </div>

                        <h3>Custom Wallpaper</h3>
                        <input id="wallpaper-file" type="file" accept="image/*">
                    </section>

                    <section class="settings-section hidden" data-settings-page="system">
                        <h2>System</h2>
                        <p>Drinoed OS</p>
                        <p>Version 1.0</p>
                        <button class="settings-action" id="reset-settings">Reset Settings</button>
                    </section>
                    <section class="About-section hidden" data-settings-page="About">
                        <h2>About</h2>
                        <p>Drinoed OS is a WEB based OS UI.</p>
                        <p>It build by Yoru Ayan on 5th setember 2026 and changes are going on.</p>
                        <p>Here are some more good projects on My Github <a href="https://github.com/aniway89">Here</a></p>

                    </section>
                </div>
            </div>
        `;
    }

    function setupSettings(win) {
        const brightness = win.querySelector("#brightness-control");

        if (brightness) {
            const saved = Number(localStorage.getItem("drinoed-brightness") || 100);
            brightness.value = Math.max(10, Math.min(100, saved));
            applyBrightness(brightness.value);

            brightness.addEventListener("input", () => {
                const value = Number(brightness.value);
                localStorage.setItem("drinoed-brightness", value);
                applyBrightness(value);
            });
        }

        win.querySelectorAll("[data-wallpaper]").forEach(button => {
            button.addEventListener("click", () => setWallpaper(button.dataset.wallpaper));
        });

        const fileInput = win.querySelector("#wallpaper-file");
        if (fileInput) {
            fileInput.addEventListener("change", () => {
                const file = fileInput.files[0];
                if (!file || !file.type.startsWith("image/")) return;

                const reader = new FileReader();
                reader.onload = e => {
                    localStorage.setItem("drinoed-custom-wallpaper", e.target.result);
                    setWallpaper(e.target.result);
                };
                reader.readAsDataURL(file);
            });
        }

        win.querySelectorAll(".settings-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const page = tab.dataset.settings;

                win.querySelectorAll(".settings-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");

                win.querySelectorAll("[data-settings-page]").forEach(section => {
                    section.classList.toggle("hidden", section.dataset.settingsPage !== page);
                });
            });
        });

        const reset = win.querySelector("#reset-settings");
        if (reset) {
            reset.addEventListener("click", () => {
                localStorage.removeItem("drinoed-brightness");
                localStorage.removeItem("drinoed-custom-wallpaper");

                if (brightness) brightness.value = 100;
                applyBrightness(100);
                setWallpaper("src/593257.jpg");
            });
        }
    }

    /* =========================================================
       FILES
    ========================================================= */

    function getFilesApp() {
        return `
            <div class="files-app">
                <div class="files-toolbar"><strong>Files</strong></div>
                <div class="files-empty">
                    <img src="src/Files.png">
                    <h3>This folder is empty</h3>
                    <p>Your files will appear here.</p>
                </div>
            </div>
        `;
    }

    /* =========================================================
       INTERNAL APP SETUP
    ========================================================= */

    function setupInternalApp(appId, win) {
        if (appId === "notes") setupNotes(win);
        if (appId === "terminal") setupTerminal(win);
        if (appId === "calculator") setupCalculator(win);
        if (appId === "settings") setupSettings(win);
    }

    /* =========================================================
       DOCK
    ========================================================= */

    function setupDock() {
        const dock = document.querySelector(".Dock");
        if (!dock) return;

        dock.querySelectorAll(".app").forEach(app => {
            if (!app.dataset.app) return;

            app.addEventListener("click", e => {
                e.stopPropagation();
                const id = app.dataset.app;

                if (id === "app-launcher") {
                    toggleLauncher();
                    return;
                }

                openApp(id);
            });
        });

        createAppsButton();
    }

    function createAppsButton() {
        const dock = document.querySelector(".Dock");
        if (!dock || dock.querySelector(".apps-dock-button")) return;

        const separator = document.createElement("div");
        separator.className = "dock-separator";

        const button = document.createElement("div");
        button.className = "app apps-dock-button";
        button.dataset.app = "app-launcher";
        button.title = "Open Apps";

        button.innerHTML = `<div class="apps-button-inner">${"<span></span>".repeat(9)}</div>`;

        button.addEventListener("click", e => {
            e.stopPropagation();
            toggleLauncher();
        });

        dock.appendChild(separator);
        dock.appendChild(button);
    }

    /* =========================================================
       DOCK APP MANAGEMENT
    ========================================================= */

    function addToDock(appId, app) {
        const dock = document.querySelector(".Dock");
        if (!dock) return;

        if (dock.querySelector(`.app[data-app="${appId}"]`)) return;

        const dockApp = document.createElement("div");
        dockApp.className = "app dynamic-app";
        dockApp.dataset.app = appId;
        dockApp.dataset.dynamic = "true";
        dockApp.title = app.name;

        dockApp.innerHTML = `
            <div class="wrap">
                <img src="${escapeAttribute(app.icon)}" alt="${escapeAttribute(app.name)}">
            </div>
        `;

        dockApp.addEventListener("click", e => {
            e.stopPropagation();
            openApp(appId);
        });

        const separator = dock.querySelector(".dock-separator");
        if (separator) {
            dock.insertBefore(dockApp, separator);
        } else {
            dock.appendChild(dockApp);
        }
    }

    function removeFromDock(appId) {
        const dockApp = document.querySelector(`.Dock .app[data-app="${appId}"]`);
        if (!dockApp || dockApp.dataset.dynamic !== "true") return;

        dockApp.classList.add("dock-removing");
        setTimeout(() => dockApp.remove(), 180);
    }

    /* =========================================================
       DOCK STATE
    ========================================================= */

    function setDockState(appId, state) {
        const dock = document.querySelector(".Dock");
        if (!dock) return;

        dock.querySelectorAll(".app").forEach(app => {
            app.classList.remove("active");
        });

        if (!appId) return;

        const app = dock.querySelector(`.app[data-app="${appId}"]`);
        if (!app) return;

        if (state === "active") {
            app.classList.remove("minimized-app");
            app.classList.add("active");
        }

        if (state === "minimized") {
            app.classList.add("minimized-app");
        }
    }

    /* =========================================================
       CLOSE
    ========================================================= */

    function closeApp(appId) {
        const win = runningApps.get(appId);
        if (!win) return;

        if (win.classList.contains("fullscreen")) {
            exitFullscreen(win);
        }

        win.classList.remove("window-open");
        win.classList.add("window-closing");

        setDockState(appId, null);

        setTimeout(() => {
            win._calculatorCleanup?.();

            win.remove();
            runningApps.delete(appId);
            windowStates.delete(appId);

            removeFromDock(appId);
            activateTopWindow();
        }, 210);
    }

    /* =========================================================
       MINIMIZE
    ========================================================= */

    function minimizeApp(appId) {
        const win = runningApps.get(appId);
        if (!win) return;

        if (win.classList.contains("fullscreen")) {
            exitFullscreen(win);
        }

        win.classList.remove("window-open");
        win.classList.add("window-minimizing");

        setDockState(appId, "minimized");

        setTimeout(() => {
            win.style.display = "none";
            win.classList.remove("window-minimizing");
            activateTopWindow();
        }, 210);
    }

    /* =========================================================
       RESTORE
    ========================================================= */

    function restoreWindow(win) {
        if (!win) return;

        win.style.display = "block";
        win.classList.remove("window-minimizing");

        requestAnimationFrame(() => win.classList.add("window-open"));

        setDockState(win.dataset.app, "active");
    }

    /* =========================================================
       WINDOW FOCUS
    ========================================================= */

    function setupWindowFocus(win) {
        win.addEventListener("mousedown", () => {
            if (win.style.display === "none") return;

            bringToFront(win);
            setDockState(win.dataset.app, "active");
        });
    }

    function bringToFront(win) {
        highestZIndex++;
        win.style.zIndex = highestZIndex;
    }

    function activateTopWindow() {
        let topWindow = null;
        let topZ = -Infinity;

        runningApps.forEach(win => {
            if (win.style.display === "none") return;
            if (win.classList.contains("window-closing")) return;

            const z = Number(win.style.zIndex || 0);
            if (z > topZ) {
                topZ = z;
                topWindow = win;
            }
        });

        if (topWindow) {
            setDockState(topWindow.dataset.app, "active");
        } else {
            document.querySelectorAll(".Dock .app").forEach(app => app.classList.remove("active"));
        }
    }

    /* =========================================================
       FULLSCREEN
       Hides the Dock (with a slide-down animation) while ANY
       window is fullscreen, restores it once none are.
    ========================================================= */

    function toggleFullscreen(win) {
        if (win.classList.contains("fullscreen")) {
            exitFullscreen(win);
        } else {
            enterFullscreen(win);
        }
    }

    function enterFullscreen(win) {
        windowStates.set(win.dataset.app, {
            width: win.style.width,
            height: win.style.height,
            left: win.style.left,
            top: win.style.top
        });

        win.classList.add("fullscreen");

        win.style.left = "0px";
        win.style.top = `${TOP_BAR_HEIGHT}px`;
        win.style.width = "100vw";
        win.style.height = `calc(100vh - ${TOP_BAR_HEIGHT}px)`;

        fullscreenWindows.add(win);
        updateDockVisibility();
    }

    function exitFullscreen(win) {
        const old = windowStates.get(win.dataset.app);

        win.classList.remove("fullscreen");

        if (old) {
            win.style.width = old.width;
            win.style.height = old.height;
            win.style.left = old.left;
            win.style.top = old.top;
        } else {
            resetWindowPosition(win);
        }

        fullscreenWindows.delete(win);
        updateDockVisibility();
    }

    function updateDockVisibility() {
        const dock = document.querySelector(".Dock");
        if (!dock) return;

        dock.classList.toggle("dock-hidden-fullscreen", fullscreenWindows.size > 0);
    }

    /* =========================================================
       DRAGGING

       Rule: a window may never move above the top bar, but is
       otherwise free to move anywhere on/below it. Horizontally
       it may be dragged mostly off-screen, as long as at least
       MIN_VISIBLE_RATIO (20%) of the header's width stays inside
       the visible viewport so the user can always grab it again.
    ========================================================= */

    function makeDraggable(win) {
        const header = win.querySelector(".header");
        if (!header) return;

        let dragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;

        header.addEventListener("mousedown", e => {
            if (e.target.closest(".window_button")) return;
            if (win.classList.contains("fullscreen")) return;
            if (e.button !== 0) return;

            dragging = true;

            startX = e.clientX;
            startY = e.clientY;
            startLeft = win.offsetLeft;
            startTop = win.offsetTop;

            bringToFront(win);
            setDockState(win.dataset.app, "active");

            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", stop);
        });

        function move(e) {
            if (!dragging) return;

            const width = win.offsetWidth;

            let left = startLeft + (e.clientX - startX);
            let top = startTop + (e.clientY - startY);

            const minVisible = Math.max(24, width * MIN_VISIBLE_RATIO);

            // Horizontal: allow moving mostly off-screen either side,
            // but keep at least `minVisible` px of the header reachable.
            const minLeft = -(width - minVisible);
            const maxLeft = window.innerWidth - minVisible;

            left = Math.min(maxLeft, Math.max(minLeft, left));

            // Vertical: never above the top bar; keep some of the
            // window visible if dragged toward the bottom edge.
            const minTop = TOP_BAR_HEIGHT;
            const maxTop = window.innerHeight - MIN_VISIBLE_HEIGHT;

            top = Math.min(maxTop, Math.max(minTop, top));

            win.style.left = `${left}px`;
            win.style.top = `${top}px`;
        }

        function stop() {
            dragging = false;
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", stop);
        }
    }

    /* =========================================================
       EXISTING (STATIC HTML) WINDOWS — e.g. the Welcome window
    ========================================================= */

    function setupExistingWindows() {
        const welcome = document.getElementById("window");
        const oldNotes = document.getElementById("window2");

        if (welcome) {
            makeDraggable(welcome);
            bringToFront(welcome);

            const close = welcome.querySelector(".clos");
            if (close) {
                close.addEventListener("click", e => {
                    e.stopPropagation();
                    welcome.style.display = "none";
                });
            }

            welcome.addEventListener("mousedown", () => bringToFront(welcome));
        }

        // Legacy static Notepad window — superseded by the unified
        // app-window system, so it's hidden rather than wired up.
        if (oldNotes) {
            oldNotes.style.display = "none";
        }
    }

    /* =========================================================
       DESKTOP SELECTION (drag-to-select icons)
    ========================================================= */

    function setupDesktopSelection() {
        const desktop = document.querySelector(".desktop_");
        if (!desktop) return;

        let selecting = false;
        let startX = 0, startY = 0;
        let selectionBox = null;

        desktop.addEventListener("mousedown", e => {
            if (e.button !== 0) return;
            if (e.target.closest(".desktopApps")) return;

            closeContextMenu();
            clearDesktopSelection();

            selecting = true;

            const rect = desktop.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;

            selectionBox = document.createElement("div");
            selectionBox.id = "desktop-selection";
            desktop.appendChild(selectionBox);

            document.addEventListener("mousemove", updateSelection);
            document.addEventListener("mouseup", finishSelection);
        });

        function updateSelection(e) {
            if (!selecting) return;

            const rect = desktop.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const left = Math.min(startX, x);
            const top = Math.min(startY, y);
            const width = Math.abs(x - startX);
            const height = Math.abs(y - startY);

            selectionBox.style.left = `${left}px`;
            selectionBox.style.top = `${top}px`;
            selectionBox.style.width = `${width}px`;
            selectionBox.style.height = `${height}px`;

            selectAppsInArea(left, top, width, height);
        }

        function finishSelection() {
            selecting = false;
            document.removeEventListener("mousemove", updateSelection);
            document.removeEventListener("mouseup", finishSelection);

            if (selectionBox) {
                selectionBox.remove();
                selectionBox = null;
            }
        }
    }

    function selectAppsInArea(x, y, width, height) {
        const desktop = document.querySelector(".desktop_");
        if (!desktop) return;

        const desktopRect = desktop.getBoundingClientRect();
        const right = x + width;
        const bottom = y + height;

        desktop.querySelectorAll(".desktopApps").forEach(app => {
            const rect = app.getBoundingClientRect();

            const appLeft = rect.left - desktopRect.left;
            const appTop = rect.top - desktopRect.top;
            const appRight = appLeft + rect.width;
            const appBottom = appTop + rect.height;

            const intersects = appLeft < right && appRight > x && appTop < bottom && appBottom > y;

            app.classList.toggle("selected", intersects);
        });
    }

    function clearDesktopSelection() {
        document.querySelectorAll(".desktopApps.selected").forEach(app => {
            app.classList.remove("selected");
        });
    }

    /* =========================================================
       DESKTOP CONTEXT MENU
    ========================================================= */

    function setupDesktopContextMenu() {
        document.addEventListener("contextmenu", e => {
            const desktop = e.target.closest(".desktop_");
            if (!desktop) return;

            e.preventDefault();

            const app = e.target.closest(".desktopApps");

            if (app) {
                clearDesktopSelection();
                app.classList.add("selected");
                showDesktopContextMenu(e.clientX, e.clientY, app.dataset.app);
            } else {
                clearDesktopSelection();
                showDesktopContextMenu(e.clientX, e.clientY, null);
            }
        });
    }

    function showDesktopContextMenu(x, y, appId = null) {
        closeContextMenu();

        contextMenu = document.createElement("div");
        contextMenu.className = "desktop-context-menu";

        if (appId) {
            const app = apps[appId];
            contextMenu.innerHTML = `
                <div class="os-menu-title">${escapeHTML(app ? app.name : appId)}</div>
                <button data-action="open"><span>▸</span> Open</button>
                <div class="context-separator"></div>
                <button data-action="settings"><span>⚙</span> Desktop Settings</button>
            `;
        } else {
            contextMenu.innerHTML = `
                <button data-action="launcher"><span>▦</span> Open Apps</button>
                <button data-action="select-all"><span>▢</span> Select All</button>
                <button data-action="refresh"><span>↻</span> Refresh</button>
                <div class="context-separator"></div>
                <button data-action="settings"><span>⚙</span> Desktop Settings</button>
            `;
        }

        document.body.appendChild(contextMenu);

        // Clamp inside viewport now that it has a real size.
        const width = contextMenu.offsetWidth;
        const height = contextMenu.offsetHeight;

        contextMenu.style.left = `${Math.min(x, window.innerWidth - width - 8)}px`;
        contextMenu.style.top = `${Math.min(y, window.innerHeight - height - 8)}px`;

        contextMenu.addEventListener("click", e => {
            const button = e.target.closest("button");
            if (!button) return;

            const action = button.dataset.action;

            if (action === "open" && appId) openApp(appId);
            if (action === "launcher") openLauncher();
            if (action === "select-all") {
                document.querySelectorAll(".desktopApps").forEach(app => app.classList.add("selected"));
            }
            if (action === "refresh") location.reload();
            if (action === "settings") openApp("settings");

            closeContextMenu();
        });
    }

    function closeContextMenu() {
        if (!contextMenu) return;
        contextMenu.remove();
        contextMenu = null;
    }

    /* =========================================================
       APP LAUNCHER
    ========================================================= */

    function toggleLauncher() {
        if (launcher) {
            closeLauncher();
        } else {
            openLauncher();
        }
    }

    function openLauncher() {
        closeContextMenu();
        if (launcher) return;

        launcher = document.createElement("div");
        launcher.id = "app-launcher";

        launcher.innerHTML = `
            <div class="launcher-panel">
                <div class="launcher-search">
                    <span>⌕</span>
                    <input id="app-search" type="text" placeholder="Search apps..." autocomplete="off">
                </div>
                <div class="launcher-apps" id="launcher-apps"></div>
            </div>
        `;

        document.body.appendChild(launcher);
        document.body.classList.add("launcher-active");

        renderLauncherApps("");

        const search = launcher.querySelector("#app-search");
        search.addEventListener("input", () => renderLauncherApps(search.value));

        launcher.addEventListener("mousedown", e => {
            if (e.target === launcher) closeLauncher();
        });

        requestAnimationFrame(() => launcher.classList.add("launcher-open"));

        setTimeout(() => search.focus(), 50);
    }

    function renderLauncherApps(query) {
        if (!launcher) return;

        const container = launcher.querySelector("#launcher-apps");
        if (!container) return;

        const search = query.toLowerCase().trim();
        container.innerHTML = "";

        Object.entries(apps)
            .filter(([id, app]) => app.name.toLowerCase().includes(search) || id.toLowerCase().includes(search))
            .forEach(([id, app]) => {
                const item = document.createElement("button");
                item.className = "launcher-app";
                item.dataset.app = id;

                item.innerHTML = `
                    <img src="${escapeAttribute(app.icon)}" alt="">
                    <span>${escapeHTML(app.name)}</span>
                `;

                item.addEventListener("click", () => {
                    openApp(id);
                    closeLauncher();
                });

                container.appendChild(item);
            });

        if (!container.children.length) {
            container.innerHTML = `<div class="no-apps">No apps found</div>`;
        }
    }

    function closeLauncher() {
        if (!launcher) return;

        launcher.classList.remove("launcher-open");
        document.body.classList.remove("launcher-active");

        const oldLauncher = launcher;
        launcher = null;

        setTimeout(() => oldLauncher.remove(), 220);
    }

    /* =========================================================
       OS MENU
    ========================================================= */

    function setupOSMenu() {
        const osName = document.querySelector(".os-name");
        if (!osName) return;

        osName.style.cursor = "pointer";

        osName.addEventListener("click", e => {
            e.stopPropagation();
            toggleOSMenu();
        });
    }

    function toggleOSMenu() {
        const existing = document.querySelector(".os-menu");
        if (existing) {
            existing.remove();
            return;
        }

        closeContextMenu();

        const osName = document.querySelector(".os-name");
        if (!osName) return;

        const menu = document.createElement("div");
        menu.className = "os-menu";

        menu.innerHTML = `
            <div class="os-menu-title">Drinoed OS</div>
            <button data-os="restart">↻ Restart</button>
            <button data-os="shutdown" id="shutdown-os">⏻ Shutdown</button>
            <button data-os="about">ⓘ About</button>
        `;

        document.body.appendChild(menu);

        const rect = osName.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 6}px`;

        menu.addEventListener("click", e => {
            const button = e.target.closest("button");
            if (!button) return;

            const action = button.dataset.os;

            if (action === "restart") location.reload();
            if (action === "shutdown") shutdownOS();
            if (action === "about") alert("Drinoed OS\nBuilt with HTML, CSS and JavaScript.");

            menu.remove();
        });
    }

    /* =========================================================
       SHUTDOWN
    ========================================================= */

    function shutdownOS() {
        try { window.close(); } catch {}

        setTimeout(() => {
            if (document.getElementById("shutdown-screen")) return;

            const screen = document.createElement("div");
            screen.id = "shutdown-screen";

            screen.innerHTML = `
                <div>
                    <div class="shutdown-logo">D</div>
                    <p>Drinoed OS has shut down.</p>
                    <small>You can close this tab.</small>
                </div>
            `;

            document.body.appendChild(screen);
        }, 100);
    }

    /* =========================================================
       BRIGHTNESS
    ========================================================= */

    function createBrightnessOverlay() {
        if (document.getElementById("brightness-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "brightness-overlay";
        document.body.appendChild(overlay);
    }

    function applyBrightness(value) {
        const overlay = document.getElementById("brightness-overlay");
        if (!overlay) return;

        let brightness = Number(value);
        if (!Number.isFinite(brightness)) brightness = 100;

        brightness = Math.max(10, Math.min(100, brightness));

        overlay.style.opacity = String(1 - brightness / 100);
    }

    /* =========================================================
       WALLPAPER
    ========================================================= */

    function setWallpaper(path) {
        const os = document.querySelector(".Os");
        if (!os) return;

        os.style.backgroundImage = `url("${path}")`;

        if (path.startsWith("data:")) {
            localStorage.setItem("drinoed-custom-wallpaper", path);
        } else {
            localStorage.removeItem("drinoed-custom-wallpaper");
        }
    }

    function loadSavedSettings() {
        const savedBrightness = localStorage.getItem("drinoed-brightness");
        applyBrightness(savedBrightness || 100);

        const savedWallpaper = localStorage.getItem("drinoed-custom-wallpaper");
        if (savedWallpaper) setWallpaper(savedWallpaper);
    }

    /* =========================================================
       BOOT SCREEN
    ========================================================= */

    function createBootScreen() {
        const existing = document.getElementById("boot-screen");
        if (existing) existing.remove();

        const boot = document.createElement("div");
        boot.id = "boot-screen";

        boot.innerHTML = `
            <div class="boot-content">
                <div class="boot-spinner"></div>
                <div class="boot-text">Loading...</div>
                <div class="boot-subtext">Starting Drinoed OS</div>
            </div>
        `;

        document.body.appendChild(boot);

        setTimeout(() => {
            boot.classList.add("boot-finished");
            setTimeout(() => boot.remove(), 700);
        }, 1200);
    }

    /* =========================================================
       KEYBOARD SHORTCUTS
    ========================================================= */

    function setupKeyboardShortcuts() {
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                closeContextMenu();
                if (launcher) closeLauncher();
            }

            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "t") {
                e.preventDefault();
                openApp("terminal");
            }

            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "c") {
                e.preventDefault();
                openApp("calculator");
            }
        });
    }

    function setupGlobalDismiss() {
        document.addEventListener("click", e => {
            const menu = document.querySelector(".os-menu");

            if (menu && !e.target.closest(".os-menu") && !e.target.closest(".os-name")) {
                menu.remove();
            }

            if (contextMenu && !e.target.closest(".desktop-context-menu")) {
                closeContextMenu();
            }
        });
    }

    /* =========================================================
       RESIZE (viewport)
    ========================================================= */

    window.addEventListener("resize", () => {
        runningApps.forEach(win => {
            if (win.classList.contains("fullscreen")) {
                win.style.top = `${TOP_BAR_HEIGHT}px`;
                win.style.left = "0px";
                win.style.width = "100vw";
                win.style.height = `calc(100vh - ${TOP_BAR_HEIGHT}px)`;
                return;
            }

            const fixedSize = FIXED_APP_SIZES[win.dataset.app];
            const app = apps[win.dataset.app];

            if (fixedSize) {
                // Fixed-size apps (like Calculator) shrink to fit a small
                // viewport but otherwise keep their standard proportions.
                // Their internal grid layout (keys, display) is fluid, so
                // it scales itself the moment the window's own size changes.
                const width = Math.min(fixedSize.width, Math.max(260, window.innerWidth - 30));
                const height = Math.min(fixedSize.height, Math.max(360, window.innerHeight - TOP_BAR_HEIGHT - 60));

                win.style.width = `${width}px`;
                win.style.height = `${height}px`;
            } else if (app && app.type === "iframe") {
                // Keep external apps in a 16:9 box as the viewport changes.
                const maxWidth = Math.max(480, window.innerWidth - 60);
                const maxHeight = Math.max(320, window.innerHeight - TOP_BAR_HEIGHT - 100);

                const { width, height } = calculateAspectSize(16, 9, maxWidth, maxHeight);

                win.style.width = `${width}px`;
                win.style.height = `${height}px`;
            }

            keepWindowReachable(win);
        });
    });

    function keepWindowReachable(win) {
        const width = win.offsetWidth;
        const minVisible = Math.max(24, width * MIN_VISIBLE_RATIO);

        let left = win.offsetLeft;
        let top = win.offsetTop;

        left = Math.min(window.innerWidth - minVisible, Math.max(-(width - minVisible), left));
        top = Math.min(window.innerHeight - MIN_VISIBLE_HEIGHT, Math.max(TOP_BAR_HEIGHT, top));

        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
    }

    function resetWindowPosition(win) {
        const width = Math.min(DEFAULT_WINDOW_WIDTH, Math.max(320, window.innerWidth - 30));
        const height = Math.min(DEFAULT_WINDOW_HEIGHT, Math.max(240, window.innerHeight - TOP_BAR_HEIGHT - 80));

        win.style.width = `${width}px`;
        win.style.height = `${height}px`;
        win.style.left = `${Math.max(10, (window.innerWidth - width) / 2)}px`;
        win.style.top = `${Math.max(TOP_BAR_HEIGHT + 15, (window.innerHeight - height) / 2)}px`;
    }

    /* =========================================================
       HELPERS
    ========================================================= */

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHTML(value);
    }

    /* =========================================================
       ASPECT-RATIO SIZING
       Used to size external/iframe apps into a standard 16:9
       window, fitted to whatever space is currently available.
    ========================================================= */

    function calculateAspectSize(ratioW, ratioH, maxWidth, maxHeight) {
        let width = maxWidth;
        let height = (width * ratioH) / ratioW;

        if (height > maxHeight) {
            height = maxHeight;
            width = (height * ratioW) / ratioH;
        }

        return { width, height };
    }

    /* =========================================================
       START OS
    ========================================================= */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

})();