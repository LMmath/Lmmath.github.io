(function () {
  // === CONFIGURATION ===
  var CONFIG = {
    STORAGE_KEY: "verification-status",
    VERIFICATION_EXPIRY_KEY: "verification-expiry",
    USER_DATA_KEY: "verification-user-data",
    VERIFICATION_PAGE: "index.html",
    DEFAULT_REDIRECT: "./h.html",
    CURRENT_USER: "RipAngelhacks", // Updated to current user
    CURRENT_TIME: "2025-04-17 12:38:56", // Updated to current time
    REQUIRED_EXTENSIONS: 1,
    VERIFICATION_DURATION: 24 * 60 * 60 * 1000,
    EXTENSIONS: {
      // More reliable extension detection URLs
      "Securly": [
        "chrome-extension://joflmkccibkooplaeoinecjbmdebglab/fonts/Metropolis.css",
        "chrome-extension://iheobagjkfklnlikgihanlhcddjoihkg/fonts/Metropolis.css",
        "chrome-extension://lcgajdcbmhepemmlpemkkpgagieehmjp/fonts/Metropolis.css"
      ],
      "GoGuardian": [
        "chrome-extension://haldlgldplgnggkjaafhelgiaglafanh/youtube_injection.js",
        "chrome-extension://haldlgldplgnggkjaafhelgiaglafanh/images/icon-128.png"
      ]
    },
    OVERLAY_ID: "verification-please-verify-overlay",
    REDIRECT_DELAY: 2000
  };

  // --- EXTENSION DETECTION LOGIC ---
  function checkExtension(urls) {
    return new Promise((resolve) => {
      let checked = 0;
      let found = false;

      function tryNext() {
        if (checked === urls.length || found) {
          resolve(found);
          return;
        }

        const url = urls[checked];
        const img = new Image();
        let timeout;

        function cleanup() {
          clearTimeout(timeout);
          img.onload = img.onerror = null;
        }

        img.onload = function() {
          cleanup();
          found = true;
          resolve(true);
        };

        img.onerror = function() {
          cleanup();
          checked++;
          tryNext();
        };

        timeout = setTimeout(() => {
          cleanup();
          checked++;
          tryNext();
        }, 500);

        img.src = url + '?nc=' + Math.random();
      }

      tryNext();
    });
  }

  async function checkAllExtensions() {
    const results = [];
    const entries = Object.entries(CONFIG.EXTENSIONS);
    
    for (const [name, urls] of entries) {
      const found = await checkExtension(Array.isArray(urls) ? urls : [urls]);
      if (found) results.push(name);
    }
    
    return results;
  }

  // --- UI UPDATES ---
  function updateProgress(progress) {
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
  }

  function updateStatus(text) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = text;
    }
  }

  // --- VERIFICATION LOGIC ---
  async function performVerification() {
    if (checkVerificationStatus()) {
      updateUIAfterVerification("already-verified");
      return;
    }

    updateStatus("Checking for required extensions...");
    updateProgress(0);

    try {
      const validExtensions = await checkAllExtensions();
      updateProgress(100);

      if (validExtensions.length >= CONFIG.REQUIRED_EXTENSIONS) {
        handleVerificationSuccess(validExtensions);
      } else {
        handleVerificationFailure(validExtensions);
      }
    } catch (error) {
      handleVerificationFailure([]);
    }
  }

  function handleVerificationSuccess(validExtensions) {
    const expiryTime = Date.now() + CONFIG.VERIFICATION_DURATION;
    localStorage.setItem(CONFIG.STORAGE_KEY, "verified");
    localStorage.setItem(CONFIG.VERIFICATION_EXPIRY_KEY, expiryTime.toString());
    saveUserData("verified");
    updateUIAfterVerification("verified");
  }

  function handleVerificationFailure(validExtensions) {
    saveUserData("failed");
    updateUIAfterVerification("failed");
  }

  // [Previous helper functions remain the same: getCurrentUtcIso, isVerificationPage, etc.]

  function blockAndRedirect() {
    if (document.getElementById(CONFIG.OVERLAY_ID)) return;
    
    // Create a completely opaque overlay
    const overlay = document.createElement("div");
    overlay.id = CONFIG.OVERLAY_ID;
    
    // Force overlay to cover everything
    const styles = {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "#000",
      color: "#fff",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: "0",
      padding: "0",
      border: "none",
      overflow: "hidden"
    };
    
    Object.assign(overlay.style, styles);
    
    overlay.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:2rem;font-weight:bold;margin-bottom:1rem;">Verification Required</div>
        <div style="font-size:1.2rem;margin-bottom:1rem;">Please verify to access this content</div>
        <div style="opacity:0.8;font-size:0.9rem;">Redirecting to verification page...</div>
      </div>
    `;

    // Clear page and add overlay
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    document.body.appendChild(overlay);

    setTimeout(() => {
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = CONFIG.VERIFICATION_PAGE + "?returnUrl=" + returnUrl;
    }, CONFIG.REDIRECT_DELAY);
  }

  // Entry point
  if (isVerificationPage()) {
    document.addEventListener("DOMContentLoaded", performVerification);
  } else {
    document.addEventListener("DOMContentLoaded", runProtectedPageCheck);
  }
})();
