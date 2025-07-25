// Variables globales
let currentTab = "dashboard";
let refreshInterval;
let spotifyRefreshInterval; // New interval for Spotify updates
let sessionId = localStorage.getItem("twitch_session");
let currentUser = JSON.parse(localStorage.getItem("twitch_user") || "null");
let currentPermissions = JSON.parse(
  localStorage.getItem("twitch_permissions") || "null"
);
let isCheckingAuth = false; // Prevent multiple simultaneous auth checks
let translations = {};

// Modal management
let currentEditCommand = null;
let currentEditBannedWord = null;
let currentDeleteItem = null;

// Initialisation
document.addEventListener("DOMContentLoaded", function () {
  // Add a small delay to ensure everything is loaded
  setTimeout(() => {
    loadTranslations();
    checkAuthentication();
  }, 100);
});

// Variable pour éviter les tentatives multiples de reconnexion
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Translation management
async function loadTranslations() {
  try {
    const response = await fetch("/api/translations");
    translations = await response.json();
    applyTranslations();
  } catch (error) {
    console.error("Error loading translations:", error);
  }
}

function applyTranslations() {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const translation = getTranslation(key);
    if (translation) {
      element.textContent = translation;
    }
  });

  // Apply placeholders
  const placeholderElements = document.querySelectorAll(
    "[data-i18n-placeholder]"
  );
  placeholderElements.forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    const translation = getTranslation(key);
    if (translation) {
      element.placeholder = translation;
    }
  });
}

function getTranslation(key) {
  const keys = key.split(".");
  let translation = translations;

  for (const k of keys) {
    if (translation && translation[k] !== undefined) {
      translation = translation[k];
    } else {
      return key; // Return the key if no translation found
    }
  }

  return translation;
}

function t(key, variables = {}) {
  let translation = getTranslation(key);

  if (typeof translation === "string") {
    return translation.replace(/\{(\w+)\}/g, (match, variable) => {
      return variables[variable] !== undefined ? variables[variable] : match;
    });
  }

  return translation || key;
}

// Authentication management
async function checkAuthentication() {
  // Prevent multiple simultaneous auth checks
  if (isCheckingAuth) {
    console.log("Auth check already in progress, skipping...");
    return;
  }

  isCheckingAuth = true;

  const authStatus = document.getElementById("authStatus");
  const authActions = document.getElementById("authActions");

  try {
    // Check if auth is enabled
    const authConfig = await apiCall("auth/status");

    if (!authConfig.enabled) {
      // Auth disabled, show main interface
      reconnectAttempts = 0; // Reset attempts on success
      showMainInterface();
      return;
    }

    if (!authConfig.configured) {
      // Auth not configured, show error
      authStatus.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-triangle"></i>
          <span data-i18n="web.auth.notConfigured"></span>
        </div>
      `;
      applyTranslations();
      return;
    }

    // Check existing session
    if (sessionId && currentUser) {
      try {
        const session = await apiCall("auth/session", {
          headers: { "x-session-id": sessionId },
        });

        if (session.user && session.permissions.canAccess) {
          // Valid session, show main interface
          reconnectAttempts = 0; // Reset attempts on success
          showMainInterface();
          return;
        }
      } catch (error) {
        console.log("Session invalid, clearing...");
        // Session invalid, clear it
        clearSession();
      }
    }

    // No valid session, show login
    authStatus.innerHTML = `
      <div class="info">
        <i class="fas fa-info-circle"></i>
        <span data-i18n="web.auth.loginRequired"></span>
      </div>
    `;
    applyTranslations();
    authActions.style.display = "block";
  } catch (error) {
    console.error("Auth check error:", error);

    // If it's a network error, show a more specific message
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError")
    ) {
      reconnectAttempts++;
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        authStatus.innerHTML = `
          <div class="info">
            <i class="fas fa-info-circle"></i>
            <span data-i18n="web.auth.connecting">Tentative de connexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...</span>
          </div>
        `;
        applyTranslations();
        // Retry after 2 seconds
        setTimeout(() => {
          isCheckingAuth = false;
          checkAuthentication();
        }, 2000);
        return;
      } else {
        authStatus.innerHTML = `
          <div class="error">
            <i class="fas fa-exclamation-triangle"></i>
            <span data-i18n="web.auth.serverError"></span>
          </div>
        `;
        applyTranslations();
      }
    } else {
      authStatus.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-triangle"></i>
          <span data-i18n="web.auth.checkError"></span>
        </div>
      `;
      applyTranslations();
    }
  } finally {
    isCheckingAuth = false;
  }
}

function showMainInterface() {
  reconnectAttempts = 0; // Reset attempts on success
  document.getElementById("authModal").style.display = "none";
  document.getElementById("mainContainer").style.display = "block";

  // Update user info
  if (currentUser) {
    document.getElementById("userAvatar").src = currentUser.profileImageUrl;
    document.getElementById("userName").textContent = currentUser.displayName;
  }

  // Initialize main interface
  initializeTabs();
  initializeEventListeners();
  loadInitialData();
  startAutoRefresh();
}

