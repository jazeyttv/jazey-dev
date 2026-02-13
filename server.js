// ============================================
// JAZEY — Elite FiveM Development
// Backend Server v2.0
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

// ── Resend (email) — lazy loaded ──────────────
let resend = null;
if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
}

// ── Middleware ─────────────────────────────────
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiters
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Too many submissions. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many login attempts.' }
});

// Admin auth middleware
function adminAuth(req, res, next) {
    const username = req.headers['x-admin-username'] || req.query.username;
    const password = req.headers['x-admin-password'] || req.query.password;
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

const serviceNames = {
    'server-build': 'Full Server Build',
    'custom-script': 'Custom Script',
    'ui-design': 'UI/UX Design',
    'optimization': 'Performance Optimization',
    'security': 'Anti-Cheat & Security',
    'other': 'Other'
};

// ══════════════════════════════════════════════
// PUBLIC API ROUTES
// ══════════════════════════════════════════════

// POST /api/contact
app.post('/api/contact', contactLimiter, (req, res) => {
    try {
        const { name, discord, service, message } = req.body;
        if (!name || !discord || !service || !message) {
            return res.status(400).json({ success: false, error: 'All fields are required.' });
        }
        if (name.length > 100 || discord.length > 100 || message.length > 2000) {
            return res.status(400).json({ success: false, error: 'Input too long.' });
        }

        const clean = {
            name: name.trim(),
            discord: discord.trim(),
            service: service.trim(),
            message: message.trim()
        };
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const entry = db.addSubmission({ ...clean, ip_address: ip });

        sendDiscordWebhook(clean, entry.id);
        sendEmailNotification(clean, entry.id);

        console.log(`  [NEW] #${entry.id} — ${clean.name} (${clean.discord}) — ${serviceNames[clean.service] || clean.service}`);

        res.json({ success: true, ticketId: entry.id, message: 'Your message has been sent! We\'ll get back to you soon.' });
    } catch (err) {
        console.error('  [ERROR]', err);
        res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
    }
});

// POST /api/track
app.post('/api/track', (req, res) => {
    try {
        const { page, referrer } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || '';
        db.addPageView({ page: page || '/', referrer: referrer || '', user_agent: userAgent, ip_address: ip });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// GET /api/blog — Public blog posts
app.get('/api/blog', (req, res) => {
    try {
        const posts = db.getBlogPosts(20);
        res.json({ success: true, posts });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load posts.' });
    }
});

// GET /api/ticket/:id — Public ticket status lookup
app.get('/api/ticket/:id', (req, res) => {
    try {
        const sub = db.getSubmission(req.params.id);
        if (!sub) {
            return res.status(404).json({ success: false, error: 'Ticket not found. Please check your ticket number.' });
        }
        // Return only public-safe info (no message content, notes, discord, or IP)
        res.json({
            success: true,
            ticket: {
                id: sub.id,
                name: sub.name,
                service: serviceNames[sub.service] || sub.service,
                status: sub.status,
                created_at: sub.created_at
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to look up ticket.' });
    }
});

// GET /api/discord-status — Proxy Discord widget API
app.get('/api/discord-status', async (req, res) => {
    const serverId = process.env.DISCORD_SERVER_ID;
    if (!serverId) {
        return res.json({ success: false, error: 'No server ID configured.' });
    }
    try {
        const response = await fetch(`https://discord.com/api/guilds/${serverId}/widget.json`);
        if (!response.ok) {
            return res.json({ success: false, error: 'Widget not available.' });
        }
        const data = await response.json();
        res.json({
            success: true,
            name: data.name,
            presence_count: data.presence_count,
            invite: data.instant_invite
        });
    } catch (err) {
        res.json({ success: false, error: 'Failed to fetch Discord status.' });
    }
});

// GET /sitemap.xml
app.get('/sitemap.xml', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/#services</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/#work</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/#pricing</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/#contact</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

// ══════════════════════════════════════════════
// ADMIN API ROUTES
// ══════════════════════════════════════════════

app.post('/api/admin/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }
});

app.get('/api/admin/submissions', adminAuth, (req, res) => {
    try {
        const { status, search, limit = 50, offset = 0 } = req.query;
        const result = db.getSubmissions({ status, search, limit: parseInt(limit), offset: parseInt(offset) });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch submissions.' });
    }
});

app.patch('/api/admin/submissions/:id', adminAuth, (req, res) => {
    try {
        const updated = db.updateSubmission(req.params.id, req.body);
        if (!updated) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true, submission: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to update.' });
    }
});

app.delete('/api/admin/submissions/:id', adminAuth, (req, res) => {
    try {
        const deleted = db.deleteSubmission(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete.' });
    }
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
    try {
        const stats = db.getStats();
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
    }
});

// CSV Export
app.get('/api/admin/export-csv', adminAuth, (req, res) => {
    try {
        const subs = db.getAllSubmissions();
        const header = 'ID,Name,Discord,Service,Message,Status,Notes,Date\n';
        const rows = subs.map(s => {
            const msg = `"${(s.message || '').replace(/"/g, '""')}"`;
            const notes = `"${(s.notes || '').replace(/"/g, '""')}"`;
            return `${s.id},"${s.name}","${s.discord}","${serviceNames[s.service] || s.service}",${msg},"${s.status}",${notes},"${s.created_at}"`;
        }).join('\n');
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename="jazey-submissions.csv"');
        res.send(header + rows);
    } catch (err) {
        res.status(500).json({ success: false, error: 'Export failed.' });
    }
});

// Blog Admin
app.get('/api/admin/blog', adminAuth, (req, res) => {
    try {
        const posts = db.getBlogPosts(100);
        res.json({ success: true, posts });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load posts.' });
    }
});

app.post('/api/admin/blog', adminAuth, (req, res) => {
    try {
        const { title, content, tags } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required.' });
        }
        const post = db.addBlogPost({ title, content, tags: tags || [] });
        res.json({ success: true, post });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to create post.' });
    }
});

app.delete('/api/admin/blog/:id', adminAuth, (req, res) => {
    try {
        const deleted = db.deleteBlogPost(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete post.' });
    }
});

// ══════════════════════════════════════════════
// DISCORD WEBHOOK
// ══════════════════════════════════════════════
async function sendDiscordWebhook(data, id) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;
    const serviceName = serviceNames[data.service] || data.service;
    const payload = {
        username: 'JAZEY Bot',
        avatar_url: 'https://i.imgur.com/AfFp7pu.png',
        embeds: [{
            title: 'New Project Inquiry!',
            color: 0xFF6B35,
            fields: [
                { name: 'Name', value: data.name, inline: true },
                { name: 'Discord', value: data.discord, inline: true },
                { name: 'Service', value: serviceName, inline: true },
                { name: 'Message', value: data.message.substring(0, 1024) },
                { name: 'Ticket', value: `#${id}`, inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'JAZEY Development' }
        }]
    };
    try {
        await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (err) {
        console.error('  [DISCORD] Webhook error:', err.message);
    }
}

// ══════════════════════════════════════════════
// EMAIL NOTIFICATION (Resend)
// ══════════════════════════════════════════════
async function sendEmailNotification(data, id) {
    if (!resend || !process.env.NOTIFICATION_EMAIL) return;
    const serviceName = serviceNames[data.service] || data.service;
    try {
        await resend.emails.send({
            from: 'JAZEY <onboarding@resend.dev>',
            to: [process.env.NOTIFICATION_EMAIL],
            subject: `New Inquiry #${id} — ${data.name} (${serviceName})`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:12px;">
                    <h2 style="color:#FF6B35;margin-bottom:16px;">New Project Inquiry #${id}</h2>
                    <p><strong>Name:</strong> ${data.name}</p>
                    <p><strong>Discord:</strong> ${data.discord}</p>
                    <p><strong>Service:</strong> ${serviceName}</p>
                    <p><strong>Message:</strong></p>
                    <p style="background:#1a1a2e;padding:12px;border-radius:8px;">${data.message}</p>
                    <hr style="border-color:#333;margin:20px 0;">
                    <p style="color:#888;font-size:12px;">JAZEY Development — jazey.dev</p>
                </div>
            `
        });
        console.log(`  [EMAIL] Notification sent for #${id}`);
    } catch (err) {
        console.error('  [EMAIL] Failed:', err.message);
    }
}

// ── Serve Pages ───────────────────────────────
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/ticket', (req, res) => {
    res.sendFile(path.join(__dirname, 'ticket.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║     JAZEY Development Server v2.0        ║');
    console.log(`  ║   Running on port ${PORT}                     ║`);
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`  [DB]      JSON database ready`);
    console.log(`  [WEBHOOK] Discord: ${process.env.DISCORD_WEBHOOK_URL ? 'Configured' : 'Not set'}`);
    console.log(`  [EMAIL]   Resend: ${process.env.RESEND_API_KEY ? 'Configured' : 'Not set'}`);
    console.log(`  [DISCORD] Widget: ${process.env.DISCORD_SERVER_ID ? 'Configured' : 'Not set'}`);
    console.log('');
});
