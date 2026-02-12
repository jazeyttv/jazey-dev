# JAZEY — Elite FiveM Development

Premium portfolio & contact backend for FiveM development services.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure (edit .env with your settings)
#    - Set ADMIN_PASSWORD
#    - (Optional) Add DISCORD_WEBHOOK_URL

# 3. Start the server
npm start
```

Then open:
- **Website:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin

## Features

### Frontend
- Premium dark-themed landing page
- Animated particles, gradient orbs, and scroll effects
- 3D tilt cards, typing animation, counter animations
- Contact form connected to backend API
- Fully responsive (mobile / tablet / desktop)

### Backend
- **Express.js** server serving the frontend + API
- **Contact form API** — saves submissions to database
- **Discord webhook** — instant notifications in your Discord server
- **Admin dashboard** — view, filter, search, and manage all submissions
- **Page view tracking** — see how many people visit your site
- **Rate limiting** — prevents spam (5 submissions per 15 min)
- **Security** — Helmet headers, input validation, sanitization

### Admin Dashboard (`/admin`)
- Password-protected login
- Stats overview (total submissions, new, in-progress, page views)
- Full submissions table with search and status filter
- Click any submission to view details, update status, add notes
- Quick status toggle (click the badge to cycle: new → in-progress → completed → cancelled)
- Auto-refreshes every 30 seconds

## Discord Webhook Setup

1. Go to your Discord server → **Server Settings** → **Integrations** → **Webhooks**
2. Click **New Webhook** and choose which channel to post in
3. Copy the webhook URL
4. Paste it into your `.env` file as `DISCORD_WEBHOOK_URL`

Every new form submission will instantly post a rich embed to your Discord channel.

## File Structure

```
jazey/
├── public/           # Frontend (served by Express)
│   ├── index.html    # Main landing page
│   ├── style.css     # Premium dark theme styles
│   └── script.js     # Animations + API integration
├── admin.html        # Admin dashboard
├── server.js         # Express backend
├── database.js       # JSON file database engine
├── data/             # Database storage (auto-created)
│   └── jazey.json    # All submissions + page views
├── .env              # Your configuration (don't commit)
├── .env.example      # Template for .env
├── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/contact` | No | Submit contact form |
| POST | `/api/track` | No | Track page view |
| POST | `/api/admin/login` | No | Verify admin password |
| GET | `/api/admin/submissions` | Yes | List all submissions |
| PATCH | `/api/admin/submissions/:id` | Yes | Update status/notes |
| DELETE | `/api/admin/submissions/:id` | Yes | Delete submission |
| GET | `/api/admin/stats` | Yes | Dashboard statistics |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `ADMIN_PASSWORD` | Yes | — | Password for admin dashboard |
| `DISCORD_WEBHOOK_URL` | No | — | Discord webhook for notifications |

---

**Built by JAZEY** — Custom Code. Clean Systems. Real Results.