function clearSession() {
  sessionId = null;
  currentUser = null;
  currentPermissions = null;
  localStorage.removeItem("twitch_session");
  localStorage.removeItem("twitch_user");
  localStorage.removeItem("twitch_permissions");
}

// Login button handler
document.addEventListener("DOMContentLoaded", function () {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      try {
        const response = await apiCall("auth/twitch");
        window.location.href = response.authUrl;
      } catch (error) {
        showNotification(t("web.auth.loginError"), "error");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await apiCall("auth/logout", {
          method: "POST",
          headers: { "x-session-id": sessionId },
        });
        clearSession();
        location.reload();
      } catch (error) {
        console.error("Logout error:", error);
        clearSession();
        location.reload();
      }
    });
  }
});

// Gestion des onglets
function initializeTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Mettre à jour les boutons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  // Mettre à jour le contenu
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(tabName).classList.add("active");

  currentTab = tabName;
  loadTabData(tabName);
}

// Écouteurs d'événements
function initializeEventListeners() {
  // Envoi de message
  document
    .getElementById("sendMessageBtn")
    .addEventListener("click", sendMessage);
  document.getElementById("messageInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Formulaires
  document
    .getElementById("addCommandForm")
    .addEventListener("submit", addCommand);
  document
    .getElementById("addBannedWordForm")
    .addEventListener("submit", addBannedWord);
  document
    .getElementById("addAllowedLinkForm")
    .addEventListener("submit", addAllowedLink);

  // Gestion de l'affichage du champ durée pour les mots bannis
  document
    .getElementById("bannedWordAction")
    .addEventListener("change", toggleBannedWordDuration);
  document
    .getElementById("editBannedWordAction")
    .addEventListener("change", toggleEditBannedWordDuration);

  // Event listeners pour les switches de modération
  document
    .getElementById("bannedWordsToggle")
    ?.addEventListener("change", toggleBannedWords);
  document
    .getElementById("allowedLinksToggle")
    ?.addEventListener("change", toggleAllowedLinks);

  // Formulaires de messages récurrents
  document
    .getElementById("addRecurringMessageForm")
    .addEventListener("submit", addRecurringMessage);

  // Boutons de rafraîchissement
  document
    .getElementById("refreshCommandsBtn")
    .addEventListener("click", loadCommands);
  document
    .getElementById("refreshSpotifyBtn")
    .addEventListener("click", loadSpotifyInfo);
  document
    .getElementById("refreshApexBtn")
    .addEventListener("click", loadApexInfo);

  // Event listeners pour les modales
  document.getElementById("editCommandForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveEditCommand();
  });

  document
    .getElementById("editBannedWordForm")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      saveEditBannedWord();
    });

  // Close modals when clicking outside
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      closeModal(e.target.id);
    }
  });

  // Initialize ads event listeners
  initializeAdsEventListeners();

  // Initialize Spotify auth event listeners
  initializeSpotifyAuthEventListeners();
}

// Chargement initial des données
async function loadInitialData() {
  await Promise.all([
    loadBotStatus(),
    loadSpotifyInfo(),
    loadObsInfo(),
    loadApexInfo(),
  ]);
}

// Chargement des données par onglet
function loadTabData(tabName) {
  switch (tabName) {
    case "commands":
      loadCommands();
      break;
    case "moderation":
      loadModerationData();
      break;
    case "recurring":
      loadRecurringMessages();
      break;
    case "integrations":
      loadIntegrationsData();
      break;
    case "ads":
      loadAdsData();
      break;
  }
}

