/// <reference types="leaflet" />

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ubicacion {
  nombre: string;
  lat: number;
  lon: number;
  info: string | null;
}

interface ConsultaResponse {
  resposta: string;
  ubicaciones: Ubicacion[];
  error?: string;
}

type MapType = "roadmap" | "satellite" | "terrain";

// ─── Estado global ────────────────────────────────────────────────────────────

let map: L.Map | null = null;
let markersLayer: L.FeatureGroup | null = null;
let dotsInterval: any = null;

// ─── Referencias DOM ──────────────────────────────────────────────────────────

const input         = document.getElementById("userInput")      as HTMLInputElement;
const bubble        = document.getElementById("msgBubble")      as HTMLElement;
const msgText       = document.getElementById("msgText")        as HTMLElement;
const mapContainer  = document.getElementById("mapFrame")       as HTMLElement;
const sendBtn       = document.getElementById("sendBtn")        as HTMLButtonElement;
const saveSystemBtn = document.getElementById("saveSystemBtn")  as HTMLButtonElement;
const systemInfoTA  = document.getElementById("systemInfo")     as HTMLTextAreaElement;
const roadmapPill   = document.getElementById("roadmap-pill")   as HTMLElement;
const satellitePill = document.getElementById("satellite-pill") as HTMLElement;
const terrainPill   = document.getElementById("terrain-pill")   as HTMLElement;

// ─── Mapa ─────────────────────────────────────────────────────────────────────

const tileUrls: Record<MapType, string> = {
  roadmap:   "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  terrain:   "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
};

const tileAttributions: Record<MapType, string> = {
  roadmap:   "© OpenStreetMap contributors",
  satellite: "© Esri",
  terrain:   "© Esri",
};

function initMap(): void {
  if (map) return;
  map = L.map(mapContainer).setView([41.3874, 2.1686], 12);
  L.tileLayer(tileUrls.roadmap, { attribution: tileAttributions.roadmap }).addTo(map);
  markersLayer = L.featureGroup().addTo(map);
  setTimeout(() => map!.invalidateSize(), 400);
}

function setView(type: MapType, el: HTMLElement): void {
  document.querySelectorAll(".map-pill").forEach((p) => p.classList.remove("active"));
  el.classList.add("active");
  if (!map) return;
  map.eachLayer((l: L.Layer) => { if (l instanceof L.TileLayer) map!.removeLayer(l); });
  L.tileLayer(tileUrls[type], { attribution: tileAttributions[type] }).addTo(map);
}

// ─── Marcadores ───────────────────────────────────────────────────────────────

function pintarMarcadores(ubicaciones: Ubicacion[]): void {
  const layer = markersLayer;
  if (!layer || !map) return;

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

async function saveSystemInfo(): Promise<void> {
  try {
    await fetch("/system-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInfo: systemInfoTA.value.trim() }),
    });
  } catch (e) {
    console.error("Error guardando system info:", e);
  }
}

// ─── Animar puntos suspensivos ───────────────────────────────────────────────

function startLoadingDots(): void {
  let dotCount = 0;
  msgText.textContent = "Buscando";
  
  dotsInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    msgText.textContent = "Buscando" + ".".repeat(dotCount);
  }, 350);
}

function stopLoadingDots(): void {
  if (dotsInterval) {
    clearInterval(dotsInterval);
    dotsInterval = null;
  }
}

// ─── Envío de mensaje ─────────────────────────────────────────────────────────

async function sendMessage(): Promise<void> {
  const val = input.value.trim();
  if (!val) return;

  startLoadingDots();
  bubble.classList.add("visible");
  sendBtn.disabled = true;

  try {
    const response = await fetch("/consulta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta: val }),
    });

    const data: ConsultaResponse = await response.json();
    if (!response.ok) throw new Error(data.error ?? `Error ${response.status}`);
    
    stopLoadingDots();
    msgText.textContent = data.resposta;

    if (data.ubicaciones && data.ubicaciones.length > 0) {
      pintarMarcadores(data.ubicaciones);
    }
  } catch (error) {
    console.error(error);
    stopLoadingDots();
    msgText.textContent = "Error: " + (error instanceof Error ? error.message : String(error));
  }

  input.value = "";
  sendBtn.disabled = false;
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

sendBtn.addEventListener("click", sendMessage);
saveSystemBtn.addEventListener("click", saveSystemInfo);
input.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") sendMessage(); });

roadmapPill.addEventListener("click",   () => setView("roadmap",   roadmapPill));
satellitePill.addEventListener("click", () => setView("satellite", satellitePill));
terrainPill.addEventListener("click",   () => setView("terrain",   terrainPill));

// ─── Arranque ─────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", initMap);