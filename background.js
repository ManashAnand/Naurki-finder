let companyApplyJobs = [];

async function getCache() {
  const { jobCache = {} } = await chrome.storage.local.get("jobCache");
  return jobCache;
}

async function saveCache(cache) {
  await chrome.storage.local.set({
    jobCache: cache,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

chrome.runtime.onMessage.addListener(async (msg) => {
  // ===========================
  // Scan button clicked
  // ===========================
  if (msg.action === "scan") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    console.log("Scanning jobs...");

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
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
          type: "JOBS",
          jobs,
        });
      },
    });

    return;
  }

  // ===========================
  // Process jobs
  // ===========================
  if (msg.type === "JOBS") {
    console.log("Received jobs:");
    console.table(msg.jobs);
    const storage = await chrome.storage.local.get("companyApplyJobs");

    companyApplyJobs = storage.companyApplyJobs || [];

    const jobCache = await getCache();

    console.log(`Cached jobs: ${Object.keys(jobCache).length}`);

    for (const job of msg.jobs) {
      // Already processed
      if (jobCache[job.jobId] !== undefined) {
        console.log(`⏩ Skipping: ${job.title}`);

        if (jobCache[job.jobId]) {
          if (!companyApplyJobs.some((j) => j.url === data.url)) {
            companyApplyJobs.push({
              title: job.title,
              company: job.company,
              url: data.url,
            });
          }
        }

        continue;
      }

      const createdTab = await chrome.tabs.create({
        url: job.url,
        active: true,
      });

      try {
        await new Promise((resolve) => {
          const listener = async (tabId, info) => {
            if (tabId !== createdTab.id) return;
            if (info.status !== "complete") return;

            chrome.tabs.onUpdated.removeListener(listener);

            console.log(`Checking: ${job.title}`);

            const result = await chrome.scripting.executeScript({
              target: { tabId },
              files: ["screenshot.js"],
            });

            const data = result[0].result;

            jobCache[job.jobId] = data.hasCompanyApply;

            if (data.hasCompanyApply) {
              if (!companyApplyJobs.some((j) => j.url === data.url)) {
                companyApplyJobs.push({
                  title: job.title,
                  company: job.company,
                  url: data.url,
                });
              }

              console.log("✅ Found:", data.url);
            } else {
              console.log("❌ No company apply");
            }

            resolve();
          };

          chrome.tabs.onUpdated.addListener(listener);
        });
      } finally {
        await chrome.tabs.remove(createdTab.id);
      }
    }

    // Save cache once
    await saveCache(jobCache);

    console.log("========== RESULTS ==========");
    console.table(companyApplyJobs);
    console.log(
      `Total jobs with Apply on company site: ${companyApplyJobs.length}`,
    );

    // Save results for popup
    await chrome.storage.local.set({
      companyApplyJobs,
      lastScan: Date.now(),
    });

    // Export CSV
    const csv = [
      ["Title", "Company", "Naukri URL"],
      ...companyApplyJobs.map((job) => [job.title, job.company, job.url]),
    ]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv",
    });

    const downloadUrl = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: downloadUrl,
      filename: "company_apply_jobs.csv",
      saveAs: true,
    });

    URL.revokeObjectURL(downloadUrl);
  }
});
