"use strict";
/// <reference types="leaflet" />
// ─── Estado global ────────────────────────────────────────────────────────────
let map = null;
let markersLayer = null;
// ─── Referencias DOM ──────────────────────────────────────────────────────────
const input = document.getElementById("userInput");
const bubble = document.getElementById("msgBubble");
const msgText = document.getElementById("msgText");
const mapContainer = document.getElementById("mapFrame");
const sendBtn = document.getElementById("sendBtn");
const saveSystemBtn = document.getElementById("saveSystemBtn");
const systemInfoTA = document.getElementById("systemInfo");
const roadmapPill = document.getElementById("roadmap-pill");
const satellitePill = document.getElementById("satellite-pill");
const terrainPill = document.getElementById("terrain-pill");
// ─── Mapa ─────────────────────────────────────────────────────────────────────
const tileUrls = {
    roadmap: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    terrain: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
};
const tileAttributions = {
    roadmap: "© OpenStreetMap contributors",
    satellite: "© Esri",
    terrain: "© Esri",
};
function initMap() {
    if (map)
        return;
    map = L.map(mapContainer).setView([41.3874, 2.1686], 12);
    L.tileLayer(tileUrls.roadmap, { attribution: tileAttributions.roadmap }).addTo(map);
    markersLayer = L.featureGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 400);
}
function setView(type, el) {
    document.querySelectorAll(".map-pill").forEach((p) => p.classList.remove("active"));
    el.classList.add("active");
    if (!map)
        return;
    map.eachLayer((l) => { if (l instanceof L.TileLayer)
        map.removeLayer(l); });
    L.tileLayer(tileUrls[type], { attribution: tileAttributions[type] }).addTo(map);
}
// ─── Marcadores ───────────────────────────────────────────────────────────────
function pintarMarcadores(ubicaciones) {
    const layer = markersLayer;
    if (!layer || !map)
        return;
    layer.clearLayers();
    for (const ub of ubicaciones) {
        const popup = ub.info
            ? `<b>${ub.nombre}</b><br><small>${ub.info}</small>`
            : `<b>${ub.nombre}</b>`;
        L.circleMarker([ub.lat, ub.lon], {
            radius: 10,
            fillColor: "#c8ff57",
            color: "#000",
            weight: 2,
            fillOpacity: 0.9,
        }).addTo(layer).bindPopup(popup);
    }
    map.invalidateSize();
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
}
// ─── Guardar system info ──────────────────────────────────────────────────────
async function saveSystemInfo() {
    try {
        await fetch("/system-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ systemInfo: systemInfoTA.value.trim() }),
        });
    }
    catch (e) {
        console.error("Error guardando system info:", e);
    }
}
// ─── Envío de mensaje ─────────────────────────────────────────────────────────
async function sendMessage() {
    const val = input.value.trim();
    if (!val)
        return;
    msgText.textContent = "Buscando...";
    bubble.classList.add("visible");
    sendBtn.disabled = true;
    try {
        const response = await fetch("/consulta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pregunta: val }),
        });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error ?? `Error ${response.status}`);
        msgText.textContent = data.resposta;
        if (data.ubicaciones && data.ubicaciones.length > 0) {
            pintarMarcadores(data.ubicaciones);
        }
    }
    catch (error) {
        console.error(error);
        msgText.textContent = "Error: " + (error instanceof Error ? error.message : String(error));
    }
    input.value = "";
    sendBtn.disabled = false;
}
// ─── Eventos ──────────────────────────────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);
saveSystemBtn.addEventListener("click", saveSystemInfo);
input.addEventListener("keydown", (e) => { if (e.key === "Enter")
    sendMessage(); });
roadmapPill.addEventListener("click", () => setView("roadmap", roadmapPill));
satellitePill.addEventListener("click", () => setView("satellite", satellitePill));
terrainPill.addEventListener("click", () => setView("terrain", terrainPill));
// ─── Arranque ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initMap);
