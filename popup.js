document.addEventListener("DOMContentLoaded", init);

// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
  console.log("[POPUP] Initializing...");

  await refreshStats();

  document.getElementById("scanBtn").addEventListener("click", scan);

  document
    .getElementById("download-btn")
    .addEventListener("click", downloadPending);

  document
    .getElementById("download-all-btn")
    .addEventListener("click", downloadAll);

  document.getElementById("clearBtn").addEventListener("click", clearCache);

  console.log("[POPUP] Initialization complete");
}

// ============================================================
// REFRESH STATS
// ============================================================

async function refreshStats() {
  console.log("[POPUP] Refreshing stats...");

  const { jobCache = {}, lastScan = null } = await chrome.storage.local.get([
    "jobCache",
    "lastScan",
  ]);

  const cachedJobs = Object.keys(jobCache).length;

  const companyJobs = Object.values(jobCache).filter((job) => {
    if (typeof job === "boolean") return job;

    return job?.hasCompanyApply === true;
  }).length;

  document.getElementById("cachedJobs").textContent = cachedJobs;

  document.getElementById("companyJobs").textContent = companyJobs;

  document.getElementById("lastScan").textContent = lastScan
    ? new Date(lastScan).toLocaleString()
    : "Never";

  console.log("[POPUP] Stats:", {
    cachedJobs,
    companyJobs,
    lastScan,
  });
}

// ============================================================
// SCAN
// ============================================================

async function scan() {
  console.log("[POPUP] Scan button clicked");

  setStatus("Scanning...");

  console.log("[POPUP] Sending scan request to background");

  chrome.runtime.sendMessage({
    action: "scan",
  });
}

// ============================================================
// DOWNLOAD PENDING
// ============================================================

function downloadPending() {
  console.log("[POPUP] Download pending jobs clicked");

  chrome.runtime.sendMessage({
    action: "downloadPendingCSV",
  });
}

// ============================================================
// DOWNLOAD ALL
// ============================================================

function downloadAll() {
  console.log("[POPUP] Download all jobs clicked");

  chrome.runtime.sendMessage({
    action: "downloadAllCSV",
  });
}

// ============================================================
// CLEAR CACHE
// ============================================================

async function clearCache() {
  console.log("[POPUP] Clear cache clicked");

  if (!confirm("Clear all cached jobs?")) {
    console.log("[POPUP] Clear cache cancelled");

    return;
  }

  console.log("[POPUP] Sending clearCache request");

  const response = await chrome.runtime.sendMessage({
    action: "clearCache",
  });

  console.log("[POPUP] Clear cache response:", response);

  if (response?.success) {
    await refreshStats();

    document.getElementById("progress").textContent = "0 / 0";

    document.getElementById("status").textContent = "Idle";

    console.log("[POPUP] Cache cleared successfully");
  }
}

// ============================================================
// STATUS
// ============================================================

function setStatus(text) {
  document.getElementById("status").textContent = text;

  console.log("[POPUP] Status:", text);
}

// ============================================================
// BACKGROUND PROGRESS
// ============================================================

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action !== "progress") {
    return;
  }

  console.log("[POPUP] Progress received:", msg);

  setStatus(msg.status);

  document.getElementById("progress").textContent =
    `${msg.current} / ${msg.total}`;

  document.getElementById("companyJobs").textContent = msg.found;

  if (msg.status === "Finished") {
    console.log("[POPUP] Scan finished");

    await refreshStats();
  }
});
