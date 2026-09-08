const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

let isScanning = false;

const TRACKING_PARAM = "na_track";

// ============================================================
// APPLIED JOBS
// ============================================================

async function getAppliedJobs() {
  const { appliedJobs = {} } = await chrome.storage.local.get("appliedJobs");

  return appliedJobs;
}

async function saveAppliedJobs(appliedJobs) {
  await chrome.storage.local.set({
    appliedJobs,
  });
}

async function markJobAsApplied(jobId) {
  const appliedJobs = await getAppliedJobs();

  // Don't overwrite existing appliedAt
  if (appliedJobs[jobId]) {
    console.log("[APPLIED] Already marked:", jobId);
    return;
  }

  appliedJobs[jobId] = {
    appliedAt: new Date().toISOString(),
  };

  await saveAppliedJobs(appliedJobs);

  console.log("[APPLIED] Marked appliedAt:", jobId);
}

// ============================================================
// CACHE
// ============================================================

async function getCache() {
  const { jobCache = {} } = await chrome.storage.local.get("jobCache");

  return jobCache;
}

async function saveCache(jobCache) {
  await chrome.storage.local.set({
    jobCache,
    lastScan: Date.now(),
  });

  console.log("[CACHE] Saved:", Object.keys(jobCache).length, "jobs");
}

async function getCompanyApplyJobs() {
  const cache = await getCache();

  return Object.values(cache).filter((job) => job.hasCompanyApply);
}

// ============================================================
// INSTALL
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log("[EXTENSION] Installed");
});

// ============================================================
// TRACKED JOB / EXPIRED JOB DETECTION
// ============================================================
//
// CSV URL:
//
// /job-listings-010926503896?na_track=1
//
// If Naukri redirects to:
//
// /software-development-engineer-2-jobs-in-bengaluru?expJD=true
//
// We remember:
//
// trackedTab_12345 -> 010926503896
//
// Then when expJD appears, we know which job expired.
// ============================================================

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.type !== "main_frame") {
      return;
    }

    const url = new URL(details.url);

    // ----------------------------------------------------------
    // Our tracked job URL
    // ----------------------------------------------------------

    if (url.searchParams.get(TRACKING_PARAM) === "1") {
      const match = url.pathname.match(/job-listings-(\d+)/);

      if (!match) {
        return;
      }

      const jobId = match[1];

      await chrome.storage.session.set({
        [`trackedTab_${details.tabId}`]: jobId,
      });

      console.log("[TRACKING] Remembered job:", jobId, "| Tab:", details.tabId);

      return;
    }

    // ----------------------------------------------------------
    // Naukri expired/dead job
    // ----------------------------------------------------------

    if (url.searchParams.has("expJD")) {
      const key = `trackedTab_${details.tabId}`;

      const result = await chrome.storage.session.get(key);

      const jobId = result[key];

      if (!jobId) {
        console.log("[EXPIRED] expJD found but no tracked job:", details.tabId);

        return;
      }

      console.log("[EXPIRED] Naukri says job is expired:", jobId);

      await markJobAsApplied(jobId);

      await chrome.storage.session.remove(key);

      console.log("[EXPIRED] Removed from pending:", jobId);
    }
  },
  {
    urls: ["https://www.naukri.com/*"],
  },
);

// ============================================================
// MESSAGE HANDLER
// ============================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ----------------------------------------------------------
  // Scan
  // ----------------------------------------------------------

  if (msg.action === "scan") {
    console.log("[MESSAGE] Scan requested");

    scanCurrentTab();

    return true;
  }

  // ----------------------------------------------------------
  // Download pending
  // ----------------------------------------------------------

  if (msg.action === "downloadPendingCSV") {
    console.log("[MESSAGE] Download pending CSV");

    downloadCSV(true);

    return true;
  }

  // ----------------------------------------------------------
  // Download all
  // ----------------------------------------------------------

  if (msg.action === "downloadAllCSV") {
    console.log("[MESSAGE] Download all CSV");

    downloadCSV(false);

    return true;
  }

  // ----------------------------------------------------------
  // Clear cache
  // ----------------------------------------------------------

  if (msg.action === "clearCache") {
    console.log("[MESSAGE] Clear cache requested");

    chrome.storage.local
      .remove(["jobCache", "lastScan", "appliedJobs"])
      .then(() => {
        console.log("[CACHE] Cleared successfully");

        sendResponse({
          success: true,
        });
      });

    return true;
  }
});

