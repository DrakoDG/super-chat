// api/chat.js (Backend para Vercel Serverless)

import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';

// === CONFIGURACIÓN (Variables de Entorno) ===
const MONGO_URI = 'mongodb+srv://DrakoDg:200711HD@draking.jyrjtcw.mongodb.net/'; 
const YOUTUBE_API_KEY = 'AIzaSyCbaIqG1KXNhbyA3-I9hZvRZv_izvuY5uY'; 
const LIVE_CHAT_ID = 'Cg0KC2xGblpQR3dHdHRjKicKGFVDdkR2QkFPdUpJSEtXSzU5ZHV2TTBKURILbEZuWlBHd0d0dGM';
const API_BASE_URL = 'https://www.googleapis.com/youtube/v3/liveChat/messages';
const DB_NAME = 'youtube_chat';

// === TASAS DE CAMBIO (Del Script Original) ===
// (Deben ser las mismas que en el frontend para consistencia)
const TASA_CAMBIO_USD = { /* ... (Tus tasas de cambio originales) ... */ };
const PARTICIPANTES_DATA = [ /* ... (Tus participantes originales) ... */ ];

let client;
let db;
let lastPageToken = ''; // Guardado en memoria del servidor (o en BD para persistencia a largo plazo)

// Conexión Singleton a MongoDB
async function connectToDb() {
    if (db) return db;
    if (!client) client = await MongoClient.connect(MONGO_URI);
    db = client.db(DB_NAME);
    return db;
}

// === Lógica de Procesamiento de Super Chats (Copiada y adaptada del Frontend) ===
// ... (Aquí van las funciones convertToPoints y getMentions) ...
// ADVERTENCIA: La función distributePoints debe cambiar.

function convertToPoints(amount, currency) { /* ... Lógica original ... */ }
function getMentions(userComment) { /* ... Lógica original ... */ }

// MODIFICADA: Si no hay mención, divide entre TODOS.
function distributePoints(userComment, points) {
    const mentions = getMentions(userComment);
    const participants = PARTICIPANTES_DATA.map(p => p.nombre);

    if (mentions.length === 0) {
        // Nueva lógica: Dividir entre todos
        const pointsPerParticipant = points / participants.length;
        return { 
            mentions: participants, 
            pointsPerMention: pointsPerParticipant 
        };
    } else {
        // Lógica original: Dividir entre mencionados
        const pointsPerMention = points / mentions.length;
        return { 
            mentions: mentions, 
            pointsPerMention: pointsPerMention 
        };
    }
}

// === Lógica de la Base de Datos ===

/**
 * Procesa los Super Chats y actualiza MongoDB.
 */
async function processAndUpdate(messages, collection) {
    let newTotalPoints = 0;
    
    for (const message of messages) {
        const superChatDetails = message.snippet.superChatDetails;
        const messageId = message.id;

        if (superChatDetails) {
            // 1. **Prevención de Duplicados (MongoDB)**: Verificar si el ID ya existe.
            const existing = await collection.findOne({ _id: messageId });
            if (existing) {
                console.log(`SC duplicado (ID: ${messageId}) omitido.`);
                continue; 
            }

            const amount = superChatDetails.amountMicros / 1000000; 
            const currency = superChatDetails.currency || 'USD';

            // Conversión a Puntos (USD)
            const points = convertToPoints(amount, currency);
            newTotalPoints += points;

            // Distribución de Puntos
            const distributionResult = distributePoints(
                superChatDetails.userComment || "(Sin mensaje)", 
                points
            );
            
            // 2. **Actualizar Puntos en MongoDB**
            const updateOperations = distributionResult.mentions.map(name => ({
                updateOne: {
                    filter: { nombre: name },
                    update: { $inc: { puntos: distributionResult.pointsPerMention } },
                    upsert: true
                }
            }));
            
            if (updateOperations.length > 0) {
                await db.collection('leaderboard').bulkWrite(updateOperations);
            }

            // 3. **Insertar el Super Chat en MongoDB (Historial para duplicados)**
            await collection.insertOne({
                _id: messageId,
                timestamp: new Date(message.snippet.publishedAt),
                points: points,
                mentions: distributionResult.mentions
            });

            console.log(`[SC Procesado] ${messageId}. Puntos: ${points.toFixed(2)}`);
        }
    }
    
    // 4. **Actualizar Total Recaudado en MongoDB**
    if (newTotalPoints > 0) {
        await db.collection('totals').updateOne(
            { _id: 'totalAmountUSD' },
            { $inc: { value: newTotalPoints } },
            { upsert: true }
        );
    }
}

// === Endpoint Principal ===
export default async function handler(req, res) {
    try {
        const db = await connectToDb();
        const scCollection = db.collection('superchats');

        // 1. Obtener el pageToken guardado para la siguiente consulta
        const tokenDoc = await db.collection('config').findOne({ _id: 'pageToken' });
        lastPageToken = tokenDoc ? tokenDoc.value : '';

        // 2. Consultar la API de YouTube
        let url = `${API_BASE_URL}?liveChatId=${LIVE_CHAT_ID}&part=snippet,authorDetails&key=${YOUTUBE_API_KEY}`;
        if (lastPageToken) url += `&pageToken=${lastPageToken}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`YouTube API Error: ${response.status}`);
        const data = await response.json();
        
        // 3. Procesar y Actualizar
        await processAndUpdate(data.items, scCollection);

        // 4. Guardar el nuevo pageToken
        await db.collection('config').updateOne(
            { _id: 'pageToken' },
            { $set: { value: data.nextPageToken } },
            { upsert: true }
        );

        // 5. Devolver los datos actualizados al Frontend
        const leaderboard = await db.collection('leaderboard').find({}).sort({ puntos: -1 }).toArray();
        const totalDoc = await db.collection('totals').findOne({ _id: 'totalAmountUSD' });
        const totalAmountUSD = totalDoc ? totalDoc.value : 0;
        
        // Cómputo de últimas 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const total24h = await scCollection.aggregate([
            { $match: { timestamp: { $gte: yesterday } } },
            { $group: { _id: null, total: { $sum: '$points' } } }
        ]).toArray();
        const totalLast24h = total24h.length > 0 ? total24h[0].total : 0;

        res.status(200).json({ 
            leaderboard, 
            totalAmountUSD: totalAmountUSD.toFixed(2), 
            totalLast24h: totalLast24h.toFixed(2),
            pollingIntervalMillis: data.pollingIntervalMillis || 5000 // Para que el frontend sepa cuándo volver a preguntar
        });

    } catch (error) {
        console.error("Error en el API Server:", error);
        res.status(500).json({ error: error.message });
    }
}
