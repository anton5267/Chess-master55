import Chart from "chart.js/auto";

function tryParseStatsPayload() {
    const payloadElement = document.getElementById("stats-data");
    if (!payloadElement) {
        return null;
    }

    try {
        return JSON.parse(payloadElement.textContent || "{}");
    } catch {
        return null;
    }
}

function renderStatsChart(payload) {
    const canvas = document.getElementById("stats-pie-chart");
    const emptyState = document.getElementById("stats-chart-empty");

    if (!canvas || !payload) {
        return;
    }

    const values = Array.isArray(payload.values) ? payload.values : [];
    const hasData = values.some((value) => Number(value) > 0);
    if (!hasData) {
        canvas.hidden = true;
        if (emptyState) {
            emptyState.hidden = false;
            emptyState.textContent = payload.emptyState || "";
        }
        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: payload.labels || [],
            datasets: [
                {
                    data: values,
                    backgroundColor: payload.colors || [],
                    borderWidth: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                },
                title: {
                    display: true,
                    text: payload.title || "",
                },
            },
        },
    });
}

renderStatsChart(tryParseStatsPayload());