// API Functions
async function apiCall(endpoint, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Add session ID if available
    if (sessionId) {
      headers["x-session-id"] = sessionId;
    }

    // Ensure endpoint doesn't start with /api/ to avoid double /api/
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.substring(5)
      : endpoint;

    const url = `/api/${cleanEndpoint}`;

    const response = await fetch(url, {
      headers,
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Session expired or invalid - just clear session
        clearSession();
        throw new Error("Session expirée");
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Erreur API ${endpoint}:`, error);
    // Don't show notification for auth errors to avoid spam
    if (!endpoint.includes("/auth/")) {
      // Only show notification for non-critical errors
      if (!error.message.includes("Session expirée")) {
        showNotification(t("web.errors.serverCommunication"), "error");
      }
    }
    throw error;
  }
}

// Fonctions du tableau de bord
async function loadBotStatus() {
  try {
    const status = await apiCall("status");

    const channelNameElement = document.getElementById("channelName");
    const uptimeElement = document.getElementById("uptime");
    const versionElement = document.getElementById("version");
    const statusDot = document.querySelector(".status-dot");
    const statusText = document.querySelector(".status-text");

    if (channelNameElement) {
      channelNameElement.textContent = status.channel || "-";
    }
    if (uptimeElement) {
      uptimeElement.textContent = formatUptime(status.uptime);
    }
    if (versionElement) {
      versionElement.textContent = status.version || "-";
    }

    if (statusDot && statusText) {
      if (status.connected) {
        statusDot.classList.add("connected");
        statusText.textContent = t("web.status.connected");
      } else {
        statusDot.classList.remove("connected");
        statusText.textContent = t("web.status.disconnected");
      }
    }
  } catch (error) {
    console.error("Erreur lors du chargement du statut du bot:", error);
    // Don't show notification for status errors to avoid spam
  }
}

async function loadSpotifyInfo() {
  try {
    const status = await apiCall("spotify/status");
    const currentSong = await apiCall("spotify/current-song");

    const spotifyStatusElement = document.getElementById("spotifyStatus");
    const spotifyStatusDetailElement = document.getElementById(
      "spotifyStatusDetail"
    );
    const currentSongElement = document.getElementById("currentSong");

    if (spotifyStatusElement) {
      spotifyStatusElement.textContent = status.connected
        ? t("web.status.connected")
        : t("web.status.disconnected");
    }
    if (spotifyStatusDetailElement) {
      spotifyStatusDetailElement.textContent = status.connected
        ? t("web.status.connected")
        : t("web.status.disconnected");
    }

    if (currentSongElement) {
      if (currentSong && currentSong.name) {
        currentSongElement.textContent = `${currentSong.name} - ${currentSong.artists}`;
      } else {
        currentSongElement.textContent = t("web.spotify.noSong");
      }
    }
  } catch (error) {
    console.error("Erreur lors du chargement des infos Spotify:", error);
    // Don't show notification for Spotify errors to avoid spam
  }
}

async function loadObsInfo() {
  try {
    const status = await apiCall("obs/status");

    const obsStatusElement = document.getElementById("obsStatus");
    const obsStatusDetailElement = document.getElementById("obsStatusDetail");

    if (obsStatusElement) {
      obsStatusElement.textContent = status.connected
        ? t("web.status.connected")
        : t("web.status.disconnected");
    }
    if (obsStatusDetailElement) {
      obsStatusDetailElement.textContent = status.connected
        ? t("web.status.connected")
        : t("web.status.disconnected");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des infos OBS:", error);
    // Don't show notification for OBS errors to avoid spam
  }
}

async function loadApexInfo() {
  try {
    const status = await apiCall("apex/status");

    const apexStatusElement = document.getElementById("apexStatus");
    const apexStatusDetailElement = document.getElementById("apexStatusDetail");
    const apexPlayerElement = document.getElementById("apexPlayer");

    if (apexStatusElement) {
      apexStatusElement.textContent =
        status.status === "online"
          ? t("web.apex.available")
          : t("web.apex.unavailable");
    }
    if (apexStatusDetailElement) {
      apexStatusDetailElement.textContent =
        status.status === "online"
          ? t("web.apex.available")
          : t("web.apex.unavailable");
    }
    if (apexPlayerElement) {
      apexPlayerElement.textContent = t("web.apex.configured");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des infos Apex:", error);
    // Don't show notification for Apex errors to avoid spam
  }
}

// Fonctions des commandes
async function loadCommands() {
  try {
    const commands = await apiCall("commands");
    const tbody = document.getElementById("commandsTableBody");
    tbody.innerHTML = "";

    commands.custom.forEach((command) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>!${command.name}</td>
                <td>${command.content}</td>
                <td>${command.usage_count}</td>
                <td>${command.created_by || "-"}</td>
                <td>
                    <button onclick="editCommand('${
                      command.name
                    }', '${command.content.replace(
        /'/g,
        "\\'"
      )}')" class="action-btn" title="${t("web.common.edit")}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCommand('${
                      command.name
                    }')" class="action-btn" title="${t("web.common.delete")}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Erreur lors du chargement des commandes:", error);
  }
}

async function addCommand(event) {
  event.preventDefault();

  const name = document.getElementById("commandName").value;
  const content = document.getElementById("commandContent").value;

  try {
    await apiCall("commands", {
      method: "POST",
      body: JSON.stringify({
        name: name.replace("!", ""),
        content,
        createdBy: "web-interface",
      }),
    });

    showNotification(t("web.commands.addSuccess"), "success");
    document.getElementById("addCommandForm").reset();
    loadCommands();
  } catch (error) {
    console.error("Erreur lors de l'ajout de la commande:", error);
  }
}

async function editCommand(name, currentContent) {
  currentEditCommand = { name, content: currentContent };

  // Fill modal with current data
  document.getElementById("editCommandName").value = name;
  document.getElementById("editCommandContent").value = currentContent;

  // Open modal
  openModal("editCommandModal");
}

async function saveEditCommand() {
  if (!currentEditCommand) return;

  const newName = document
    .getElementById("editCommandName")
    .value.trim()
    .replace("!", "");
  const newContent = document.getElementById("editCommandContent").value.trim();

  if (newName === "" || newContent === "") {
    showNotification(t("web.commands.nameAndContentRequired"), "error");
    return;
  }

  try {
    // Delete old command and create new one
    await apiCall(`commands/${currentEditCommand.name}`, { method: "DELETE" });
    await apiCall("commands", {
      method: "POST",
      body: JSON.stringify({
        name: newName,
        content: newContent,
        createdBy: "web-interface",
      }),
    });

    showNotification(t("web.commands.editSuccess"), "success");
    closeModal("editCommandModal");
    loadCommands();
  } catch (error) {
    console.error("Erreur lors de la modification de la commande:", error);
    showNotification(t("web.commands.editError"), "error");
  }
}

async function deleteCommand(name) {
  showDeleteConfirm(t("web.commands.deleteConfirm", { name }), async () => {
    try {
      const encodedName = encodeURIComponent(name);
      await apiCall(`commands/${encodedName}`, { method: "DELETE" });
      showNotification(t("web.commands.deleteSuccess"), "success");
      loadCommands();
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      showNotification(t("web.commands.deleteError"), "error");
    }
  });
}

// Fonctions de modération
async function loadModerationData() {
  try {
    const bannedWords = await apiCall("moderation/banned-words");
    const allowedLinks = await apiCall("moderation/allowed-links");
    const settings = await apiCall("moderation/settings");

    // Update switches
    document.getElementById("bannedWordsToggle").checked =
      settings.banned_words_enabled === 1;
    document.getElementById("allowedLinksToggle").checked =
      settings.allowed_links_enabled === 1;

    // Charger les mots interdits
    const bannedWordsTbody = document.getElementById("bannedWordsTableBody");
    bannedWordsTbody.innerHTML = "";

    bannedWords.forEach((word) => {
      const row = document.createElement("tr");
      const durationText = word.action === "delete" ? "-" : `${word.duration}s`;
      row.innerHTML = `
                <td>${word.word}</td>
                <td>${word.action}</td>
                <td>${durationText}</td>
                <td>${word.added_by || "-"}</td>
                <td>
                    <button onclick="editBannedWord('${word.word}', '${
        word.action
      }', ${word.duration})" class="action-btn" title="${t("web.common.edit")}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteBannedWord('${
                      word.word
                    }')" class="action-btn" title="${t("web.common.delete")}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      bannedWordsTbody.appendChild(row);
    });

    // Charger les liens autorisés
    const allowedLinksTbody = document.getElementById("allowedLinksTableBody");
    if (allowedLinksTbody) {
      allowedLinksTbody.innerHTML = "";

      allowedLinks.forEach((link) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${link.domain}</td>
          <td>${link.added_by}</td>
          <td>${new Date(link.added_at).toLocaleDateString("fr-FR")}</td>
          <td>
            <button onclick="deleteAllowedLink('${
              link.domain
            }')" class="action-btn">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        allowedLinksTbody.appendChild(row);
      });
    }
  } catch (error) {
    console.error(
      "Erreur lors du chargement des données de modération:",
      error
    );
  }
}

