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
    let aktifOdaSayisi = 0; 
    let toplamIstemci = 0;
    const detayliOdalar = []; 

    for (const oda in odalar) { 
        if (odalar[oda].length > 0) { 
            aktifOdaSayisi++; 
            toplamIstemci += odalar[oda].length; 
            
            // Odadaki herkesin IP adresini topla
            const bagliIpler = odalar[oda].map(client => client.ipAdresi || "Bilinmiyor");

            detayliOdalar.push({
                odaKodu: oda,
                odaSifresi: odaSifreleri[oda] || "Şifresiz",
                kisiSayisi: odalar[oda].length,
                ipAdresleri: bagliIpler
            });
        } 
    }
    
    res.json({ odalar: aktifOdaSayisi, istemciler: toplamIstemci, detaylar: detayliOdalar });
});

app.get('/api/room/:code', (req, res) => {
    const odaKodu = req.params.code.toUpperCase();
    if (odalar[odaKodu]) { res.json({ exists: true, hasPassword: !!odaSifreleri[odaKodu] }); } 
    else { res.json({ exists: false, hasPassword: false }); }
});

wss.on('connection', (ws) => {
    ws.aktifOdalar = new Set();

    ws.on('message', (mesaj) => {
        const data = JSON.parse(mesaj.toString());

        if (data.islem === 'ping') return;

        if (data.islem === 'otomatikYenidenBaglan') {
            const oda = data.odaKodu;
            if (!odalar[oda]) {
                odalar[oda] = [];
                odaSifreleri[oda] = data.sifre || "";
            }
            if (odaSifreleri[oda] && odaSifreleri[oda] !== (data.sifre || "")) return;
            
            ws.aktifOdalar.add(oda);
            odalar[oda].push(ws); 
            return; 
        }

        // YENİ: Biri sekmeyi yenilediğinde veya Ayrıl dediğinde odadan temizle
        if (data.islem === 'odadanAyril') {
            const oda = data.odaKodu;
            if (odalar[oda]) {
                const index = odalar[oda].indexOf(ws);
                if (index > -1) {
                    odalar[oda].splice(index, 1); // Sadece kapanan sekmeyi sil
                }
                // Oda tamamen boşaldıysa yok et
                if (odalar[oda].length === 0) {
                    delete odalar[oda];
                    delete odaSifreleri[oda];
                }
            }
            return;
        }

        if (data.islem === 'odaKur') {
            const oda = data.odaKodu;
            if (odalar[oda]) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Bu oda kodu kullanımda!' }));
                return;
            }
            odalar[oda] = [];
            odaSifreleri[oda] = data.sifre || "";
            ws.aktifOdalar.add(oda);
            odalar[oda].push(ws);
            ws.send(JSON.stringify({ islem: 'baglantiBasarili', mesaj: `[${oda}] ağı kuruldu.`, odaKodu: oda }));
        } 
        else if (data.islem === 'odayaKatil') {
            const oda = data.odaKodu;
            if (!odalar[oda]) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Oda bulunamadı!' }));
                return;
            }
            if (odaSifreleri[oda] && odaSifreleri[oda] !== (data.sifre || "")) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Yanlış şifre!' }));
                return;
            }
            ws.aktifOdalar.add(oda);
            odalar[oda].push(ws); // YENİ: Aynı tarayıcıdan farklı sekmeler girerse sayıyı doğru tutar
            ws.send(JSON.stringify({ islem: 'baglantiBasarili', mesaj: `[${oda}] ağına bağlanıldı.`, odaKodu: oda }));
        }
        else if (data.odaKodu && odalar[data.odaKodu]) {
            odalar[data.odaKodu].forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        ws.aktifOdalar.forEach(oda => {
            if (odalar[oda]) {
                // Tarayıcı tamamen kapatılırsa temizle
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
