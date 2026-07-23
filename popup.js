document.addEventListener("DOMContentLoaded", init);

let pollTimer = null;

async function init() {
  await refreshStats();

  document.getElementById("scanBtn").addEventListener("click", scan);

  document
    .getElementById("download-btn")
    .addEventListener("click", downloadPending);

  document
    .getElementById("download-all-btn")
    .addEventListener("click", downloadAll);

  document.getElementById("clearBtn").addEventListener("click", clearCache);
}

async function refreshStats() {
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
}

async function scan() {
  setStatus("Scanning...");

  chrome.runtime.sendMessage({
    action: "scan",
  });
}

function downloadPending() {
  chrome.runtime.sendMessage({
    action: "downloadPendingCSV",
  });
}

function downloadAll() {
  chrome.runtime.sendMessage({
    action: "downloadAllCSV",
  });
}

async function clearCache() {
  if (!confirm("Clear all cached jobs?")) return;

  // Await message completion from background script
  const response = await chrome.runtime.sendMessage({
    action: "clearCache",
  });

  if (response?.success) {
    // Instantly refresh UI stats directly from cleared storage
    await refreshStats();

    // Reset progress indicator if visible
    document.getElementById("progress").textContent = "0 / 0";
    document.getElementById("status").textContent = "Idle";
  }
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action !== "progress") return;

  setStatus(msg.status);

  document.getElementById("progress").textContent =
    `${msg.current} / ${msg.total}`;

  document.getElementById("companyJobs").textContent = msg.found;

  if (msg.status === "Finished") {
    await refreshStats();
  }
});
