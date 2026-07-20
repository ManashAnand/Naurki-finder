const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
let isScanning = false;

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

  if (msg.action === "downloadCSV") {
    downloadCSV();
    return true;
  }

  if (msg.action === "clearCache") {
    (async () => {
      await chrome.storage.local.remove(["jobCache", "lastScan"]);
    })();

    return true;
  }

  if (msg.action === "forceRescan") {
    (async () => {
      await chrome.storage.local.remove(["jobCache", "lastScan"]);
      await scanCurrentTab(true);
    })();

    return true;
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

async function downloadCSV() {
  const jobs = await getCompanyApplyJobs();

  const csv = [
    ["Title", "Company", "URL"],
    ...jobs.map((job) => [job.title, job.company, job.url]),
  ]
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);

  await chrome.downloads.download({
    url: dataUrl,
    filename: "company_apply_jobs.csv",
    saveAs: true,
  });
}