// ============================================================
// SCANNING
// ============================================================

async function scanCurrentTab() {
  if (isScanning) {
    console.log("[SCAN] Already scanning");

    return;
  }

  isScanning = true;

  console.log("[SCAN] Starting");

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

  if (!tab?.id) {
    console.error("[SCAN] No active tab found");

    isScanning = false;

    return;
  }

  console.log("[SCAN] Current tab:", tab.id, tab.url);

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

      console.log("[PAGE] Jobs found:", jobs.length);

      chrome.runtime.sendMessage({
        action: "processJobs",
        jobs,
      });
    },
  });
}

// ============================================================
// PROCESS SCANNED JOBS
// ============================================================

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action !== "processJobs") {
    return;
  }

  console.log("[SCAN] Processing jobs:", msg.jobs.length);

  const cache = await getCache();

  let current = 0;

  const total = msg.jobs.length;

  let found = Object.values(cache).filter((job) => job.hasCompanyApply).length;

  console.log("[SCAN] Cached jobs:", Object.keys(cache).length);

  console.log("[SCAN] Existing company-apply jobs:", found);

  // ----------------------------------------------------------
  // Create ONE worker tab
  // ----------------------------------------------------------

  const workerTab = await chrome.tabs.create({
    url: "about:blank",
    active: false,
  });

  console.log("[WORKER] Created worker tab:", workerTab.id);

  try {
    for (const job of msg.jobs) {
      console.log(
        `[SCAN] ${current + 1}/${total}:`,
        job.title,
        "|",
        job.company,
      );

      const cachedJob = cache[job.jobId];

      // --------------------------------------------------------
      // Cache check
      // --------------------------------------------------------

      if (cachedJob && Date.now() - cachedJob.checkedAt < MAX_CACHE_AGE) {
        console.log("[CACHE] Skipping:", job.title);

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

      // --------------------------------------------------------
      // Inspect job
      // --------------------------------------------------------

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
    // ----------------------------------------------------------
    // Close worker only after all jobs
    // ----------------------------------------------------------

    console.log("[WORKER] Scan finished. Closing worker tab:", workerTab.id);

    await chrome.tabs.remove(workerTab.id);
  }

  // ------------------------------------------------------------
  // Save cache
  // ------------------------------------------------------------

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

  console.log("[SCAN] Finished:", current, "/", total);
});

// ============================================================
// APPLY AUTOMATION
// ============================================================

