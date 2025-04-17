(function () {
    // === CONFIGURATION ===
    var CONFIG = {
        STORAGE_KEY: "verification-status",
        VERIFICATION_EXPIRY_KEY: "verification-expiry",
        USER_DATA_KEY: "verification-user-data",
        VERIFICATION_PAGE: "index.html", // The page to redirect to for verification
        DEFAULT_REDIRECT: "./h.html",    // Redirect after verification
        CURRENT_USER: "Scaroontop",      // Default username, can be replaced
        REQUIRED_EXTENSIONS: 2,          // How many extensions are required
        VERIFICATION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
        EXTENSIONS: {
            "no-direct-ip": "chrome-extension://hacaeeoapmdgmhifjcgbblcobgnmceff/icons/block.png",
            "Securly (4th ID)": "chrome-extension://lcgajdcbmhepemmlpemkkpgagieehmjp/fonts/Metropolis.css",
            "Securly (3rd ID)": "chrome-extension://ckecmkbnoanpgplccmnoikfmpcdladkc/fonts/Metropolis.css",
            "Securly (2nd ID)": "chrome-extension://joflmkccibkooplaeoinecjbmdebglab/fonts/Metropolis.css",
            "Securly (1st ID)": "chrome-extension://iheobagjkfklnlikgihanlhcddjoihkg/fonts/Metropolis.css",
            "GoGuardian": "chrome-extension://haldlgldplgnggkjaafhelgiaglafanh/youtube_injection.js"
        },
        OVERLAY_ID: "verification-please-verify-overlay",
        REDIRECT_DELAY: 2000 // ms
    };

    // === UTILS ===
    function getCurrentUtcIso() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    // Don't run on verification page itself (index.html or /)
    var here = window.location.pathname.replace(/\\/g, "/");
    if (
        here.endsWith("/") ||
        here.endsWith("/index.html") ||
        here === "/index.html"
    ) {
        // If on verification page, provide the full process (extension check etc.)
        document.addEventListener("DOMContentLoaded", runVerificationPage);
        return;
    } else {
        // On protected page, guard access
        document.addEventListener("DOMContentLoaded", runProtectedPageCheck);
    }

    // === GUARD LOGIC FOR PROTECTED PAGES ===
    function isVerified() {
        try {
            var expiry = localStorage.getItem(CONFIG.VERIFICATION_EXPIRY_KEY);
            var status = localStorage.getItem(CONFIG.STORAGE_KEY);
            var now = Date.now();
            return (status === "verified" && expiry && parseInt(expiry, 10) > now);
        } catch (e) { return false; }
    }

    function blockAndRedirect() {
        // Only add overlay if not already present
        if (document.getElementById(CONFIG.OVERLAY_ID)) return;

        // Block all interaction and show a message
        var overlay = document.createElement("div");
        overlay.id = CONFIG.OVERLAY_ID;
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.93)",
            color: "white",
            zIndex: "999999",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem"
        });
        overlay.innerHTML = `
            <div>
                <strong>Please verify</strong>
                <div style="margin-top:1em;font-size:1rem;">You must complete verification to access this page.</div>
                <div style="margin-top:2em;font-size:0.9rem;opacity:0.7;">Redirecting to verification page...</div>
            </div>
        `;
        document.body.appendChild(overlay);

        setTimeout(function () {
            // Save attempted page for return after verification
            var returnUrl = encodeURIComponent(window.location.href);
            window.location.href = CONFIG.VERIFICATION_PAGE + "?returnUrl=" + returnUrl;
        }, CONFIG.REDIRECT_DELAY);
    }

    function runProtectedPageCheck() {
        if (!isVerified()) {
            blockAndRedirect();
        } else {
            // Update last checked time
            let userData = {};
            try {
                userData = JSON.parse(localStorage.getItem(CONFIG.USER_DATA_KEY) || "{}");
            } catch (e) {}
            userData.lastChecked = getCurrentUtcIso();
            localStorage.setItem(CONFIG.USER_DATA_KEY, JSON.stringify(userData));
        }
    }

    // === FULL VERIFICATION PAGE LOGIC (index.html) ===
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
        // Clear expired or invalid data
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        localStorage.removeItem(CONFIG.VERIFICATION_EXPIRY_KEY);
        return false;
    }

    function updateUIAfterVerification(status, statusElement, spinner, progressFill) {
        var successElement = document.getElementById('success');
        var failureElement = document.getElementById('failure');
        var alreadyVerifiedElement = document.getElementById('already-verified');

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

    function handleVerificationSuccess(validExtensions, spinner, success, statusElement) {
        const expiryTime = Date.now() + CONFIG.VERIFICATION_DURATION;
        localStorage.setItem(CONFIG.STORAGE_KEY, "verified");
        localStorage.setItem(CONFIG.VERIFICATION_EXPIRY_KEY, expiryTime.toString());
        saveUserData("verified");
        updateUIAfterVerification("verified", statusElement, spinner, document.querySelector('.progress-fill'));
    }

    function handleVerificationFailure(validExtensions, spinner, failure, statusElement) {
        saveUserData("failed");
        updateUIAfterVerification("failed", statusElement, spinner, document.querySelector('.progress-fill'));
    }

    function checkExtensions() {
        var statusElement = document.getElementById('status');
        var spinner = document.getElementById('spinner');
        var success = document.getElementById('success');
        var failure = document.getElementById('failure');
        var progressFill = document.querySelector('.progress-fill');

        // Skip validation if already verified
        if (checkVerificationStatus()) {
            updateUIAfterVerification("already-verified", statusElement, spinner, progressFill);
            return;
        }

        if (statusElement) statusElement.textContent = "Checking for extensions...";

        var entries = Object.entries(CONFIG.EXTENSIONS);
        var checked = 0;
        var validExtensions = [];

        // For progress bar and extension check
        entries.forEach(([name, url], idx) => {
            fetch(url, { method: 'HEAD' })
                .then(() => validExtensions.push(name))
                .catch(() => {})
                .finally(() => {
                    checked++;
                    var progress = Math.min((checked / entries.length) * 100, 100);
                    if (progressFill) progressFill.style.width = `${progress}%`;

                    if (checked === entries.length) {
                        // All checks done
                        if (validExtensions.length >= CONFIG.REQUIRED_EXTENSIONS) {
                            handleVerificationSuccess(validExtensions, spinner, success, statusElement);
                        } else {
                            handleVerificationFailure(validExtensions, spinner, failure, statusElement);
                        }
                    }
                });
        });
    }

    function redirectToPage() {
        var urlParams = new URLSearchParams(window.location.search);
        var returnUrl = urlParams.get('returnUrl');
        window.location.href = returnUrl || CONFIG.DEFAULT_REDIRECT;
    }

    function showVerificationMessage() {
        if (document.getElementById("verification-message")) return;
        var overlay = document.createElement('div');
        overlay.id = 'verification-message';
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.93)",
            color: "white",
            zIndex: "999999",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
        });
        overlay.innerHTML = `
            <div class="verification-content" style="background:#191919;padding:2em 3em;border-radius:1em;box-shadow:0 0 30px #000;font-size:1.2em;max-width:90vw;">
                <strong>Verification Required</strong>
                <span style="display:block;margin-top:1em;">You must complete the verification to access this page</span>
                <div class="user-info" style="margin-top:1em;font-size:0.9em;opacity:.7;">User: ${CONFIG.CURRENT_USER}</div>
            </div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
            var currentPage = window.location.href;
            saveUserData("redirect-to-verification");
            window.location.href = `${CONFIG.VERIFICATION_PAGE}?returnUrl=${encodeURIComponent(currentPage)}`;
        }, CONFIG.REDIRECT_DELAY);
    }

    function addVerificationCheck() {
        if (window.location.pathname === "/" || window.location.pathname.endsWith("/index.html")) {
            checkExtensions();
            return;
        }
        if (!checkVerificationStatus()) {
            showVerificationMessage();
        } else {
            let userData = {};
            try {
                userData = JSON.parse(localStorage.getItem(CONFIG.USER_DATA_KEY) || "{}");
            } catch (e) {}
            userData.lastChecked = getCurrentUtcIso();
            localStorage.setItem(CONFIG.USER_DATA_KEY, JSON.stringify(userData));
        }
    }

    function runVerificationPage() {
        // Attach for index.html only
        addVerificationCheck();
    }
})();
