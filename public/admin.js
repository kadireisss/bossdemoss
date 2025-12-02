// public/admin.js
(async function initAdmin() {
  const summaryEls = {
    total: document.getElementById("summary-total"),
    today: document.getElementById("summary-today"),
    online: document.getElementById("summary-online"),
    avgSession: document.getElementById("summary-avg-session"),
    bounce: document.getElementById("summary-bounce"),
    bestDay: document.getElementById("summary-best-day"),
    bestHour: document.getElementById("summary-best-hour"),
    totalChange: document.getElementById("summary-total-change"),
  };

  const eventsTbody = document.getElementById("events-tbody");
  const refreshBtn = document.getElementById("refresh-btn");

  async function fetchStats() {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Stats API error");
      const data = await res.json();

      const { summary, chart, events } = data;

      summaryEls.total.textContent = (summary.totalVisitors || 0).toLocaleString("tr-TR");
      summaryEls.today.textContent = (summary.todayVisitors || 0).toLocaleString("tr-TR");
      summaryEls.online.textContent = (summary.onlineNow || 0).toString();
      summaryEls.avgSession.textContent = (summary.avgSessionPages || 0).toFixed(1);
      summaryEls.bounce.textContent = `%${summary.bounceRate || 0}`;
      summaryEls.bestDay.textContent = summary.bestDay || "-";
      summaryEls.bestHour.textContent = summary.bestHour || "-";
      summaryEls.totalChange.textContent = summary.totalChangeLabel || "-";

      eventsTbody.innerHTML = "";
      events.forEach((ev) => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-800/50";
        tr.innerHTML = `
          <td class="py-2 pr-4 whitespace-nowrap text-slate-200">${ev.time}</td>
          <td class="py-2 pr-4 text-slate-300">${ev.ip}</td>
          <td class="py-2 pr-4 text-slate-300">${ev.country}</td>
          <td class="py-2 pr-4 text-slate-200">${ev.page}</td>
          <td class="py-2 pr-4 text-slate-400">${ev.referrer || "-"}</td>
          <td class="py-2 pr-4 text-slate-300">${ev.device}</td>
        `;
        eventsTbody.appendChild(tr);
      });

      renderChart(chart.labels, chart.values);
    } catch (err) {
      console.error(err);
      alert("Stats API'ye ulaşılamadı. Konsolu kontrol et.");
    }
  }

  let trafficChart;
  function renderChart(labels, values) {
    const ctx = document.getElementById("trafficChart").getContext("2d");
    if (trafficChart) trafficChart.destroy();

    trafficChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Günlük Ziyaretçi",
            data: values,
            fill: true,
            tension: 0.35,
            borderColor: "#22c55e",
            backgroundColor: "rgba(34,197,94,0.15)",
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
              font: { size: 11 },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#9ca3af", font: { size: 10 } },
            grid: { color: "rgba(55,65,81,0.5)" },
          },
          y: {
            ticks: { color: "#9ca3af", font: { size: 10 } },
            grid: { color: "rgba(55,65,81,0.4)" },
          },
        },
      },
    });
  }

  refreshBtn?.addEventListener("click", () => {
    fetchStats();
  });

  fetchStats();
})();
