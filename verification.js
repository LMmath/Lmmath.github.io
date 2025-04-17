const extensions = {
    "no-direct-ip": "chrome-extension://hacaeeoapmdgmhifjcgbblcobgnmceff/icons/block.png",
    "Securly (4th ID)": "chrome-extension://lcgajdcbmhepemmlpemkkpgagieehmjp/fonts/Metropolis.css",
    "Securly (3rd ID)": "chrome-extension://ckecmkbnoanpgplccmnoikfmpcdladkc/fonts/Metropolis.css",
    "Securly (2nd ID)": "chrome-extension://joflmkccibkooplaeoinecjbmdebglab/fonts/Metropolis.css",
    "Securly (1st ID)": "chrome-extension://iheobagjkfklnlikgihanlhcddjoihkg/fonts/Metropolis.css",
    "GoGuardian": "chrome-extension://haldlgldplgnggkjaafhelgiaglafanh/youtube_injection.js"
};

// Configuration constants
const CONFIG = {
    STORAGE_KEY: "verification-status",
    VERIFICATION_EXPIRY_KEY: "verification-expiry",
    USER_DATA_KEY: "verification-user-data",
    VERIFICATION_PAGE: "/",
    DEFAULT_REDIRECT: "./h.html",
    CURRENT_USER: "Scaroontop",
    CURRENT_UTC_TIME: "2025-03-23 01:09:54",
    REQUIRED_EXTENSIONS: 5,
    VERIFICATION_DURATION: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

/**
 * Save user verification data to localStorage
 * @param {string} verificationStatus - The verification status
 */
function saveUserData(verificationStatus) {
    const userData = {
        username: CONFIG.CURRENT_USER,
        verificationDate: CONFIG.CURRENT_UTC_TIME,
        status: verificationStatus,
        lastChecked: CONFIG.CURRENT_UTC_TIME
    };
    localStorage.setItem(CONFIG.USER_DATA_KEY, JSON.stringify(userData));
}

/**
 * Check if the user is already verified
 * @returns {boolean} - True if verified, false otherwise
 */
function checkVerificationStatus() {
    const verificationExpiry = localStorage.getItem(CONFIG.VERIFICATION_EXPIRY_KEY);
    const isVerified = localStorage.getItem(CONFIG.STORAGE_KEY) === "verified";
    const now = Date.now();

    if (isVerified && verificationExpiry && parseInt(verificationExpiry, 10) > now) {
        return true;
    }

    // Clear expired or invalid data
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    localStorage.removeItem(CONFIG.VERIFICATION_EXPIRY_KEY);
    return false;
}

/**
 * Update UI elements after verification check
 * @param {string} status - The verification status
 * @param {HTMLElement} statusElement - The status text element
 * @param {HTMLElement} spinner - The spinner element
 * @param {HTMLElement} progressFill - The progress bar fill element
 */
function updateUIAfterVerification(status, statusElement, spinner, progressFill) {
    const successElement = document.getElementById('success');
    const failureElement = document.getElementById('failure');
    const alreadyVerifiedElement = document.getElementById('already-verified');

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

/**
 * Handle successful verification
 * @param {string[]} validExtensions - List of valid extensions found
 * @param {HTMLElement} spinner - The spinner element
 * @param {HTMLElement} success - The success message element
 * @param {HTMLElement} statusElement - The status text element
 */
function handleVerificationSuccess(validExtensions, spinner, success, statusElement) {
    const expiryTime = Date.now() + CONFIG.VERIFICATION_DURATION;
    localStorage.setItem(CONFIG.STORAGE_KEY, "verified");
    localStorage.setItem(CONFIG.VERIFICATION_EXPIRY_KEY, expiryTime.toString());
    saveUserData("verified");
    updateUIAfterVerification("verified", statusElement, spinner, document.querySelector('.progress-fill'));
}

/**
 * Handle failed verification
 * @param {string[]} validExtensions - List of valid extensions found
 * @param {HTMLElement} spinner - The spinner element
 * @param {HTMLElement} failure - The failure message element
 * @param {HTMLElement} statusElement - The status text element
 */
function handleVerificationFailure(validExtensions, spinner, failure, statusElement) {
    saveUserData("failed");
    updateUIAfterVerification("failed", statusElement, spinner, document.querySelector('.progress-fill'));
}

/**
 * Check installed extensions and update verification status
 */
function checkExtensions() {
    const statusElement = document.getElementById('status');
    const spinner = document.getElementById('spinner');
    const success = document.getElementById('success');
    const failure = document.getElementById('failure');
    const progressFill = document.querySelector('.progress-fill');

    // Skip validation if already verified
    if (checkVerificationStatus()) {
        updateUIAfterVerification("already-verified", statusElement, spinner, progressFill);
        return;
    }

    if (statusElement) statusElement.textContent = "Checking for extensions...";

    const promises = Object.entries(extensions).map(([name, url]) => 
        fetch(url, { method: 'HEAD' })
            .then(() => name)
            .catch(() => null)
    );

    Promise.all(promises)
        .then(results => {
            const validExtensions = results.filter(name => name !== null);
            const progress = Math.min((validExtensions.length / CONFIG.REQUIRED_EXTENSIONS) * 100, 100);

            if (progressFill) progressFill.style.width = `${progress}%`;

            if (validExtensions.length >= CONFIG.REQUIRED_EXTENSIONS) {
                handleVerificationSuccess(validExtensions, spinner, success, statusElement);
            } else {
                handleVerificationFailure(validExtensions, spinner, failure, statusElement);
            }
        })
        .catch(() => {
            if (statusElement) statusElement.textContent = "Error checking extensions. Please try again.";
            if (spinner) spinner.classList.add('hidden');
            if (failure) failure.classList.remove('hidden');
            saveUserData("error");
        });
}

/**
 * Redirect to appropriate page after verification
 */
function redirectToPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('returnUrl');
    window.location.href = returnUrl || CONFIG.DEFAULT_REDIRECT;
}

/**
 * Show verification message and handle redirection
 */
function showVerificationMessage() {
    if (document.getElementById("verification-message")) return;

    const overlay = document.createElement('div');
    overlay.id = 'verification-message';
    overlay.innerHTML = `
        <div class="verification-content">
            <strong>Verification Required</strong>
            <span>You must complete the verification to access this page</span>
            <div class="user-info">User: ${CONFIG.CURRENT_USER}</div>
        </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
        const currentPage = window.location.href;
        saveUserData("redirect-to-verification");
        window.location.href = `${CONFIG.VERIFICATION_PAGE}?returnUrl=${encodeURIComponent(currentPage)}`;
    }, 2000);
}

/**
 * Initialize verification process
 */
function addVerificationCheck() {
    if (window.location.pathname === CONFIG.VERIFICATION_PAGE) {
        checkExtensions();
        return;
    }

    if (!checkVerificationStatus()) {
        showVerificationMessage();
    } else {
        const userData = JSON.parse(localStorage.getItem(CONFIG.USER_DATA_KEY) || "{}");
        userData.lastChecked = CONFIG.CURRENT_UTC_TIME;
        localStorage.setItem(CONFIG.USER_DATA_KEY, JSON.stringify(userData));
    }
}

// Initialize the process when the DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addVerificationCheck);
} else {
    addVerificationCheck();
}
