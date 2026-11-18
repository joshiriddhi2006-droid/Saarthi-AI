/**
 * Saarthi-AI - Background Service Worker (Manifest V3)
 * Manages extension lifecycle, default settings initialization,
 * and background accessibility coordination.
 */

// Initialize default accessibility settings upon extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Saarthi-AI installed successfully.");
    
    // Set initial accessibility defaults
    chrome.storage.local.set({
      highContrast: false,
      largeFont: false,
      speechSpeed: "1.0",
      speechVoice: "default"
    }, () => {
      console.log("Saarthi-AI default accessibility settings initialized.");
    });
  } else if (details.reason === "update") {
    console.log("Saarthi-AI updated to version:", chrome.runtime.getManifest().version);
  }
});

// Listener for runtime messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pingBackground") {
    sendResponse({ status: "ok", serviceWorker: "active" });
  }
  return true;
});
