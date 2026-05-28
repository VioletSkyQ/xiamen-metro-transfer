// 主前端交互逻辑

let allStationsData = []; // {name, lines}

document.addEventListener("DOMContentLoaded", async () => {
  await initStationSelects();
  await window.metroMap.load();
  initSearchBox();

  document.getElementById("btn-all").addEventListener("click", () => query("all"));
  document.getElementById("btn-shortest").addEventListener("click", () => query("shortest"));
  document.getElementById("btn-transfers").addEventListener("click", () => query("fewest-transfers"));
  document.getElementById("btn-compare").addEventListener("click", () => query("compare"));
  document.getElementById("swap-btn").addEventListener("click", swapStations);

  document.getElementById("start-station").addEventListener("change", () => {
    window.metroMap._syncMarkerStates();
  });
  document.getElementById("end-station").addEventListener("change", () => {
    window.metroMap._syncMarkerStates();
  });
});

async function initStationSelects() {
  const resp = await fetch("/api/stations");
  const data = await resp.json();

  const allStations = new Set();
  const stationLinesMap = {};
  for (const [lineName, lineInfo] of Object.entries(data.lines)) {
    for (const st of lineInfo.stations) {
      allStations.add(st);
      if (!stationLinesMap[st]) stationLinesMap[st] = [];
      stationLinesMap[st].push(lineName);
    }
  }

  const sorted = [...allStations].sort((a, b) => a.localeCompare(b, "zh"));

  // 存储供搜索使用
  allStationsData = sorted.map((name) => ({
    name,
    lines: stationLinesMap[name] || [],
    pinyin: toPinyin(name),
  }));

  const startEl = document.getElementById("start-station");
  const endEl = document.getElementById("end-station");

  for (const st of sorted) {
    const opt1 = document.createElement("option");
    opt1.value = st;
    opt1.textContent = st;
    startEl.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = st;
    opt2.textContent = st;
    endEl.appendChild(opt2);
  }
}

function toPinyin(str) {
  return str
    .split("")
    .map((c) => c)
    .join("");
}

function initSearchBox() {
  const input = document.getElementById("station-search");
  const dropdown = document.getElementById("search-dropdown");
  const clearBtn = document.getElementById("search-clear");
  let activeIdx = -1;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    activeIdx = -1;

    if (!q) {
      dropdown.classList.add("hidden");
      clearBtn.classList.add("hidden");
      window.metroMap._clearSearchHighlight();
      return;
    }

    clearBtn.classList.remove("hidden");

    const lowerQ = q.toLowerCase();
    const matches = allStationsData
      .filter((s) => {
        if (s.name.includes(q)) return true;
        if (s.name.split("").some((c) => c.toLowerCase().includes(lowerQ)))
          return true;
        return false;
      })
      .slice(0, 10);

    if (matches.length === 0) {
      dropdown.innerHTML =
        '<div class="no-result">未找到匹配站点</div>';
      dropdown.classList.remove("hidden");
      return;
    }

    const lineColors = {
      "1号线": "#FF6A00",
      "2号线": "#0077C8",
      "3号线": "#E60012",
    };

    dropdown.innerHTML = matches
      .map((s, i) => {
        const tags = s.lines
          .map(
            (ln) =>
              `<span class="suggestion-line-tag" style="background:${lineColors[ln] || "#999"}">${ln.replace("号线", "")}</span>`
          )
          .join("");
        const nameHtml = s.name.replace(
          new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "g"),
          "<mark>$1</mark>"
        );
        return `<div class="suggestion-item" data-idx="${i}" data-name="${s.name}">
          <span class="suggestion-name">${nameHtml}</span>
          <span class="suggestion-lines">${tags}</span>
        </div>`;
      })
      .join("");

    dropdown.classList.remove("hidden");
  });

  // 键盘导航
  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".suggestion-item");
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      updateActive(items, activeIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      updateActive(items, activeIdx);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) {
        selectSearchStation(items[activeIdx].dataset.name);
      } else if (items.length === 1) {
        selectSearchStation(items[0].dataset.name);
      }
    } else if (e.key === "Escape") {
      dropdown.classList.add("hidden");
      input.blur();
    }
  });

  // 点击建议
  dropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (!item) return;
    selectSearchStation(item.dataset.name);
  });

  // 清除按钮
  clearBtn.addEventListener("click", () => {
    input.value = "";
    dropdown.classList.add("hidden");
    clearBtn.classList.add("hidden");
    window.metroMap._clearSearchHighlight();
    input.focus();
  });

  // 点击外部关闭
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      dropdown.classList.add("hidden");
    }
  });

  function updateActive(items, idx) {
    items.forEach((el) => el.classList.remove("active"));
    if (idx >= 0 && items[idx]) {
      items[idx].classList.add("active");
      items[idx].scrollIntoView({ block: "nearest" });
    }
  }

  function selectSearchStation(name) {
    input.value = name;
    dropdown.classList.add("hidden");
    clearBtn.classList.remove("hidden");
    window.metroMap.searchAndHighlight(name);
    input.blur();
  }
}

