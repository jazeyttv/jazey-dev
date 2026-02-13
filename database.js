// ============================================
// JAZEY — Simple JSON File Database
// Zero dependencies, just works.
// ============================================

const fs = require('fs');
const path = require('path');

class JsonDatabase {
    constructor(filepath) {
        this.filepath = filepath;
        this.data = { submissions: [], pageViews: [], blogPosts: [], nextId: 1, nextBlogId: 1 };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filepath)) {
                const raw = fs.readFileSync(this.filepath, 'utf8');
                this.data = JSON.parse(raw);
                // Migrate: ensure blogPosts array exists
                if (!this.data.blogPosts) this.data.blogPosts = [];
                if (!this.data.nextBlogId) this.data.nextBlogId = 1;
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
        this.data.submissions.unshift(entry);
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

    getAllSubmissions() {
        return [...this.data.submissions];
    }

    getSubmission(id) {
        return this.data.submissions.find(s => s.id === parseInt(id));
    }

    updateSubmission(id, updates) {
        const index = this.data.submissions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return null;

        const sub = this.data.submissions[index];
        const oldStatus = sub.status;

        if (updates.status !== undefined) {
            sub.status = updates.status;
        }
        if (updates.notes !== undefined) {
            sub.notes = updates.notes;
        }
        if (updates.client_message !== undefined) {
            sub.client_message = updates.client_message;
        }

        sub.updated_at = new Date().toISOString();

        // Track status history for the timeline
        if (!sub.status_history) sub.status_history = [];
        if (updates.status && updates.status !== oldStatus) {
            sub.status_history.push({
                status: updates.status,
                timestamp: new Date().toISOString(),
                message: updates.client_message || null
            });
        }

        this.save();
        return sub;
    }

    deleteSubmission(id) {
        const index = this.data.submissions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return false;
        this.data.submissions.splice(index, 1);
        this.save();
        return true;
    }

    // ── Blog Posts ──────────────────────
    addBlogPost({ title, content, tags }) {
        const id = this.data.nextBlogId++;
        const post = {
            id,
            title: title.trim(),
            content: content.trim(),
            tags: tags || [],
            created_at: new Date().toISOString()
        };
        this.data.blogPosts.unshift(post);
        this.save();
        return post;
    }

    getBlogPosts(limit = 50) {
        return this.data.blogPosts.slice(0, limit);
    }

    deleteBlogPost(id) {
        const index = this.data.blogPosts.findIndex(p => p.id === parseInt(id));
        if (index === -1) return false;
        this.data.blogPosts.splice(index, 1);
        this.save();
        return true;
    }

    // ── Page Views ──────────────────────
    addPageView(view) {
        this.data.pageViews.push({
            ...view,
            created_at: new Date().toISOString()
        });

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

        const serviceCounts = {};
        subs.forEach(s => {
            serviceCounts[s.service] = (serviceCounts[s.service] || 0) + 1;
        });
        const byService = Object.entries(serviceCounts).map(([service, count]) => ({ service, count }))
            .sort((a, b) => b.count - a.count);

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
