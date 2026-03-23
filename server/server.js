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

app.post('/system-info', (req, res) => {
    systemInfo = req.body.systemInfo || '';
    res.json({ mensaje: 'Información guardada' });
});

app.post('/consulta', async (req, res) => {
    const { pregunta } = req.body;
    console.log('--- Nueva consulta ---');
    console.log('Pregunta:', pregunta);

    const prompt = `Eres un asistente geográfico. 
IMPORTANTE: 
1. Al inicio de tu respuesta pon SIEMPRE: [UBICACIONES: lugar1, ciudad; lugar2, ciudad; ...]
2. Usa el punto y coma (;) para separar múltiples lugares.
3. Si solo hay uno, pon igualmente: [UBICACIONES: lugar, ciudad].
4. Sé preciso con los nombres para que el mapa los encuentre.
Contexto adicional: ${systemInfo}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: pregunta }
            ],
            temperature: 0.7
        });

        const respuestaCompleta = completion.choices[0].message.content;
        console.log('Respuesta de la IA:', respuestaCompleta);

        const locRegex = /\[UBICACIONES[:\s]*(.+?)\]/is;
        const match = respuestaCompleta.match(locRegex);

        let listaUbicaciones = [];
        let respuestaLimpia = respuestaCompleta;

        if (match) {
            listaUbicaciones = match[1].split(';').map(l => l.trim()).filter(l => l.length > 0);
            respuestaLimpia = respuestaCompleta.replace(locRegex, "").trim();
        }

        console.log('Ubicaciones extraídas:', listaUbicaciones);

        res.json({
            resposta: respuestaLimpia,
            ubicaciones: listaUbicaciones
        });

    } catch (error) {
        console.error('ERROR EN LA API:', error.message);
        res.status(500).json({ error: 'Error en la comunicación con la IA: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`>>> Servidor corriendo en http://localhost:${PORT}`);
});