// Moderation settings functions
async function toggleBannedWords() {
  const enabled = document.getElementById("bannedWordsToggle").checked;
  try {
    const settings = await apiCall("moderation/settings");
    await apiCall("moderation/settings", {
      method: "PUT",
      body: JSON.stringify({
        bannedWordsEnabled: enabled,
        allowedLinksEnabled: settings.allowed_links_enabled === 1,
      }),
    });
    showNotification(
      enabled
        ? t("web.moderation.bannedWordsEnabled")
        : t("web.moderation.bannedWordsDisabled"),
      "success"
    );
  } catch (error) {
    console.error("Erreur lors de la mise à jour des paramètres:", error);
    showNotification(t("web.moderation.settingsError"), "error");
    // Revert the toggle
    document.getElementById("bannedWordsToggle").checked = !enabled;
  }
}

async function toggleAllowedLinks() {
  const enabled = document.getElementById("allowedLinksToggle").checked;
  try {
    const settings = await apiCall("moderation/settings");
    await apiCall("moderation/settings", {
      method: "PUT",
      body: JSON.stringify({
        bannedWordsEnabled: settings.banned_words_enabled === 1,
        allowedLinksEnabled: enabled,
      }),
    });
    showNotification(
      enabled
        ? t("web.moderation.allowedLinksEnabled")
        : t("web.moderation.allowedLinksDisabled"),
      "success"
    );
  } catch (error) {
    console.error("Erreur lors de la mise à jour des paramètres:", error);
    showNotification(t("web.moderation.settingsError"), "error");
    // Revert the toggle
    document.getElementById("allowedLinksToggle").checked = !enabled;
  }
}

