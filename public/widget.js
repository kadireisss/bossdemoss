// public/widget.js
(function () {
  try {
    const payload = {
      url: window.location.href,
      referrer: document.referrer || null,
      ua: navigator.userAgent,
      ts: Date.now(),
    };

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((e) => {
      console.warn("BossMedya widget track error:", e);
    });
  } catch (e) {
    console.warn("BossMedya widget init error:", e);
  }
})();
