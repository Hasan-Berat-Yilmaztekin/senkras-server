const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const odalar = {}; 

// --- 1. YENİ EKLENEN API BÖLÜMÜ ---
// PHP sitemizin bu sunucudan veri çekmesine izin veriyoruz (CORS)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Admin paneli bu adrese gelip verileri soracak
app.get('/api/stats', (req, res) => {
    let aktifOdaSayisi = 0;
    let toplamIstemci = 0;
    
    for (const oda in odalar) {
        if (odalar[oda].length > 0) {
            aktifOdaSayisi++;
            toplamIstemci += odalar[oda].length;
        }
    }
    
    // Verileri paketleyip geri gönderiyoruz
    res.json({
        odalar: aktifOdaSayisi,
        istemciler: toplamIstemci
    });
});
// ------------------------------------

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
            odalar[kullaniciOdasi].forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        if (kullaniciOdasi && odalar[kullaniciOdasi]) {
            // Kullanıcıyı odadan çıkar
            odalar[kullaniciOdasi] = odalar[kullaniciOdasi].filter(client => client !== ws);
            console.log(`SENKRAS: Bir kullanıcı [${kullaniciOdasi}] odasından ayrıldı.`);
            
            // --- 2. OPTİMİZASYON: Oda tamamen boşaldıysa odayı sil ---
            if(odalar[kullaniciOdasi].length === 0) {
                delete odalar[kullaniciOdasi];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SENKRAS Bulut Sunucusu ${PORT} portunda API VE ODA DESTEĞİYLE çalışıyor!`);
});
