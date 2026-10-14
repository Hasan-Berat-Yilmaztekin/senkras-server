const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const odalar = {}; 

wss.on('connection', (ws) => {
    let kullaniciOdasi = null;

    ws.on('message', (mesaj) => {
        const data = JSON.parse(mesaj.toString());

        if (data.islem === 'odayaKatil') {
            kullaniciOdasi = data.odaKodu;
            if (!odalar[kullaniciOdasi]) odalar[kullaniciOdasi] = [];
            if (!odalar[kullaniciOdasi].includes(ws)) odalar[kullaniciOdasi].push(ws);
            console.log(`SENKRAS: Bir kullanıcı [${kullaniciOdasi}] odasına katıldı!`);
        } 
        else if (kullaniciOdasi && odalar[kullaniciOdasi]) {
            console.log(`[${kullaniciOdasi}] Odasına İletilen Komut: ${data.islem}`);
            odalar[kullaniciOdasi].forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        if (kullaniciOdasi && odalar[kullaniciOdasi]) {
            odalar[kullaniciOdasi] = odalar[kullaniciOdasi].filter(client => client !== ws);
            console.log(`SENKRAS: Bir kullanıcı [${kullaniciOdasi}] odasından ayrıldı.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SENKRAS Bulut Sunucusu ${PORT} portunda ODA DESTEĞİYLE çalışıyor!`);
});
