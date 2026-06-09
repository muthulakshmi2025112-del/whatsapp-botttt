const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const MESSAGES_FILE = './messages_to_send.json';

console.log('========================================');
console.log('🚀 WhatsApp Auto Sender');
console.log('========================================\n');

// Check messages
if (!fs.existsSync(MESSAGES_FILE)) {
    console.log('❌ No messages found! Waiting for messages...');
    // Don't exit - keep waiting
    process.exit(0);
}

let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));

if (messages.length === 0) {
    console.log('❌ No messages to send');
    process.exit(0);
}

console.log(`✅ Loaded ${messages.length} messages\n`);

// Create client with Chrome path for Render
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    }
});

// QR Code handler
client.on('qr', (qr) => {
    console.log('\n📱 SCAN THIS QR CODE WITH YOUR PHONE:');
    console.log('Open WhatsApp → Settings → Linked Devices → Link a Device\n');
    qrcode.generate(qr, { small: true });
    console.log('\n⏳ Waiting for scan...\n');
});

client.on('authenticated', () => {
    console.log('✅ Authenticated! Session saved.\n');
});

client.on('ready', async () => {
    console.log('✅ WhatsApp READY!');
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
    
    try {
        fs.unlinkSync(MESSAGES_FILE);
        console.log('🧹 Messages file cleared');
    } catch(e) {}
    
    await new Promise(r => setTimeout(r, 2000));
    client.destroy();
    process.exit(0);
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
    process.exit(1);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Disconnected:', reason);
    process.exit(0);
});

console.log('🔄 Starting WhatsApp client...\n');
client.initialize();