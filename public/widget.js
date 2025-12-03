// public/widget.js
(function () {
  const endpoint = "/api/track";

  function send() {
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          url: window.location.href,
          referrer: document.referrer || "",
          ua: navigator.userAgent,
        }),
      }).catch(() => {});
    } catch (e) {
      console.error("BossMedya widget error:", e);
    }
  }

  // sayfa yüklendiğinde tek hit
  if (document.readyState === "complete" || document.readyState === "interactive") {
    send();
  } else {
    window.addEventListener("DOMContentLoaded", send);
  }
})();
