document.addEventListener("DOMContentLoaded", init);

async function init() {
  await refreshStats();

  document.getElementById("scanBtn").addEventListener("click", scan);

  document.getElementById("downloadBtn").addEventListener("click", download);

  document.getElementById("clearBtn").addEventListener("click", clearCache);

  document.getElementById("forceBtn").addEventListener("click", forceRescan);
}

async function refreshStats() {
  const { jobCache = {}, lastScan } = await chrome.storage.local.get([
    "jobCache",
    "lastScan",
  ]);

  const cachedJobs = Object.keys(jobCache).length;

  const companyJobs = Object.values(jobCache).filter((job) => {
    if (typeof job === "boolean") {
      return job;
    }

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

  pollUntilFinished();
}

async function pollUntilFinished() {
  const timer = setInterval(async () => {
    const bg = await chrome.runtime.getBackgroundPage?.();

    // MV3 doesn't support getBackgroundPage.
    // So instead we'll just refresh stats every second.
    await refreshStats();
  }, 1000);

  // Stop polling after 30 seconds.
  setTimeout(async () => {
    clearInterval(timer);

    await refreshStats();

    setStatus("Finished");
  }, 30000);
}

function download() {
  chrome.runtime.sendMessage({
    action: "downloadCSV",
  });
}

async function clearCache() {
  if (!confirm("Clear all cached jobs?")) return;

  chrome.runtime.sendMessage({
    action: "clearCache",
  });

  setTimeout(refreshStats, 300);
}

async function forceRescan() {
  if (!confirm("Force rescan all jobs?")) return;

  setStatus("Scanning...");

  chrome.runtime.sendMessage({
    action: "forceRescan",
  });

  pollUntilFinished();
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== "progress") return;

  document.getElementById("status").textContent = msg.status;
  document.getElementById("progress").textContent =
    `${msg.current} / ${msg.total}`;
  document.getElementById("companyJobs").textContent = msg.found;
});
