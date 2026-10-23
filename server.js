const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const odalar = {}; 
const odaSifreleri = {}; // ŞİFRE KASASI

// API CORS İZİNLERİ (Sitenin ve Eklentinin veri çekebilmesi için)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// API 1: İSTATİSTİKLER (Sitedeki Admin Paneli İçin)
app.get('/api/stats', (req, res) => {
    let aktifOdaSayisi = 0; let toplamIstemci = 0;
    for (const oda in odalar) {
        if (odalar[oda].length > 0) { aktifOdaSayisi++; toplamIstemci += odalar[oda].length; }
    }
    res.json({ odalar: aktifOdaSayisi, istemciler: toplamIstemci });
});

// API 2: ODA KONTROL (Eklentinin odaya girmeden önce şifre sorup sormayacağını anlaması için)
app.get('/api/room/:code', (req, res) => {
    const odaKodu = req.params.code.toUpperCase();
    if (odalar[odaKodu]) {
        res.json({ exists: true, hasPassword: !!odaSifreleri[odaKodu] });
    } else {
        res.json({ exists: false, hasPassword: false });
    }
});

// WEBSOCKET SİSTEMİ (Gerçek Zamanlı İletişim)
wss.on('connection', (ws) => {
    let kullaniciOdasi = null;

    ws.on('message', (mesaj) => {
        const data = JSON.parse(mesaj.toString());

        // 1. İŞLEM: ODA KURMA
        if (data.islem === 'odaKur') {
            const oda = data.odaKodu;
            const sifre = data.sifre || "";

            if (odalar[oda]) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Bu oda kodu şu an kullanımda! Lütfen başka bir kod deneyin.' }));
                return;
            }

            odalar[oda] = [];
            odaSifreleri[oda] = sifre;
            kullaniciOdasi = oda;
            odalar[oda].push(ws);
            
            ws.send(JSON.stringify({ islem: 'baglantiBasarili', mesaj: `[${oda}] ağı başarıyla kuruldu.` }));
            console.log(`SENKRAS: [${oda}] kuruldu. Şifreli: ${sifre ? 'Evet' : 'Hayır'}`);
        } 
        // 2. İŞLEM: MEVCUT ODAYA KATILMA
        else if (data.islem === 'odayaKatil') {
            const oda = data.odaKodu;
            const sifre = data.sifre || "";

            if (!odalar[oda]) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Böyle bir oda bulunamadı!' }));
                return;
            }

            if (odaSifreleri[oda] && odaSifreleri[oda] !== sifre) {
                ws.send(JSON.stringify({ islem: 'sistemMesaji', mesaj: 'HATA: Yanlış şifre girdiniz! Odaya erişim reddedildi.' }));
                return;
            }

            kullaniciOdasi = oda;
            if (!odalar[oda].includes(ws)) odalar[oda].push(ws);
            
            ws.send(JSON.stringify({ islem: 'baglantiBasarili', mesaj: `[${oda}] ağına bağlanıldı.` }));
            console.log(`SENKRAS: Bir kullanıcı [${oda}] odasına katıldı!`);
        }
        // 3. İŞLEM: VİDEO VE SES VERİLERİNİ AKTARMA
        else if (kullaniciOdasi && odalar[kullaniciOdasi]) {
            odalar[kullaniciOdasi].forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    // KULLANICI ÇIKINCA ODAYI TEMİZLEME
    ws.on('close', () => {
        if (kullaniciOdasi && odalar[kullaniciOdasi]) {
            odalar[kullaniciOdasi] = odalar[kullaniciOdasi].filter(client => client !== ws);
            
            // Oda tamamen boşaldıysa odayı ve şifresini imha et
            if(odalar[kullaniciOdasi].length === 0) {
                delete odalar[kullaniciOdasi];
                delete odaSifreleri[kullaniciOdasi]; 
                console.log(`SENKRAS: [${kullaniciOdasi}] odası boşaldığı için silindi.`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SENKRAS Sunucusu ${PORT} portunda çalışıyor!`);
});
