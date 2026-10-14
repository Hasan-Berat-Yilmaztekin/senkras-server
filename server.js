const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', (ws) => {
    console.log('Gemicim Bildiriyor: Bir kullanıcı film sitesinden bağlandı!');

    // Telsizden bir mesaj geldiğinde
    ws.on('message', (mesaj) => {
        // İŞTE ÇÖZÜM BURASI: Gelen makine kodunu normal metne çeviriyoruz!
        const yaziMesaji = mesaj.toString();
        
        // Bu satır sayesinde sen oynat/durdur yaptıkça CMD ekranında da ne gönderdiğini göreceksin
        console.log("İletilen Komut:", yaziMesaji);

        // Mesajı diğer herkese gönder
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(yaziMesaji);
            }
        });
    });
});

console.log('🚀 Sunucu başarıyla çalışıyor! (Çevirmen ve kalkan delici aktif)');