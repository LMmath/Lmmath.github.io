(function () {
  // === CONFIGURATION ===
  var CONFIG = {
    STORAGE_KEY: "verification-status",
    VERIFICATION_EXPIRY_KEY: "verification-expiry",
    USER_DATA_KEY: "verification-user-data",
    VERIFICATION_PAGE: "index.html",
    DEFAULT_REDIRECT: "./h.html",
    CURRENT_USER: "Scaroontop",
    REQUIRED_EXTENSIONS: 1,
    VERIFICATION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    EXTENSIONS: {
      "Securly": "chrome-extension://joflmkccibkooplaeoinecjbmdebglab/fonts/Metropolis.css",
      "GoGuardian": "chrome-extension://haldlgldplgnggkjaafhelgiaglafanh/youtube_injection.js"
      // Add more as needed
    },
    OVERLAY_ID: "verification-please-verify-overlay",
    REDIRECT_DELAY: 2000 // ms
  };

  function getCurrentUtcIso() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  function isVerificationPage() {
    var here = window.location.pathname.replace(/\\/g, "/");
    return (
      here === "/" ||
      here.endsWith("/index.html") ||
      here === "/index.html" ||
      here === "index.html"
    );
  }

  function isVerified() {
    try {
      var expiry = localStorage.getItem(CONFIG.VERIFICATION_EXPIRY_KEY);
      var status = localStorage.getItem(CONFIG.STORAGE_KEY);
      var now = Date.now();
      return (status === "verified" && expiry && parseInt(expiry, 10) > now);
    } catch (e) { return false; }
  }

  function blockAndRedirect() {
    if (document.getElementById(CONFIG.OVERLAY_ID)) return;
    // Cover the entire window (even if in iframe)
    var overlay = document.createElement("div");
    overlay.id = CONFIG.OVERLAY_ID;
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      minHeight: "100vh",
      minWidth: "100vw",
      background: "rgba(0,0,0,0.98)",
      color: "white",
      zIndex: "2147483647", // max z-index for absolute covering
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "2rem"
    });
    overlay.innerHTML = `
      <div style="text-align:center;">
        <strong style="font-size:2.4rem;">Please verify</strong>
        <div style="margin-top:1em;font-size:1.15rem;">You must complete verification to access this page.</div>
        <div style="margin-top:2em;font-size:1rem;opacity:0.7;">Redirecting to verification page...</div>
      </div>
    `;
    // Remove all body children (super secure block)
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    document.body.appendChild(overlay);

    setTimeout(function () {
      var returnUrl = encodeURIComponent(window.location.href);
      window.location.href = CONFIG.VERIFICATION_PAGE + "?returnUrl=" + returnUrl;
    }, CONFIG.REDIRECT_DELAY);
  }

  function runProtectedPageCheck() {
    if (!isVerified()) {
      blockAndRedirect();
    } else {
      let userData = {};
      try {
        userData = JSON.parse(localStorage.getItem(CONFIG.USER_DATA_KEY) || "{}");
      } catch (e) {}
      userData.lastChecked = getCurrentUtcIso();
      localStorage.setItem(CONFIG.USER_DATA_KEY, JSON.stringify(userData));
    }
  }

  // --- EXTENSION CHECK LOGIC USING <img> ---
  function checkExtensions(callback) {
    var entries = Object.entries(CONFIG.EXTENSIONS);
    var checked = 0;
    var validExtensions = [];
    if (entries.length === 0) {
      callback([]);
      return;
    }

    entries.forEach(([name, url]) => {
      var img = new window.Image();
      var done = false;
      img.onload = function () { if (!done) { validExtensions.push(name); done = true; step(); } };
      img.onerror = function () { if (!done) { done = true; step(); } };
      setTimeout(() => { if (!done) { done = true; step(); } }, 1500);
      // Avoid cache
      img.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + Date.now();

      function step() {
        checked++;
        if (checked === entries.length) {
          callback(validExtensions);
        }
      }
    });
  }

  function saveUserData(verificationStatus) {
    const userData = {
      username: CONFIG.CURRENT_USER,
      verificationDate: getCurrentUtcIso(),
      status: verificationStatus,
      lastChecked: getCurrentUtcIso()
    };
    try {
      localStorage.setItem(CONFIG.USER_DATA_KEY, JSON.stringify(userData));
    } catch (e) { }
  }

  function checkVerificationStatus() {
    try {
      const verificationExpiry = localStorage.getItem(CONFIG.VERIFICATION_EXPIRY_KEY);
      const isVerified = localStorage.getItem(CONFIG.STORAGE_KEY) === "verified";
      const now = Date.now();
      if (isVerified && verificationExpiry && parseInt(verificationExpiry, 10) > now) {
        return true;
      }
    } catch (e) {}
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    localStorage.removeItem(CONFIG.VERIFICATION_EXPIRY_KEY);
    return false;
  }

  function updateUIAfterVerification(status, statusElement) {
    var successElement = document.getElementById('success');
    var failureElement = document.getElementById('failure');
    var alreadyVerifiedElement = document.getElementById('already-verified');
    var spinner = document.getElementById('spinner');
    var progressFill = document.querySelector('.progress-fill');

    if (spinner) spinner.classList.add('hidden');
    if (progressFill) progressFill.style.width = '100%';

    switch (status) {
      case "verified":
        if (successElement) successElement.classList.remove('hidden');
        if (statusElement) statusElement.textContent = "Verification successful!";
        setTimeout(redirectToPage, 2000);
        break;
      case "failed":
        if (failureElement) failureElement.classList.remove('hidden');
        if (statusElement) statusElement.textContent = "Verification failed";
        break;
      case "already-verified":
        if (alreadyVerifiedElement) alreadyVerifiedElement.classList.remove('hidden');
        if (statusElement) statusElement.textContent = "Already verified";
        setTimeout(redirectToPage, 1500);
        break;
    }
  }

  function handleVerificationSuccess(validExtensions, statusElement) {
    const expiryTime = Date.now() + CONFIG.VERIFICATION_DURATION;
    localStorage.setItem(CONFIG.STORAGE_KEY, "verified");
    localStorage.setItem(CONFIG.VERIFICATION_EXPIRY_KEY, expiryTime.toString());
    saveUserData("verified");
    updateUIAfterVerification("verified", statusElement);
  }

  function handleVerificationFailure(validExtensions, statusElement) {
    saveUserData("failed");
    updateUIAfterVerification("failed", statusElement);
  }

  function redirectToPage() {
    var urlParams = new URLSearchParams(window.location.search);
    var returnUrl = urlParams.get('returnUrl');
    window.location.href = returnUrl || CONFIG.DEFAULT_REDIRECT;
  }

  function addVerificationCheck() {
    var statusElement = document.getElementById('status');
    if (checkVerificationStatus()) {
      updateUIAfterVerification("already-verified", statusElement);
      return;
    }
    if (statusElement) statusElement.textContent = "Checking for required extensions...";
    var progressFill = document.querySelector('.progress-fill');
    var entries = Object.entries(CONFIG.EXTENSIONS);
    if (progressFill) progressFill.style.width = '0%';

    var checked = 0;
    var validExtensions = [];
    if (entries.length === 0) {
      handleVerificationFailure([], statusElement);
      return;
    }
    entries.forEach(([name, url], idx) => {
      var img = new window.Image();
      var done = false;
      img.onload = function () { if (!done) { validExtensions.push(name); done = true; step(); } };
      img.onerror = function () { if (!done) { done = true; step(); } };
      setTimeout(() => { if (!done) { done = true; step(); } }, 1500);
      img.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + Date.now();

      function step() {
        checked++;
        var progress = Math.min((checked / entries.length) * 100, 100);
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (checked === entries.length) {
          if (validExtensions.length >= CONFIG.REQUIRED_EXTENSIONS) {
            handleVerificationSuccess(validExtensions, statusElement);
          } else {
            handleVerificationFailure(validExtensions, statusElement);
          }
        }
      }
    });
  }

  // Entry points
  if (isVerificationPage()) {
    document.addEventListener("DOMContentLoaded", addVerificationCheck);
  } else {
    document.addEventListener("DOMContentLoaded", runProtectedPageCheck);
  }
})();
