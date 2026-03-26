import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import OpenAI from 'openai';
dotenv.config();
const openai = new OpenAI({
    baseURL: 'https://models.github.ai/inference',
    apiKey: process.env.OPENAI_API_KEY
});
const app = express();
const PORT = 3000;
let systemInfo = '';
app.use(express.json());
app.use(express.static('public'));
// ─── Sistema de información ───────────────────────────────────────────────────
app.post('/system-info', (req, res) => {
    systemInfo = req.body.systemInfo || '';
    res.json({ mensaje: 'Información guardada' });
});
// ─── Coordenadas (latitud/longitud) y geocodificación con Nominatim ──────────
function parseLatLon(query) {
    // Extrae los primeros dos números flotantes en el texto
    const match = query.match(/(-?\d+(?:\.\d+)?)[^\d\-]+(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
}

async function geocodeLocation(query) {
    const direct = parseLatLon(query);
    if (direct) return direct;

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'ExplorerApp/1.0' } });

    if (!r.ok) {
        console.error(`Geocode error: ${r.status} ${r.statusText}`);
        return null;
    }

    try {
        const data = await r.json();
        if (data && data.length > 0) {
            const lat = Number(data[0].lat);
            const lon = Number(data[0].lon);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                return { lat, lon };
            }
        }
    } catch (e) {
        console.error('Geocode parse error:', e.message);
        const text = await r.text();
        console.error('Response text:', text.substring(0, 200));
    }

    return null;
}

function haversineDistance(a, b) {
    const R = 6371000; // metros
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon), Math.sqrt(1 - (sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon)));

    return R * c;
}

// ─── Consulta principal ───────────────────────────────────────────────────────
app.post('/consulta', async (req, res) => {
    const { pregunta } = req.body;
    console.log('--- Nueva consulta ---');
    console.log('Pregunta:', pregunta);
    const coordsDirectas = parseLatLon(pregunta || '');
    if (coordsDirectas) {
        return res.json({
            resposta: `Ubicación por coordenadas: ${coordsDirectas.lat}, ${coordsDirectas.lon}`,
            ubicaciones: [{ nombre: `Coordenadas directas`, lat: coordsDirectas.lat, lon: coordsDirectas.lon, info: null }]
        });
    }
    const promptTemplate = fs.readFileSync('server/prompt.txt', 'utf8');
    const prompt = promptTemplate.replace('${systemInfo}', systemInfo);
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: pregunta }
            ],
            temperature: 0.2
        });
        const respuestaIA = completion.choices[0].message.content.trim();
        console.log('Respuesta IA:', respuestaIA);
        // La IA rechazó la pregunta
        if (!respuestaIA.startsWith('{')) {
            return res.json({ resposta: respuestaIA, ubicaciones: [] });
        }
        let parsed;
        try {
            parsed = JSON.parse(respuestaIA);
        } catch {
            return res.json({ resposta: respuestaIA, ubicaciones: [] });
        }
        // ── Caso 1: categoría → ubicaciones de IA ──────────────────────────────────────
        if (parsed.tipo === 'categoria') {
            console.log(`Ubicaciones de IA: ${parsed.ubicaciones ? parsed.ubicaciones.length : 0}`);
            return res.json({ resposta: parsed.respuesta, ubicaciones: parsed.ubicaciones || [] });
        }

        // ── Caso 2: lugar concreto → ubicaciones de IA + validación ────────────────
        if (parsed.tipo === 'lugar') {
            const resolvedUbicaciones = [];

            for (const rawUb of (parsed.ubicaciones || [])) {
                const nombre = rawUb.nombre || rawUb.name || String(rawUb || '').trim();
                let lat = typeof rawUb.lat === 'number' ? rawUb.lat : Number(rawUb.lat);
                let lon = typeof rawUb.lon === 'number' ? rawUb.lon : Number(rawUb.lon);
                let info = rawUb.info || null;

                const actual = (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
                    ? { lat, lon }
                    : null;

                const nominatim = await geocodeLocation(nombre);

                if (nominatim && actual) {
                    const dist = haversineDistance(actual, nominatim);
                    // Si la distancia entre lo que da la IA y Nominatim es > 2 km, usamos Nominatim.
                    if (dist > 2000) {
                        lat = nominatim.lat;
                        lon = nominatim.lon;
                        info = info ? `${info} (ajustado por Nominatim)` : 'Coordenadas ajustadas por Nominatim';
                    }
                } else if (nominatim && !actual) {
                    lat = nominatim.lat;
                    lon = nominatim.lon;
                    info = info ? `${info} (ajustado por Nominatim)` : 'Coordenadas obtenidas por Nominatim';
                } else if (!nominatim && actual) {
                    // Mantenemos coords IA si no hay fallback.
                } else {
                    continue; // sin coords válidas no hay marcador
                }

                resolvedUbicaciones.push({ nombre: nombre || 'Ubicación', lat, lon, info });
            }

            if (resolvedUbicaciones.length === 0) {
                return res.json({ resposta: parsed.respuesta + ' (No pude ubicarlo con precisión.)', ubicaciones: [] });
            }

            return res.json({ resposta: parsed.respuesta, ubicaciones: resolvedUbicaciones });
        }

        res.json({ resposta: parsed.respuesta || respuestaIA, ubicaciones: [] });
    } catch (error) {
        console.error('ERROR:', error.message);
        res.status(500).json({ error: 'Error en la comunicación con la IA: ' + error.message });
    }
});
app.listen(PORT, () => {
    console.log(`>>> Servidor corriendo en http://localhost:${PORT}`);
});