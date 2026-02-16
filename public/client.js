const socket = io();

// UI Elements
const statusEl = document.getElementById('status');
const qrImage = document.getElementById('qr-image');
const qrText = document.getElementById('qr-text');
const pairingCodeDisplay = document.getElementById('pairing-code-display');
const pairingCodeEl = document.getElementById('pairing-code');
const logContent = document.getElementById('log-content');

// Utils
function log(msg) {
    const div = document.createElement('div');
    div.textContent = `> ${msg}`;
    logContent.appendChild(div);
    logContent.scrollTop = logContent.scrollHeight;
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}-panel`).classList.add('active');
}

function requestPairing() {
    const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
    if (phone.length < 10) return alert('Numéro invalide');
    socket.emit('request-pairing', phone);
    log(`Demande de code pour: ${phone}...`);
}

// Socket Events
socket.on('connect', () => {
    log('Connecté au serveur');
});

socket.on('status', (status) => {
    statusEl.textContent = status === 'open' ? 'Connecté' : 'Déconnecté';
    statusEl.className = `status ${status === 'open' ? 'connected' : 'disconnected'}`;
    if (status === 'open') {
        qrText.textContent = "Bot Connecté !";
        qrImage.style.display = 'none';
        pairingCodeDisplay.style.display = 'none';
    }
});

socket.on('qr', (url) => {
    qrImage.src = url;
    qrImage.style.display = 'block';
    qrText.style.display = 'none';
    log('Nouveau QR Code reçu');
});

socket.on('pairing-code', (code) => {
    pairingCodeEl.textContent = code;
    pairingCodeDisplay.style.display = 'block';
    log(`Code de connexion reçu: ${code}`);
});

socket.on('log', (msg) => {
    log(msg);
});
