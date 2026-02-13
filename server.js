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

const reviewsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { success: false, error: 'Too many reviews. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
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
        const { name, discord, service, message, coupon, referral } = req.body;
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
            message: message.trim(),
            coupon: coupon ? String(coupon).trim() : undefined,
            referral: referral ? String(referral).trim() : undefined
        };
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const entry = db.addSubmission({ ...clean, ip_address: ip });

        if (clean.coupon) {
            const valid = db.validateCoupon(clean.coupon);
            if (valid && valid.success) db.useCoupon(clean.coupon);
        }

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

// GET /api/reviews — Public approved reviews only
app.get('/api/reviews', (req, res) => {
    try {
        const reviews = db.getReviews(true);
        res.json({ success: true, reviews });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load reviews.' });
    }
});

// POST /api/reviews — Submit a review (rate limited)
app.post('/api/reviews', reviewsLimiter, (req, res) => {
    try {
        const { name, rating, text, service } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Name is required.' });
        }
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Review text is required.' });
        }
        if (text.length > 500) {
            return res.status(400).json({ success: false, error: 'Review text must be 500 characters or less.' });
        }
        const r = Number(rating);
        if (!Number.isInteger(r) || r < 1 || r > 5) {
            return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5.' });
        }
        db.addReview({ name: name.trim(), rating: r, text: text.trim(), service: service ? String(service).trim() : '' });
        res.json({ success: true, message: 'Thank you for your review!' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to submit review.' });
    }
});

// GET /api/portfolio
app.get('/api/portfolio', (req, res) => {
    try {
        const portfolio = db.getPortfolio();
        res.json({ success: true, portfolio });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load portfolio.' });
    }
});

// POST /api/coupon/validate
app.post('/api/coupon/validate', (req, res) => {
    try {
        const { code } = req.body;
        if (!code || String(code).trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Coupon code is required.' });
        }
        const result = db.validateCoupon(String(code).trim());
        if (!result || !result.success) {
            return res.status(400).json({ success: false, error: result && result.error ? result.error : 'Invalid or expired coupon.' });
        }
        res.json({ success: true, discount_percent: result.discount_percent });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to validate coupon.' });
    }
});

// GET /api/changelog
app.get('/api/changelog', (req, res) => {
    try {
        const changelog = db.getChangelog(30);
        res.json({ success: true, changelog });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load changelog.' });
    }
});

