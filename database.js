// ============================================
// JAZEY — Simple JSON File Database
// Zero dependencies, just works.
// ============================================

const fs = require('fs');
const path = require('path');

class JsonDatabase {
    constructor(filepath) {
        this.filepath = filepath;
        this.data = { submissions: [], pageViews: [], nextId: 1 };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filepath)) {
                const raw = fs.readFileSync(this.filepath, 'utf8');
                this.data = JSON.parse(raw);
            } else {
                this.save();
            }
        } catch (err) {
            console.error('[DB] Failed to load database, starting fresh:', err.message);
            this.save();
        }
    }

    save() {
        try {
            const dir = path.dirname(this.filepath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (err) {
            console.error('[DB] Failed to save database:', err.message);
        }
    }

    // ── Submissions ─────────────────────
    addSubmission(submission) {
        const id = this.data.nextId++;
        const entry = {
            id,
            ...submission,
            status: 'new',
            notes: '',
            created_at: new Date().toISOString()
        };
        this.data.submissions.unshift(entry); // newest first
        this.save();
        return entry;
    }

    getSubmissions({ status, search, limit = 50, offset = 0 } = {}) {
        let results = [...this.data.submissions];

        if (status && status !== 'all') {
            results = results.filter(s => s.status === status);
        }

        if (search) {
            const q = search.toLowerCase();
            results = results.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.discord.toLowerCase().includes(q) ||
                s.message.toLowerCase().includes(q)
            );
        }

        const total = results.length;
        results = results.slice(offset, offset + limit);

        return { submissions: results, total };
    }

    getSubmission(id) {
        return this.data.submissions.find(s => s.id === parseInt(id));
    }

    updateSubmission(id, updates) {
        const index = this.data.submissions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return null;

        if (updates.status !== undefined) {
            this.data.submissions[index].status = updates.status;
        }
        if (updates.notes !== undefined) {
            this.data.submissions[index].notes = updates.notes;
        }

        this.save();
        return this.data.submissions[index];
    }

    deleteSubmission(id) {
        const index = this.data.submissions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return false;
        this.data.submissions.splice(index, 1);
        this.save();
        return true;
    }

    // ── Page Views ──────────────────────
    addPageView(view) {
        this.data.pageViews.push({
            ...view,
            created_at: new Date().toISOString()
        });

        // Keep only last 10,000 views to prevent file bloat
        if (this.data.pageViews.length > 10000) {
            this.data.pageViews = this.data.pageViews.slice(-10000);
        }

        this.save();
    }

    // ── Stats ───────────────────────────
    getStats() {
        const subs = this.data.submissions;
        const today = new Date().toISOString().split('T')[0];

        const todayViews = this.data.pageViews.filter(v =>
            v.created_at.startsWith(today)
        ).length;

        const totalViews = this.data.pageViews.length;

        // Submissions by service
        const serviceCounts = {};
        subs.forEach(s => {
            serviceCounts[s.service] = (serviceCounts[s.service] || 0) + 1;
        });
        const byService = Object.entries(serviceCounts).map(([service, count]) => ({ service, count }))
            .sort((a, b) => b.count - a.count);

        // Daily submissions (last 7 days)
        const dailySubmissions = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const count = subs.filter(s => s.created_at.startsWith(dateStr)).length;
            dailySubmissions.push({ date: dateStr, count });
        }

        return {
            totalSubmissions: subs.length,
            newSubmissions: subs.filter(s => s.status === 'new').length,
            inProgress: subs.filter(s => s.status === 'in-progress').length,
            completed: subs.filter(s => s.status === 'completed').length,
            todayViews,
            totalViews,
            recentSubmissions: subs.slice(0, 5),
            byService,
            dailySubmissions
        };
    }
}

module.exports = JsonDatabase;