async function addBannedWord(event) {
  event.preventDefault();

  const word = document.getElementById("bannedWord").value;
  const action = document.getElementById("bannedWordAction").value;
  const duration =
    action === "delete"
      ? 0
      : parseInt(document.getElementById("bannedWordDuration").value);

  try {
    await apiCall("moderation/banned-words", {
      method: "POST",
      body: JSON.stringify({ word, action, duration }),
    });

    showNotification(t("web.moderation.bannedWordAddSuccess"), "success");
    document.getElementById("addBannedWordForm").reset();
    loadModerationData();
  } catch (error) {
    console.error("Erreur lors de l'ajout du mot interdit:", error);
  }
}

async function editBannedWord(word, currentAction, currentDuration) {
  currentEditBannedWord = {
    word,
    action: currentAction,
    duration: currentDuration,
  };

  // Fill modal with current data
  document.getElementById("editBannedWordText").value = word;
  document.getElementById("editBannedWordAction").value = currentAction;
  document.getElementById("editBannedWordDuration").value = currentDuration;

  // Initialize duration field visibility
  toggleEditBannedWordDuration();

  // Open modal
  openModal("editBannedWordModal");
}

async function saveEditBannedWord() {
  if (!currentEditBannedWord) return;

  const newWord = document.getElementById("editBannedWordText").value.trim();
  const newAction = document.getElementById("editBannedWordAction").value;
  const newDuration =
    newAction === "delete"
      ? 0
      : parseInt(document.getElementById("editBannedWordDuration").value);

  if (
    newWord === "" ||
    (newAction !== "delete" && (isNaN(newDuration) || newDuration < 1))
  ) {
    showNotification(t("web.moderation.wordAndDurationRequired"), "error");
    return;
  }

  try {
    // Delete old word and create new one
    const encodedWord = encodeURIComponent(currentEditBannedWord.word);
    await apiCall(`moderation/banned-words/${encodedWord}`, {
      method: "DELETE",
    });
    await apiCall("moderation/banned-words", {
      method: "POST",
      body: JSON.stringify({
        word: newWord,
        action: newAction,
        duration: newDuration,
      }),
    });

    showNotification(t("web.moderation.editBannedWordSuccess"), "success");
    closeModal("editBannedWordModal");
    loadModerationData();
  } catch (error) {
    console.error("Erreur lors de la modification du mot interdit:", error);
    showNotification(t("web.moderation.editBannedWordError"), "error");
  }
}

async function deleteBannedWord(word) {
  showDeleteConfirm(
    t("web.moderation.bannedWordDeleteConfirm", { word }),
    async () => {
      try {
        const encodedWord = encodeURIComponent(word);
        await apiCall(`moderation/banned-words/${encodedWord}`, {
          method: "DELETE",
        });
        showNotification(
          t("web.moderation.bannedWordDeleteSuccess"),
          "success"
        );
        loadModerationData();
      } catch (error) {
        console.error("Erreur lors de la suppression du mot interdit:", error);
        showNotification(t("web.moderation.bannedWordDeleteError"), "error");
      }
    }
  );
}

async function addAllowedLink(event) {
  event.preventDefault();

  const domain = document.getElementById("allowedLink").value;

  try {
    await apiCall("moderation/allowed-links", {
      method: "POST",
      body: JSON.stringify({ domain, addedBy: "web-interface" }),
    });

    showNotification(t("web.moderation.allowedLinkAddSuccess"), "success");
    document.getElementById("addAllowedLinkForm").reset();
    loadModerationData(); // Recharger les données après l'ajout
  } catch (error) {
    console.error("Erreur lors de l'ajout du lien autorisé:", error);
    showNotification(t("web.moderation.allowedLinkAddError"), "error");
  }
}

async function deleteAllowedLink(domain) {
  showDeleteConfirm(
    t("web.moderation.allowedLinkDeleteConfirm", { domain }),
    async () => {
      try {
        const encodedDomain = encodeURIComponent(domain);
        await apiCall(`moderation/allowed-links/${encodedDomain}`, {
          method: "DELETE",
        });
        showNotification(
          t("web.moderation.allowedLinkDeleteSuccess"),
          "success"
        );
        loadModerationData();
      } catch (error) {
        console.error("Erreur lors de la suppression du lien autorisé:", error);
        showNotification(t("web.moderation.allowedLinkDeleteError"), "error");
      }
    }
  );
}

