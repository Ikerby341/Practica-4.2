import dotenv from 'dotenv';
import express from 'express';
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

// ─── Geocodificación con Nominatim (para lugares concretos) ───────────────────

async function geocodeLocation(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'ExplorerApp/1.0' } });
    const data = await r.json();
    if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
}

// ─── Búsqueda de POIs con Overpass (para categorías: pizzerías, hoteles...) ───

async function buscarPOIsOverpass(categoria, ciudad) {
    const cityCoords = await geocodeLocation(ciudad);
    if (!cityCoords) return [];

    const { lat, lon } = cityCoords;
    const radio = 5000;

    const tagMap = {
        pizzeria: '[amenity=restaurant][cuisine=pizza]',
        restaurant: '[amenity=restaurant]',
        hotel: '[tourism=hotel]',
        hostel: '[tourism=hostel]',
        farmacia: '[amenity=pharmacy]',
        hospital: '[amenity=hospital]',
        supermercado: '[shop=supermarket]',
        bar: '[amenity=bar]',
        cafe: '[amenity=cafe]',
        museo: '[tourism=museum]',
        playa: '[natural=beach]',
        parking: '[amenity=parking]',
        gasolinera: '[amenity=fuel]',
        banco: '[amenity=bank]',
        gimnasio: '[leisure=fitness_centre]',
    };

    const catLower = categoria.toLowerCase();
    let tag = null;
    for (const [key, value] of Object.entries(tagMap)) {
        if (catLower.includes(key)) { tag = value; break; }
    }
    if (!tag) tag = `[name~"${categoria}",i]`;

    const query = `[out:json][timeout:10];(node${tag}(around:${radio},${lat},${lon});way${tag}(around:${radio},${lat},${lon}););out center 10;`;

    const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' }
    });

    const data = await r.json();
    if (!data.elements || data.elements.length === 0) return [];

    return data.elements.map(el => ({
        nombre: el.tags?.name || categoria,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        info: [
            el.tags?.['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}`.trim() : null,
            el.tags?.phone || null,
            el.tags?.opening_hours ? `Horario: ${el.tags.opening_hours}` : null,
        ].filter(Boolean).join(' · ') || null
    })).filter(p => p.lat && p.lon);
}

// ─── Consulta principal ───────────────────────────────────────────────────────

app.post('/consulta', async (req, res) => {
    const { pregunta } = req.body;
    console.log('--- Nueva consulta ---');
    console.log('Pregunta:', pregunta);

    const prompt = `Eres un asistente especializado EXCLUSIVAMENTE en geografía, ubicaciones físicas, direcciones, lugares, mapas y puntos de interés.

OBJETIVO
Tu función es identificar si una consulta está relacionada con una ubicación física real o buscable en un mapa, y responder en formato JSON SOLO cuando corresponda.

CRITERIO CLAVE (MUY IMPORTANTE)
Considera como CONSULTA GEOGRÁFICA VÁLIDA cualquier pregunta que implique:

Lugares físicos (ciudades, países, calles, monumentos, negocios, etc.)
Ubicación de sitios ("dónde está...", "dónde hay...", "ubicación de...")
Categorías de lugares ("restaurantes en...", "hospitales cerca de...")
Lugares asociados a personas ("dónde vive X", "dónde nació X", etc.) → SIEMPRE es geográfico
Infraestructura ("cementerios", "parques", "aeropuertos", etc.)
Rutas o direcciones
Coordenadas o referencias geográficas

Aunque la pregunta mencione personas, eventos u otros contextos, SI hay una ubicación física implícita o explícita, ES válida.

CUÁNDO RECHAZAR
Responde ÚNICAMENTE con:
"Lo siento, solo puedo ayudarte con consultas geográficas y de ubicaciones."

Solo si la consulta:

No tiene ninguna relación con lugares físicos
Es puramente teórica, emocional, opinión o conocimiento general sin ubicación
No puede asociarse a ningún sitio real

FORMATO DE RESPUESTA

Si la consulta es válida, responde SOLO con un JSON válido, sin texto adicional.

CATEGORÍA DE LUGARES

Usa este formato cuando se pidan tipos de sitios:

{"tipo":"categoria","categoria":"<categoria>","ciudad":"<ciudad>","respuesta":"<mensaje breve>"}

Categorías permitidas:
pizzeria, restaurant, hotel, hostel, farmacia, hospital, supermercado, bar, cafe, museo, playa, parking, gasolinera, banco, gimnasio, cementerio, parque, aeropuerto

Reglas:

Detecta la categoría aunque el usuario use sinónimos (ej: “pizza” → pizzeria)
"ciudad" debe ser lo más específica posible
LUGAR CONCRETO

Usa este formato si se habla de un lugar específico:

{"tipo":"lugar","ubicaciones":["<Nombre, Ciudad, País>"],"respuesta":"<descripción breve y útil>"}

Reglas:

Incluye ubicaciones claras para geocodificación
Puedes incluir varias si aplica
Si es sobre una persona (ej: dónde vive), usa la mejor aproximación conocida (ciudad, país)

CASOS ESPECIALES

Si no puedes dar una ubicación exacta pero sí aproximada, responde (no rechaces)
Si la consulta es ambigua pero claramente geográfica, interpreta y responde
Si pide múltiples sitios, usa varias ubicaciones
Si pide algo como “cementerios en Barcelona”, es categoría (cementerio)

REGLAS ESTRICTAS

No uses markdown
No expliques nada fuera del JSON
No añadas texto antes o después
No uses emojis
No saludes
Solo devuelve el JSON

SI NO PUEDES RESPONDER EN JSON

Responde con una frase breve explicando que no puedes ayudar con esa consulta, sin formato JSON.

CONTEXTO ADICIONAL
${systemInfo}`;

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

        // ── Caso 1: categoría → Overpass ──────────────────────────────────────
        if (parsed.tipo === 'categoria') {
            const pois = await buscarPOIsOverpass(parsed.categoria, parsed.ciudad);
            console.log(`POIs encontrados: ${pois.length}`);

            if (pois.length === 0) {
                return res.json({
                    resposta: `No encontré ${parsed.categoria}s en ${parsed.ciudad} en OpenStreetMap. Puede que no estén registradas.`,
                    ubicaciones: []
                });
            }

            return res.json({ resposta: parsed.respuesta, ubicaciones: pois });
        }

        // ── Caso 2: lugar concreto → Nominatim ────────────────────────────────
        if (parsed.tipo === 'lugar') {
            const coords = [];
            for (const loc of parsed.ubicaciones) {
                const result = await geocodeLocation(loc);
                if (result) coords.push({ nombre: loc.split(',')[0], lat: result.lat, lon: result.lon, info: null });
            }
            return res.json({ resposta: parsed.respuesta, ubicaciones: coords });
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