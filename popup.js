async function refresh() {
  const {
    jobCache = {},
    lastScan,
    companyApplyJobs = [],
  } = await chrome.storage.local.get([
    "jobCache",
    "lastScan",
    "companyApplyJobs",
  ]);

  document.getElementById("cached").textContent = Object.keys(jobCache).length;

  document.getElementById("found").textContent = companyApplyJobs.length;

  document.getElementById("lastScan").textContent = lastScan
    ? new Date(lastScan).toLocaleString()
    : "Never";
}

refresh();

document.getElementById("scan").onclick = () => {
  chrome.runtime.sendMessage({
    action: "scan",
  });
  window.close();
};

document.getElementById("clear").onclick = async () => {
  await chrome.storage.local.clear();

  refresh();

  document.getElementById("status").textContent = "Cache Cleared";
};

document.getElementById("force").onclick = async () => {
  await chrome.storage.local.remove("jobCache");

  chrome.runtime.sendMessage({
    action: "scan",
  });

  window.close();
};

document.getElementById("download").onclick = () => {
  chrome.runtime.sendMessage({
    action: "downloadCSV",
  });

  window.close();
};
