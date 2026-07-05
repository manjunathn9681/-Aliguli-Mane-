/* =========================================================
   ui.js  —  DOM UI manager
   ========================================================= */
'use strict';

class UIManager {
    constructor() {
        this.els = {
            screens: {
                splash: document.getElementById('screen-splash'),
                mode: document.getElementById('screen-mode'),
                game: document.getElementById('screen-game'),
                pause: document.getElementById('modal-pause'),
                rules: document.getElementById('modal-rules'),
                settings: document.getElementById('modal-settings'),
                win: document.getElementById('modal-win')
            },
            hud: {
                p1Score: document.getElementById('hud-p1-score'),
                p2Score: document.getElementById('hud-p2-score'),
                p1Name: document.getElementById('hud-p1-name'),
                p2Name: document.getElementById('hud-p2-name'),
                turnMsg: document.getElementById('hud-turn-msg'),
                statusMsg: document.getElementById('hud-status-msg')
            },
            stats: {
                played: document.getElementById('stat-played'),
                wins: document.getElementById('stat-wins'),
                losses: document.getElementById('stat-losses'),
                rate: document.getElementById('stat-rate')
            }
        };

        this.updateStats();
        this.applyLanguage();
    }

    // ── Screen Management ────────────────────────────────────
    showScreen(name) {
        Object.values(this.els.screens).forEach(el => {
            if(el) el.classList.remove('active');
        });
        if (this.els.screens[name]) {
            this.els.screens[name].classList.add('active');
        }
    }
    
    hideModals() {
        ['pause', 'rules', 'settings', 'win'].forEach(m => {
            if (this.els.screens[m]) this.els.screens[m].classList.remove('active');
        });
    }

    // ── HUD Updates ──────────────────────────────────────────
    updateHUD(game, mode) {
        this.els.hud.p1Score.textContent = game.scores[0];
        this.els.hud.p2Score.textContent = game.scores[1];
        
        // Names
        this.els.hud.p1Name.textContent = Settings.t('player1');
        if (mode === 'local') {
            this.els.hud.p2Name.textContent = Settings.t('player2');
        } else {
            this.els.hud.p2Name.textContent = Settings.t('computer') + ` (${Settings.t(mode)})`;
        }

        // Active player highlight
        document.getElementById('hud-p1').classList.toggle('active-player', game.currentPlayer === 0);
        document.getElementById('hud-p2').classList.toggle('active-player', game.currentPlayer === 1);
        
        // Turn message
        if (game.currentPlayer === 0) {
            this.els.hud.turnMsg.textContent = Settings.t('yourTurn');
        } else {
            this.els.hud.turnMsg.textContent = mode === 'local' ? Settings.t('player2') + ' ' + Settings.t('yourTurn') : Settings.t('computer') + '...';
        }
    }
    
    setStatus(msg) {
        if (!msg) {
            this.els.hud.statusMsg.style.opacity = '0';
            return;
        }
        this.els.hud.statusMsg.textContent = msg;
        this.els.hud.statusMsg.style.opacity = '1';
    }

    // ── Win Screen ───────────────────────────────────────────
    showWinScreen(game, mode) {
        this.hideModals();
        const modal = this.els.screens.win;
        modal.classList.add('active');
        
        const title = document.getElementById('win-title');
        const p1s = document.getElementById('win-p1-score');
        const p2s = document.getElementById('win-p2-score');
        
        p1s.textContent = game.scores[0];
        p2s.textContent = game.scores[1];
        
        if (game.winner === 'draw') {
            title.textContent = Settings.t('draw');
        } else {
            let winnerName = '';
            if (game.winner === 0) winnerName = Settings.t('player1');
            else winnerName = mode === 'local' ? Settings.t('player2') : Settings.t('computer');
            
            title.textContent = winnerName + ' ' + Settings.t('wins');
        }
    }

    // ── Settings & Stats ─────────────────────────────────────
    updateStats() {
        const s = SaveManager.loadStats();
        if (this.els.stats.played) this.els.stats.played.textContent = s.gamesPlayed;
        if (this.els.stats.wins) this.els.stats.wins.textContent = s.wins;
        if (this.els.stats.losses) this.els.stats.losses.textContent = s.losses;
        if (this.els.stats.rate) this.els.stats.rate.textContent = SaveManager.getWinRate();
    }
    
    applySettingsToUI() {
        // Toggles
        document.getElementById('btn-lang').textContent = Settings.get('language') === 'en' ? 'EN / ಕನ್' : 'ಕನ್ / EN';
        document.getElementById('btn-theme').textContent = Settings.t(Settings.get('theme'));
        document.getElementById('btn-haptic').textContent = Settings.get('haptics') ? Settings.t('on') : Settings.t('off');
        
        // Sliders
        document.getElementById('slide-music').value = Settings.get('musicVolume');
        document.getElementById('slide-sfx').value = Settings.get('sfxVolume');
        
        // Theme application
        document.body.className = Settings.get('theme');
        
        this.applyLanguage();
    }
    
    applyLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = Settings.t(key);
        });
        
        // Special case for rules content
        const rulesContent = Settings.t('rulesContent');
        const rulesContainer = document.getElementById('rules-content-body');
        if (rulesContainer && Array.isArray(rulesContent)) {
            rulesContainer.innerHTML = '';
            rulesContent.forEach(r => {
                const h = document.createElement('h3');
                h.textContent = r.h;
                const p = document.createElement('p');
                p.textContent = r.p;
                rulesContainer.appendChild(h);
                rulesContainer.appendChild(p);
            });
        }
    }
}

window.UIManager = UIManager;
