const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const odalar = {}; 
const odaSifreleri = {}; // YENİ: ŞİFRE KASASI

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/api/stats', (req, res) => {
    let aktifOdaSayisi = 0; let toplamIstemci = 0;
    for (const oda in odalar) {
        if (odalar[oda].length > 0) { aktifOdaSayisi++; toplamIstemci += odalar[oda].length; }
    }
    res.json({ odalar: aktifOdaSayisi, istemciler: toplamIstemci });
});

wss.on('connection', (ws) => {
    let kullaniciOdasi = null;

    ws.on('message', (mesaj) => {
        const data = JSON.parse(mesaj.toString());

        if (data.islem === 'odayaKatil') {
            const oda = data.odaKodu;
            const sifre = data.sifre || ""; // Şifre girilmezse boş kabul et

            if (!odalar[oda]) {
                // İLK GİREN KİŞİ ODAYI KURAR VE ŞİFREYİ BELİRLER
                odalar[oda] = [];
                odaSifreleri[oda] = sifre; 
                console.log(`SENKRAS: [${oda}] odası kuruldu. (Şifreli: ${sifre ? 'Evet' : 'Hayır'})`);
            } else {
                // SONRADAN GİRENLER ŞİFREYİ DOĞRU GİRMEK ZORUNDA
                if (odaSifreleri[oda] !== sifre) {
                    ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Yanlış Şifre! Odaya erişim reddedildi.' }));
                    return; // Yanlışsa kapıdan çevir!
                }
            }

            kullaniciOdasi = oda;
            if (!odalar[oda].includes(ws)) odalar[oda].push(ws);
            console.log(`SENKRAS: Bir kullanıcı [${oda}] odasına katıldı!`);
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
            odalar[kullaniciOdasi] = odalar[kullaniciOdasi].filter(client => client !== ws);
            if(odalar[kullaniciOdasi].length === 0) {
                delete odalar[kullaniciOdasi];
                delete odaSifreleri[kullaniciOdasi]; // Oda boşalınca şifreyi de sil
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SENKRAS Sunucusu ${PORT} portunda çalışıyor!`);
});
