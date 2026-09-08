(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("na_track") !== "1") {
    return;
  }

  const match = window.location.pathname.match(/job-listings-(\d+)/);

  if (!match) {
    return;
  }

  const jobId = match[1];

  console.log("✅ Tracked Naukri job opened:", jobId);

  chrome.runtime.sendMessage({
    action: "jobOpened",
    jobId,
  });
})();