// GET /api/ticket/:id — Public ticket status lookup
app.get('/api/ticket/:id', (req, res) => {
    try {
        const sub = db.getSubmission(req.params.id);
        if (!sub) {
            return res.status(404).json({ success: false, error: 'Ticket not found. Please check your ticket number.' });
        }
        // Return public-safe info (no message body, internal notes, discord, or IP)
        res.json({
            success: true,
            ticket: {
                id: sub.id,
                name: sub.name,
                service: serviceNames[sub.service] || sub.service,
                status: sub.status,
                client_message: sub.client_message || null,
                status_history: sub.status_history || [],
                messages: sub.messages || [],
                files: sub.files || [],
                priority: sub.priority || false,
                created_at: sub.created_at,
                updated_at: sub.updated_at || sub.created_at
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to look up ticket.' });
    }
});

// GET /api/ticket/:id/messages — Public: get chat messages for a ticket
app.get('/api/ticket/:id/messages', (req, res) => {
    try {
        const sub = db.getSubmission(req.params.id);
        if (!sub) {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }
        const messages = db.getMessages(req.params.id) || [];
        res.json({ success: true, messages });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load messages.' });
    }
});

// POST /api/ticket/:id/messages — Public: client sends a chat message
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many messages. Slow down a bit.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.post('/api/ticket/:id/messages', chatLimiter, (req, res) => {
    try {
        const sub = db.getSubmission(req.params.id);
        if (!sub) {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }
        const { text } = req.body;
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
        }
        if (text.length > 1000) {
            return res.status(400).json({ success: false, error: 'Message too long (max 1000 characters).' });
        }
        const msg = db.addMessage(req.params.id, { sender: 'client', text });
        sendDiscordChatAlert(req.params.id, sub.name, text);
        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

// POST /api/admin/submissions/:id/messages — Admin sends a chat message
app.post('/api/admin/submissions/:id/messages', adminAuth, (req, res) => {
    try {
        const sub = db.getSubmission(req.params.id);
        if (!sub) {
            return res.status(404).json({ success: false, error: 'Submission not found.' });
        }
        const { text } = req.body;
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
        }
        const msg = db.addMessage(req.params.id, { sender: 'admin', text });
        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to send message.' });
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
  <url><loc>${baseUrl}/reviews</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>${baseUrl}/changelog</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>
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
        const sub = db.getSubmission(req.params.id);
        if (!sub) return res.status(404).json({ success: false, error: 'Not found.' });
        const oldStatus = sub.status;
        const updated = db.updateSubmission(req.params.id, req.body);
        if (!updated) return res.status(404).json({ success: false, error: 'Not found.' });
        if (req.body.status !== undefined && String(req.body.status) !== String(oldStatus)) {
            sendStatusChangeEmail(updated.id, updated.name, req.body.status, updated.client_message);
        }
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

// Reviews Admin
app.get('/api/admin/reviews', adminAuth, (req, res) => {
    try {
        const reviews = db.getReviews(false);
        res.json({ success: true, reviews });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load reviews.' });
    }
});

app.patch('/api/admin/reviews/:id/approve', adminAuth, (req, res) => {
    try {
        const updated = db.approveReview(req.params.id);
        if (!updated) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true, review: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to approve review.' });
    }
});

app.delete('/api/admin/reviews/:id', adminAuth, (req, res) => {
    try {
        const deleted = db.deleteReview(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete review.' });
    }
});

// Portfolio Admin
app.post('/api/admin/portfolio', adminAuth, (req, res) => {
    try {
        const { title, description, image_url, tags } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, error: 'Title is required.' });
        }
        const item = db.addPortfolio({ title, description: description || '', image_url: image_url || '', tags: tags || [] });
        res.json({ success: true, item });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to add portfolio item.' });
    }
});

app.delete('/api/admin/portfolio/:id', adminAuth, (req, res) => {
    try {
        const deleted = db.deletePortfolio(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete portfolio item.' });
    }
});

// Coupons Admin
app.get('/api/admin/coupons', adminAuth, (req, res) => {
    try {
        const coupons = db.getCoupons();
        res.json({ success: true, coupons });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load coupons.' });
    }
});

app.post('/api/admin/coupons', adminAuth, (req, res) => {
    try {
        const { code, discount_percent, max_uses } = req.body;
        if (!code || String(code).trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Code is required.' });
        }
        if (discount_percent === undefined || discount_percent === null || Number(discount_percent) < 0) {
            return res.status(400).json({ success: false, error: 'Discount percent is required and must be 0 or greater.' });
        }
        const item = db.addCoupon({ code: String(code).trim(), discount_percent: Number(discount_percent), max_uses: max_uses != null ? parseInt(max_uses) : null });
        res.json({ success: true, coupon: item });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to add coupon.' });
    }
});

app.patch('/api/admin/coupons/:id/toggle', adminAuth, (req, res) => {
    try {
        const updated = db.toggleCoupon(req.params.id);
        if (!updated) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true, coupon: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to toggle coupon.' });
    }
});

app.delete('/api/admin/coupons/:id', adminAuth, (req, res) => {
    try {
        const deleted = db.deleteCoupon(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete coupon.' });
    }
});

// Changelog Admin
app.get('/api/admin/changelog', adminAuth, (req, res) => {
    try {
        const changelog = db.getChangelog(100);
        res.json({ success: true, changelog });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to load changelog.' });
    }
});

app.post('/api/admin/changelog', adminAuth, (req, res) => {
    try {
        const { title, content, type } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required.' });
        }
        const entry = db.addChangelog({ title, content, type: type || 'general' });
        res.json({ success: true, entry });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to add changelog entry.' });
    }
});

app.delete('/api/admin/changelog/:id', adminAuth, (req, res) => {
    try {
        const deleted = db.deleteChangelog(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete changelog entry.' });
    }
});

// Analytics
app.get('/api/admin/analytics', adminAuth, (req, res) => {
    try {
        const analytics = db.getAnalytics();
        res.json({ success: true, analytics });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch analytics.' });
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
            color: 0x6C63FF,
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

async function sendDiscordChatAlert(ticketId, clientName, text) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;
    const payload = {
        username: 'JAZEY Bot',
        avatar_url: 'https://i.imgur.com/AfFp7pu.png',
        embeds: [{
            title: 'New client message',
            color: 0x00D4FF,
            fields: [
                { name: 'Ticket', value: `#${ticketId}`, inline: true },
                { name: 'Client', value: clientName || 'Unknown', inline: true },
                { name: 'Message', value: text.substring(0, 1024) }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'JAZEY Development' }
        }]
    };
    try {
        await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (err) {
        console.error('  [DISCORD] Chat alert error:', err.message);
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
                    <h2 style="color:#6C63FF;margin-bottom:16px;">New Project Inquiry #${id}</h2>
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

async function sendStatusChangeEmail(ticketId, clientName, newStatus, clientMessage) {
    if (!resend || !process.env.NOTIFICATION_EMAIL) return;
    try {
        await resend.emails.send({
            from: 'JAZEY <onboarding@resend.dev>',
            to: [process.env.NOTIFICATION_EMAIL],
            subject: `Ticket #${ticketId} — Status changed to ${newStatus}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:12px;">
                    <h2 style="color:#6C63FF;margin-bottom:16px;">Ticket #${ticketId} — Status updated</h2>
                    <p><strong>Client:</strong> ${clientName || '—'}</p>
                    <p><strong>New status:</strong> ${newStatus}</p>
                    ${clientMessage ? `<p><strong>Original message:</strong></p><p style="background:#1a1a2e;padding:12px;border-radius:8px;">${clientMessage}</p>` : ''}
                    <hr style="border-color:#333;margin:20px 0;">
                    <p style="color:#888;font-size:12px;">JAZEY Development — jazey.dev</p>
                </div>
            `
        });
        console.log(`  [EMAIL] Status change notification sent for #${ticketId}`);
    } catch (err) {
        console.error('  [EMAIL] Status change failed:', err.message);
    }
}

// ── Serve Pages ───────────────────────────────
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/ticket', (req, res) => {
    res.sendFile(path.join(__dirname, 'ticket.html'));
});

app.get('/reviews', (req, res) => {
    res.sendFile(path.join(__dirname, 'reviews.html'));
});

app.get('/changelog', (req, res) => {
    res.sendFile(path.join(__dirname, 'changelog.html'));
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