async function applyAndCheckResult(tabId, job) {
  console.log("[APPLY] Starting:", job.title, "|", job.company);

  // ----------------------------------------------------------
  // Wait for URL changes BEFORE clicking
  // ----------------------------------------------------------

  const result = await new Promise((resolve) => {
    let finished = false;

    const finish = (success, reason) => {
      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timeout);

      chrome.tabs.onUpdated.removeListener(listener);

      resolve({
        success,
        reason,
      });
    };

    const listener = (id, changeInfo) => {
      if (id !== tabId) {
        return;
      }

      if (!changeInfo.url) {
        return;
      }

      console.log("[APPLY URL]", job.title, "→", changeInfo.url);

      // --------------------------------------------------------
      // Expected successful application URL
      // --------------------------------------------------------

      if (changeInfo.url.includes("/myapply/saveApply")) {
        console.log("[APPLY SUCCESS]", job.title, "→ /myapply/saveApply");

        finish(true, "saveApply detected");
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // ----------------------------------------------------------
    // 3 second timeout
    // ----------------------------------------------------------

    const timeout = setTimeout(() => {
      console.log(
        "[APPLY TIMEOUT]",
        job.title,
        "→ No /myapply/saveApply within 3 seconds",
      );

      finish(false, "saveApply not detected");
    }, 3000);

    // ----------------------------------------------------------
    // Click Apply
    // ----------------------------------------------------------

    chrome.scripting
      .executeScript({
        target: {
          tabId,
        },

        func: () => {
          const btn = document.querySelector("#company-site-button");

          if (!btn) {
            return false;
          }

          btn.click();

          return true;
        },
      })
      .then((clickResult) => {
        const clicked = clickResult?.[0]?.result === true;

        if (clicked) {
          console.log("[APPLY] Clicked:", job.title);
        } else {
          console.log("[APPLY] Button not found:", job.title);

          finish(false, "button not found");
        }
      })
      .catch((err) => {
        console.error("[APPLY] Click failed:", job.title, err);

        finish(false, "click failed");
      });
  });

  if (result.success) {
    console.log("[APPLY] Completed successfully:", job.title);
  } else {
    console.log(
      "[APPLY] Moving to next job:",
      job.title,
      "| Reason:",
      result.reason,
    );
  }

  return result.success;
}

// ============================================================
// INSPECT JOB
// ============================================================

async function inspectJob(tabId, job, cache) {
  console.log("[INSPECT] Opening:", job.title, "|", job.url);

  await new Promise(async (resolve) => {
    const listener = async (id, info) => {
      if (id !== tabId) {
        return;
      }

      if (info.status !== "complete") {
        return;
      }

      chrome.tabs.onUpdated.removeListener(listener);

      console.log("[INSPECT] Page loaded:", job.title);

      try {
        // ------------------------------------------------------
        // Detect company-site Apply
        // ------------------------------------------------------

        const result = await chrome.scripting.executeScript({
          target: {
            tabId,
          },

          files: ["screenshot.js"],
        });

        const hasCompanyApply = result[0].result.hasCompanyApply;

        // ------------------------------------------------------
        // Cache result
        // ------------------------------------------------------

        cache[job.jobId] = {
          ...job,

          hasCompanyApply,

          checkedAt: Date.now(),
        };

        console.log(
          hasCompanyApply
            ? "[DETECT] COMPANY APPLY"
            : "[DETECT] NO COMPANY APPLY",
          "|",
          job.title,
        );

        // ------------------------------------------------------
        // Automatically click company Apply
        // ------------------------------------------------------

        if (hasCompanyApply) {
          await applyAndCheckResult(tabId, job);
        }
      } catch (err) {
        console.error("[INSPECT] Failed:", job.title, err);

        cache[job.jobId] = {
          ...job,

          hasCompanyApply: false,

          checkedAt: Date.now(),
        };
      }

      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);

    console.log("[INSPECT] Navigating worker to:", job.url);

    await chrome.tabs.update(tabId, {
      url: job.url,
    });
  });
}

// ============================================================
// CSV EXPORT
// ============================================================

async function downloadCSV(exportPendingOnly = true) {
  console.log("[CSV] Creating:", exportPendingOnly ? "pending" : "all");

  const jobs = await getCompanyApplyJobs();

  const appliedJobs = await getAppliedJobs();

  // ----------------------------------------------------------
  // Pending only
  // ----------------------------------------------------------

  let filteredJobs = exportPendingOnly
    ? jobs.filter((job) => !appliedJobs[job.jobId])
    : [...jobs];

  // ----------------------------------------------------------
  // Full CSV sorting
  // ----------------------------------------------------------

  if (!exportPendingOnly) {
    filteredJobs.sort((a, b) => {
      const aApplied = appliedJobs[a.jobId];

      const bApplied = appliedJobs[b.jobId];

      // Pending first

      if (!aApplied && bApplied) {
        return -1;
      }

      if (aApplied && !bApplied) {
        return 1;
      }

      // Both pending

      if (!aApplied && !bApplied) {
        return 0;
      }

      // Both applied
      // Latest applied first

      return new Date(bApplied.appliedAt) - new Date(aApplied.appliedAt);
    });
  }

  console.log("[CSV] Jobs exported:", filteredJobs.length);

  // ----------------------------------------------------------
  // Build CSV
  // ----------------------------------------------------------

  const csv = [
    ["Title", "Company", "URL", "Status", "Applied At"],

    ...filteredJobs.map((job) => {
      const url = new URL(job.url);

      url.searchParams.set(TRACKING_PARAM, "1");

      const trackedUrl = url.toString();

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

  // ----------------------------------------------------------
  // Download
  // ----------------------------------------------------------

  const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);

  await chrome.downloads.download({
    url: dataUrl,

    filename: exportPendingOnly
      ? "company_apply_jobs_pending.csv"
      : "company_apply_jobs_all.csv",

    saveAs: true,
  });

  console.log("[CSV] Download started");
}

// ============================================================
// NORMAL TRACKED JOB OPENED
// ============================================================

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action !== "jobOpened") {
    return;
  }

  if (!msg.jobId) {
    return;
  }

  console.log("[TRACKED JOB] Opened:", msg.jobId);

  await markJobAsApplied(msg.jobId);

  console.log("[TRACKED JOB] Marked applied:", msg.jobId);
});
