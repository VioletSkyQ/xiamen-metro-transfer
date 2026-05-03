// Leaflet 实景地图 + 厦门地铁路线渲染器

class MetroMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.coords = {};
    this.lineRoutes = {};
    this.lineColors = {};
    this.linePolylines = {};
    this.stationMarkers = {};
    this.transferMarkers = {};
    this.highlightGroup = null;
    this.selectedStart = null;
    this.selectedEnd = null;
    this._searchHighlighted = null;
    this._searchPulseTimer = null;
  }

  async load() {
    const resp = await fetch("/api/map-data");
    const data = await resp.json();
    this.coords = data.coords;
    this.lineRoutes = data.routes;
    this.lineColors = data.colors;

    this._initMap();
    this._drawLines();
    this._addStationMarkers();
    this._addLegend();
  }

  _initMap() {
    const allCoords = Object.values(this.coords).filter((c) => c);
    if (allCoords.length === 0) return;

    const bounds = L.latLngBounds(allCoords);

    this.map = L.map(this.containerId, {
      center: bounds.getCenter(),
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    // OpenStreetMap 瓦片
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.map.fitBounds(bounds.pad(0.08));
    this.highlightGroup = L.layerGroup().addTo(this.map);
  }

  _drawLines() {
    for (const [lineName, stations] of Object.entries(this.lineRoutes)) {
      const latlngs = stations
        .map((s) => this.coords[s])
        .filter((c) => c);

      if (latlngs.length < 2) continue;

      const polyline = L.polyline(latlngs, {
        color: this.lineColors[lineName],
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
        className: `metro-line metro-line-${lineName}`,
      }).addTo(this.map);

      polyline.bindTooltip(lineName, {
        sticky: true,
        direction: "center",
        className: "line-tooltip",
      });

      this.linePolylines[lineName] = polyline;
    }
  }

  _getStationLines() {
    const stationLines = {};
    for (const [ln, stations] of Object.entries(this.lineRoutes)) {
      for (const st of stations) {
        if (!stationLines[st]) stationLines[st] = [];
        stationLines[st].push(ln);
      }
    }
    return stationLines;
  }

  _addStationMarkers() {
    const stationLines = this._getStationLines();

    for (const [st, coord] of Object.entries(this.coords)) {
      const lines = stationLines[st] || [];
      const isTransfer = lines.length >= 2;
      const primaryColor = isTransfer
        ? "#333"
        : this.lineColors[lines[0]] || "#999";

      // 站点圆点
      const isMobile = window.innerWidth < 768;
      const marker = L.circleMarker(coord, {
        radius: isTransfer ? (isMobile ? 11 : 9) : (isMobile ? 8 : 6),
        fillColor: "#fff",
        fillOpacity: 1,
        color: primaryColor,
        weight: isTransfer ? 3 : 2.5,
        opacity: 1,
        className: "station-marker",
      }).addTo(this.map);

      // 常驻站名标签
      marker.bindTooltip(st, {
        permanent: true,
        direction: "bottom",
        offset: [0, isTransfer ? (isMobile ? 14 : 12) : (isMobile ? 11 : 9)],
        className: `station-label${isTransfer ? " station-label--transfer" : ""}`,
      });

      marker.on("click", () => this._onStationClick(st));

      // 悬停高亮
      marker.on("mouseover", () => {
        if (
          st !== this.selectedStart &&
          st !== this.selectedEnd &&
          st !== this._searchHighlighted &&
          !marker._onRoute
        ) {
          marker.setStyle({ radius: isTransfer ? 11 : 8, fillColor: "#fffbe6" });
        }
        marker.bringToFront();
      });

      marker.on("mouseout", () => {
        if (
          st !== this.selectedStart &&
          st !== this.selectedEnd &&
          st !== this._searchHighlighted &&
          !marker._onRoute
        ) {
          marker.setStyle({ radius: isTransfer ? 9 : 6, fillColor: "#fff" });
        }
      });

      if (isTransfer) {
        this.transferMarkers[st] = marker;
      }
      this.stationMarkers[st] = marker;
    }
  }

  _onStationClick(stationName) {
    const startEl = document.getElementById("start-station");
    const endEl = document.getElementById("end-station");

    if (this.selectedStart && stationName === this.selectedStart) {
      this.selectedStart = null;
      if (startEl) startEl.value = "";
    } else if (this.selectedEnd && stationName === this.selectedEnd) {
      this.selectedEnd = null;
      if (endEl) endEl.value = "";
    } else if (!this.selectedStart) {
      this.selectedStart = stationName;
      if (startEl) startEl.value = stationName;
      if (this.selectedEnd === stationName) {
        this.selectedEnd = null;
        if (endEl) endEl.value = "";
      }
    } else if (!this.selectedEnd) {
      if (stationName === this.selectedStart) return;
      this.selectedEnd = stationName;
      if (endEl) endEl.value = stationName;
    } else {
      if (stationName === this.selectedStart) return;
      this.selectedEnd = stationName;
      if (endEl) endEl.value = stationName;
    }

    this._syncMarkerStates();
    if (startEl) startEl.dispatchEvent(new Event("change"));
    if (endEl) endEl.dispatchEvent(new Event("change"));
  }

  _syncMarkerStates() {
    const startEl = document.getElementById("start-station");
    const endEl = document.getElementById("end-station");
    this.selectedStart = (startEl && startEl.value) || null;
    this.selectedEnd = (endEl && endEl.value) || null;

    const stationLines = this._getStationLines();

    for (const [st, marker] of Object.entries(this.stationMarkers)) {
      // 保留搜索高亮
      if (st === this._searchHighlighted) continue;

      const isTransfer = stationLines[st]?.length >= 2;
      const primaryColor = isTransfer
        ? "#333"
        : this.lineColors[stationLines[st]?.[0]] || "#999";

      // 重置样式
      marker.setStyle({
        radius: isTransfer ? 9 : 6,
        fillColor: "#fff",
        fillOpacity: 1,
        color: primaryColor,
        weight: isTransfer ? 3 : 2.5,
        opacity: 1,
      });
      marker._onRoute = false;
    }

    // 起点
    if (this.selectedStart) {
      const m = this.stationMarkers[this.selectedStart];
      if (m) {
        m.setStyle({
          radius: 11,
          fillColor: "#4caf50",
          fillOpacity: 1,
          color: "#2e7d32",
          weight: 3.5,
        });
        m.bringToFront();
      }
    }

    // 终点
    if (this.selectedEnd) {
      const m = this.stationMarkers[this.selectedEnd];
      if (m) {
        m.setStyle({
          radius: 11,
          fillColor: "#f44336",
          fillOpacity: 1,
          color: "#c62828",
          weight: 3.5,
        });
        m.bringToFront();
      }
    }
  }

  setHighlight(path) {
    this.highlightGroup.clearLayers();

    if (!path || path.length === 0) return;

    const latlngs = path.map((s) => this.coords[s]).filter((c) => c);

    // 高亮路径线
    L.polyline(latlngs, {
      color: "#00c853",
      weight: 7,
      opacity: 0.8,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(this.highlightGroup);

    // 路径站点高亮
    const stationLines = this._getStationLines();
    for (const st of path) {
      const marker = this.stationMarkers[st];
      if (marker && st !== this.selectedStart && st !== this.selectedEnd && st !== this._searchHighlighted) {
        marker.setStyle({
          radius: stationLines[st]?.length >= 2 ? 10 : 7,
          fillColor: "#e8f5e9",
          fillOpacity: 1,
          color: "#66bb6a",
          weight: 3,
        });
        marker._onRoute = true;
        marker.bringToFront();
      }
    }

    // 起终点保持在最前
    if (this.selectedStart) {
      this.stationMarkers[this.selectedStart]?.bringToFront();
    }
    if (this.selectedEnd) {
      this.stationMarkers[this.selectedEnd]?.bringToFront();
    }
  }

  clearHighlight() {
    this.highlightGroup.clearLayers();
    for (const [st, marker] of Object.entries(this.stationMarkers)) {
      marker._onRoute = false;
    }
    this._syncMarkerStates();
  }

  searchAndHighlight(stationName) {
    this._clearSearchHighlight();

    const marker = this.stationMarkers[stationName];
    if (!marker) return;

    const coord = this.coords[stationName];
    if (!coord) return;

    // 飞行到站点并放大
    this.map.flyTo(coord, 15, { duration: 0.8 });

    // 搜索高亮样式 — 金色脉冲
    const stationLines = this._getStationLines();
    const isTransfer = (stationLines[stationName] || []).length >= 2;

    marker.setStyle({
      radius: isTransfer ? 14 : 11,
      fillColor: "#ffc107",
      fillOpacity: 1,
      color: "#e6a800",
      weight: 4,
    });
    marker.bringToFront();

    this._searchHighlighted = stationName;
    this._searchPulse = { growing: true, baseRadius: isTransfer ? 14 : 11 };
    this._searchPulseTimer = setInterval(() => {
      const p = this._searchPulse;
      p.growing = !p.growing;
      marker.setRadius(p.growing ? p.baseRadius + 3 : p.baseRadius - 1);
    }, 400);
  }

  _clearSearchHighlight() {
    if (this._searchPulseTimer) {
      clearInterval(this._searchPulseTimer);
      this._searchPulseTimer = null;
    }
    if (this._searchHighlighted) {
      this._syncMarkerStates();
      this._searchHighlighted = null;
    }
  }

  _addLegend() {
    const legend = L.control({ position: "bottomright" });

    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend");
      div.innerHTML = `
        <div class="legend-title">图例</div>
        <div class="legend-row"><span class="legend-line" style="background:#FF6A00"></span> 1号线</div>
        <div class="legend-row"><span class="legend-line" style="background:#0077C8"></span> 2号线</div>
        <div class="legend-row"><span class="legend-line" style="background:#E60012"></span> 3号线</div>
        <div class="legend-row"><span class="legend-dot transfer"></span> 换乘站</div>
        <div class="legend-row"><span class="legend-dot start"></span> 起点</div>
        <div class="legend-row"><span class="legend-dot end"></span> 终点</div>
        <div class="legend-row"><span class="legend-dot search"></span> 搜索结果</div>
      `;
      return div;
    };

    legend.addTo(this.map);
  }
}

window.metroMap = new MetroMap("map-container");
