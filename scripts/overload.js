// IMPORTANTE: si cambias el "id" del módulo en module.json,
// cambia también este canal para que coincida.
const SOCKET_CHANNEL = "module.overload-timer";

const OverloadTimer = {
  countdownInterval: null,
  defaultCountdownSeconds: 180, // 3 minutos por defecto
  isRunning: false,

  /**
   * Enviar mensaje por socket al resto de clientes.
   */
  broadcast(action, data = {}) {
    if (!game.socket) return;
    console.log("OverloadTimer | broadcast", action, data);
    game.socket.emit(SOCKET_CHANNEL, { action, data });
  },

  /**
   * Comprobar si el usuario actual puede usar los comandos.
   * - minRole: rol mínimo configurado.
   * - allowedUserNames: lista de nombres separados por comas (opcional).
   */
  canUse() {
    const minRole = game.settings.get("overload-timer", "minRole");
    const allowedNamesStr = game.settings.get("overload-timer", "allowedUserNames") || "";

    // Rol mínimo
    if (game.user.role < minRole) return false;

    // Si no hay lista de nombres, solo mandan los roles
    const trimmed = allowedNamesStr.trim();
    if (!trimmed) return true;

    // Si hay lista, además el nombre debe estar en ella
    const list = trimmed
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    return list.includes(game.user.name.toLowerCase());
  },

  /**
   * Iniciar overload (desde comando local o desde red).
   * @param {boolean} fromNetwork - true si viene del socket (para no rebroadcast).
   * @param {number|null} durationSeconds - duración en segundos (si null, usar por defecto).
   */
  trigger(fromNetwork = false, durationSeconds = null) {
    console.log("OverloadTimer | trigger", { fromNetwork, durationSeconds, isRunning: this.isRunning });

    if (this.isRunning) {
      console.log("OverloadTimer | ya hay un overload activo, se ignora el comando.");
      return;
    }

    this.isRunning = true;

    const duration = Number.isInteger(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : this.defaultCountdownSeconds;

    // Si la orden viene del cliente local (chat), la retransmitimos al resto
    if (!fromNetwork) {
      this.broadcast("start", { duration });
    }

    this.clearOverlay();
    this.clearCountdown();

    this.showOverloadImage()
      .then(async () => {
        // Al empezar el contador, guardar música actual y arrancar la principal del módulo
        await OverloadAudio.startMainLoopWithCapture();
        this.startCountdown(duration);
      })
      .catch(err => {
        console.error("OverloadTimer | Error en trigger:", err);
        this.finish();
      });
  },

  // Animación inicial de OVERLOAD
  showOverloadImage() {
    return this.showGenericOverlay("modules/overload-timer/assets/overload.png");
  },

  // Animación final: finish o cancel
  showEndImage(type) {
    let src;
    if (type === "finish") {
      src = "modules/overload-timer/assets/overload-finish.png";
    } else {
      src = "modules/overload-timer/assets/overload-cancel.png";
    }
    return this.showGenericOverlay(src);
  },

  /**
   * Función genérica de animación: entra desde la izquierda,
   * se para en el centro, sale por la derecha.
   */
  showGenericOverlay(src) {
    return new Promise((resolve) => {
      console.log("OverloadTimer | showGenericOverlay", src);

      const overlay = document.createElement("div");
      overlay.id = "overload-overlay";
      overlay.classList.add("overload-overlay");

      const img = document.createElement("img");
      img.src = src;
      img.classList.add("overload-image");

      overlay.appendChild(img);
      document.body.appendChild(overlay);

      const durationIn = 1000;
      const pause = 2000;
      const durationOut = 1000;

      void overlay.offsetWidth;

      overlay.style.left = "50%";
      overlay.style.transform = "translateX(-50%)";

      setTimeout(() => {
        setTimeout(() => {
          overlay.style.left = "110%";
          overlay.style.transform = "translateX(0)";

          setTimeout(() => {
            this.clearOverlay();
            resolve();
          }, durationOut);
        }, pause);
      }, durationIn);
    });
  },

  startCountdown(totalSeconds) {
    console.log("OverloadTimer | startCountdown", totalSeconds);

    const existing = document.getElementById("overload-countdown");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "overload-countdown";
    container.classList.add("overload-countdown");

    const timeSpan = document.createElement("span");
    timeSpan.classList.add("overload-countdown-time");

    container.appendChild(timeSpan);
    document.body.appendChild(container);

    let remaining = totalSeconds;

    const updateDisplay = () => {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;

      timeSpan.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;

      if (remaining <= 60 && remaining > 0) {
        container.classList.add("overload-countdown-warning");
      }
    };

    updateDisplay();

    this.countdownInterval = setInterval(() => {
      remaining--;

      if (remaining > 0) {
        updateDisplay();
        return;
      }

      remaining = 0;
      updateDisplay();

      const c = document.getElementById("overload-countdown");
      if (c) {
        c.classList.remove("overload-countdown-warning");
        c.classList.add("overload-countdown-finished");
      }

      clearInterval(this.countdownInterval);
      this.countdownInterval = null;

      setTimeout(() => {
        this.clearCountdown();

        // Al llegar al final:
        // - parar loop principal
        // - reproducir SFX de finish
        // - animación "finish"
        // - restaurar música que había antes (si había)
        OverloadAudio.playFinish();
        this.showEndImage("finish").then(() => {
          this.finish();
          OverloadAudio.restorePreviousMusic();
        });
      }, 1000);
    }, 1000);
  },

  finish() {
    console.log("OverloadTimer | finish");
    this.clearOverlay();
    this.clearCountdown();
    this.isRunning = false;
  },

  /**
   * Forzar final inmediato (desde comando local o desde red).
   * @param {boolean} fromNetwork - true si viene del socket.
   */
  forceFinish(fromNetwork = false) {
    console.log("OverloadTimer | forceFinish", { fromNetwork, isRunning: this.isRunning });

    if (!this.isRunning) return;

    if (!fromNetwork) {
      this.broadcast("finish");
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const container = document.getElementById("overload-countdown");
    const timeSpan = document.querySelector("#overload-countdown .overload-countdown-time");

    if (container) {
      container.classList.remove("overload-countdown-warning");
      container.classList.add("overload-countdown-finished");
    }
    if (timeSpan) {
      timeSpan.textContent = "00:00";
    }

    setTimeout(() => {
      this.clearCountdown();

      // Al cancelar:
      // - parar loop principal
      // - reproducir SFX de cancel
      // - animación "cancel"
      // - restaurar música que había antes (si había)
      OverloadAudio.playCancel();
      this.showEndImage("cancel").then(() => {
        this.finish();
        OverloadAudio.restorePreviousMusic();
      });
    }, 1000);
  },

  clearOverlay() {
    const overlay = document.getElementById("overload-overlay");
    if (overlay) overlay.remove();
  },

  clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    const container = document.getElementById("overload-countdown");
    if (container) container.remove();
  }
};

/**
 * Gestión de audio a través de Playlists (pestaña Música).
 * Solo el GM controla realmente el audio.
 */
const OverloadAudio = {
  playlistName: "Overload Timer",
  mainSoundName: "Overload Main",
  cancelSoundName: "Overload Cancel",
  finishSoundName: "Overload Finish",

  // Música que estaba sonando antes de empezar el OVERLOAD
  // Formato: [{ playlistId, soundIds: [id1, id2, ...] }, ...]
  previousSounds: [],

  async ensurePlaylist() {
    if (!game.user.isGM) return;
    if (!game.playlists) return;

    let pl = game.playlists.getName(this.playlistName);
    if (pl) {
      console.log("OverloadAudio | playlist ya existe:", this.playlistName);
      // Asegurar que el modo es DISABLED para que no avance sola
      if (pl.mode !== CONST.PLAYLIST_MODES.DISABLED) {
        await pl.update({ mode: CONST.PLAYLIST_MODES.DISABLED });
        console.log("OverloadAudio | modo de playlist actualizado a DISABLED");
      }
      return pl;
    }

    console.log("OverloadAudio | creando playlist", this.playlistName);

    const sounds = [
      {
        name: this.mainSoundName,
        path: "modules/overload-timer/sounds/overload-main.ogg",
        repeat: true,   // loop mientras dure overload
        volume: 0.8
      },
      {
        name: this.cancelSoundName,
        path: "modules/overload-timer/sounds/overload-cancel.ogg",
        repeat: false,
        volume: 0.8
      },
      {
        name: this.finishSoundName,
        path: "modules/overload-timer/sounds/overload-finish.ogg",
        repeat: false,
        volume: 0.8
      }
    ];

    pl = await Playlist.create(
      {
        name: this.playlistName,
        mode: CONST.PLAYLIST_MODES.DISABLED, // clave: sin avance automático
        sounds
      },
      { render: true }
    );

    return pl;
  },

  async getPlaylist() {
    return game.playlists?.getName(this.playlistName) ?? null;
  },

  async stopAllMusic() {
    if (!game.user.isGM) return;
    if (!game.playlists) return;

    for (const pl of game.playlists) {
      if (pl.playing) {
        await pl.stopAll();
      }
    }
  },

  /**
   * Guardar qué sonidos estaban sonando (EXCLUYENDO la playlist de Overload)
   * y detenerlos.
   */
  async captureAndStopMusic() {
    if (!game.user.isGM) return;
    if (!game.playlists) return;

    this.previousSounds = [];

    for (const pl of game.playlists) {
      // Nunca guardar la playlist del propio Overload
      if (pl.name === this.playlistName) continue;

      const playingSounds = pl.sounds.filter(s => s.playing);
      if (!playingSounds.length) continue;

      this.previousSounds.push({
        playlistId: pl.id,
        soundIds: playingSounds.map(s => s.id)
      });
    }

    // Parar toda la música actual (incluida Overload por si acaso)
    await this.stopAllMusic();
    console.log("OverloadAudio | música capturada (sin Overload):", this.previousSounds);
  },

  /**
   * Restaurar la música que se guardó en captureAndStopMusic.
   * Nunca restaurar la playlist de Overload.
   */
  async restorePreviousMusic() {
    if (!game.user.isGM) return;
    if (!game.playlists) return;

    if (!this.previousSounds || !this.previousSounds.length) {
      console.log("OverloadAudio | no había música previa que restaurar");
      this.previousSounds = [];
      return;
    }

    console.log("OverloadAudio | restaurando música previa:", this.previousSounds);

    for (const entry of this.previousSounds) {
      const pl = game.playlists.get(entry.playlistId);
      if (!pl) continue;
      if (pl.name === this.playlistName) continue;

      for (const sid of entry.soundIds) {
        const sound = pl.sounds.get(sid);
        if (!sound) continue;
        await pl.playSound(sound);
      }
    }

    this.previousSounds = [];
  },

  async stopOverloadPlaylist() {
    if (!game.user.isGM) return;
    const pl = await this.getPlaylist();
    if (!pl) return;
    await pl.stopAll();
  },

  async playSoundByName(soundName) {
    if (!game.user.isGM) return;
    if (!game.playlists) return;

    let pl = await this.getPlaylist();
    if (!pl) {
      pl = await this.ensurePlaylist();
      if (!pl) return;
    }

    const sound = pl.sounds.getName(soundName);
    if (!sound) {
      console.warn("OverloadAudio | sound no encontrado:", soundName);
      return;
    }

    console.log("OverloadAudio | reproduciendo sonido", soundName);
    await pl.playSound(sound);
  },

  async playMainLoop() {
    return this.playSoundByName(this.mainSoundName);
  },

  async playCancel() {
    // Parar el loop principal del OVERLOAD y reproducir el SFX de cancel
    await this.stopOverloadPlaylist();
    return this.playSoundByName(this.cancelSoundName);
  },

  async playFinish() {
    // Parar el loop principal del OVERLOAD y reproducir el SFX de finish
    await this.stopOverloadPlaylist();
    return this.playSoundByName(this.finishSoundName);
  },

  /**
   * Paso completo al iniciar OVERLOAD:
   * - guardar música actual (sin Overload)
   * - detenerla
   * - reproducir el loop principal del módulo
   */
  async startMainLoopWithCapture() {
    await this.captureAndStopMusic();
    await this.playMainLoop();
  }
};

Hooks.once("init", () => {
  console.log("OverloadTimer | init");

  // Ajuste: rol mínimo para usar los comandos
  game.settings.register("overload-timer", "minRole", {
    name: "Rol mínimo para usar Overload",
    hint: "Solo los usuarios con este rol o superior pueden usar los comandos /overload.",
    scope: "world",
    config: true,
    type: Number,
    default: CONST.USER_ROLES.ASSISTANT,
    choices: {
      [CONST.USER_ROLES.NONE]: "Sin rol (no recomendado)",
      [CONST.USER_ROLES.PLAYER]: "Player",
      [CONST.USER_ROLES.TRUSTED]: "Trusted",
      [CONST.USER_ROLES.ASSISTANT]: "Assistant",
      [CONST.USER_ROLES.GAMEMASTER]: "GM"
    }
  });

  // Ajuste: lista opcional de usuarios específicos
  game.settings.register("overload-timer", "allowedUserNames", {
    name: "Usuarios permitidos (opcional)",
    hint: "Lista de nombres de usuario separados por comas. Déjalo vacío para no filtrar por nombre.",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });
});

Hooks.once("ready", async () => {
  console.log("OverloadTimer | ready en usuario", game.user?.name, "rol", game.user?.role);

  if (!game.socket) {
    console.warn("OverloadTimer | game.socket no disponible");
  } else {
    game.socket.on(SOCKET_CHANNEL, (data) => {
      console.log("OverloadTimer | mensaje recibido por socket", data);
      if (!data || !data.action) return;
      const payload = data.data || {};

      switch (data.action) {
        case "start":
          OverloadTimer.trigger(true, payload.duration);
          break;
        case "finish":
          OverloadTimer.forceFinish(true);
          break;
      }
    });
  }

  // Solo el GM se encarga de asegurar la playlist
  if (game.user.isGM) {
    await OverloadAudio.ensurePlaylist();
  }
});

Hooks.on("chatMessage", (chatLog, message, chatData) => {
  const args = message.trim().toLowerCase().split(/\s+/);
  const command = args[0];
  const sub = args[1];

  const isStartBase =
    command === "/overload" ||
    command === "/over" ||
    command === "/ov";

  const isFinishCmd =
    command === "/of" ||
    (
      isStartBase &&
      (sub === "finish" || sub === "stop" || sub === "end")
    );

  const isStartCmd = isStartBase && !isFinishCmd;

  if (!isStartCmd && !isFinishCmd) return true;

  console.log("OverloadTimer | chat command", { message, isStartCmd, isFinishCmd });

  // Comprobar permisos sólo para el que escribe
  if (!OverloadTimer.canUse()) {
    ui.notifications.warn("No tienes permiso para usar los comandos de Overload.");
    return false;
  }

  // Finalización (cancelación)
  if (isFinishCmd) {
    OverloadTimer.forceFinish(false);
    return false;
  }

  // Inicio con duración opcional (en segundos)
  let duration = null;
  if (sub && !isNaN(parseInt(sub, 10))) {
    duration = parseInt(sub, 10);
  }

  OverloadTimer.trigger(false, duration);
  return false;
});