function getSelected() {
  const start = document.getElementById("start-station").value;
  const end = document.getElementById("end-station").value;
  return { start, end };
}

async function query(type) {
  const { start, end } = getSelected();
  const errorEl = document.getElementById("error-msg");

  if (!start || !end) {
    errorEl.textContent = "请选择起始站和终点站";
    errorEl.classList.remove("hidden");
    return;
  }
  errorEl.classList.add("hidden");

  const loading = showLoading();
  try {
    const resp = await fetch(`/api/query/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end }),
    });
    const data = await resp.json();
    if (data.error) {
      errorEl.textContent = data.error;
      errorEl.classList.remove("hidden");
      return;
    }
    renderResult(data, type);
  } catch (e) {
    errorEl.textContent = "网络错误，请稍后再试";
    errorEl.classList.remove("hidden");
  } finally {
    hideLoading(loading);
  }
}

function renderResult(data, type) {
  const panel = document.getElementById("result-panel");
  const content = document.getElementById("result-content");
  panel.classList.remove("hidden");

  let html = "";

  if (type === "compare") {
    const routes = data.routes || [];
    if (routes.length === 0) {
      html = "<p>未找到可行路线</p>";
    } else {
      html += routes.map((r, i) => buildRouteCard(r, i)).join("");
    }
  } else if (type === "all") {
    if (data.shortest) html += buildRouteCard(data.shortest, 0);
    if (data.fewest_transfers) html += buildRouteCard(data.fewest_transfers, 1);
    if (data.compare) {
      html += data.compare.map((r, i) => buildRouteCard(r, i + 2)).join("");
    }
  } else {
    html = buildRouteCard(data, 0);
  }

  content.innerHTML = html || "<p>未找到结果</p>";

  // 高亮第一个结果到地图
  let highlightPath = null;
  if (type === "compare" && data.routes?.length > 0) {
    highlightPath = data.routes[0].stations;
  } else if (type === "all") {
    highlightPath = data.shortest?.stations || data.fewest_transfers?.stations;
  } else {
    highlightPath = data.stations;
  }
  if (highlightPath) {
    window.metroMap.setHighlight(highlightPath);
  }

  panel.scrollIntoView({ behavior: "smooth" });
}

function buildRouteCard(route, idx) {
  const typeLabel = route.type || `方案${idx + 1}`;
  const stations = route.stations || [];
  const transfers = route.transfers || [];

  // 👇 新增：获取后端传过来的分钟数，并加上橙色高亮样式
  const minutesHtml = route.total_minutes 
    ? `<span style="color: #FF6A00; font-weight: bold; font-size: 16px;">约 ${route.total_minutes} 分钟</span>` 
    : '';

  // 标注换乘站
  const transferSet = new Set(transfers.map((t) => t.station));
  const stationHtml = stations
    .map((s) => {
      const cls = transferSet.has(s) ? "station transfer-station" : "station";
      return `<span class="${cls}">${s}</span>`;
    })
    .join('<span class="arrow">→</span>');

  let transferHtml = "";
  if (transfers.length > 0) {
    transferHtml =
      '<div class="transfer-note">' +
      transfers
        .map((t) => `<strong>${t.station}</strong>: ${t.from} → ${t.to}`)
        .join("；") +
      "</div>";
  }

  // 👇 修改返回的 HTML 结构，使用 flex 布局让“方案名”和“时间”左右对齐
  return `
    <div class="result-item">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="margin: 0;">${typeLabel}</h4>
        ${minutesHtml}
      </div>
      <div class="result-stats" style="margin-bottom: 10px;">
        <span>共 ${route.total_stations} 站</span>
        <span>换乘 ${route.total_transfers} 次</span>
      </div>
      <div class="route-path">${stationHtml}</div>
      ${transferHtml}
    </div>
  `;
}

function swapStations() {
  const startEl = document.getElementById("start-station");
  const endEl = document.getElementById("end-station");
  const tmp = startEl.value;
  startEl.value = endEl.value;
  endEl.value = tmp;
}

function showLoading() {
  const el = document.createElement("div");
  el.className = "loading-overlay";
  el.innerHTML = '<div class="spinner"></div>';
  el.style.cssText =
    "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;z-index:999;";
  document.body.appendChild(el);
  return el;
}

function hideLoading(el) {
  el.remove();
}
