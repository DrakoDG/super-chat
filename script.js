// script.js (Frontend - Solo llama a tu propio API)

// Base URL de tu API en Vercel (Ej: https://tudominio.vercel.app/api/chat)
const API_ENDPOINT = '/api/chat'; 
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
let currentPollingInterval = 5000; // Por defecto

/**
 * Llama a tu API de Vercel para obtener datos y procesar nuevos SC.
 */
async function fetchAndUpdateData() {
    try {
        const response = await fetch(API_ENDPOINT);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: El API falló. Revisa logs en Vercel.`);
        }
        
        const data = await response.json();

        // 1. Actualizar el Total y el Total 24h
        document.getElementById('total-donado').textContent = `${data.totalAmountUSD} ($)`;
        document.getElementById('total-24h').textContent = `${data.totalLast24h} ($)`;
        
        // 2. Actualizar el Leaderboard
        updateLeaderboard(data.leaderboard);

        // 3. Ajustar el intervalo de polling
        currentPollingInterval = data.pollingIntervalMillis || 5000;
        
        // 4. Repetir la consulta
        setTimeout(fetchAndUpdateData, currentPollingInterval);

    } catch (error) {
        console.error("Fallo al obtener datos del API. Reintentando en 30s...", error);
        document.getElementById('last-message-box').innerHTML = `<span style="color:red;">Error de conexión. Revisa el API Server.</span>`;
        setTimeout(fetchAndUpdateData, 30000); 
    }
}


function updateLeaderboard(leaderboardData) {
    const tableBody = document.getElementById('puntos-body');
    if (!tableBody) return; 

    tableBody.innerHTML = ''; 

    leaderboardData.forEach((p, index) => {
        const row = tableBody.insertRow();
        
        let rankClass = '';
        if (index === 0) rankClass = 'rank-1';
        else if (index === 1) rankClass = 'rank-2';
        else if (index === 2) rankClass = 'rank-3';

        row.className = rankClass;

        row.insertCell().textContent = index + 1; // Posición

        const participantData = PARTICIPANTES_DATA.find(pd => pd.nombre === p.nombre);
        const nameCell = row.insertCell();
        nameCell.innerHTML = `<strong>${p.nombre}</strong> ${participantData?.alias[0] || ''}`;

        const pointsCell = row.insertCell();
        pointsCell.className = 'points-cell';
        pointsCell.textContent = parseFloat(p.puntos).toFixed(2); 
    });
}


// =================================================================
// === INICIO DE LA APLICACIÓN (Frontend) ===
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar estructura de la tabla
    const leaderboardContainer = document.getElementById('leaderboard-container');
    if (leaderboardContainer) {
        leaderboardContainer.innerHTML = `
            <h2>🏆 Leaderboard (1 USD = 1 Punto)</h2>
            <table id="puntos-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Participante</th>
                        <th>Puntos Acumulados (USD)</th>
                    </tr>
                </thead>
                <tbody id="puntos-body"></tbody>
            </table>
        `;
    }

    // 2. Mostrar la interfaz (Se llenará al obtener los datos del API)
    document.getElementById('total-donado').textContent = 'Cargando...';
    document.getElementById('total-24h').textContent = 'Cargando...';

    // 3. Iniciar la conexión a tu API
    fetchAndUpdateData(); 
});
