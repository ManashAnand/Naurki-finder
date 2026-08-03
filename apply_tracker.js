(() => {
  const params = new URLSearchParams(window.location.search);

  if (!params.has("na_track") && !params.has("expJD")) {
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