// Fonctions des messages récurrents
async function loadRecurringMessages() {
  try {
    const messages = await apiCall("recurring-messages");
    const tbody = document.getElementById("recurringMessagesTableBody");
    tbody.innerHTML = "";

    messages.forEach((message) => {
      const row = document.createElement("tr");
      const lastSent = message.last_sent
        ? new Date(message.last_sent).toLocaleString("fr-FR")
        : t("web.recurring.never");

      row.innerHTML = `
        <td>${message.message}</td>
        <td>${message.interval_minutes} min</td>
        <td>
          <span class="status-badge ${
            message.enabled ? "enabled" : "disabled"
          }">
            ${
              message.enabled
                ? t("web.recurring.active")
                : t("web.recurring.inactive")
            }
          </span>
        </td>
        <td>${lastSent}</td>
        <td>
          <button onclick="toggleRecurringMessage(${
            message.id
          }, ${!message.enabled})" class="action-btn">
            <i class="fas fa-${message.enabled ? "pause" : "play"}"></i>
          </button>
          <button onclick="editRecurringMessage(${
            message.id
          })" class="action-btn">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteRecurringMessage(${
            message.id
          })" class="action-btn">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Erreur lors du chargement des messages récurrents:", error);
  }
}

async function addRecurringMessage(event) {
  event.preventDefault();

  const message = document.getElementById("recurringMessage").value;
  const intervalMinutes = parseInt(
    document.getElementById("intervalMinutes").value
  );

  try {
    await apiCall("recurring-messages", {
      method: "POST",
      body: JSON.stringify({ message, intervalMinutes }),
    });

    showNotification(t("web.recurring.addSuccess"), "success");
    document.getElementById("addRecurringMessageForm").reset();
    loadRecurringMessages();
  } catch (error) {
    console.error("Erreur lors de l'ajout du message récurrent:", error);
  }
}

async function toggleRecurringMessage(id, enabled) {
  try {
    const messages = await apiCall("recurring-messages");
    const message = messages.find((m) => m.id === id);

    if (message) {
      await apiCall(`recurring-messages/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          message: message.message,
          intervalMinutes: message.interval_minutes,
          enabled,
        }),
      });

      showNotification(
        t("web.recurring.toggleSuccess", {
          status: enabled
            ? t("web.recurring.enabled")
            : t("web.recurring.disabled"),
        }),
        "success"
      );
      loadRecurringMessages();
    }
  } catch (error) {
    console.error(
      "Erreur lors de la modification du message récurrent:",
      error
    );
  }
}

async function editRecurringMessage(id) {
  try {
    const messages = await apiCall("recurring-messages");
    const message = messages.find((m) => m.id === id);

    if (message) {
      const newMessage = prompt(
        t("web.recurring.editMessage"),
        message.message
      );
      if (newMessage !== null) {
        const newInterval = prompt(
          t("web.recurring.editInterval"),
          message.interval_minutes
        );
        if (newInterval !== null) {
          await apiCall(`recurring-messages/${id}`, {
            method: "PUT",
            body: JSON.stringify({
              message: newMessage,
              intervalMinutes: parseInt(newInterval),
              enabled: message.enabled,
            }),
          });

          showNotification(t("web.recurring.updateSuccess"), "success");
          loadRecurringMessages();
        }
      }
    }
  } catch (error) {
    console.error(
      "Erreur lors de la modification du message récurrent:",
      error
    );
  }
}

async function deleteRecurringMessage(id) {
  showDeleteConfirm(t("web.recurring.deleteConfirm"), async () => {
    try {
      await apiCall(`recurring-messages/${id}`, { method: "DELETE" });
      showNotification(t("web.recurring.deleteSuccess"), "success");
      loadRecurringMessages();
    } catch (error) {
      console.error(
        "Erreur lors de la suppression du message récurrent:",
        error
      );
    }
  });
}

// Fonctions des intégrations
function loadIntegrationsData() {
  loadSpotifyInfo();
  loadObsInfo();
  loadApexInfo();
}

// Fonctions des statistiques

// Fonctions utilitaires
function toggleBannedWordDuration() {
  const action = document.getElementById("bannedWordAction").value;
  const durationGroup = document
    .getElementById("bannedWordDuration")
    .closest(".form-group");

  if (action === "delete") {
    durationGroup.style.display = "none";
  } else {
    durationGroup.style.display = "block";
  }
}

function toggleEditBannedWordDuration() {
  const action = document.getElementById("editBannedWordAction").value;
  const durationGroup = document
    .getElementById("editBannedWordDuration")
    .closest(".form-group");

  if (action === "delete") {
    durationGroup.style.display = "none";
  } else {
    durationGroup.style.display = "block";
  }
}

