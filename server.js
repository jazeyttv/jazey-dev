// ============================================
// JAZEY — Elite FiveM Development
// Backend Server
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const JsonDatabase = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database Setup ────────────────────────────
const db = new JsonDatabase(path.join(__dirname, 'data', 'jazey.json'));

// ── Middleware ─────────────────────────────────
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (your frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting for contact form
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { success: false, error: 'Too many submissions. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting for admin login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many login attempts.' }
});

// Admin auth middleware (username + password)
function adminAuth(req, res, next) {
    const username = req.headers['x-admin-username'] || req.query.username;
    const password = req.headers['x-admin-password'] || req.query.password;
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

// ── Service Name Mapping ──────────────────────
const serviceNames = {
    'server-build': 'Full Server Build',
    'custom-script': 'Custom Script',
    'ui-design': 'UI/UX Design',
    'optimization': 'Performance Optimization',
    'security': 'Anti-Cheat & Security',
    'other': 'Other'
};

// ── API Routes ────────────────────────────────

// POST /api/contact — Submit contact form
app.post('/api/contact', contactLimiter, (req, res) => {
    try {
        const { name, discord, service, message } = req.body;

        // Validation
        if (!name || !discord || !service || !message) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required.'
            });
        }

        if (name.length > 100 || discord.length > 100 || message.length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Input too long.'
            });
        }

        // Sanitize
        const clean = {
            name: name.trim(),
            discord: discord.trim(),
            service: service.trim(),
            message: message.trim()
        };

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

        // Insert into database
        const entry = db.addSubmission({ ...clean, ip_address: ip });

        // Send Discord webhook
        sendDiscordWebhook(clean, entry.id);

        console.log(`  [NEW] #${entry.id} — ${clean.name} (${clean.discord}) — ${serviceNames[clean.service] || clean.service}`);

        res.json({
            success: true,
            message: 'Your message has been sent! We\'ll get back to you soon.'
        });
    } catch (err) {
        console.error('  [ERROR]', err);
        res.status(500).json({
            success: false,
            error: 'Something went wrong. Please try again.'
        });
    }
});

// POST /api/track — Track page views
app.post('/api/track', (req, res) => {
    try {
        const { page, referrer } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || '';

        db.addPageView({
            page: page || '/',
            referrer: referrer || '',
            user_agent: userAgent,
            ip_address: ip
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// POST /api/admin/login — Verify admin credentials
app.post('/api/admin/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }
});

// GET /api/admin/submissions — Get all submissions
app.get('/api/admin/submissions', adminAuth, (req, res) => {
    try {
        const { status, search, limit = 50, offset = 0 } = req.query;
        const result = db.getSubmissions({
            status,
            search,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('  [ADMIN ERROR]', err);
        res.status(500).json({ success: false, error: 'Failed to fetch submissions.' });
    }
});

// PATCH /api/admin/submissions/:id — Update submission status/notes
app.patch('/api/admin/submissions/:id', adminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const updated = db.updateSubmission(id, { status, notes });
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Not found.' });
        }
        res.json({ success: true, submission: updated });
    } catch (err) {
        console.error('  [UPDATE ERROR]', err);
        res.status(500).json({ success: false, error: 'Failed to update.' });
    }
});

// DELETE /api/admin/submissions/:id — Delete submission
app.delete('/api/admin/submissions/:id', adminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const deleted = db.deleteSubmission(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Not found.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('  [DELETE ERROR]', err);
        res.status(500).json({ success: false, error: 'Failed to delete.' });
    }
});

// GET /api/admin/stats — Dashboard statistics
app.get('/api/admin/stats', adminAuth, (req, res) => {
    try {
        const stats = db.getStats();
        res.json({ success: true, stats });
    } catch (err) {
        console.error('  [STATS ERROR]', err);
        res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
    }
});

// ── Discord Webhook ───────────────────────────
async function sendDiscordWebhook(data, id) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const serviceName = serviceNames[data.service] || data.service;

    const payload = {
        username: 'JAZEY Bot',
        avatar_url: 'https://i.imgur.com/AfFp7pu.png',
        embeds: [{
            title: '🔥 New Project Inquiry!',
            color: 0xFF6B35,
            fields: [
                { name: '👤 Name', value: data.name, inline: true },
                { name: '💬 Discord', value: data.discord, inline: true },
                { name: '🛠️ Service', value: serviceName, inline: true },
                { name: '📝 Message', value: data.message.substring(0, 1024) },
                { name: '🆔 Ticket', value: `#${id}`, inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'JAZEY Development — jazey.dev'
            }
        }]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log(`  [DISCORD] Webhook sent for #${id}`);
        } else {
            console.error(`  [DISCORD] Webhook failed: ${response.status}`);
        }
    } catch (err) {
        console.error('  [DISCORD] Webhook error:', err.message);
    }
}

// ── Serve Admin Dashboard ─────────────────────
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── Fallback to index.html ────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start Server (0.0.0.0 for Render/cloud hosting) ──
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║                                          ║');
    console.log('  ║     🔥 JAZEY Development Server 🔥       ║');
    console.log('  ║                                          ║');
    console.log(`  ║   Running on port ${PORT}                     ║`);
    console.log('  ║                                          ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`  [DB]      JSON database ready (data/jazey.json)`);
    console.log(`  [WEBHOOK] Discord: ${process.env.DISCORD_WEBHOOK_URL ? 'Configured' : 'Not set (optional)'}`);
    console.log('');
});
