// ============================================
// JAZEY — Elite FiveM Development
// Premium Interactive Script
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // === Particle System ===
    const canvas = document.getElementById('particles');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: 0, y: 0 };

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.5 + 0.1;
            this.opacityDir = Math.random() > 0.5 ? 0.002 : -0.002;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.opacity += this.opacityDir;

            if (this.opacity <= 0.05 || this.opacity >= 0.6) {
                this.opacityDir *= -1;
            }

            // Mouse interaction
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                this.x -= dx * 0.01;
                this.y -= dy * 0.01;
            }

            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                this.reset();
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 107, 53, ${this.opacity})`;
            ctx.fill();
        }
    }

    // Create particles
    const particleCount = Math.min(80, Math.floor(window.innerWidth / 20));
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function connectParticles() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 107, 53, ${0.03 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        connectParticles();
        requestAnimationFrame(animateParticles);
    }
    animateParticles();

    // === Mouse Tracking ===
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;

        const glow = document.getElementById('cursorGlow');
        if (glow) {
            glow.style.left = e.clientX + 'px';
            glow.style.top = e.clientY + 'px';
        }
    });

    // === Navbar Scroll Effect ===
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });

    // === Active Nav Link on Scroll ===
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link:not(.nav-link-cta)');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.pageYOffset >= sectionTop) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    });

    // === Mobile Nav Toggle ===
    const navToggle = document.getElementById('navToggle');
    const navLinksEl = document.getElementById('navLinks');

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinksEl.classList.toggle('open');
    });

    // Close mobile nav on link click
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinksEl.classList.remove('open');
        });
    });

    // === Scroll Animations ===
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.getAttribute('data-delay') || 0;
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, parseInt(delay));
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // === Counter Animation ===
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counters = entry.target.querySelectorAll('.stat-number');
                counters.forEach(counter => {
                    const target = parseInt(counter.getAttribute('data-target'));
                    const duration = 2000;
                    const startTime = performance.now();

                    function updateCounter(currentTime) {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // Easing function
                        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                        const current = Math.floor(easeOutQuart * target);
                        
                        counter.textContent = current;

                        if (progress < 1) {
                            requestAnimationFrame(updateCounter);
                        } else {
                            counter.textContent = target;
                        }
                    }
                    requestAnimationFrame(updateCounter);
                });
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        counterObserver.observe(statsSection);
    }

    // === Smooth Scroll for Anchor Links ===
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // === Contact Form (connected to backend API) ===
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const btn = this.querySelector('button[type="submit"]');
            const originalContent = btn.innerHTML;
            
            // Gather form data
            const formData = {
                name: document.getElementById('name').value.trim(),
                discord: document.getElementById('discord').value.trim(),
                service: document.getElementById('service').value,
                message: document.getElementById('message').value.trim()
            };

            // Validate
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
                    btn.innerHTML = '<span>Message Sent!</span><i class="fas fa-check"></i>';
                    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    showNotification('Message sent! We\'ll get back to you soon.', 'success');
                    contactForm.reset();
                    
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

    // === Notification Toast ===
    function showNotification(message, type = 'success') {
        // Remove existing notification
        const existing = document.querySelector('.notification-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `notification-toast notification-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        // Style it
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '14px 24px',
            background: type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${type === 'success' ? '#10b981' : '#ef4444'}`,
            borderRadius: '12px',
            color: '#fff',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: '9999',
            backdropFilter: 'blur(20px)',
            transform: 'translateY(20px)',
            opacity: '0',
            transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        });

        document.body.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateY(20px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // === Track Page View ===
    try {
        fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                page: window.location.pathname,
                referrer: document.referrer
            })
        });
    } catch (e) { /* silent */ }

    // === Tilt Effect on Cards ===
    document.querySelectorAll('.service-card, .work-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    // === Typing Effect for Code Window ===
    const codeBody = document.querySelector('.code-body code');
    if (codeBody) {
        const codeContent = codeBody.innerHTML;
        codeBody.innerHTML = '';
        let charIndex = 0;
        let isCodeVisible = false;

        const codeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !isCodeVisible) {
                    isCodeVisible = true;
                    typeCode();
                    codeObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        codeObserver.observe(document.querySelector('.code-window'));

        function typeCode() {
            if (charIndex < codeContent.length) {
                // Handle HTML tags - add them instantly
                if (codeContent[charIndex] === '<') {
                    const closingTag = codeContent.indexOf('>', charIndex);
                    codeBody.innerHTML += codeContent.substring(charIndex, closingTag + 1);
                    charIndex = closingTag + 1;
                    typeCode();
                } else {
                    codeBody.innerHTML += codeContent[charIndex];
                    charIndex++;
                    setTimeout(typeCode, 8 + Math.random() * 15);
                }
            }
        }
    }

    // === Page Load Complete ===
    document.body.classList.add('loaded');
    console.log('%c🔥 JAZEY Development', 'font-size: 24px; font-weight: bold; color: #FF6B35;');
    console.log('%cElite FiveM Development', 'font-size: 14px; color: #FF3366;');
});