async function sendMessage() {
  const message = document.getElementById("messageInput").value.trim();
  if (!message) return;

  try {
    await apiCall("bot/say", {
      method: "POST",
      body: JSON.stringify({ message }),
    });

    document.getElementById("messageInput").value = "";
    showNotification(t("web.bot.messageSent"), "success");
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
  }
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours}h ${minutes}m ${secs}s`;
}

// Modal functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    // Focus on the first input
    setTimeout(() => {
      if (modalId === "editCommandModal") {
        document.getElementById("editCommandName").focus();
      } else if (modalId === "editBannedWordModal") {
        document.getElementById("editBannedWordText").focus();
      }
    }, 100);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }

  // Reset current items
  if (modalId === "editCommandModal") {
    currentEditCommand = null;
  } else if (modalId === "editBannedWordModal") {
    currentEditBannedWord = null;
  } else if (modalId === "deleteConfirmModal") {
    currentDeleteItem = null;
  }
}

function showDeleteConfirm(message, onConfirm) {
  document.getElementById("deleteConfirmMessage").textContent = message;
  currentDeleteItem = { onConfirm };
  openModal("deleteConfirmModal");

  // Set up confirm button
  const confirmBtn = document.getElementById("deleteConfirmBtn");
  confirmBtn.onclick = () => {
    if (currentDeleteItem && currentDeleteItem.onConfirm) {
      currentDeleteItem.onConfirm();
    }
    closeModal("deleteConfirmModal");
  };
}

function showNotification(message, type = "info") {
  const notifications = document.getElementById("notifications");
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  notifications.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function startAutoRefresh() {
  // Clear existing intervals
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (spotifyRefreshInterval) {
    clearInterval(spotifyRefreshInterval);
  }

  // Start main refresh interval (every 30 seconds)
  refreshInterval = setInterval(() => {
    if (currentTab === "dashboard") {
      loadBotStatus();
    } else if (currentTab === "integrations") {
      loadIntegrationsData();
    }
  }, 30000); // Refresh every 30 seconds

  // Start Spotify-specific refresh interval (every 10 seconds)
  spotifyRefreshInterval = setInterval(() => {
    // Always update Spotify info, regardless of current tab
    loadSpotifyInfo();
  }, 10000); // Refresh Spotify every 10 seconds
}

// Ads Management Functions
async function loadAdsData() {
  try {
    const adsStatus = await apiCall("ads/status");
    updateAdsStatus(adsStatus);
  } catch (error) {
    console.error("Error loading ads data:", error);
    showNotification("Error loading ads status", "error");
  }
}

function updateAdsStatus(data) {
  // Check if account has access to ads management
  if (data.commercial && data.commercial.error === "no_access") {
    // Account doesn't have access
    const commercialStatus = document.getElementById("commercialStatus");
    const adScheduleStatus = document.getElementById("adScheduleStatus");
    const nextAdBreakStatus = document.getElementById("nextAdBreakStatus");
    const adsInfo = document.getElementById("adsInfo");

    commercialStatus.textContent = "Not available for this account";
    commercialStatus.className = "status-value inactive";

    adScheduleStatus.textContent = "Not available for this account";
    adScheduleStatus.className = "status-value inactive";

    nextAdBreakStatus.textContent = "Not available for this account";
    nextAdBreakStatus.className = "status-value inactive";

    // Show info message
    if (adsInfo) adsInfo.style.display = "block";

    // Disable buttons
    const startCommercialBtn = document.getElementById("startCommercialBtn");
    const snoozeAdBtn = document.getElementById("snoozeAdBtn");
    if (startCommercialBtn) startCommercialBtn.disabled = true;
    if (snoozeAdBtn) snoozeAdBtn.disabled = true;

    return;
  }

  // Hide info message if it was shown
  const adsInfo = document.getElementById("adsInfo");
  if (adsInfo) adsInfo.style.display = "none";

  // Update commercial status
  const commercialStatus = document.getElementById("commercialStatus");
  if (data.commercial && !data.commercial.error) {
    commercialStatus.textContent = `Active - ${data.commercial.length}s remaining`;
    commercialStatus.className = "status-value active";
  } else {
    commercialStatus.textContent = "No active commercial";
    commercialStatus.className = "status-value inactive";
  }

  // Update ad schedule status
  const adScheduleStatus = document.getElementById("adScheduleStatus");
  if (data.adSchedule && !data.adSchedule.error) {
    const nextAd = new Date(data.adSchedule.next_ad_at);
    const timeUntilAd = Math.max(
      0,
      Math.floor((nextAd - new Date()) / 1000 / 60)
    );
    adScheduleStatus.textContent = `Next ad in ${timeUntilAd} minutes`;
    adScheduleStatus.className = "status-value active";
  } else {
    adScheduleStatus.textContent = "No scheduled ads";
    adScheduleStatus.className = "status-value inactive";
  }

  // Update ad break schedule status
  const nextAdBreakStatus = document.getElementById("nextAdBreakStatus");
  if (data.adBreakSchedule && !data.adBreakSchedule.error) {
    const nextBreak = new Date(data.adBreakSchedule.next_ad_at);
    const timeUntilBreak = Math.max(
      0,
      Math.floor((nextBreak - new Date()) / 1000 / 60)
    );
    nextAdBreakStatus.textContent = `Next break in ${timeUntilBreak} minutes`;
    nextAdBreakStatus.className = "status-value active";
  } else {
    nextAdBreakStatus.textContent = "No scheduled ad breaks";
    nextAdBreakStatus.className = "status-value inactive";
  }
}

async function startCommercial() {
  const length = document.getElementById("commercialLength").value;

  try {
    const result = await apiCall("ads/commercial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ length: parseInt(length) }),
    });

    if (result.success) {
      showNotification(
        `Commercial started successfully for ${length} seconds`,
        "success"
      );
      addToAdsHistory("Commercial started", `${length}s`, "success");
      loadAdsData(); // Refresh status
    } else {
      showNotification("Failed to start commercial", "error");
    }
  } catch (error) {
    console.error("Error starting commercial:", error);
    showNotification("Error starting commercial", "error");
    addToAdsHistory("Commercial failed", "Error", "error");
  }
}

async function snoozeNextAd() {
  try {
    const result = await apiCall("ads/snooze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (result.success) {
      showNotification("Next ad has been snoozed successfully", "success");
      addToAdsHistory("Ad snoozed", "Next ad delayed", "warning");
      loadAdsData(); // Refresh status
    } else {
      showNotification("Failed to snooze next ad", "error");
    }
  } catch (error) {
    console.error("Error snoozing next ad:", error);
    showNotification("Error snoozing next ad", "error");
    addToAdsHistory("Ad snooze failed", "Error", "error");
  }
}

function addToAdsHistory(action, details, type = "info") {
  const adsHistory = document.getElementById("adsHistory");
  const now = new Date();
  const timeString = now.toLocaleTimeString();

  const historyItem = document.createElement("div");
  historyItem.className = "history-item";
  historyItem.innerHTML = `
    <span class="history-time">${timeString}</span>
    <span class="history-action ${type}">${action}: ${details}</span>
  `;

  // Add to the beginning of the history
  adsHistory.insertBefore(historyItem, adsHistory.firstChild);

  // Keep only the last 10 items
  const items = adsHistory.querySelectorAll(".history-item");
  if (items.length > 10) {
    items[items.length - 1].remove();
  }
}

// Initialize ads event listeners
function initializeAdsEventListeners() {
  // Refresh ads status button
  const refreshAdsStatusBtn = document.getElementById("refreshAdsStatusBtn");
  if (refreshAdsStatusBtn) {
    refreshAdsStatusBtn.addEventListener("click", loadAdsData);
  }

  // Start commercial button
  const startCommercialBtn = document.getElementById("startCommercialBtn");
  if (startCommercialBtn) {
    startCommercialBtn.addEventListener("click", startCommercial);
  }

  // Snooze ad button
  const snoozeAdBtn = document.getElementById("snoozeAdBtn");
  if (snoozeAdBtn) {
    snoozeAdBtn.addEventListener("click", snoozeNextAd);
  }
}

// Initialize Spotify auth event listeners
function initializeSpotifyAuthEventListeners() {
  // Get authorization URL button
  const getSpotifyAuthUrlBtn = document.getElementById("getSpotifyAuthUrlBtn");
  if (getSpotifyAuthUrlBtn) {
    getSpotifyAuthUrlBtn.addEventListener("click", getSpotifyAuthUrl);
  }

  // Open authorization URL button
  const openSpotifyAuthBtn = document.getElementById("openSpotifyAuthBtn");
  if (openSpotifyAuthBtn) {
    openSpotifyAuthBtn.addEventListener("click", openSpotifyAuth);
  }
}

// Spotify Authorization Functions
async function getSpotifyAuthUrl() {
  try {
    const response = await apiCall("spotify/auth-url");
    const authUrlInput = document.getElementById("spotifyAuthUrl");
    const authUrlContainer = document.getElementById("spotifyAuthUrlContainer");

    authUrlInput.value = response.authUrl;
    authUrlContainer.style.display = "block";

    showNotification(
      t("web.integrations.spotifyAuth.authUrlGenerated"),
      "success"
    );
  } catch (error) {
    console.error("Error getting Spotify auth URL:", error);
    showNotification(
      t("web.integrations.spotifyAuth.errors.generateUrl"),
      "error"
    );
  }
}

function openSpotifyAuth() {
  const authUrlInput = document.getElementById("spotifyAuthUrl");
  const authUrl = authUrlInput.value;

  if (authUrl) {
    window.open(authUrl, "_blank");
    showNotification(t("web.integrations.spotifyAuth.authPageOpened"), "info");
  } else {
    showNotification(
      t("web.integrations.spotifyAuth.errors.generateUrlFirst"),
      "error"
    );
  }
}

// Nettoyage lors de la fermeture
window.addEventListener("beforeunload", () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (spotifyRefreshInterval) {
    clearInterval(spotifyRefreshInterval);
  }
});
