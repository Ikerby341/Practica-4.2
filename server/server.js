import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

// Crear un objecte per fer les consultes
const openai = new OpenAI({ baseURL: 'https://models.github.ai/inference', apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = 3000;
let systemInfo = ''; // Variable para guardar la información del sistema

// Middleware per convertir JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ruta para guardar la información del sistema
app.post('/system-info', (req, res) => {
    const { systemInfo: newSystemInfo } = req.body;
    if (!newSystemInfo) {
        return res.status(400).json({ error: 'Información del sistema vacía' });
    }
    systemInfo = newSystemInfo;
    res.json({ mensaje: 'Información del sistema guardada' });
});

app.post('/consulta', async (req, res) => {
    const { pregunta } = req.body;

    try {
        // Realitzar la consulta, esperar la resposta i guardar-la a 'resposta'
        const systemMessage = systemInfo
            ? `Eres un asistente especializado en información geográfica y ubicaciones. Puedes responder preguntas sobre:
- Coordenadas geográficas, latitud, longitud
- Ubicaciones de lugares, ciudades, países
- Búsquedas de servicios y establecimientos en zonas específicas (gasolineras, restaurantes, hoteles, etc.)
- Distancias y rutas entre lugares
- Información sobre mapa, geografía y localización
Si la pregunta no está relacionada con geografía o ubicaciones, responde: 'Lo siento, solo puedo ayudarte con consultas relacionadas con ubicaciones y geografía.'

Información adicional a considerar: ${systemInfo}`
            : `Eres un asistente especializado en información geográfica y ubicaciones. Puedes responder preguntas sobre:
- Coordenadas geográficas, latitud, longitud
- Ubicaciones de lugares, ciudades, países
- Búsquedas de servicios y establecimientos en zonas específicas (gasolineras, restaurantes, hoteles, etc.)
- Distancias y rutas entre lugares
- Información sobre mapa, geografía y localización
Si la pregunta no está relacionada con geografía o ubicaciones, responde: 'Lo siento, solo puedo ayudarte con consultas relacionadas con ubicaciones y geografía.'`;

        const resposta = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                {
                    "role": "system",
                    "content": systemMessage
                },
                {
                    "role": "user",
                    "content": pregunta
                }
            ],
            temperature: 0.7,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            max_completion_tokens: 500,
            n: 1
        });

        res.json({ resposta: resposta.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: 'Error en la consulta a OpenAI: ' + error.message });
    }
});
// --- Pàgina no trobada ---
// Ha d'anar després de totes les rutes
app.use((req, res) => {
    res.status(404).json({ error: 'Pàgina no trobada: ' + req.url });
});
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor responent en http://localhost:${PORT}`);
});