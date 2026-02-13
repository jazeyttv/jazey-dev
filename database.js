// ============================================
// JAZEY — Simple JSON File Database
// Zero dependencies, just works.
// ============================================

const fs = require('fs');
const path = require('path');

class JsonDatabase {
    constructor(filepath) {
        this.filepath = filepath;
        this.data = {
            submissions: [],
            pageViews: [],
            blogPosts: [],
            nextId: 1,
            nextBlogId: 1,
            reviews: [],
            nextReviewId: 1,
            portfolio: [],
            nextPortfolioId: 1,
            coupons: [],
            nextCouponId: 1,
            changelog: [],
            nextChangelogId: 1
        };
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
                // Migrate: ensure reviews array and counter exist
                if (!this.data.reviews) this.data.reviews = [];
                if (!this.data.nextReviewId) this.data.nextReviewId = 1;
                // Migrate: ensure portfolio array and counter exist
                if (!this.data.portfolio) this.data.portfolio = [];
                if (!this.data.nextPortfolioId) this.data.nextPortfolioId = 1;
                // Migrate: ensure coupons array and counter exist
                if (!this.data.coupons) this.data.coupons = [];
                if (!this.data.nextCouponId) this.data.nextCouponId = 1;
                // Migrate: ensure changelog array and counter exist
                if (!this.data.changelog) this.data.changelog = [];
                if (!this.data.nextChangelogId) this.data.nextChangelogId = 1;
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
            coupon: submission.coupon != null ? submission.coupon : null,
            referral: submission.referral != null ? submission.referral : null,
            priority: submission.priority === true,
            files: Array.isArray(submission.files) ? submission.files : [],
            status: 'new',
            notes: '',
            messages: [],
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
        if (updates.priority !== undefined) {
            sub.priority = updates.priority;
        }
        if (updates.files !== undefined) {
            sub.files = Array.isArray(updates.files) ? updates.files : (sub.files || []);
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

    // ── Messages (Chat) ────────────────
    addMessage(id, { sender, text }) {
        const index = this.data.submissions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return null;
        const sub = this.data.submissions[index];
        if (!sub.messages) sub.messages = [];
        const msg = {
            id: (sub.messages.length + 1),
            sender, // 'client' or 'admin'
            text: text.trim(),
            timestamp: new Date().toISOString()
        };
        sub.messages.push(msg);
        sub.updated_at = new Date().toISOString();
        this.save();
        return msg;
    }

    getMessages(id) {
        const sub = this.data.submissions.find(s => s.id === parseInt(id));
        if (!sub) return null;
        return sub.messages || [];
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
    // view may include: url, user_agent, referrer, referral_code, etc.
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

    // ── Reviews ─────────────────────────
    addReview({ name, rating, text, service }) {
        const id = this.data.nextReviewId++;
        const entry = {
            id,
            name: name || '',
            rating: rating != null ? rating : 0,
            text: text || '',
            service: service || '',
            approved: false,
            created_at: new Date().toISOString()
        };
        this.data.reviews.unshift(entry);
        this.save();
        return entry;
    }

    getReviews(approvedOnly = true) {
        let list = [...this.data.reviews];
        if (approvedOnly) {
            list = list.filter(r => r.approved === true);
        }
        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return list;
    }

    approveReview(id) {
        const index = this.data.reviews.findIndex(r => r.id === parseInt(id));
        if (index === -1) return null;
        this.data.reviews[index].approved = true;
        this.save();
        return this.data.reviews[index];
    }

    deleteReview(id) {
        const index = this.data.reviews.findIndex(r => r.id === parseInt(id));
        if (index === -1) return false;
        this.data.reviews.splice(index, 1);
        this.save();
        return true;
    }

    // ── Portfolio ───────────────────────
    addPortfolio({ title, description, image_url, tags }) {
        const id = this.data.nextPortfolioId++;
        const entry = {
            id,
            title: title || '',
            description: description || '',
            image_url: image_url || '',
            tags: Array.isArray(tags) ? tags : [],
            created_at: new Date().toISOString()
        };
        this.data.portfolio.unshift(entry);
        this.save();
        return entry;
    }

    getPortfolio() {
        return [...this.data.portfolio];
    }

    deletePortfolio(id) {
        const index = this.data.portfolio.findIndex(p => p.id === parseInt(id));
        if (index === -1) return false;
        this.data.portfolio.splice(index, 1);
        this.save();
        return true;
    }

    // ── Coupons ─────────────────────────
    addCoupon({ code, discount_percent, max_uses }) {
        const id = this.data.nextCouponId++;
        const entry = {
            id,
            code: (code || '').trim(),
            discount_percent: discount_percent != null ? discount_percent : 0,
            max_uses: max_uses != null ? max_uses : 0,
            uses: 0,
            active: true,
            created_at: new Date().toISOString()
        };
        this.data.coupons.push(entry);
        this.save();
        return entry;
    }

    getCoupons() {
        return [...this.data.coupons];
    }

    validateCoupon(code) {
        const c = (code || '').trim().toLowerCase();
        const coupon = this.data.coupons.find(
            x => (x.code || '').toLowerCase() === c && x.active && (x.uses || 0) < (x.max_uses || 0)
        );
        return coupon || null;
    }

    useCoupon(code) {
        const coupon = this.validateCoupon(code);
        if (!coupon) return null;
        coupon.uses = (coupon.uses || 0) + 1;
        this.save();
        return coupon;
    }

    toggleCoupon(id) {
        const index = this.data.coupons.findIndex(c => c.id === parseInt(id));
        if (index === -1) return null;
        this.data.coupons[index].active = !this.data.coupons[index].active;
        this.save();
        return this.data.coupons[index];
    }

    deleteCoupon(id) {
        const index = this.data.coupons.findIndex(c => c.id === parseInt(id));
        if (index === -1) return false;
        this.data.coupons.splice(index, 1);
        this.save();
        return true;
    }

    // ── Changelog ──────────────────────
    addChangelog({ title, content, type }) {
        const id = this.data.nextChangelogId++;
        const entry = {
            id,
            title: title || '',
            content: content || '',
            type: type === 'feature' || type === 'improvement' || type === 'fix' ? type : 'improvement',
            created_at: new Date().toISOString()
        };
        this.data.changelog.unshift(entry);
        this.save();
        return entry;
    }

    getChangelog(limit = 50) {
        const list = [...this.data.changelog];
        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return list.slice(0, limit);
    }

    deleteChangelog(id) {
        const index = this.data.changelog.findIndex(c => c.id === parseInt(id));
        if (index === -1) return false;
        this.data.changelog.splice(index, 1);
        this.save();
        return true;
    }

    // ── Analytics ───────────────────────
    getAnalytics() {
        const views = this.data.pageViews || [];
        const now = new Date();

        // Referrer breakdown (top 10) — use referrer or referral_code
        const referrerCounts = {};
        views.forEach(v => {
            const key = (v.referrer || v.referral_code || 'direct').toString().trim() || 'direct';
            referrerCounts[key] = (referrerCounts[key] || 0) + 1;
        });
        const referrerBreakdown = Object.entries(referrerCounts)
            .map(([referrer, count]) => ({ referrer, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Browser breakdown from user_agent
        const browserCounts = { Chrome: 0, Firefox: 0, Safari: 0, Edge: 0, Other: 0 };
        views.forEach(v => {
            const ua = (v.user_agent || '').toLowerCase();
            if (ua.includes('edg/') || ua.includes('edge')) browserCounts.Edge++;
            else if (ua.includes('chrome') && !ua.includes('edg')) browserCounts.Chrome++;
            else if (ua.includes('firefox') || ua.includes('fxios')) browserCounts.Firefox++;
            else if (ua.includes('safari') && !ua.includes('chrome')) browserCounts.Safari++;
            else browserCounts.Other++;
        });
        const browserBreakdown = Object.entries(browserCounts).map(([browser, count]) => ({ browser, count }));

        // Device breakdown (mobile vs desktop)
        const deviceCounts = { mobile: 0, desktop: 0 };
        views.forEach(v => {
            const ua = (v.user_agent || '').toLowerCase();
            const mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
            if (mobile) deviceCounts.mobile++;
            else deviceCounts.desktop++;
        });
        const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({ device, count }));

        // Hourly traffic (24 array, index = hour 0–23)
        const hourlyTraffic = Array(24).fill(0);
        views.forEach(v => {
            const d = v.created_at ? new Date(v.created_at) : null;
            if (d && !isNaN(d.getTime())) {
                const h = d.getHours();
                hourlyTraffic[h]++;
            }
        });

        // Views by day (last 30 days)
        const viewsByDay = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const count = views.filter(v => (v.created_at || '').startsWith(dateStr)).length;
            viewsByDay.push({ date: dateStr, count });
        }

        return {
            referrerBreakdown,
            browserBreakdown,
            deviceBreakdown,
            hourlyTraffic,
            viewsByDay
        };
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

        const totalReviews = (this.data.reviews || []).length;
        const totalPortfolio = (this.data.portfolio || []).length;
        const activeCoupons = (this.data.coupons || []).filter(c => c.active).length;
        const totalChangelog = (this.data.changelog || []).length;

        return {
            totalSubmissions: subs.length,
            newSubmissions: subs.filter(s => s.status === 'new').length,
            reviewing: subs.filter(s => s.status === 'reviewing').length,
            inProgress: subs.filter(s => s.status === 'in-progress').length,
            testing: subs.filter(s => s.status === 'testing').length,
            completed: subs.filter(s => s.status === 'completed').length,
            todayViews,
            totalViews,
            recentSubmissions: subs.slice(0, 5),
            byService,
            dailySubmissions,
            totalReviews,
            totalPortfolio,
            activeCoupons,
            totalChangelog
        };
    }
}

module.exports = JsonDatabase;
