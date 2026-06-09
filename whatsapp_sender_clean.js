const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');

const app = express();
const MESSAGES_FILE = './messages_to_send.json';
let currentQR = null;
let isConnected = false;

// Serve static files
app.use(express.static('./'));

// API endpoint to get QR code
app.get('/qr-status', (req, res) => {
    res.json({
        qrCode: currentQR,
        connected: isConnected
    });
});

// API endpoint to refresh QR
app.get('/refresh-qr', (req, res) => {
    currentQR = null;
    res.json({ status: 'refreshing' });
});

// Start web server on port 10000
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📱 Open: https://your-app.onrender.com/qr.html to scan QR`);
});

console.log('========================================');
console.log('🚀 WhatsApp Auto Sender');
console.log('========================================\n');

// Check messages
if (!fs.existsSync(MESSAGES_FILE)) {
    console.log('❌ No messages found! Waiting for messages...');
}

let messages = [];
if (fs.existsSync(MESSAGES_FILE)) {
    messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    console.log(`✅ Loaded ${messages.length} messages\n`);
}

// Create client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

// QR Code handler
client.on('qr', (qr) => {
    currentQR = qr;
    console.log('\n📱 QR Code generated!');
    console.log('Open: https://your-app.onrender.com/qr.html to scan');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('✅ Authenticated! Session saved.\n');
    currentQR = null;
    isConnected = true;
});

client.on('ready', async () => {
    console.log('✅ WhatsApp READY!');
    isConnected = true;
    
    if (messages.length === 0) {
        console.log('📨 No messages to send. Waiting for campaign...');
        return;
    }
    
    console.log(`📨 Sending ${messages.length} messages...\n`);
    
    let sent = 0;
    let failed = 0;
    
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        console.log(`[${i+1}/${messages.length}] Sending to: ${msg.name} (${msg.phone})`);
        
        try {
            let phone = msg.phone.toString().replace(/\D/g, '');
            if (phone.startsWith('0')) phone = phone.substring(1);
            if (phone.length === 10) phone = '91' + phone;
            
            const numberId = `${phone}@c.us`;
            await client.sendMessage(numberId, msg.message);
            console.log(`   ✅ SENT`);
            sent++;
            
        } catch (err) {
            console.log(`   ❌ FAILED: ${err.message}`);
            failed++;
        }
        
        if (i < messages.length - 1) {
            console.log(`   ⏳ Waiting 3 seconds...\n`);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    
    console.log('\n========================================');
    console.log(`📊 COMPLETE! Sent: ${sent}, Failed: ${failed}`);
    console.log('========================================\n');
    
    // Clear messages file
    try {
        fs.unlinkSync(MESSAGES_FILE);
        console.log('🧹 Messages file cleared');
    } catch(e) {}
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Disconnected:', reason);
    isConnected = false;
});

console.log('🔄 Starting WhatsApp client...\n');
client.initialize();
