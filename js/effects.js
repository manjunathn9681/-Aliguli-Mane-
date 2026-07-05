/* =========================================================
   effects.js  —  Post-processing and UI effects (Confetti)
   ========================================================= */
'use strict';

const EffectsManager = (() => {

    // Simple HTML canvas confetti overlay
    let canvas = null;
    let ctx = null;
    let particles = [];
    let animationId = null;

    function init() {
        if (!document.getElementById('confetti-canvas')) {
            canvas = document.createElement('canvas');
            canvas.id = 'confetti-canvas';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '9999';
            document.body.appendChild(canvas);
            
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();
        }
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function triggerConfetti() {
        init();
        particles = [];
        const colors = ['#FFC700', '#FF0000', '#2E3192', '#41BBC7', '#00A859'];
        
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2 + (Math.random() * 100),
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 1.0) * 20 - 5,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10
            });
        }
        
        if (animationId) cancelAnimationFrame(animationId);
        updateConfetti();
    }

    function updateConfetti() {
        if (!ctx) ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let active = false;
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // gravity
            p.rotation += p.rotSpeed;
            
            if (p.y < canvas.height) active = true;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            ctx.restore();
        });
        
        if (active) {
            animationId = requestAnimationFrame(updateConfetti);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    // UI Floating Score (+X) effect
    function floatingScore(text, x, y) {
        const el = document.createElement('div');
        el.className = 'floating-score';
        el.textContent = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        
        // Remove after animation (matches CSS duration)
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1500);
    }

    return {
        init,
        triggerConfetti,
        floatingScore
    };
})();

window.EffectsManager = EffectsManager;
