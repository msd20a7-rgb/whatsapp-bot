const express = require('express');
const path = require('path');
const fs = require('fs');

/**
 * Unified Messaging Service supporting both wwebjs (Unofficial) and Twilio (Official TwiML)
 */
class MessagingService {
    constructor() {
        this.wwebClient = null;
        this.twilioClient = null;
        this.expressApp = null;
        this.mode = process.env.BOT_MODE || 'wwebjs'; // 'wwebjs' | 'twilio' | 'hybrid'
        this.port = process.env.PORT || 3000;
        this.baseUrl = process.env.SERVER_BASE_URL || `http://localhost:${this.port}`;
        this.messageHandler = null;
    }

    /**
     * Registers the unified message processor callback
     * @param {Function} handler - function(msgContext)
     */
    onMessage(handler) {
        this.messageHandler = handler;
    }

    /**
     * Escapes special characters for XML TwiML responses
     */
    escapeXml(text) {
        return (text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Initializes Express Web Server (handles Twilio TwiML webhooks & serving PDF media URLs)
     */
    initExpressServer() {
        this.expressApp = express();
        this.expressApp.use(express.urlencoded({ extended: true }));
        this.expressApp.use(express.json());

        // Serve generated PDFs statically so Twilio can fetch mediaUrl
        const pdfDir = path.join(__dirname, '../public/pdfs');
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }
        // Lightweight Keep-Alive Ping Endpoints for cron-job.org
        this.expressApp.get('/ping', (req, res) => res.status(200).send('OK'));
        this.expressApp.get('/health', (req, res) => res.status(200).send('OK'));

        // Twilio Webhook Endpoint using native TwiML HTTP responses (Bypasses ContentSid restriction)
        this.expressApp.post('/webhook/twilio', async (req, res) => {
            const twilioBody = req.body;
            const from = twilioBody.From;
            const to = twilioBody.To;
            const body = twilioBody.Body || '';

            console.log(`📩 [TWILIO INCOMING] From: ${from} | Body: "${body}"`);

            let twimlReplyText = '';
            let twimlMediaUrl = '';

            const msgContext = {
                provider: 'twilio',
                from: from,
                to: to,
                body: body,
                isGroup: false,
                fromMe: false,
                reply: async (text) => {
                    twimlReplyText = text;
                },
                sendMedia: async ({ filePath, filename, caption }) => {
                    const fileBasename = filename || path.basename(filePath);
                    const publicPath = path.join(pdfDir, fileBasename);
                    fs.copyFileSync(filePath, publicPath);

                    twimlMediaUrl = `${this.baseUrl}/pdfs/${fileBasename}`;
                    twimlReplyText = caption || '';
                    console.log(`📤 [TWILIO OUTGOING MEDIA VIA TWIML] Media URL: ${twimlMediaUrl}`);
                }
            };

            // Pass to unified message handler
            if (this.messageHandler) {
                try {
                    await this.messageHandler(msgContext);
                } catch (err) {
                    console.error('Error handling Twilio message:', err);
                }
            }

            // Build TwiML Response
            res.type('text/xml');
            if (twimlMediaUrl) {
                const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>${this.escapeXml(twimlReplyText)}</Body>
        <Media>${this.escapeXml(twimlMediaUrl)}</Media>
    </Message>
</Response>`;
                console.log(`📤 [TWILIO TWIML REPLY WITH MEDIA] Sent TwiML XML`);
                return res.send(xml);
            } else if (twimlReplyText) {
                const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>${this.escapeXml(twimlReplyText)}</Body>
    </Message>
</Response>`;
                console.log(`📤 [TWILIO TWIML REPLY] Sent text TwiML XML: "${twimlReplyText}"`);
                return res.send(xml);
            } else {
                return res.send('<Response></Response>');
            }
        });

        this.expressApp.listen(this.port, '0.0.0.0', () => {
            console.log(`🌐 Webhook & PDF server running on port ${this.port} (Base URL: ${this.baseUrl})`);
        });
    }

    /**
     * Initializes Twilio SDK Client
     */
    initTwilio() {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        if (sid && token && sid !== 'your_twilio_account_sid_here') {
            const twilio = require('twilio');
            this.twilioClient = twilio(sid, token);
            console.log('✅ Twilio WhatsApp Provider initialized!');
        }
    }
}

module.exports = new MessagingService();
