// ============================================
// JAZEY — Elite FiveM Development
// Frontend Script v2.0
// ============================================

(function() {
    'use strict';

    // ══════════════════════════════════════
    // LOADING SCREEN
    // ══════════════════════════════════════
    const loader = document.getElementById('loader');
    const minLoadTime = 1500;
    const loadStart = Date.now();

    window.addEventListener('load', () => {
        const elapsed = Date.now() - loadStart;
        const remaining = Math.max(0, minLoadTime - elapsed);
        setTimeout(() => {
            if (loader) loader.classList.add('hidden');
        }, remaining);
    });

    // ══════════════════════════════════════
    // DARK / LIGHT MODE TOGGLE
    // ══════════════════════════════════════
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const saved = localStorage.getItem('jazey_theme');

    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.className = 'fas fa-sun';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('jazey_theme', next);
            if (themeIcon) themeIcon.className = next === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        });
    }

    // ══════════════════════════════════════
    // PARTICLES
    // ══════════════════════════════════════
    const canvas = document.getElementById('particles');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouseX = 0, mouseY = 0;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

        function createParticles() {
            const count = Math.min(window.innerWidth / 15, 80);
            particles = [];
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * 1.5 + 0.5,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    alpha: Math.random() * 0.4 + 0.1
                });
            }
        }

        createParticles();

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                const dx = mouseX - p.x;
                const dy = mouseY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200) {
                    p.x -= dx * 0.005;
                    p.y -= dy * 0.005;
                }
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 107, 53, ${p.alpha})`;
                ctx.fill();
            });

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(255, 107, 53, ${0.06 * (1 - dist / 120)})`;
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(animateParticles);
        }

        animateParticles();
    }

    // ══════════════════════════════════════
    // FIRE CURSOR TRAIL
    // ══════════════════════════════════════
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isTouchDevice && !prefersReducedMotion) {
        const trailCount = 10;
        const trailDots = [];
        const positions = [];

        for (let i = 0; i < trailCount; i++) {
            const dot = document.createElement('div');
            dot.classList.add('trail-dot');
            const size = Math.max(3, 14 - i * 1.2);
            const opacity = Math.max(0.1, 0.7 - i * 0.07);
            const hue = Math.round(20 + i * 4); // orange to red
            dot.style.width = size + 'px';
            dot.style.height = size + 'px';
            dot.style.background = `radial-gradient(circle, hsla(${hue}, 100%, 55%, ${opacity}), hsla(${hue - 10}, 100%, 40%, ${opacity * 0.4}))`;
            dot.style.boxShadow = `0 0 ${size}px hsla(${hue}, 100%, 55%, ${opacity * 0.5})`;
            document.body.appendChild(dot);
            trailDots.push(dot);
            positions.push({ x: -100, y: -100 });
        }

        let trailX = -100, trailY = -100;

        document.addEventListener('mousemove', (e) => {
            trailX = e.clientX;
            trailY = e.clientY;
        });

        function animateTrail() {
            positions[0].x += (trailX - positions[0].x) * 0.35;
            positions[0].y += (trailY - positions[0].y) * 0.35;

            for (let i = 1; i < trailCount; i++) {
                positions[i].x += (positions[i - 1].x - positions[i].x) * (0.3 - i * 0.015);
                positions[i].y += (positions[i - 1].y - positions[i].y) * (0.3 - i * 0.015);
            }

            for (let i = 0; i < trailCount; i++) {
                const size = parseFloat(trailDots[i].style.width);
                trailDots[i].style.left = (positions[i].x - size / 2) + 'px';
                trailDots[i].style.top = (positions[i].y - size / 2) + 'px';
            }

            requestAnimationFrame(animateTrail);
        }

        animateTrail();
    }

    // ══════════════════════════════════════
    // HOVER SOUND EFFECTS
    // ══════════════════════════════════════
    if (!prefersReducedMotion) {
        let audioCtx = null;

        function playHoverSound() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800 + Math.random() * 400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        }

        // Attach to buttons and nav links after a small delay to ensure DOM is ready
        setTimeout(() => {
            document.querySelectorAll('.btn, .nav-link, .nav-link-cta').forEach(el => {
                el.addEventListener('mouseenter', playHoverSound);
            });
        }, 100);
    }

    // ══════════════════════════════════════
    // NAVIGATION
    // ══════════════════════════════════════
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    window.addEventListener('scroll', () => {
        if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navLinks.classList.toggle('open');
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navLinks.classList.remove('open');
            });
        });
    }

    // Active link highlight on scroll
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY + 100;
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            const link = document.querySelector(`.nav-link[href="#${id}"]`);
            if (link) {
                link.classList.toggle('active', scrollY >= top && scrollY < top + height);
            }
        });
    });

    // ══════════════════════════════════════
    // SCROLL ANIMATIONS
    // ══════════════════════════════════════
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.delay || 0;
                setTimeout(() => entry.target.classList.add('visible'), parseInt(delay));
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.animate-on-scroll').forEach(el => scrollObserver.observe(el));

    // ══════════════════════════════════════
    // STAT COUNTERS
    // ══════════════════════════════════════
    const counters = document.querySelectorAll('.stat-number[data-target]');
    let countersDone = false;

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !countersDone) {
                countersDone = true;
                counters.forEach(counter => {
                    const target = parseInt(counter.dataset.target);
                    let current = 0;
                    const increment = target / 60;
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            counter.textContent = target;
                            clearInterval(timer);
                        } else {
                            counter.textContent = Math.floor(current);
                        }
                    }, 30);
                });
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(c => counterObserver.observe(c));

    // ══════════════════════════════════════
    // CODE TYPING EFFECT
    // ══════════════════════════════════════
    const codeBody = document.querySelector('.code-body pre code');
    if (codeBody) {
        const originalHTML = codeBody.innerHTML;
        const codeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    codeBody.style.opacity = '0';
                    setTimeout(() => {
                        codeBody.style.opacity = '1';
                        codeBody.style.transition = 'opacity 0.5s';
                    }, 300);
                    codeObserver.disconnect();
                }
            });
        }, { threshold: 0.3 });
        codeObserver.observe(codeBody);
    }

    // ══════════════════════════════════════
    // FAQ ACCORDION
    // ══════════════════════════════════════
    document.querySelectorAll('.faq-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.parentElement;
            const isOpen = item.classList.contains('active');
            // Close all
            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
            // Open clicked (if wasn't already open)
            if (!isOpen) item.classList.add('active');
        });
    });

    // ══════════════════════════════════════
    // BLOG / UPDATES FETCH
    // ══════════════════════════════════════
    const blogGrid = document.getElementById('blogGrid');

    async function loadBlogPosts() {
        try {
            const res = await fetch('/api/blog');
            const data = await res.json();
            if (data.success && data.posts && data.posts.length > 0) {
                const posts = data.posts.slice(0, 3);
                blogGrid.innerHTML = posts.map(post => {
                    const date = new Date(post.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                    });
                    const excerpt = post.content.length > 150
                        ? post.content.substring(0, 150) + '...'
                        : post.content;
                    const tagsHtml = (post.tags || []).map(t =>
                        `<span>${t}</span>`
                    ).join('');
                    return `
                        <div class="blog-card animate-on-scroll visible">
                            <div class="blog-card-date">${date}</div>
                            <h3>${escapeHtml(post.title)}</h3>
                            <p>${escapeHtml(excerpt)}</p>
                            ${tagsHtml ? `<div class="blog-card-tags">${tagsHtml}</div>` : ''}
                        </div>
                    `;
                }).join('');
            }
        } catch (e) {
            // Silent — blog is optional
        }
    }

    if (blogGrid) loadBlogPosts();

    // ══════════════════════════════════════
    // DISCORD STATUS WIDGET
    // ══════════════════════════════════════
    const discordWidget = document.getElementById('discordWidget');
    const discordCount = document.getElementById('discordCount');
    const discordWidgetLink = document.getElementById('discordWidgetLink');

    async function fetchDiscordStatus() {
        try {
            const res = await fetch('/api/discord-status');
            const data = await res.json();
            if (data.success && discordWidget) {
                discordWidget.style.display = 'block';
                if (discordCount) discordCount.textContent = data.presence_count || 0;
                if (discordWidgetLink && data.invite) {
                    discordWidgetLink.href = data.invite;
                }
            }
        } catch (e) {
            // Silent — widget is optional
        }
    }

    fetchDiscordStatus();
    setInterval(fetchDiscordStatus, 60000);

    // ══════════════════════════════════════
    // CONTACT FORM
    // ══════════════════════════════════════
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            const originalContent = btn.innerHTML;

            const formData = {
                name: document.getElementById('name').value.trim(),
                discord: document.getElementById('discord').value.trim(),
                service: document.getElementById('service').value,
                message: document.getElementById('message').value.trim()
            };

            if (!formData.name || !formData.discord || !formData.service || !formData.message) {
                showNotification('Please fill out all fields.', 'error');
                return;
            }

            btn.innerHTML = '<span>Sending...</span><i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const data = await response.json();

                if (data.success) {
                    const ticketId = data.ticketId;
                    btn.innerHTML = '<span>Message Sent!</span><i class="fas fa-check"></i>';
                    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    showNotification(`Ticket #${ticketId} created! Track it at /ticket`, 'success');
                    contactForm.reset();

                    // Show ticket ID banner above the form
                    let banner = document.getElementById('ticketBanner');
                    if (!banner) {
                        banner = document.createElement('div');
                        banner.id = 'ticketBanner';
                        banner.style.cssText = 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;animation:fadeInUp 0.5s ease;';
                        contactForm.parentElement.insertBefore(banner, contactForm);
                    }
                    banner.innerHTML = `<p style="color:#10b981;font-weight:600;margin-bottom:4px;">Your ticket number is <strong>#${ticketId}</strong></p><p style="color:var(--text-secondary);font-size:0.85rem;">Save this number! <a href="/ticket?id=${ticketId}" style="color:#FF6B35;text-decoration:underline;">Track your ticket here</a></p>`;

                    setTimeout(() => {
                        btn.innerHTML = originalContent;
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 3000);
                } else {
                    throw new Error(data.error || 'Something went wrong');
                }
            } catch (err) {
                btn.innerHTML = '<span>Failed — Try Again</span><i class="fas fa-times"></i>';
                btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                showNotification(err.message || 'Failed to send. Please try again.', 'error');
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            }
        });
    }

    // ══════════════════════════════════════
    // NOTIFICATION TOAST
    // ══════════════════════════════════════
    function showNotification(message, type = 'success') {
        let toast = document.querySelector('.notification-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'notification-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `notification-toast ${type}`;
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // ══════════════════════════════════════
    // PAGE VIEW TRACKING
    // ══════════════════════════════════════
    try {
        fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                page: window.location.pathname,
                referrer: document.referrer || ''
            })
        });
    } catch (e) {
        // Silent
    }

    // ══════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
