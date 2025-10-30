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
const TASA_CAMBIO_USD = {
    // Tasa: 1 unidad de moneda = X USD (Punto)
    'EUR': 1.08,  // Euro
    'GBP': 1.25,  // Libra Esterlina
    'CHF': 1.11,  // Franco Suizo
    'CAD': 0.73,  // Dólar Canadiense
    'AUD': 0.65,  // Dólar Australiano
    'JPY': 0.0063, // Yen Japonés
    'USD': 1.00,  // Dólar estadounidense (Base)
    'DOP': 0.017, // Peso Dominicano 
    'MXN': 0.055, // Peso Mexicano
    'COP': 0.00025, // Peso Colombiano
    'BRL': 0.19,  // Real Brasileño
    'PAB': 1.00,  // Balboa Panameño
    'PEN': 0.27,  // Sol Peruano
    'CLP': 0.0011, // Peso Chileno
    'ARS': 0.0011, // Peso Argentino 
    'VES': 0.027, // Bolívar Soberano Venezolano
    'CRC': 0.0019, // Colón Costarricense
    'GTQ': 0.13,  // Quetzal Guatemalteco
    'HNL': 0.041, // Lempira Hondureña
    'NIO': 0.027, // Córdoba Nicaragüense
    'CUC': 1.00,  // Peso Cubano Convertible
    'KRW': 0.00072, // Won Surcoreano
    'CNY': 0.14,  // Yuan Chino
    'AED': 0.27,  // Dirham de Emiratos Árabes Unidos
    'INR': 0.012, // Rupia India
    'SAR': 0.27,  // Riyal Saudí
    'ZAR': 0.054, // Rand Sudafricano
    'RUB': 0.010, // Rublo Ruso
    'PLN': 0.25,  // Zloty Polaco
    'SEK': 0.091, // Corona Sueca
    'TRY': 0.031, // Lira Turca
    'HKD': 0.13,  // Dólar de Hong Kong
};

const PARTICIPANTES_DATA = [
    { nombre: "La Fruta", alias: ["La Fruta", "🍇", "Fruta"] },
    { nombre: "Michael Flores", alias: ["Flores", "PR", "Boris", "Nenes", "Michael"] },
    { nombre: "Jlexis", alias: ["Nene", "PR", "Boris", "🇵🇷"] },
    { nombre: "Carlos Montesquieu", alias: ["Montesquieu", "Saltamontes", "Carlos"] },
    { nombre: "Diosa Canales", alias: ["Canales", "Venezuela", "🇻🇪", "Diosa"] },
    { nombre: "Daniela Barranco", alias: ["Daniela", "Barranco", "Venezuela", "🇻🇪", "Dani"] },
    { nombre: "Pollito Tropical", alias: ["Tropical", "Cuba", "🇨🇺", "Pollito"] },
    { nombre: "JC Pichardo", alias: ["Pichardo", "🧡", "JC"] },
    { nombre: "Valka", alias: ["Colombia", "🇨🇴", "Valka"] },
    { nombre: "Gracie Bon", alias: ["Bon", "Panamá", "Panama", "Gracie", "Greci Bom", "Greci"] },
    { nombre: "La Insuperable", alias: ["Indhira", "Luna", "Insuperable"] },
    { nombre: "La Perversa", alias: ["Perversa", "💜", "Perver"] },
    { nombre: "Mami Nolas", alias: ["Pepita", "Carepepita", "MamiNolas", "Mami Nolas"] },
    { nombre: "Capiitán Alo", alias: ["Capitan", "Alo", "Nariz", "Capitán"] },
    { nombre: "YoungSwagon", alias: ["YoungSwagon", "papotico"] },
    { nombre: "Shadow", alias: ["Blow", "💎"] },
    { nombre: "Sujeto Oro 24", alias: ["El Mejor Hombre"] },
    { nombre: "Mami Jordan", alias: ["Jordan", "Mami Jordan"] },
    { nombre: "Yesther", alias: ["Jesther", "Villano"] },
    { nombre: "Luis Polonia", alias: ["Polonia", "Rey del Hit"] },
];

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

