(() => {
  function applySharedMetrics() {
    const metrics = window.RALPHAI_METRICS;
    if (!metrics) return;

    document.querySelectorAll('[data-metric-key]').forEach((el) => {
      const key = el.dataset.metricKey;
      if (!key) return;
      const value = metrics[key];
      if (value !== undefined && value !== null) {
        el.textContent = String(value);
      }
    });
  }

  applySharedMetrics();
})();
