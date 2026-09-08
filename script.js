// Sorry for using the AI to Format this code earlier this version is the first one written from scratch by me. Hope you will accepet this one.


(function () {
  "use strict";

  var TOP_BAR_HEIGHT = 30;
  var DEFAULT_WINDOW_WIDTH = 700;
  var DEFAULT_WINDOW_HEIGHT = 520;

  var FIXED_APP_SIZES = {
    calculator: { width: 340, height: 520 }
  };

  var MIN_VISIBLE_RATIO = 0.2;
  var MIN_VISIBLE_HEIGHT = 40;

  var highestZIndex = 100;

  var runningApps = {};
  var windowStates = {};
  var fullscreenWindows = [];

  var launcher = null;
  var contextMenu = null;

  var apps = {
    notes: { name: "Notepad", icon: "src/note.png", type: "internal" },
    vscode: { name: "VS Code", icon: "src/VScode.png", type: "iframe", url: "https://onecompiler.com/embed/" },
    brave: { name: "Brave", icon: "src/Brave.png", type: "iframe", url: "https://www.google.com/search?igu=1&q=" },
    terminal: { name: "Terminal", icon: "src/Terminal.png", type: "internal" },
    settings: { name: "Settings", icon: "src/setting.png", type: "internal" },
    calculator: { name: "Calculator", icon: "src/calculator.png", type: "internal" },
    safari: { name: "Safari", icon: "src/Safari.png", type: "iframe", url: "https://www.google.com/search?igu=1&q=" },
    chrome: { name: "Chrome", icon: "src/Chrome.png", type: "iframe", url: "https://www.google.com/search?igu=1&q=" },
    pinterest: { name: "Pinterest", icon: "src/Pinterest.png", type: "iframe", url: "https://www.pinterest.com/" },
    discord: { name: "kobayashi OS", icon: "src/Kiyo.png", type: "iframe", url: "https://dev-dock-ruddy.vercel.app/" },
    archery: { name: "Archery", icon: "src/Arch.png", type: "iframe", url: "https://www.madkidgames.com/full/bowmasters-archery-shooting" },
    spotify: { name: "Spotify", icon: "src/Spotify.png", type: "iframe", url: "https://open.spotify.com/embed/album/2ODvWsOgouMbaA5xf0RkJe?utm_source=oembed" },
    Youtube: { name: "Youtube", icon: "src/youtube.png", type: "iframe", url: "https://www.youtube-nocookie.com/embed/2DFKIllyMOY?si=6Mb053DK-HC4gC44" },
    files: { name: "Files", icon: "src/Files.png", type: "internal" },
    Block_Blast: { name: "Block Blast", icon: "src/Block.png", type: "iframe", url: "https://www.madkidgames.com/full/block-blast-puzzle-game" }
  };

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

  function setupClock() {
    updateClock();
    updateDate();
    setInterval(updateClock, 1000);
    setInterval(updateDate, 60000);
  }

  function updateClock() {
    var el = document.getElementById("time-text");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function updateDate() {
    var el = document.getElementById("date-text");
    if (!el) return;
    el.textContent = new Date().toLocaleDateString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function setupDesktopApps() {
    var icons = document.querySelectorAll(".desktopApps");
    for (var i = 0; i < icons.length; i++) {
      (function (icon) {
        var appId = icon.dataset.app;
        if (!appId || !apps[appId]) return;

        icon.addEventListener("click", function (e) {
          if (e.button !== 0) return;
          clearDesktopSelection();
          icon.classList.add("selected");
          openApp(appId);
        });

        icon.addEventListener("contextmenu", function (e) {
          e.preventDefault();
          e.stopPropagation();
          clearDesktopSelection();
          icon.classList.add("selected");
          showDesktopContextMenu(e.clientX, e.clientY, appId);
        });
      })(icons[i]);
    }
  }

  function openApp(appId) {
    var app = apps[appId];
    if (!app) return;

    closeContextMenu();
    closeLauncher();

    if (runningApps[appId]) {
      var existingWin = runningApps[appId];
      restoreWindow(existingWin);
      bringToFront(existingWin);
      setDockState(appId, "active");
      return;
    }

    var win = createAppWindow(appId, app);
    document.body.appendChild(win);

    runningApps[appId] = win;
    addToDock(appId, app);

    bringToFront(win);
    makeDraggable(win);
    setupWindowFocus(win);

    setTimeout(function () {
      win.classList.add("window-open");
    }, 0);

    setDockState(appId, "active");
  }

  function createAppWindow(appId, app) {
    var win = document.createElement("div");
    win.className = "window app-window";
    win.dataset.app = appId;

    var fixedSize = FIXED_APP_SIZES[appId];
    var width, height;

    if (fixedSize) {
      width = Math.min(fixedSize.width, Math.max(260, window.innerWidth - 30));
      height = Math.min(fixedSize.height, Math.max(360, window.innerHeight - TOP_BAR_HEIGHT - 60));
      win.classList.add("fixed-size");
    } else if (app.type === "iframe") {
      var maxWidth = Math.max(480, window.innerWidth - 60);
      var maxHeight = Math.max(320, window.innerHeight - TOP_BAR_HEIGHT - 100);
      var size = calculateAspectSize(16, 9, maxWidth, maxHeight);
      width = size.width;
      height = size.height;
    } else {
      width = Math.min(DEFAULT_WINDOW_WIDTH, Math.max(320, window.innerWidth - 30));
      height = Math.min(DEFAULT_WINDOW_HEIGHT, Math.max(240, window.innerHeight - TOP_BAR_HEIGHT - 80));
    }

    var left = Math.max(10, (window.innerWidth - width) / 2);
    var top = Math.max(TOP_BAR_HEIGHT + 15, (window.innerHeight - height) / 2);

    win.style.width = width + "px";
    win.style.height = height + "px";
    win.style.left = left + "px";
    win.style.top = top + "px";

    win.innerHTML =
      '<div class="header flex ac app-header">' +
        '<div class="window_button flex ac">' +
          '<div class="clos window-close" title="Close"></div>' +
          '<div class="min window-min" title="Minimize"></div>' +
          '<div class="full window-full" title="Fullscreen"></div>' +
        "</div>" +
        '<div class="title">' + escapeHTML(app.name) + "</div>" +
      "</div>" +
      '<div class="container App_container">' +
        getAppContent(appId, app) +
      "</div>";

    win.querySelector(".window-close").addEventListener("click", function (e) {
      e.stopPropagation();
      closeApp(appId);
    });

    win.querySelector(".window-min").addEventListener("click", function (e) {
      e.stopPropagation();
      minimizeApp(appId);
    });

    win.querySelector(".window-full").addEventListener("click", function (e) {
      e.stopPropagation();
      toggleFullscreen(win);
    });

    setupInternalApp(appId, win);

    return win;
  }

  function getAppContent(appId, app) {
    if (app.type === "iframe") {
      return (
        '<iframe src="' + escapeAttribute(app.url) + '" title="' + escapeAttribute(app.name) +
        '" allow="camera; microphone; fullscreen; autoplay; clipboard-read; clipboard-write" loading="lazy"></iframe>'
      );
    }

    if (appId === "notes") return getNotesApp();
    if (appId === "terminal") return getTerminalApp();
    if (appId === "calculator") return getCalculatorApp();
    if (appId === "settings") return getSettingsApp();
    if (appId === "files") return getFilesApp();

    return "<div class=\"internal-app\"><h2>" + escapeHTML(app.name) + "</h2></div>";
  }

  function getNotesApp() {
    return (
      '<div class="notes-app">' +
        '<textarea id="notes-editor" placeholder="Start typing..." spellcheck="false"></textarea>' +
        '<div class="notes-status">Saved locally</div>' +
      "</div>"
    );
  }

  function setupNotes(win) {
    var editor = win.querySelector("#notes-editor");
    if (!editor) return;

    var saved = localStorage.getItem("drinoed-notes");
    if (saved !== null) editor.value = saved;

    editor.addEventListener("input", function () {
      localStorage.setItem("drinoed-notes", editor.value);
    });
  }

  function getTerminalApp() {
    return (
      '<div class="terminal-app">' +
        '<div class="terminal-output" id="terminal-output">' +
          "<div>Drinoed Terminal</div>" +
          '<div>Type "help" to see commands.</div>' +
          "<br>" +
        "</div>" +
        '<div class="terminal-input-row">' +
          "<span>user@drinoed:~$</span>" +
          '<input id="terminal-input" autocomplete="off" spellcheck="false">' +
        "</div>" +
      "</div>"
    );
  }

  function setupTerminal(win) {
    var input = win.querySelector("#terminal-input");
    var output = win.querySelector("#terminal-output");
    if (!input || !output) return;

    setTimeout(function () {
      input.focus();
    }, 100);

    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;

      var command = input.value.trim();
      if (!command) return;

      var line = document.createElement("div");
      line.textContent = "user@drinoed:~$ " + command;
      output.appendChild(line);

      executeTerminalCommand(command, output);

      input.value = "";
      output.scrollTop = output.scrollHeight;
    });
  }

  function executeTerminalCommand(command, output) {
    var lower = command.toLowerCase();
    var result = document.createElement("div");

    if (lower === "help") {
      result.textContent = "help, clear, date, time, whoami, echo, neofetch, about, restart";
      output.appendChild(result);
    } else if (lower === "clear") {
      output.innerHTML = "";
    } else if (lower === "date") {
      result.textContent = new Date().toDateString();
      output.appendChild(result);
    } else if (lower === "time") {
      result.textContent = new Date().toLocaleTimeString();
      output.appendChild(result);
    } else if (lower === "whoami") {
      result.textContent = "user";
      output.appendChild(result);
    } else if (lower === "about") {
      result.textContent = "Drinoed OS — HTML/CSS/JavaScript desktop environment.";
      output.appendChild(result);
    } else if (lower === "neofetch") {
      result.textContent = "Drinoed OS\nCPU: Web Browser\nShell: Drinoed Terminal\nKernel: JavaScript";
      result.style.whiteSpace = "pre-line";
      output.appendChild(result);
    } else if (lower === "restart") {
      location.reload();
    } else if (lower.indexOf("echo ") === 0) {
      result.textContent = command.substring(5);
      output.appendChild(result);
    } else {
      result.textContent = "Command not found: " + command;
      output.appendChild(result);
    }
  }

  function getCalculatorApp() {
    return (
      '<div class="calculator-app">' +
        '<input class="calculator-display" id="calculator-display" type="text" value="0" readonly>' +
        '<div class="calculator-buttons">' +
          '<button class="clear" data-value="C">C</button>' +
          '<button class="operator" data-value="(">(</button>' +
          '<button class="operator" data-value=")">)</button>' +
          '<button class="operator" data-value="/">÷</button>' +
          '<button data-value="7">7</button>' +
          '<button data-value="8">8</button>' +
          '<button data-value="9">9</button>' +
          '<button class="operator" data-value="*">×</button>' +
          '<button data-value="4">4</button>' +
          '<button data-value="5">5</button>' +
          '<button data-value="6">6</button>' +
          '<button class="operator" data-value="-">−</button>' +
          '<button data-value="1">1</button>' +
          '<button data-value="2">2</button>' +
          '<button data-value="3">3</button>' +
          '<button class="operator" data-value="+">+</button>' +
          '<button class="zero" data-value="0">0</button>' +
          '<button data-value=".">.</button>' +
          '<button class="equals" data-value="=">=</button>' +
        "</div>" +
      "</div>"
    );
  }

  function setupCalculator(win) {
    var display = win.querySelector("#calculator-display");
    var buttons = win.querySelectorAll(".calculator-buttons button");
    if (!display) return;

    var expression = "";

    function render() {
      if (expression) {
        display.value = expression.split("*").join("×").split("/").join("÷");
      } else {
        display.value = "0";
      }
    }

    function equals() {
      if (!expression.trim()) return;

      var okChars = /^[0-9+\-*/().\s]+$/;
      if (!okChars.test(expression)) {
        expression = "";
        display.value = "Error";
        return;
      }

      try {
        var result = Function('"use strict"; return (' + expression + ")")();
        if (!isFinite(result)) throw new Error("bad result");
        expression = String(result);
        render();
      } catch (err) {
        expression = "";
        display.value = "Error";
      }
    }

    for (var i = 0; i < buttons.length; i++) {
      (function (button) {
        button.addEventListener("click", function () {
          var value = button.dataset.value;

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
      })(buttons[i]);
    }

    var keyboardHandler = function (e) {
      if (win.style.display === "none") return;
      if (!win.isConnected) return;

      var allowed = "0123456789+-*/().";

      if (allowed.indexOf(e.key) !== -1) {
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

    win._calculatorCleanup = function () {
      document.removeEventListener("keydown", keyboardHandler);
    };
  }

  function getSettingsApp() {
    return (
      '<div class="settings-app">' +
        '<div class="settings-sidebar">' +
          '<button class="settings-tab active" data-settings="appearance">Appearance</button>' +
          '<button class="settings-tab" data-settings="system">System</button>' +
          '<button class="settings-tab" data-settings="About">About</button>' +
        "</div>" +
        '<div class="settings-content">' +
          '<section class="settings-section" data-settings-page="appearance">' +
            "<h2>Appearance</h2>" +
            "<label>Brightness</label>" +
            '<input id="brightness-control" type="range" min="10" max="100" value="100">' +
            "<h3>Wallpaper</h3>" +
            '<div class="wallpaper-grid">' +
              '<button data-wallpaper="src/593257.jpg" style="background-image:url(\'src/593257.jpg\')"></button>' +
              '<button data-wallpaper="src/5826308.jpg" style="background-image:url(\'src/5826308.jpg\')"></button>' +
              '<button data-wallpaper="src/Gojo.png" style="background-image:url(\'src/Gojo.png\')"></button>' +
            "</div>" +
            "<h3>Custom Wallpaper</h3>" +
            '<input id="wallpaper-file" type="file" accept="image/*">' +
          "</section>" +
          '<section class="settings-section hidden" data-settings-page="system">' +
            "<h2>System</h2>" +
            "<p>Drinoed OS</p>" +
            "<p>Version 1.0</p>" +
            '<button class="settings-action" id="reset-settings">Reset Settings</button>' +
          "</section>" +
          '<section class="About-section hidden" data-settings-page="About">' +
            "<h2>About</h2>" +
            "<p>Drinoed OS is a WEB based OS UI.</p>" +
            "<p>It build by Yoru Ayan on 5th setember 2026 and changes are going on.</p>" +
            '<p>Here are some more good projects on My Github <a href="https://github.com/aniway89">Here</a></p>' +
          "</section>" +
        "</div>" +
      "</div>"
    );
  }

  function setupSettings(win) {
    var brightness = win.querySelector("#brightness-control");

    if (brightness) {
      var saved = Number(localStorage.getItem("drinoed-brightness") || 100);
      brightness.value = Math.max(10, Math.min(100, saved));
      applyBrightness(brightness.value);

      brightness.addEventListener("input", function () {
        var value = Number(brightness.value);
        localStorage.setItem("drinoed-brightness", value);
        applyBrightness(value);
      });
    }

    var wallpaperButtons = win.querySelectorAll("[data-wallpaper]");
    for (var i = 0; i < wallpaperButtons.length; i++) {
      (function (button) {
        button.addEventListener("click", function () {
          setWallpaper(button.dataset.wallpaper);
        });
      })(wallpaperButtons[i]);
    }

    var fileInput = win.querySelector("#wallpaper-file");
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var file = fileInput.files[0];
        if (!file || file.type.indexOf("image/") !== 0) return;

        var reader = new FileReader();
        reader.onload = function (e) {
          localStorage.setItem("drinoed-custom-wallpaper", e.target.result);
          setWallpaper(e.target.result);
        };
        reader.readAsDataURL(file);
      });
    }

    var tabs = win.querySelectorAll(".settings-tab");
    for (var j = 0; j < tabs.length; j++) {
      (function (tab) {
        tab.addEventListener("click", function () {
          var page = tab.dataset.settings;

          for (var k = 0; k < tabs.length; k++) {
            tabs[k].classList.remove("active");
          }
          tab.classList.add("active");

          var sections = win.querySelectorAll("[data-settings-page]");
          for (var m = 0; m < sections.length; m++) {
            var section = sections[m];
            if (section.dataset.settingsPage === page) {
              section.classList.remove("hidden");
            } else {
              section.classList.add("hidden");
            }
          }
        });
      })(tabs[j]);
    }

    var reset = win.querySelector("#reset-settings");
    if (reset) {
      reset.addEventListener("click", function () {
        localStorage.removeItem("drinoed-brightness");
        localStorage.removeItem("drinoed-custom-wallpaper");

        if (brightness) brightness.value = 100;
        applyBrightness(100);
        setWallpaper("src/593257.jpg");
      });
    }
  }

  function getFilesApp() {
    return (
      '<div class="files-app">' +
        '<div class="files-toolbar"><strong>Files</strong></div>' +
        '<div class="files-empty">' +
          '<img src="src/Files.png">' +
          "<h3>This folder is empty</h3>" +
          "<p>Your files will appear here.</p>" +
        "</div>" +
      "</div>"
    );
  }

  function setupInternalApp(appId, win) {
    if (appId === "notes") setupNotes(win);
    if (appId === "terminal") setupTerminal(win);
    if (appId === "calculator") setupCalculator(win);
    if (appId === "settings") setupSettings(win);
  }

  function setupDock() {
    var dock = document.querySelector(".Dock");
    if (!dock) return;

    var dockApps = dock.querySelectorAll(".app");
    for (var i = 0; i < dockApps.length; i++) {
      (function (appEl) {
        if (!appEl.dataset.app) return;

        appEl.addEventListener("click", function (e) {
          e.stopPropagation();
          var id = appEl.dataset.app;

          if (id === "app-launcher") {
            toggleLauncher();
            return;
          }

          openApp(id);
        });
      })(dockApps[i]);
    }

    createAppsButton();
  }

  function createAppsButton() {
    var dock = document.querySelector(".Dock");
    if (!dock || dock.querySelector(".apps-dock-button")) return;

    var separator = document.createElement("div");
    separator.className = "dock-separator";

    var button = document.createElement("div");
    button.className = "app apps-dock-button";
    button.dataset.app = "app-launcher";
    button.title = "Open Apps";

    var dots = "";
    for (var i = 0; i < 9; i++) {
      dots += "<span></span>";
    }
    button.innerHTML = '<div class="apps-button-inner">' + dots + "</div>";

    button.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleLauncher();
    });

    dock.appendChild(separator);
    dock.appendChild(button);
  }

  function addToDock(appId, app) {
    var dock = document.querySelector(".Dock");
    if (!dock) return;

    if (dock.querySelector('.app[data-app="' + appId + '"]')) return;

    var dockApp = document.createElement("div");
    dockApp.className = "app dynamic-app";
    dockApp.dataset.app = appId;
    dockApp.dataset.dynamic = "true";
    dockApp.title = app.name;

    dockApp.innerHTML =
      '<div class="wrap"><img src="' + escapeAttribute(app.icon) + '" alt="' + escapeAttribute(app.name) + '"></div>';

    dockApp.addEventListener("click", function (e) {
      e.stopPropagation();
      openApp(appId);
    });

    var separator = dock.querySelector(".dock-separator");
    if (separator) {
      dock.insertBefore(dockApp, separator);
    } else {
      dock.appendChild(dockApp);
    }
  }

  function removeFromDock(appId) {
    var dockApp = document.querySelector('.Dock .app[data-app="' + appId + '"]');
    if (!dockApp || dockApp.dataset.dynamic !== "true") return;

    dockApp.classList.add("dock-removing");
    setTimeout(function () {
      dockApp.remove();
    }, 180);
  }

  function setDockState(appId, state) {
    var dock = document.querySelector(".Dock");
    if (!dock) return;

    var allApps = dock.querySelectorAll(".app");
    for (var i = 0; i < allApps.length; i++) {
      allApps[i].classList.remove("active");
    }

    if (!appId) return;

    var app = dock.querySelector('.app[data-app="' + appId + '"]');
    if (!app) return;

    if (state === "active") {
      app.classList.remove("minimized-app");
      app.classList.add("active");
    }

    if (state === "minimized") {
      app.classList.add("minimized-app");
    }
  }

  function closeApp(appId) {
    var win = runningApps[appId];
    if (!win) return;

    if (win.classList.contains("fullscreen")) {
      exitFullscreen(win);
    }

    win.classList.remove("window-open");
    win.classList.add("window-closing");

    setDockState(appId, null);

    setTimeout(function () {
      if (win._calculatorCleanup) win._calculatorCleanup();

      win.remove();
      delete runningApps[appId];
      delete windowStates[appId];

      removeFromDock(appId);
      activateTopWindow();
    }, 210);
  }

  function minimizeApp(appId) {
    var win = runningApps[appId];
    if (!win) return;

    if (win.classList.contains("fullscreen")) {
      exitFullscreen(win);
    }

    win.classList.remove("window-open");
    win.classList.add("window-minimizing");

    setDockState(appId, "minimized");

    setTimeout(function () {
      win.style.display = "none";
      win.classList.remove("window-minimizing");
      activateTopWindow();
    }, 210);
  }

  function restoreWindow(win) {
    if (!win) return;

    win.style.display = "block";
    win.classList.remove("window-minimizing");

    setTimeout(function () {
      win.classList.add("window-open");
    }, 0);

    setDockState(win.dataset.app, "active");
  }

  function setupWindowFocus(win) {
    win.addEventListener("mousedown", function () {
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
    var topWindow = null;
    var topZ = -Infinity;

    for (var appId in runningApps) {
      var win = runningApps[appId];
      if (win.style.display === "none") continue;
      if (win.classList.contains("window-closing")) continue;

      var z = Number(win.style.zIndex || 0);
      if (z > topZ) {
        topZ = z;
        topWindow = win;
      }
    }

    if (topWindow) {
      setDockState(topWindow.dataset.app, "active");
    } else {
      var allApps = document.querySelectorAll(".Dock .app");
      for (var i = 0; i < allApps.length; i++) {
        allApps[i].classList.remove("active");
      }
    }
  }

  function toggleFullscreen(win) {
    if (win.classList.contains("fullscreen")) {
      exitFullscreen(win);
    } else {
      enterFullscreen(win);
    }
  }

  function enterFullscreen(win) {
    windowStates[win.dataset.app] = {
      width: win.style.width,
      height: win.style.height,
      left: win.style.left,
      top: win.style.top
    };

    win.classList.add("fullscreen");

    win.style.left = "0px";
    win.style.top = TOP_BAR_HEIGHT + "px";
    win.style.width = "100vw";
    win.style.height = "calc(100vh - " + TOP_BAR_HEIGHT + "px)";

    if (fullscreenWindows.indexOf(win) === -1) {
      fullscreenWindows.push(win);
    }
    updateDockVisibility();
  }

  function exitFullscreen(win) {
    var old = windowStates[win.dataset.app];

    win.classList.remove("fullscreen");

    if (old) {
      win.style.width = old.width;
      win.style.height = old.height;
      win.style.left = old.left;
      win.style.top = old.top;
    } else {
      resetWindowPosition(win);
    }

    var idx = fullscreenWindows.indexOf(win);
    if (idx !== -1) fullscreenWindows.splice(idx, 1);

    updateDockVisibility();
  }

  function updateDockVisibility() {
    var dock = document.querySelector(".Dock");
    if (!dock) return;

    if (fullscreenWindows.length > 0) {
      dock.classList.add("dock-hidden-fullscreen");
    } else {
      dock.classList.remove("dock-hidden-fullscreen");
    }
  }

  function makeDraggable(win) {
    var header = win.querySelector(".header");
    if (!header) return;

    var dragging = false;
    var startX = 0, startY = 0;
    var startLeft = 0, startTop = 0;

    header.addEventListener("mousedown", function (e) {
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

      var width = win.offsetWidth;

      var left = startLeft + (e.clientX - startX);
      var top = startTop + (e.clientY - startY);

      var minVisible = Math.max(24, width * MIN_VISIBLE_RATIO);

      var minLeft = -(width - minVisible);
      var maxLeft = window.innerWidth - minVisible;

      left = Math.min(maxLeft, Math.max(minLeft, left));

      var minTop = TOP_BAR_HEIGHT;
      var maxTop = window.innerHeight - MIN_VISIBLE_HEIGHT;

      top = Math.min(maxTop, Math.max(minTop, top));

      win.style.left = left + "px";
      win.style.top = top + "px";
    }

    function stop() {
      dragging = false;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", stop);
    }
  }

  function setupExistingWindows() {
    var welcome = document.getElementById("window");
    var oldNotes = document.getElementById("window2");

    if (welcome) {
      makeDraggable(welcome);
      bringToFront(welcome);

      var close = welcome.querySelector(".clos");
      if (close) {
        close.addEventListener("click", function (e) {
          e.stopPropagation();
          welcome.style.display = "none";
        });
      }

      welcome.addEventListener("mousedown", function () {
        bringToFront(welcome);
      });
    }

    if (oldNotes) {
      oldNotes.style.display = "none";
    }
  }

  function setupDesktopSelection() {
    var desktop = document.querySelector(".desktop_");
    if (!desktop) return;

    var selecting = false;
    var startX = 0, startY = 0;
    var selectionBox = null;

    desktop.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest(".desktopApps")) return;

      closeContextMenu();
      clearDesktopSelection();

      selecting = true;

      var rect = desktop.getBoundingClientRect();
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

      var rect = desktop.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;

      var left = Math.min(startX, x);
      var top = Math.min(startY, y);
      var width = Math.abs(x - startX);
      var height = Math.abs(y - startY);

      selectionBox.style.left = left + "px";
      selectionBox.style.top = top + "px";
      selectionBox.style.width = width + "px";
      selectionBox.style.height = height + "px";

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
    var desktop = document.querySelector(".desktop_");
    if (!desktop) return;

    var desktopRect = desktop.getBoundingClientRect();
    var right = x + width;
    var bottom = y + height;

    var icons = desktop.querySelectorAll(".desktopApps");
    for (var i = 0; i < icons.length; i++) {
      var app = icons[i];
      var rect = app.getBoundingClientRect();

      var appLeft = rect.left - desktopRect.left;
      var appTop = rect.top - desktopRect.top;
      var appRight = appLeft + rect.width;
      var appBottom = appTop + rect.height;

      var intersects = appLeft < right && appRight > x && appTop < bottom && appBottom > y;

      if (intersects) {
        app.classList.add("selected");
      } else {
        app.classList.remove("selected");
      }
    }
  }

  function clearDesktopSelection() {
    var selected = document.querySelectorAll(".desktopApps.selected");
    for (var i = 0; i < selected.length; i++) {
      selected[i].classList.remove("selected");
    }
  }

  function setupDesktopContextMenu() {
    document.addEventListener("contextmenu", function (e) {
      var desktop = e.target.closest(".desktop_");
      if (!desktop) return;

      e.preventDefault();

      var app = e.target.closest(".desktopApps");

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

  function showDesktopContextMenu(x, y, appId) {
    if (appId === undefined) appId = null;

    closeContextMenu();

    contextMenu = document.createElement("div");
    contextMenu.className = "desktop-context-menu";

    if (appId) {
      var app = apps[appId];
      contextMenu.innerHTML =
        '<div class="os-menu-title">' + escapeHTML(app ? app.name : appId) + "</div>" +
        '<button data-action="open"><span>▸</span> Open</button>' +
        '<div class="context-separator"></div>' +
        '<button data-action="settings"><span>⚙</span> Desktop Settings</button>';
    } else {
      contextMenu.innerHTML =
        '<button data-action="launcher"><span>▦</span> Open Apps</button>' +
        '<button data-action="select-all"><span>▢</span> Select All</button>' +
        '<button data-action="refresh"><span>↻</span> Refresh</button>' +
        '<div class="context-separator"></div>' +
        '<button data-action="settings"><span>⚙</span> Desktop Settings</button>';
    }

    document.body.appendChild(contextMenu);

    var width = contextMenu.offsetWidth;
    var height = contextMenu.offsetHeight;

    contextMenu.style.left = Math.min(x, window.innerWidth - width - 8) + "px";
    contextMenu.style.top = Math.min(y, window.innerHeight - height - 8) + "px";

    contextMenu.addEventListener("click", function (e) {
      var button = e.target.closest("button");
      if (!button) return;

      var action = button.dataset.action;

      if (action === "open" && appId) openApp(appId);
      if (action === "launcher") openLauncher();
      if (action === "select-all") {
        var all = document.querySelectorAll(".desktopApps");
        for (var i = 0; i < all.length; i++) {
          all[i].classList.add("selected");
        }
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

    launcher.innerHTML =
      '<div class="launcher-panel">' +
        '<div class="launcher-search">' +
          "<span>⌕</span>" +
          '<input id="app-search" type="text" placeholder="Search apps..." autocomplete="off">' +
        "</div>" +
        '<div class="launcher-apps" id="launcher-apps"></div>' +
      "</div>";

    document.body.appendChild(launcher);
    document.body.classList.add("launcher-active");

    renderLauncherApps("");

    var search = launcher.querySelector("#app-search");
    search.addEventListener("input", function () {
      renderLauncherApps(search.value);
    });

    launcher.addEventListener("mousedown", function (e) {
      if (e.target === launcher) closeLauncher();
    });

    setTimeout(function () {
      launcher.classList.add("launcher-open");
    }, 0);

    setTimeout(function () {
      search.focus();
    }, 50);
  }

  function renderLauncherApps(query) {
    if (!launcher) return;

    var container = launcher.querySelector("#launcher-apps");
    if (!container) return;

    var search = query.toLowerCase().trim();
    container.innerHTML = "";

    var count = 0;

    for (var id in apps) {
      var app = apps[id];
      var matches = app.name.toLowerCase().indexOf(search) !== -1 || id.toLowerCase().indexOf(search) !== -1;
      if (!matches) continue;

      count++;

      (function (id, app) {
        var item = document.createElement("button");
        item.className = "launcher-app";
        item.dataset.app = id;

        item.innerHTML =
          '<img src="' + escapeAttribute(app.icon) + '" alt="">' +
          "<span>" + escapeHTML(app.name) + "</span>";

        item.addEventListener("click", function () {
          openApp(id);
          closeLauncher();
        });

        container.appendChild(item);
      })(id, app);
    }

    if (count === 0) {
      container.innerHTML = '<div class="no-apps">No apps found</div>';
    }
  }

  function closeLauncher() {
    if (!launcher) return;

    launcher.classList.remove("launcher-open");
    document.body.classList.remove("launcher-active");

    var oldLauncher = launcher;
    launcher = null;

    setTimeout(function () {
      oldLauncher.remove();
    }, 220);
  }

  function setupOSMenu() {
    var osName = document.querySelector(".os-name");
    if (!osName) return;

    osName.style.cursor = "pointer";

    osName.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleOSMenu();
    });
  }

  function toggleOSMenu() {
    var existing = document.querySelector(".os-menu");
    if (existing) {
      existing.remove();
      return;
    }

    closeContextMenu();

    var osName = document.querySelector(".os-name");
    if (!osName) return;

    var menu = document.createElement("div");
    menu.className = "os-menu";

    menu.innerHTML =
      '<div class="os-menu-title">Drinoed OS</div>' +
      '<button data-os="restart">↻ Restart</button>' +
      '<button data-os="shutdown" id="shutdown-os">⏻ Shutdown</button>' +
      '<button data-os="about">ⓘ About</button>';

    document.body.appendChild(menu);

    var rect = osName.getBoundingClientRect();
    menu.style.left = rect.left + "px";
    menu.style.top = rect.bottom + 6 + "px";

    menu.addEventListener("click", function (e) {
      var button = e.target.closest("button");
      if (!button) return;

      var action = button.dataset.os;

      if (action === "restart") location.reload();
      if (action === "shutdown") shutdownOS();
      if (action === "about") alert("Drinoed OS\nBuilt with HTML, CSS and JavaScript.");

      menu.remove();
    });
  }

  function shutdownOS() {
    try {
      window.close();
    } catch (err) {}

    setTimeout(function () {
      if (document.getElementById("shutdown-screen")) return;

      var screen = document.createElement("div");
      screen.id = "shutdown-screen";

      screen.innerHTML =
        "<div>" +
          '<div class="shutdown-logo">D</div>' +
          "<p>Drinoed OS has shut down.</p>" +
          "<small>You can close this tab.</small>" +
        "</div>";

      document.body.appendChild(screen);
    }, 100);
  }

  function createBrightnessOverlay() {
    if (document.getElementById("brightness-overlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "brightness-overlay";
    document.body.appendChild(overlay);
  }

  function applyBrightness(value) {
    var overlay = document.getElementById("brightness-overlay");
    if (!overlay) return;

    var brightness = Number(value);
    if (isNaN(brightness)) brightness = 100;

    brightness = Math.max(10, Math.min(100, brightness));

    overlay.style.opacity = String(1 - brightness / 100);
  }

  function setWallpaper(path) {
    var os = document.querySelector(".Os");
    if (!os) return;

    os.style.backgroundImage = 'url("' + path + '")';

    if (path.indexOf("data:") === 0) {
      localStorage.setItem("drinoed-custom-wallpaper", path);
    } else {
      localStorage.removeItem("drinoed-custom-wallpaper");
    }
  }

  function loadSavedSettings() {
    var savedBrightness = localStorage.getItem("drinoed-brightness");
    applyBrightness(savedBrightness || 100);

    var savedWallpaper = localStorage.getItem("drinoed-custom-wallpaper");
    if (savedWallpaper) setWallpaper(savedWallpaper);
  }

  function createBootScreen() {
    var existing = document.getElementById("boot-screen");
    if (existing) existing.remove();

    var boot = document.createElement("div");
    boot.id = "boot-screen";

    boot.innerHTML =
      '<div class="boot-content">' +
        '<div class="boot-spinner"></div>' +
        '<div class="boot-text">Loading...</div>' +
        '<div class="boot-subtext">Starting Drinoed OS</div>' +
      "</div>";

    document.body.appendChild(boot);

    setTimeout(function () {
      boot.classList.add("boot-finished");
      setTimeout(function () {
        boot.remove();
      }, 700);
    }, 1200);
  }

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", function (e) {
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
    document.addEventListener("click", function (e) {
      var menu = document.querySelector(".os-menu");

      if (menu && !e.target.closest(".os-menu") && !e.target.closest(".os-name")) {
        menu.remove();
      }

      if (contextMenu && !e.target.closest(".desktop-context-menu")) {
        closeContextMenu();
      }
    });
  }

  window.addEventListener("resize", function () {
    for (var appId in runningApps) {
      var win = runningApps[appId];

      if (win.classList.contains("fullscreen")) {
        win.style.top = TOP_BAR_HEIGHT + "px";
        win.style.left = "0px";
        win.style.width = "100vw";
        win.style.height = "calc(100vh - " + TOP_BAR_HEIGHT + "px)";
        continue;
      }

      var fixedSize = FIXED_APP_SIZES[appId];
      var app = apps[appId];

      if (fixedSize) {
        var w = Math.min(fixedSize.width, Math.max(260, window.innerWidth - 30));
        var h = Math.min(fixedSize.height, Math.max(360, window.innerHeight - TOP_BAR_HEIGHT - 60));

        win.style.width = w + "px";
        win.style.height = h + "px";
      } else if (app && app.type === "iframe") {
        var maxWidth = Math.max(480, window.innerWidth - 60);
        var maxHeight = Math.max(320, window.innerHeight - TOP_BAR_HEIGHT - 100);

        var size = calculateAspectSize(16, 9, maxWidth, maxHeight);

        win.style.width = size.width + "px";
        win.style.height = size.height + "px";
      }

      keepWindowReachable(win);
    }
  });

  function keepWindowReachable(win) {
    var width = win.offsetWidth;
    var minVisible = Math.max(24, width * MIN_VISIBLE_RATIO);

    var left = win.offsetLeft;
    var top = win.offsetTop;

    left = Math.min(window.innerWidth - minVisible, Math.max(-(width - minVisible), left));
    top = Math.min(window.innerHeight - MIN_VISIBLE_HEIGHT, Math.max(TOP_BAR_HEIGHT, top));

    win.style.left = left + "px";
    win.style.top = top + "px";
  }

  function resetWindowPosition(win) {
    var width = Math.min(DEFAULT_WINDOW_WIDTH, Math.max(320, window.innerWidth - 30));
    var height = Math.min(DEFAULT_WINDOW_HEIGHT, Math.max(240, window.innerHeight - TOP_BAR_HEIGHT - 80));

    win.style.width = width + "px";
    win.style.height = height + "px";
    win.style.left = Math.max(10, (window.innerWidth - width) / 2) + "px";
    win.style.top = Math.max(TOP_BAR_HEIGHT + 15, (window.innerHeight - height) / 2) + "px";
  }

  function escapeHTML(value) {
    return String(value)
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split('"').join("&quot;")
      .split("'").join("&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  function calculateAspectSize(ratioW, ratioH, maxWidth, maxHeight) {
    var width = maxWidth;
    var height = (width * ratioH) / ratioW;

    if (height > maxHeight) {
      height = maxHeight;
      width = (height * ratioW) / ratioH;
    }

    return { width: width, height: height };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
