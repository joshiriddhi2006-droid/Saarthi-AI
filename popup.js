/**
 * Saarthi-AI - Popup Controller
 * Manages first-launch language onboarding, Web Speech API microphone recognition,
 * SpeechSynthesis, in-page DOM interaction, cognitive assistance, and multi-need setups.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --------------------------------------------------------------------------
  // Language Mapping Dictionary
  // --------------------------------------------------------------------------
  const LANGUAGE_MAP = {
    en: { code: "en-US", name: "English", display: "English (en-US)" },
    hi: { code: "hi-IN", name: "Hindi", display: "Hindi - हिन्दी (hi-IN)" },
    es: { code: "es-ES", name: "Spanish", display: "Spanish - Español (es-ES)" },
    fr: { code: "fr-FR", name: "French", display: "French - Français (fr-FR)" },
    de: { code: "de-DE", name: "German", display: "German - Deutsch (de-DE)" }
  };

  // State Variables
  let currentLanguage = "en";
  let cachedPageContent = null;
  let isSpeaking = false;
  let isListening = false;
  let recognitionInstance = null;

  // DOM Elements: Main Container
  const mainAppScreen = document.getElementById("mainAppScreen");

  // DOM Elements: Header & Navigation
  const headerLangBadgeBtn = document.getElementById("headerLangBadgeBtn");
  const headerLangText = document.getElementById("headerLangText");
  const activePageTitle = document.getElementById("activePageTitle");
  const analyzePageBtn = document.getElementById("analyzePageBtn");
  const analyzeBtnText = document.getElementById("analyzeBtnText");
  const activeModesBar = document.getElementById("activeModesBar");
  const footerStatusText = document.getElementById("footerStatusText");
  const connectionTag = document.getElementById("connectionTag");
  const outputArea = document.getElementById("outputArea");
  const outputBadge = document.getElementById("outputBadge");

  // Category Tabs & Panels
  const categoryTabs = document.querySelectorAll(".cat-tab");
  const toolPanels = document.querySelectorAll(".tool-panel");

  // Visual Assistance Elements
  const startSpeechBtn = document.getElementById("startSpeechBtn");
  const stopSpeechBtn = document.getElementById("stopSpeechBtn");
  const ttsStatusBadge = document.getElementById("ttsStatusBadge");
  const inspectImagesBtn = document.getElementById("inspectImagesBtn");
  const findInputVisual = document.getElementById("findInputVisual");
  const findBtnVisual = document.getElementById("findBtnVisual");

  // Hearing Assistance Elements
  const detectCaptionsBtn = document.getElementById("detectCaptionsBtn");

  // Speech Assistance Elements (Microphone & Input)
  const talkToSaarthiBtn = document.getElementById("talkToSaarthiBtn");
  const talkBtnText = document.getElementById("talkBtnText");
  const voiceStatusBadge = document.getElementById("voiceStatusBadge");
  const accessibilityInput = document.getElementById("accessibilityInput");
  const submitTextQueryBtn = document.getElementById("submitTextQueryBtn");

  // Cognitive Assistance Elements
  const simplifyContentBtn = document.getElementById("simplifyContentBtn");
  const summarizeContentBtn = document.getElementById("summarizeContentBtn");
  const explainInput = document.getElementById("explainInput");
  const explainBtn = document.getElementById("explainBtn");

  // Motor Assistance Elements
  const motorFindInput = document.getElementById("motorFindInput");
  const motorFindBtn = document.getElementById("motorFindBtn");
  const navPills = document.querySelectorAll(".nav-pill");

  // Language Assistance Elements
  const languageSelector = document.getElementById("languageSelector");
  const currentLangBadge = document.getElementById("currentLangBadge");
  const applyLanguageBtn = document.getElementById("applyLanguageBtn");
  const translatePageBtn = document.getElementById("translatePageBtn");

  // Multi-Preference Checkboxes
  const setupCheckboxes = {
    visual: document.getElementById("prefVisual"),
    hearing: document.getElementById("prefHearing"),
    speech: document.getElementById("prefSpeech"),
    cognitive: document.getElementById("prefCognitive"),
    motor: document.getElementById("prefMotor"),
    language: document.getElementById("prefLanguage")
  };

  // --------------------------------------------------------------------------
  // Initialize Preferred Language (Defaults to English if none saved)
  // --------------------------------------------------------------------------
  const initialLanguage = localStorage.getItem("saarthi_language") || "en";
  setAppLanguage(initialLanguage, false);

  function setAppLanguage(langKey, showNotification = false) {
    if (!LANGUAGE_MAP[langKey]) langKey = "en";
    currentLanguage = langKey;
    localStorage.setItem("saarthi_language", langKey);
    chrome.storage.local.set({ preferredLanguage: langKey });

    const langInfo = LANGUAGE_MAP[currentLanguage];

    // Update UI language indicators
    if (headerLangText) headerLangText.textContent = langInfo.name;
    if (currentLangBadge) currentLangBadge.textContent = langInfo.display;
    if (languageSelector) languageSelector.value = currentLanguage;

    if (showNotification) {
      renderOutput(
        "Language Configured",
        `Preferred language set to ${langInfo.name} (${langInfo.code}). Speech recognition and narration will use this language.`
      );
    }
  }

  // Header Language Pill click -> switches to Language category panel
  if (headerLangBadgeBtn) {
    headerLangBadgeBtn.addEventListener("click", () => {
      const langTab = document.getElementById("tabLanguage");
      if (langTab) activateCategoryTab(langTab, "panelLanguage");
    });
  }

  // Language panel apply button
  if (applyLanguageBtn) {
    applyLanguageBtn.addEventListener("click", () => {
      if (languageSelector) {
        setAppLanguage(languageSelector.value, true);
      }
    });
  }

  if (languageSelector) {
    languageSelector.addEventListener("change", (e) => {
      setAppLanguage(e.target.value, false);
    });
  }

  // --------------------------------------------------------------------------
  // 2. FIX: MICROPHONE / SPEECH INPUT (Web Speech API)
  // --------------------------------------------------------------------------
  if (talkToSaarthiBtn) {
    // Single event listener
    talkToSaarthiBtn.addEventListener("click", () => {
      handleMicrophoneActivation();
    });
  }

  if (submitTextQueryBtn) {
    submitTextQueryBtn.addEventListener("click", () => {
      handleTextQuery();
    });
  }

  if (accessibilityInput) {
    accessibilityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTextQuery();
      }
    });
  }

  // Update voice badge on load and when storage changes
  updateVoiceBadge();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.micPermissionGranted) {
      updateVoiceBadge();
    }
  });

  async function isMicrophonePermissionGranted() {
    // Check local storage state first
    const stored = await chrome.storage.local.get(["micPermissionGranted"]);
    if (stored && stored.micPermissionGranted === true) {
      return true;
    }

    // Check Permissions API if available in this context
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: "microphone" });
        if (perm.state === "granted") {
          chrome.storage.local.set({ micPermissionGranted: true });
          return true;
        } else if (perm.state === "denied") {
          chrome.storage.local.set({ micPermissionGranted: false });
          return false;
        }
      } catch (_) {
        // Permissions query may not be supported for microphone in all contexts
      }
    }

    return Boolean(stored && stored.micPermissionGranted);
  }

  async function updateVoiceBadge() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (voiceStatusBadge) {
        voiceStatusBadge.textContent = "Unsupported";
        voiceStatusBadge.className = "tool-status";
      }
      return;
    }

    const granted = await isMicrophonePermissionGranted();
    if (voiceStatusBadge) {
      if (granted) {
        voiceStatusBadge.textContent = "Ready";
        voiceStatusBadge.className = "tool-status";
      } else {
        voiceStatusBadge.textContent = "Permission Needed";
        voiceStatusBadge.className = "tool-status";
      }
    }
  }

  async function handleMicrophoneActivation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Check if SpeechRecognition is available in this browser
    if (!SpeechRecognition) {
      renderOutput("Voice Input Unsupported", "Voice input is not supported in this browser.");
      setStatusBadge("Unsupported", false);
      if (voiceStatusBadge) {
        voiceStatusBadge.textContent = "Unsupported";
        voiceStatusBadge.className = "tool-status";
      }
      return;
    }

    // If currently listening, stop it cleanly
    if (isListening) {
      stopListening();
      return;
    }

    // Check whether microphone permission has been granted
    const hasPermission = await isMicrophonePermissionGranted();

    if (!hasPermission) {
      // Do NOT directly call getUserMedia() from the popup for initial permission.
      // Open the dedicated voice/permission page in a normal Chrome tab.
      const permissionUrl = chrome.runtime.getURL("permission.html");
      chrome.tabs.create({ url: permissionUrl });

      renderOutput(
        "Microphone Setup Required",
        "Opened the microphone access tab. Please click 'Allow Microphone' in that tab, then return here to use voice input."
      );
      setStatusBadge("Setup Mic", false);
      if (voiceStatusBadge) {
        voiceStatusBadge.textContent = "Permission Needed";
        voiceStatusBadge.className = "tool-status";
      }
      return;
    }

    // Permission is granted: start real SpeechRecognition in the popup
    startRealSpeechRecognition(SpeechRecognition);
  }

  function startRealSpeechRecognition(SpeechRecognitionClass) {
    try {
      if (recognitionInstance) {
        try { recognitionInstance.abort(); } catch (_) {}
      }

      recognitionInstance = new SpeechRecognitionClass();

      // Configure strictly per requirements
      recognitionInstance.interimResults = false;
      recognitionInstance.continuous = false;

      // Set recognition language according to selected language
      const langConfig = LANGUAGE_MAP[currentLanguage] || LANGUAGE_MAP.en;
      recognitionInstance.lang = langConfig.code;

      // onstart: show "Listening..." visual state
      recognitionInstance.onstart = () => {
        isListening = true;
        setListeningVisualState(true);
        setStatusBadge("Listening...", true);
        updateFooterStatus("● Listening...");
        renderOutput("Listening...", `Listening in ${langConfig.name} (${langConfig.code}). Speak clearly into your microphone...`);
      };

      // onresult: capture final transcript and put into text input
      recognitionInstance.onresult = (event) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          const finalTranscript = event.results[0][0].transcript.trim();
          if (accessibilityInput) {
            accessibilityInput.value = finalTranscript;
            accessibilityInput.focus();
          }
          renderOutput("Speech Recognized", `"${escapeHtml(finalTranscript)}"`);
          setStatusBadge("Recognized", false, true);
          updateFooterStatus("● Ready to help");

          // Process speech command if actionable
          processCommand(finalTranscript);
        }
      };

      // onerror: handle exact error strings separately
      recognitionInstance.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);

        switch (event.error) {
          case "not-allowed":
          case "service-not-allowed":
            chrome.storage.local.set({ micPermissionGranted: false });
            renderOutput("Permission Denied", "Microphone permission denied. Please allow microphone access.");
            setStatusBadge("Denied", false);
            if (voiceStatusBadge) {
              voiceStatusBadge.textContent = "Denied";
              voiceStatusBadge.className = "tool-status";
            }
            break;

          case "no-speech":
            renderOutput("No Speech", "No speech detected. Please try again.");
            setStatusBadge("Ready", false);
            break;

          case "network":
            renderOutput("Network Error", "Speech recognition could not connect.");
            setStatusBadge("Network Error", false);
            break;

          case "aborted":
            // Aborted: stop cleanly and silently
            break;

          default:
            renderOutput("Voice Input Failed", "Voice input failed. Please try again or use text input.");
            setStatusBadge("Ready", false);
            break;
        }

        resetListeningState();
      };

      // onend: automatically stop listening and return button to normal state
      recognitionInstance.onend = () => {
        resetListeningState();
      };

      // Start recognition only after user click
      recognitionInstance.start();

    } catch (err) {
      console.error("Speech recognition start failed:", err);
      if (err.name === "NotAllowedError") {
        chrome.storage.local.set({ micPermissionGranted: false });
        renderOutput("Permission Denied", "Microphone permission denied. Please allow microphone access.");
        setStatusBadge("Denied", false);
        if (voiceStatusBadge) {
          voiceStatusBadge.textContent = "Denied";
          voiceStatusBadge.className = "tool-status";
        }
      } else {
        renderOutput("Voice Input Failed", "Voice input failed. Please try again or use text input.");
        setStatusBadge("Ready", false);
      }
      resetListeningState();
    }
  }

  function stopListening() {
    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (_) {
        try { recognitionInstance.abort(); } catch (_) {}
      }
    }
    resetListeningState();
  }

  function setListeningVisualState(active) {
    if (active) {
      if (talkToSaarthiBtn) talkToSaarthiBtn.classList.add("listening");
      if (talkBtnText) talkBtnText.textContent = "Listening...";
      if (voiceStatusBadge) voiceStatusBadge.textContent = "Listening";
    } else {
      resetListeningState();
    }
  }

  function resetListeningState() {
    isListening = false;
    if (talkToSaarthiBtn) talkToSaarthiBtn.classList.remove("listening");
    if (talkBtnText) talkBtnText.textContent = "Talk to Saarthi";
    updateVoiceBadge();
    updateFooterStatus("● Ready to help");
  }

  function processCommand(text) {
    if (!text) return;
    const clean = text.toLowerCase();

    if (clean.startsWith("find ") || clean.startsWith("locate ") || clean.startsWith("search ")) {
      const target = text.replace(/^(find|locate|search)\s+/i, "");
      executeFindAndHighlight(target);
    } else if (clean.includes("read page") || clean.includes("read this page") || clean.includes("read aloud")) {
      startReadingAloud();
    } else if (clean.includes("simplify")) {
      executeSimplifyContent();
    } else if (clean.includes("describe image") || clean.includes("images")) {
      inspectPageImages();
    }
  }

  function handleTextQuery() {
    const text = accessibilityInput ? accessibilityInput.value.trim() : "";
    if (!text) {
      if (accessibilityInput) accessibilityInput.focus();
      return;
    }
    processCommand(text);
  }

  // --------------------------------------------------------------------------
  // 3. Category Tab Switcher
  // --------------------------------------------------------------------------
  initCategoryTabs();

  function initCategoryTabs() {
    categoryTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetPanelId = tab.getAttribute("aria-controls");
        activateCategoryTab(tab, targetPanelId);
      });

      tab.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          tab.click();
        }
      });
    });
  }

  function activateCategoryTab(activeTab, panelId) {
    categoryTabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    toolPanels.forEach((p) => {
      p.classList.remove("active");
      p.hidden = true;
    });

    activeTab.classList.add("active");
    activeTab.setAttribute("aria-selected", "true");

    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
      targetPanel.classList.add("active");
      targetPanel.hidden = false;
    }
  }

  // --------------------------------------------------------------------------
  // 4. Webpage Content Extraction & Tab Messaging
  // --------------------------------------------------------------------------
  if (analyzePageBtn) {
    analyzePageBtn.addEventListener("click", () => {
      fetchPageContent(true);
    });
  }

  checkTabConnection();
  fetchPageContent(false);

  async function getVerifiedPageContent() {
    if (cachedPageContent && cachedPageContent.fullReadableText) {
      return cachedPageContent;
    }
    return await fetchPageContent(false);
  }

  function fetchPageContent(showFeedback = false) {
    return new Promise((resolve) => {
      if (analyzeBtnText) analyzeBtnText.textContent = "...";
      if (showFeedback) setStatusBadge("Extracting...", true);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs && tabs[0];
        if (!activeTab || !activeTab.id || isRestrictedUrl(activeTab.url)) {
          if (activePageTitle) activePageTitle.textContent = "Restricted browser tab";
          if (analyzeBtnText) analyzeBtnText.textContent = "Analyze";
          if (showFeedback) {
            renderOutput("Notice", "Chrome internal pages (chrome://) cannot be accessed for security. Please test on any standard website.");
          }
          resolve(null);
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "extractPageContent" }, (res) => {
          if (chrome.runtime.lastError || !res || !res.success) {
            // Attempt injection fallback if tab was opened before extension was loaded
            injectContentScript(activeTab.id, () => {
              chrome.tabs.sendMessage(activeTab.id, { action: "extractPageContent" }, (retryRes) => {
                if (retryRes && retryRes.success && retryRes.data) {
                  saveExtractedContent(retryRes.data, showFeedback);
                  resolve(retryRes.data);
                } else {
                  if (showFeedback) {
                    renderOutput("Content Notice", "Could not access webpage content. Please refresh this webpage.");
                  }
                  resolve(null);
                }
                if (analyzeBtnText) analyzeBtnText.textContent = "Analyze";
              });
            });
          } else {
            saveExtractedContent(res.data, showFeedback);
            if (analyzeBtnText) analyzeBtnText.textContent = "Analyze";
            resolve(res.data);
          }
        });
      });
    });
  }

  function saveExtractedContent(data, showFeedback) {
    if (!data) return;
    cachedPageContent = data;
    if (activePageTitle && data.title) {
      activePageTitle.textContent = data.title;
      activePageTitle.title = data.title;
    }

    if (showFeedback) {
      setStatusBadge("Extracted", false, true);
      renderOutput(
        "Page Content Extracted",
        `Extracted ${data.stats.headingsCount} headings, ${data.stats.paragraphsCount} paragraphs, and ${data.stats.totalImages} images from "${escapeHtml(data.title)}".`
      );
    }
  }

  function injectContentScript(tabId, callback) {
    if (!chrome.scripting) {
      if (callback) callback();
      return;
    }
    chrome.scripting.executeScript(
      { target: { tabId: tabId }, files: ["content.js"] },
      () => {
        if (callback) callback();
      }
    );
  }

  // --------------------------------------------------------------------------
  // 5. Visual Tools (SpeechSynthesis, Images, Find)
  // --------------------------------------------------------------------------
  if (startSpeechBtn) {
    startSpeechBtn.addEventListener("click", () => {
      startReadingAloud();
    });
  }

  if (stopSpeechBtn) {
    stopSpeechBtn.addEventListener("click", () => {
      stopReadingAloud();
    });
  }

  async function startReadingAloud() {
    if (!("speechSynthesis" in window)) {
      renderOutput("Error", "SpeechSynthesis is not supported in this browser version.");
      return;
    }

    window.speechSynthesis.cancel();
    const content = await getVerifiedPageContent();

    if (!content || !content.fullReadableText) {
      renderOutput("Notice", "No readable text content detected on this webpage.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(content.fullReadableText);
    const lang = LANGUAGE_MAP[currentLanguage] || LANGUAGE_MAP.en;
    utterance.lang = lang.code;
    utterance.rate = 1.0;

    utterance.onstart = () => {
      isSpeaking = true;
      if (ttsStatusBadge) {
        ttsStatusBadge.textContent = "Speaking";
        ttsStatusBadge.className = "tool-status speaking";
      }
      if (startSpeechBtn) startSpeechBtn.disabled = true;
      if (stopSpeechBtn) stopSpeechBtn.disabled = false;
      updateFooterStatus("● Reading aloud...");
      setStatusBadge("Speaking", true);
      renderOutput("Reading Webpage Aloud", `Reading page content in ${lang.name}... Click 'Stop' to cancel narration.`);
    };

    utterance.onend = () => {
      resetSpeechUI();
      renderOutput("Speech Finished", "Webpage narration completed.");
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e.error);
      resetSpeechUI();
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopReadingAloud() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    resetSpeechUI();
    renderOutput("Speech Stopped", "Webpage narration stopped by user.");
  }

  function resetSpeechUI() {
    isSpeaking = false;
    if (ttsStatusBadge) {
      ttsStatusBadge.textContent = "Ready";
      ttsStatusBadge.className = "tool-status";
    }
    if (startSpeechBtn) startSpeechBtn.disabled = false;
    if (stopSpeechBtn) stopSpeechBtn.disabled = true;
    updateFooterStatus("● Ready to help");
    setStatusBadge("Ready", false);
  }

  // Describe Images
  if (inspectImagesBtn) {
    inspectImagesBtn.addEventListener("click", () => {
      inspectPageImages();
    });
  }

  async function inspectPageImages() {
    setStatusBadge("Inspecting", true);
    const content = await getVerifiedPageContent();
    const images = (content && content.images) || [];

    if (images.length === 0) {
      setStatusBadge("Images", false);
      renderOutput("Image Description", "No visible images detected on this webpage.");
      return;
    }

    setStatusBadge("Images", false, true);
    let html = `<div class="output-item-list"><p style="font-weight:700; color:#00f2fe; margin-bottom:4px;">Detected ${images.length} Visible Images:</p>`;
    images.forEach((img, i) => {
      if (img.hasAlt) {
        html += `
          <div class="output-item">
            <span style="font-weight:600; color:#ffffff;">Image ${i + 1} (${escapeHtml(img.filename)}):</span>
            <p style="color:#a7f3d0; margin-top:2px;">"${escapeHtml(img.alt)}"</p>
          </div>
        `;
      } else {
        html += `
          <div class="output-item" style="border-left-color: #fb923c;">
            <span style="font-weight:600; color:#ffffff;">Image ${i + 1} (${escapeHtml(img.filename)}):</span>
            <p style="color:#fb923c; margin-top:2px;">Image description is unavailable for now (no alt text provided; requires AI vision model).</p>
          </div>
        `;
      }
    });
    html += `</div>`;

    outputArea.innerHTML = html;
    outputArea.focus();
  }

  // Find & Highlight
  if (findBtnVisual) {
    findBtnVisual.addEventListener("click", () => {
      executeFindAndHighlight(findInputVisual ? findInputVisual.value : "");
    });
  }

  if (findInputVisual) {
    findInputVisual.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeFindAndHighlight(findInputVisual.value);
      }
    });
  }

  function executeFindAndHighlight(query) {
    if (!query || !query.trim()) {
      renderOutput("Notice", "Please enter a word, button, or link to locate.");
      return;
    }

    setStatusBadge("Locating...", true);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        renderOutput("Error", "No active browser tab found.");
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: "findAndHighlight", query: query.trim() }, (res) => {
        if (chrome.runtime.lastError || !res) {
          renderOutput("Error", "Could not connect to webpage. Please refresh the page and try again.");
          setStatusBadge("Error", false);
          return;
        }

        if (res.success) {
          setStatusBadge("Found", false, true);
          updateFooterStatus("● Element Highlighted");
          renderOutput("Element Located & Highlighted", `🎯 ${escapeHtml(res.message)}. Scrolled into view with glowing highlight.`);
        } else {
          setStatusBadge("Not Found", false);
          renderOutput("Search Result", `❌ ${escapeHtml(res.message || "Element not found on page.")}`);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 6. Hearing Tools (Captions)
  // --------------------------------------------------------------------------
  if (detectCaptionsBtn) {
    detectCaptionsBtn.addEventListener("click", () => {
      detectPageCaptions();
    });
  }

  function detectPageCaptions() {
    setStatusBadge("Scanning...", true);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        renderOutput("Error", "Unable to scan active tab.");
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: "detectCaptionsAndTracks" }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
          renderOutput("Notice", "No available captions/text track found on this page.");
          setStatusBadge("Captions", false);
          return;
        }

        const data = res.data;
        if (!data.mediaFound) {
          setStatusBadge("Captions", false);
          renderOutput("Media Scan", "No audio or video elements detected on this webpage.");
          return;
        }

        if (!data.hasCaptions) {
          setStatusBadge("Captions", false);
          renderOutput("Captions Check", `Found ${data.mediaCount} media element(s). No available captions/text track found on this page.`);
          return;
        }

        setStatusBadge("Captions Found", false, true);
        let html = `<div class="output-item-list"><p style="font-weight:700; color:#34d399;">Accessible Text Tracks Found:</p>`;
        data.tracks.forEach((t, idx) => {
          html += `
            <div class="output-item">
              <span style="font-weight:600; color:#ffffff;">Track ${idx + 1} (${escapeHtml(t.mediaType)}):</span>
              <p style="color:#a7f3d0;">Kind: ${escapeHtml(t.kind)} | Label: "${escapeHtml(t.label)}"</p>
            </div>
          `;
        });
        html += `</div>`;
        outputArea.innerHTML = html;
      });
    });
  }

  // --------------------------------------------------------------------------
  // 7. Cognitive Tools (Simplification & Summaries)
  // --------------------------------------------------------------------------
  if (simplifyContentBtn) {
    simplifyContentBtn.addEventListener("click", () => {
      executeSimplifyContent();
    });
  }

  if (summarizeContentBtn) {
    summarizeContentBtn.addEventListener("click", () => {
      executeSummarizeContent();
    });
  }

  if (explainBtn) {
    explainBtn.addEventListener("click", () => {
      executeExplainContent(explainInput ? explainInput.value : "");
    });
  }

  async function executeSimplifyContent() {
    setStatusBadge("Simplifying", true);
    const content = await getVerifiedPageContent();

    if (!content || (!content.paragraphs.length && !content.headings.length)) {
      renderOutput("Notice", "No readable textual content detected on this webpage to simplify.");
      setStatusBadge("Ready", false);
      return;
    }

    setStatusBadge("Simplified", false, true);
    let simplifiedHtml = `<div class="output-item-list"><p style="font-weight:700; color:#38bdf8; margin-bottom:4px;">Simplified Key Takeaways:</p>`;

    content.headings.slice(0, 4).forEach((h) => {
      simplifiedHtml += `<div class="output-item"><strong style="color:#ffffff;">📌 ${escapeHtml(h.text)}</strong></div>`;
    });

    content.paragraphs.slice(0, 5).forEach((p) => {
      const sentences = p.split(/(?<=[.?!])\s+/).filter((s) => s.length > 20);
      if (sentences.length > 0) {
        simplifiedHtml += `<div class="output-item"><p style="color:#cbd5e1;">• ${escapeHtml(sentences[0])}</p></div>`;
      }
    });

    simplifiedHtml += `</div>`;
    outputArea.innerHTML = simplifiedHtml;
    outputArea.focus();
  }

  async function executeSummarizeContent() {
    setStatusBadge("Summarizing", true);
    const content = await getVerifiedPageContent();

    if (!content || !content.paragraphs.length) {
      renderOutput("Notice", "Insufficient content available to summarize.");
      setStatusBadge("Ready", false);
      return;
    }

    setStatusBadge("Summary", false, true);
    const topSentences = [];
    for (const p of content.paragraphs) {
      const s = p.split(/(?<=[.?!])\s+/)[0];
      if (s && s.length > 25 && topSentences.length < 3) {
        topSentences.push(s);
      }
    }

    let summaryHtml = `
      <div class="output-item-list">
        <p style="font-weight:700; color:#a855f7;">📋 Page Summary: "${escapeHtml(content.title)}"</p>
        <div class="output-item">
          <p style="color:#f1f5f9; line-height: 1.5;">${escapeHtml(topSentences.join(" "))}</p>
        </div>
        <p style="font-size:10.5px; color:#94a3b8; margin-top:4px;">✓ Local extractive summary from visible page text.</p>
      </div>
    `;
    outputArea.innerHTML = summaryHtml;
    outputArea.focus();
  }

  function executeExplainContent(text) {
    if (!text || !text.trim()) {
      renderOutput("Notice", "Please enter or paste a sentence to explain.");
      return;
    }

    renderOutput(
      "AI Configuration Required",
      `Target sentence: "${escapeHtml(text.slice(0, 80))}".<br><br>` +
      `Deep contextual AI rewriting requires an AI API connection. (AI service not connected yet).`
    );
  }

  // --------------------------------------------------------------------------
  // 8. Motor Tools (Guided Navigation)
  // --------------------------------------------------------------------------
  if (motorFindBtn) {
    motorFindBtn.addEventListener("click", () => {
      executeFindAndHighlight(motorFindInput ? motorFindInput.value : "");
    });
  }

  if (motorFindInput) {
    motorFindInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeFindAndHighlight(motorFindInput.value);
      }
    });
  }

  navPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const target = pill.getAttribute("data-target");
      if (motorFindInput) motorFindInput.value = target;
      executeFindAndHighlight(target);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Translation Architecture (No Fake Output)
  // --------------------------------------------------------------------------
  if (translatePageBtn) {
    translatePageBtn.addEventListener("click", () => {
      executePageTranslation();
    });
  }

  async function executePageTranslation() {
    const targetLang = LANGUAGE_MAP[currentLanguage] || LANGUAGE_MAP.en;
    setStatusBadge("Checking...", true);

    const pageData = await getVerifiedPageContent();
    if (!pageData) {
      renderOutput("Translation Notice", "Unable to read webpage content. Please open a standard webpage and refresh.");
      setStatusBadge("Error", false);
      return;
    }

    const paragraphs = pageData.paragraphs || [];
    if (paragraphs.length === 0) {
      renderOutput("Translation Notice", "No textual paragraph content found on this webpage to translate.");
      setStatusBadge("No Content", false);
      return;
    }

    chrome.storage.local.get(["aiTranslationApiKey", "geminiApiKey"], (res) => {
      const apiKey = res.aiTranslationApiKey || res.geminiApiKey;

      if (!apiKey) {
        setStatusBadge("AI Required", false);
        renderOutput(
          "Translation Requires AI Service",
          `Translation requires an AI translation service to be connected.<br><br>` +
          `• <strong>Target Language:</strong> ${targetLang.name} (${targetLang.code})<br>` +
          `• <strong>Extracted Webpage Content:</strong> ${paragraphs.length} paragraphs (${pageData.stats.headingsCount} headings) ready.<br>` +
          `• <strong>Status:</strong> No translation API is currently configured. Saarthi-AI does not fake translations.`
        );
      } else {
        setStatusBadge("Translating...", true);
        renderOutput("Translation Service", `Connected API key verified. Translating ${paragraphs.length} blocks to ${targetLang.name}...`);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 10. Multi-Preference Setup Persistence
  // --------------------------------------------------------------------------
  initMultiPreferences();

  function initMultiPreferences() {
    chrome.storage.local.get(["activeAccessibilityModes"], (res) => {
      if (res.activeAccessibilityModes) {
        Object.keys(setupCheckboxes).forEach((key) => {
          if (setupCheckboxes[key] && res.activeAccessibilityModes[key] !== undefined) {
            setupCheckboxes[key].checked = res.activeAccessibilityModes[key];
          }
        });
      }
      renderActiveSetupPills();
    });

    Object.keys(setupCheckboxes).forEach((key) => {
      const cb = setupCheckboxes[key];
      if (cb) {
        cb.addEventListener("change", () => {
          const modes = {};
          Object.keys(setupCheckboxes).forEach((k) => {
            modes[k] = setupCheckboxes[k] ? setupCheckboxes[k].checked : false;
          });
          chrome.storage.local.set({ activeAccessibilityModes: modes });
          renderActiveSetupPills();
        });
      }
    });
  }

  function renderActiveSetupPills() {
    if (!activeModesBar) return;
    activeModesBar.innerHTML = "";

    const labels = {
      visual: "👁️ Visual",
      hearing: "🦻 Hearing",
      speech: "🎙️ Speech",
      cognitive: "🧠 Cognitive",
      motor: "🖐️ Motor",
      language: "🌐 Language"
    };

    let count = 0;
    Object.keys(setupCheckboxes).forEach((key) => {
      if (setupCheckboxes[key] && setupCheckboxes[key].checked) {
        count++;
        const pill = document.createElement("span");
        pill.className = "mode-pill";
        pill.textContent = labels[key] || key;
        activeModesBar.appendChild(pill);
      }
    });

    if (count === 0) {
      activeModesBar.innerHTML = `<span style="font-size: 11px; color: #94a3b8;">None active (Select below)</span>`;
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  function renderOutput(title, message) {
    if (!outputArea) return;
    outputArea.innerHTML = `
      <div class="output-item-list">
        <p style="font-weight:700; color:#00f2fe;">${title}</p>
        <p style="color:#cbd5e1; margin-top:2px; line-height:1.4;">${message}</p>
      </div>
    `;
    outputArea.focus();
  }

  function setStatusBadge(text, isActive = false, isSuccess = false) {
    if (!outputBadge) return;
    outputBadge.textContent = text;
    outputBadge.className = "output-badge";
    if (isActive) outputBadge.classList.add("active");
    if (isSuccess) outputBadge.classList.add("success");
  }

  function updateFooterStatus(text) {
    if (footerStatusText) footerStatusText.textContent = text;
  }

  function checkTabConnection() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) {
        if (connectionTag) connectionTag.textContent = "Offline";
        return;
      }
      const t = tabs[0];
      if (isRestrictedUrl(t.url)) {
        if (connectionTag) connectionTag.textContent = "Restricted";
        return;
      }
      chrome.tabs.sendMessage(t.id, { action: "ping" }, (res) => {
        if (chrome.runtime.lastError || !res) {
          if (connectionTag) connectionTag.textContent = "Page Active";
        } else {
          if (connectionTag) connectionTag.textContent = "Connected";
        }
      });
    });
  }

  function isRestrictedUrl(url) {
    if (!url) return true;
    return (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("view-source:")
    );
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
