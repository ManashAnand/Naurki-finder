document.addEventListener("DOMContentLoaded", init);

let pollTimer = null;

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
