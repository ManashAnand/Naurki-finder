const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
let isScanning = false;
const TRACKING_PARAM = "na_track";

async function getAppliedJobs() {
  const { appliedJobs = {} } = await chrome.storage.local.get("appliedJobs");

  return appliedJobs;
}

async function saveAppliedJobs(appliedJobs) {
  await chrome.storage.local.set({
    appliedJobs,
  });
}

async function getCache() {
  const { jobCache = {} } = await chrome.storage.local.get("jobCache");
  return jobCache;
}

async function saveCache(jobCache) {
  await chrome.storage.local.set({
    jobCache,
    lastScan: Date.now(),
  });
}

async function getCompanyApplyJobs() {
  const cache = await getCache();

  return Object.values(cache).filter((job) => job.hasCompanyApply);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scan") {
    scanCurrentTab();
    return true;
  }

  if (msg.action === "downloadPendingCSV") {
    downloadCSV(true);
    return true;
  }

  if (msg.action === "downloadAllCSV") {
    downloadCSV(false);
    return true;
  }

  if (msg.action === "clearCache") {
    chrome.storage.local
      .remove(["jobCache", "lastScan", "appliedJobs"])
      .then(() => {
        sendResponse({ success: true });
      });
    return true; // Keep the message channel open for sendResponse
  }
});

async function scanCurrentTab(force = false) {
  if (isScanning) {
    console.log("Already scanning...");
    return;
  }

  isScanning = true;

  chrome.runtime.sendMessage({
    action: "progress",
    status: "Scanning",
    current: 0,
    total: 0,
    found: 0,
  });

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  await chrome.scripting.executeScript({
    target: {
      tabId: tab.id,
    },
    func: () => {
      const jobs = [...document.querySelectorAll("article.jobTuple")].map(
        (job) => ({
          jobId: job.dataset.jobId,
          title: job.querySelector(".title")?.innerText.trim(),
          company: job.querySelector(".subTitle")?.innerText.trim(),
          url: `https://www.naukri.com/job-listings-${job.dataset.jobId}`,
        }),
      );

      chrome.runtime.sendMessage({
        action: "processJobs",
        jobs,
      });
    },
  });
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action !== "processJobs") return;

  const cache = await getCache();

  let current = 0;
  const total = msg.jobs.length;
  let found = Object.values(cache).filter((job) => job.hasCompanyApply).length;

  // Create one background worker tab
  const workerTab = await chrome.tabs.create({
    url: "about:blank",
    active: false,
  });

  try {
    for (const job of msg.jobs) {
      const cachedJob = cache[job.jobId];

      // Skip if cached and checked within the last 7 days
      if (cachedJob && Date.now() - cachedJob.checkedAt < MAX_CACHE_AGE) {
        console.log("⏩", job.title);

        current++;

        chrome.runtime
          .sendMessage({
            action: "progress",
            status: "Scanning",
            current,
            total,
            found,
          })
          .catch(() => {});

        continue;
      }

      await inspectJob(workerTab.id, job, cache);

      current++;

      if (cache[job.jobId]?.hasCompanyApply) {
        found++;
      }

      chrome.runtime
        .sendMessage({
          action: "progress",
          status: "Scanning",
          current,
          total,
          found,
        })
        .catch(() => {});
    }
  } finally {
    await chrome.tabs.remove(workerTab.id);
  }

  await saveCache(cache);

  isScanning = false;

  chrome.runtime
    .sendMessage({
      action: "progress",
      status: "Finished",
      current: total,
      total,
      found,
    })
    .catch(() => {});

  console.log("Finished");
});

async function inspectJob(tabId, job, cache) {
  await new Promise(async (resolve) => {
    const listener = async (id, info) => {
      if (id !== tabId) return;
      if (info.status !== "complete") return;

      chrome.tabs.onUpdated.removeListener(listener);

      try {
        const result = await chrome.scripting.executeScript({
          target: {
            tabId,
          },
          files: ["screenshot.js"],
        });

        cache[job.jobId] = {
          ...job,
          hasCompanyApply: result[0].result.hasCompanyApply,
          checkedAt: Date.now(),
        };

        console.log(result[0].result.hasCompanyApply ? "✅" : "❌", job.title);
      } catch (err) {
        console.error(err);

        cache[job.jobId] = {
          ...job,
          hasCompanyApply: false,
          checkedAt: Date.now(),
        };
      }

      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);

    await chrome.tabs.update(tabId, {
      url: job.url,
    });
  });
}

async function downloadCSV(exportPendingOnly = true) {
  const jobs = await getCompanyApplyJobs();
  const appliedJobs = await getAppliedJobs();

  let filteredJobs = exportPendingOnly
    ? jobs.filter((job) => !appliedJobs[job.jobId])
    : [...jobs];

  // Only sort when exporting all jobs
  if (!exportPendingOnly) {
    filteredJobs.sort((a, b) => {
      const aApplied = appliedJobs[a.jobId];
      const bApplied = appliedJobs[b.jobId];

      // Pending first
      if (!aApplied && bApplied) return -1;
      if (aApplied && !bApplied) return 1;

      // Both pending -> keep original order
      if (!aApplied && !bApplied) return 0;

      // Both applied -> latest applied first
      return bApplied.appliedAt - aApplied.appliedAt;
    });
  }

  const csv = [
    ["Title", "Company", "URL", "Status", "Applied At"],
    ...filteredJobs.map((job) => {
      const trackedUrl = `${job.url}?${TRACKING_PARAM}=1`;
      const applied = appliedJobs[job.jobId];

      return [
        job.title,
        job.company,
        trackedUrl,
        applied ? "Applied" : "Pending",
        applied
          ? new Date(applied.appliedAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })
          : "",
      ];
    }),
  ]
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);

  await chrome.downloads.download({
    url: dataUrl,
    filename: exportPendingOnly
      ? "company_apply_jobs_pending.csv"
      : "company_apply_jobs_all.csv",
    saveAs: true,
  });
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action !== "jobOpened") return;

  const appliedJobs = await getAppliedJobs();

  // Don't overwrite if already marked
  if (appliedJobs[msg.jobId]) {
    console.log("⚡ Already marked applied:", msg.jobId);
    return;
  }

  appliedJobs[msg.jobId] = {
    appliedAt: new Date().toISOString(),
  };

  await saveAppliedJobs(appliedJobs);

  console.log("✅ Marked applied:", msg.jobId);
});
