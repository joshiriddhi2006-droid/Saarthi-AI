/**
 * Saarthi-AI - Microphone Permission Handler
 * Runs in a dedicated Chrome tab context where getUserMedia can prompt
 * for origin-level microphone access.
 */

document.addEventListener("DOMContentLoaded", () => {
  const allowMicBtn = document.getElementById("allowMicBtn");
  const continueBtn = document.getElementById("continueBtn");
  const statusMsgBox = document.getElementById("statusMsgBox");

  if (!allowMicBtn) return;

  allowMicBtn.addEventListener("click", async () => {
    allowMicBtn.disabled = true;
    allowMicBtn.textContent = "Requesting Access...";
    hideStatus();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError("Voice input is not supported in this browser.");
      allowMicBtn.disabled = false;
      allowMicBtn.textContent = "Allow Microphone";
      return;
    }

    try {
      // Prompt user for microphone access in the open tab
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop temporary microphone stream immediately
      stream.getTracks().forEach((track) => track.stop());

      // Store/update permission state
      await chrome.storage.local.set({ micPermissionGranted: true });

      // Show success message and continue button
      showSuccess("Microphone access granted.");
      allowMicBtn.style.display = "none";
      if (continueBtn) {
        continueBtn.style.display = "block";
        continueBtn.focus();
      }

    } catch (err) {
      console.warn("Microphone request error:", err);
      await chrome.storage.local.set({ micPermissionGranted: false });

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        showError("Microphone permission was denied. Please allow microphone access in Chrome.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        showError("No microphone was found.");
      } else {
        showError(`Microphone access error: ${err.message || err.name}`);
      }

      allowMicBtn.disabled = false;
      allowMicBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
        <span>Try Again</span>
      `;
    }
  });

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      // Close tab or notify user to return to extension
      window.close();
    });
  }

  function showSuccess(msg) {
    if (!statusMsgBox) return;
    statusMsgBox.className = "status-msg-box success";
    statusMsgBox.textContent = msg;
  }

  function showError(msg) {
    if (!statusMsgBox) return;
    statusMsgBox.className = "status-msg-box error";
    statusMsgBox.textContent = msg;
  }

  function hideStatus() {
    if (!statusMsgBox) return;
    statusMsgBox.className = "status-msg-box";
    statusMsgBox.textContent = "";
  }
});
