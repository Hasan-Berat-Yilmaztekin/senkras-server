const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const odalar = {}; 
const odaSifreleri = {}; 

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/api/stats', (req, res) => {
    let aktifOdaSayisi = 0; let toplamIstemci = 0;
    for (const oda in odalar) { if (odalar[oda].length > 0) { aktifOdaSayisi++; toplamIstemci += odalar[oda].length; } }
    res.json({ odalar: aktifOdaSayisi, istemciler: toplamIstemci });
});

app.get('/api/room/:code', (req, res) => {
    const odaKodu = req.params.code.toUpperCase();
    if (odalar[odaKodu]) { res.json({ exists: true, hasPassword: !!odaSifreleri[odaKodu] }); } 
    else { res.json({ exists: false, hasPassword: false }); }
});

wss.on('connection', (ws) => {
    // YENİ: Tek bir tarayıcının birden fazla odada olabilmesi için Set kullanıyoruz
    ws.aktifOdalar = new Set();

    ws.on('message', (mesaj) => {
        const data = JSON.parse(mesaj.toString());

        if (data.islem === 'odaKur') {
            const oda = data.odaKodu;
            const sifre = data.sifre || "";
            if (odalar[oda]) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Bu oda kodu kullanımda!' }));
                return;
            }
            odalar[oda] = [];
            odaSifreleri[oda] = sifre;
            ws.aktifOdalar.add(oda);
            odalar[oda].push(ws);
            ws.send(JSON.stringify({ islem: 'baglantiBasarili', mesaj: `[${oda}] ağı başarıyla kuruldu.`, odaKodu: oda }));
        } 
        else if (data.islem === 'odayaKatil') {
            const oda = data.odaKodu;
            const sifre = data.sifre || "";
            if (!odalar[oda]) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Böyle bir oda bulunamadı!' }));
                return;
            }
            if (odaSifreleri[oda] && odaSifreleri[oda] !== sifre) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Yanlış şifre girdiniz!' }));
                return;
            }
            ws.aktifOdalar.add(oda);
            if (!odalar[oda].includes(ws)) odalar[oda].push(ws);
            ws.send(JSON.stringify({ islem: 'baglantiBasarili', mesaj: `[${oda}] ağına bağlanıldı.`, odaKodu: oda }));
        }
        // YENİ GÜVENLİK: Gelen komutu kimliğine (data.odaKodu) göre SADECE o odaya dağıt
        else if (data.odaKodu && odalar[data.odaKodu]) {
            odalar[data.odaKodu].forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        // Kullanıcı çıktığında bulunduğu TÜM odalardan temizle
        ws.aktifOdalar.forEach(oda => {
            if (odalar[oda]) {
                odalar[oda] = odalar[oda].filter(client => client !== ws);
                if(odalar[oda].length === 0) {
                    delete odalar[oda];
                    delete odaSifreleri[oda];
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 SENKRAS Sunucusu ${PORT} portunda çalışıyor!`); });
