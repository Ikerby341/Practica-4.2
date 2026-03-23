import express from 'express';
import OpenAI from 'openai';

// Crear un objecte per fer les consultes
const openai = new OpenAI({ apiKey: process.env.secretOpenAI });

// Realitzar la consulta, esperar la resposta i guardar-la a 'resposta'
const resposta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ "role": "user", "content": "Consultes relacionades amb coordenades geogràfiques, si et fan cap altre pregunta has de dir que no pots ajudar-te " }],
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    max_completion_tokens,
    n
});

const app = express();
const PORT = 3000;
// Middleware per convertir JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/consulta', (req, res) => {
    const { pregunta } = req.body;
    // Aquí es pot fer la consulta a l'API d'OpenAI amb la pregunta rebuda
    // i enviar la resposta al client
    res.json({ resposta: "Resposta de l'API d'OpenAI per a la pregunta: " + pregunta });
});
// --- Pàgina no trobada ---
// Ha d'anar després de totes les rutes
app.use((req, res, next) => {
    const e = 'Pàgina no trobada:<br>' + req.url;
    res.render('error', { e });
});
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor responent en http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map