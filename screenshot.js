(async () => {
  const timeout = 5000;
  const interval = 200;
  const start = Date.now();

  while (
    !document.querySelector("#company-site-button") &&
    Date.now() - start < timeout
  ) {
    await new Promise((r) => setTimeout(r, interval));
  }

  const btn = document.querySelector("#company-site-button");

  return {
    hasCompanyApply: !!btn,
    url: location.href,
    title: document.title,
  };
})();
