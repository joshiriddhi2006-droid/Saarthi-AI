/**
 * Saarthi-AI - Content Script
 * In-page accessibility layer: DOM extraction, element highlighting,
 * caption detection, and assistive DOM interaction.
 */

(() => {
  // Prevent duplicate initialization
  if (window.__saarthiAIInitialized) return;
  window.__saarthiAIInitialized = true;

  const HIGH_CONTRAST_STYLE_ID = "saarthi-high-contrast-style";
  const HIGHLIGHT_STYLE_ID = "saarthi-highlight-style";
  const HIGHLIGHT_CLASS = "saarthi-guided-element-highlight";
  const BADGE_ID = "saarthi-guide-badge";

  // Ensure highlight styling exists in document head
  injectHighlightStyles();

  /**
   * Listen for messages from popup or background service worker
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "ping":
        sendResponse({
          status: "connected",
          title: document.title || "Untitled Webpage",
          url: window.location.href
        });
        break;

      case "extractPageContent":
        try {
          const content = extractWebpageContent();
          sendResponse({ success: true, data: content });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;

      case "findAndHighlight":
        try {
          const result = highlightElementOnPage(request.query);
          sendResponse(result);
        } catch (err) {
          sendResponse({ success: false, message: err.message });
        }
        break;

      case "clearHighlight":
        removeExistingHighlight();
        sendResponse({ success: true });
        break;

      case "detectCaptionsAndTracks":
        try {
          const trackData = detectPageMediaTracks();
          sendResponse({ success: true, data: trackData });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;

      case "toggleHighContrast":
        toggleHighContrastMode(request.enabled);
        sendResponse({ success: true, highContrast: request.enabled });
        break;

      default:
        sendResponse({ status: "unhandled_action" });
        break;
    }

    return true; // Asynchronous reply
  });

  /**
   * Inject accessible highlight styles into webpage
   */
  function injectHighlightStyles() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 4px solid #00f2fe !important;
        outline-offset: 4px !important;
        box-shadow: 0 0 20px rgba(0, 242, 254, 0.7), inset 0 0 10px rgba(0, 242, 254, 0.3) !important;
        transition: outline 0.2s ease, box-shadow 0.2s ease !important;
        position: relative !important;
        border-radius: 4px !important;
      }
      #${BADGE_ID} {
        position: absolute;
        z-index: 2147483647;
        background: #0b132b;
        color: #00f2fe;
        border: 1.5px solid #00f2fe;
        border-radius: 6px;
        padding: 4px 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Determine element visibility
   */
  function isElementVisible(el) {
    if (!el || !(el instanceof Element)) return false;

    const tagName = el.tagName.toLowerCase();
    const ignoredTags = ["script", "style", "noscript", "template", "svg", "canvas", "iframe", "object", "embed"];
    if (ignoredTags.includes(tagName)) return false;

    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
    if (tagName === "input" && el.type === "hidden") return false;

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && !el.getClientRects().length) return false;

    return true;
  }

  /**
   * Privacy Protection Check
   */
  function isSensitiveField(el) {
    if (!el) return false;
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "password") return true;

    const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
    if (autocomplete.includes("cc-") || autocomplete.includes("password") || autocomplete.includes("cvc")) {
      return true;
    }

    const nameOrId = ((el.name || "") + " " + (el.id || "")).toLowerCase();
    if (nameOrId.includes("password") || nameOrId.includes("cvv") || nameOrId.includes("ssn")) {
      return true;
    }

    return false;
  }

  /**
   * Search and highlight a requested element on the webpage
   * Scrolls element into view and places high-visibility accessible badge.
   */
  function highlightElementOnPage(query) {
    removeExistingHighlight();

    if (!query || query.trim() === "") {
      return { success: false, message: "Please enter text or an element name to find." };
    }

    const cleanQuery = query.trim().toLowerCase();

    // Collect visible candidate elements across priority tiers
    const interactiveElements = Array.from(document.querySelectorAll(
      "button, a, input, select, textarea, [role='button'], [role='link'], [role='tab'], [role='search']"
    )).filter(isElementVisible);

    const headingElements = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(isElementVisible);
    const contentElements = Array.from(document.querySelectorAll("p, article, section, label")).filter(isElementVisible);

    let match = null;
    let matchType = "";

    // 1. Check interactive elements (buttons, links, inputs)
    for (const el of interactiveElements) {
      if (isSensitiveField(el)) continue;

      const text = (el.innerText || el.textContent || "").toLowerCase();
      const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
      const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
      const val = (el.value || "").toLowerCase();

      if (text.includes(cleanQuery) || ariaLabel.includes(cleanQuery) || placeholder.includes(cleanQuery) || val.includes(cleanQuery)) {
        match = el;
        matchType = el.tagName.toLowerCase();
        break;
      }
    }

    // 2. Check headings
    if (!match) {
      for (const el of headingElements) {
        const text = (el.innerText || el.textContent || "").toLowerCase();
        if (text.includes(cleanQuery)) {
          match = el;
          matchType = el.tagName.toLowerCase();
          break;
        }
      }
    }

    // 3. Check general content elements
    if (!match) {
      for (const el of contentElements) {
        const text = (el.innerText || el.textContent || "").toLowerCase();
        if (text.includes(cleanQuery)) {
          match = el;
          matchType = el.tagName.toLowerCase();
          break;
        }
      }
    }

    if (!match) {
      return {
        success: false,
        message: `No visible element found matching "${query}" on this page.`
      };
    }

    // Apply highlight class and smooth scroll
    match.classList.add(HIGHLIGHT_CLASS);
    match.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

    // Place badge above element
    placeGuideBadge(match, query);

    const descriptiveLabel = (
      match.innerText ||
      match.getAttribute("aria-label") ||
      match.getAttribute("placeholder") ||
      matchType
    ).trim().slice(0, 60);

    return {
      success: true,
      tagName: matchType,
      label: descriptiveLabel,
      message: `Located and highlighted <${matchType}>: "${descriptiveLabel}"`
    };
  }

  function placeGuideBadge(targetEl, query) {
    removeExistingBadge();

    const badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.textContent = `🎯 Saarthi Found: ${query.slice(0, 25)}`;

    document.body.appendChild(badge);

    const rect = targetEl.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    const top = Math.max(10, rect.top + scrollY - 32);
    const left = Math.max(10, rect.left + scrollX);

    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;

    // Automatically remove badge after 6 seconds to avoid permanent page intrusion
    setTimeout(() => {
      removeExistingBadge();
    }, 6000);
  }

  function removeExistingHighlight() {
    const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    highlighted.forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
    removeExistingBadge();
  }

  function removeExistingBadge() {
    const existing = document.getElementById(BADGE_ID);
    if (existing) existing.remove();
  }

  /**
   * Detect Audio/Video elements and available caption tracks
   */
  function detectPageMediaTracks() {
    const mediaElements = Array.from(document.querySelectorAll("video, audio"));
    if (mediaElements.length === 0) {
      return {
        mediaFound: false,
        message: "No audio or video elements detected on this webpage.",
        tracks: []
      };
    }

    const detectedTracks = [];

    mediaElements.forEach((media, idx) => {
      const mediaType = media.tagName.toLowerCase();
      const trackElements = Array.from(media.querySelectorAll("track"));

      trackElements.forEach((track) => {
        detectedTracks.push({
          mediaType: mediaType,
          mediaIndex: idx + 1,
          kind: track.getAttribute("kind") || "captions",
          label: track.getAttribute("label") || track.getAttribute("srclang") || "Unnamed track",
          src: track.getAttribute("src") || ""
        });
      });
    });

    if (detectedTracks.length === 0) {
      return {
        mediaFound: true,
        mediaCount: mediaElements.length,
        hasCaptions: false,
        message: "No available captions/text track found on this page.",
        tracks: []
      };
    }

    return {
      mediaFound: true,
      mediaCount: mediaElements.length,
      hasCaptions: true,
      message: `Found ${detectedTracks.length} accessible caption/subtitle track(s).`,
      tracks: detectedTracks
    };
  }

  /**
   * Extract comprehensive structured page content
   */
  function extractWebpageContent() {
    // 1. Headings
    const headings = [];
    document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      if (isElementVisible(h)) {
        const text = (h.innerText || h.textContent || "").trim();
        if (text) {
          headings.push({ level: h.tagName.toLowerCase(), text: text.slice(0, 250) });
        }
      }
    });

    // 2. Paragraphs & Core Content
    const paragraphs = [];
    document.querySelectorAll("p, article p, main p, section p, blockquote").forEach((p) => {
      if (isElementVisible(p)) {
        const text = (p.innerText || p.textContent || "").trim();
        if (text.length > 20 && !paragraphs.includes(text)) {
          paragraphs.push(text.slice(0, 600));
        }
      }
    });

    // 3. Images with accurate alt text
    const images = [];
    document.querySelectorAll("img").forEach((img) => {
      if (isElementVisible(img)) {
        const hasAlt = img.hasAttribute("alt") && img.alt.trim() !== "";
        const altText = hasAlt ? img.alt.trim() : null;
        const src = img.getAttribute("src") || "";
        const filename = src.split("/").pop().split("?")[0] || "image";

        images.push({
          filename: filename.slice(0, 40),
          alt: altText,
          hasAlt: hasAlt
        });
      }
    });

    // 4. Interactive Controls
    const buttons = [];
    document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']").forEach((btn) => {
      if (isElementVisible(btn)) {
        const label = (btn.innerText || btn.getAttribute("aria-label") || btn.value || "").trim();
        if (label && !buttons.includes(label)) {
          buttons.push(label.slice(0, 80));
        }
      }
    });

    // 5. Links
    const links = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      if (isElementVisible(a)) {
        const text = (a.innerText || a.getAttribute("aria-label") || "").trim();
        if (text && !links.includes(text)) {
          links.push(text.slice(0, 80));
        }
      }
    });

    // 6. Concatenated readable text for SpeechSynthesis & Summarization
    const readableTextBlocks = [];
    headings.forEach((h) => readableTextBlocks.push(h.text));
    paragraphs.forEach((p) => readableTextBlocks.push(p));
    const fullText = readableTextBlocks.join(". ");

    return {
      title: document.title || "Untitled Webpage",
      url: window.location.href,
      lang: document.documentElement.lang || "en",
      headings: headings.slice(0, 30),
      paragraphs: paragraphs.slice(0, 25),
      images: images.slice(0, 20),
      buttons: buttons.slice(0, 20),
      links: links.slice(0, 20),
      fullReadableText: fullText.slice(0, 6000), // Safe payload limit for local speech
      stats: {
        headingsCount: headings.length,
        paragraphsCount: paragraphs.length,
        buttonsCount: buttons.length,
        linksCount: links.length,
        totalImages: images.length,
        missingAltCount: images.filter((img) => !img.hasAlt).length
      }
    };
  }

  /**
   * Toggle in-page High Contrast
   */
  function toggleHighContrastMode(enable) {
    let styleEl = document.getElementById(HIGH_CONTRAST_STYLE_ID);

    if (enable) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = HIGH_CONTRAST_STYLE_ID;
        styleEl.textContent = `
          html.saarthi-high-contrast {
            filter: contrast(135%) brightness(95%) !important;
          }
          html.saarthi-high-contrast *:focus-visible {
            outline: 3.5px solid #00f2fe !important;
            outline-offset: 3px !important;
          }
        `;
        (document.head || document.documentElement).appendChild(styleEl);
      }
      document.documentElement.classList.add("saarthi-high-contrast");
    } else {
      document.documentElement.classList.remove("saarthi-high-contrast");
    }
  }
})();
