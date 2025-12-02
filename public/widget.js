
(async () => {
  try {
    await fetch("/api/track");
    console.log("BossMedya widget track OK");
  } catch (e) {
    console.error("Track error:", e);
  }
})();
