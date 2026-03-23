import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

// Crear un objecte per fer les consultes
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = 3000;
// Middleware per convertir JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/consulta', async (req, res) => {
    const { pregunta } = req.body;

    try {
        // Realitzar la consulta, esperar la resposta i guardar-la a 'resposta'
        const resposta = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    "role": "system",
                    "content": "Eres un asistente especializado en coordenadas geográficas. Solo puedes responder preguntas relacionadas con coordenadas geográficas, latitud, longitud, ubicaciones, mapas, distancias geográficas, etc. Si la pregunta no está relacionada con coordenadas geográficas, debes responder: 'Lo siento, solo puedo ayudarte con consultas relacionadas con coordenadas geográficas.'"
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