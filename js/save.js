/* =========================================================
   save.js  —  Auto-save, resume & player statistics
   ========================================================= */
'use strict';

const SaveManager = (() => {

    const GAME_KEY  = 'chenn_game_state';
    const STATS_KEY = 'chenn_stats';

    // ── Statistics ─────────────────────────────────────────
    function loadStats() {
        try {
            return JSON.parse(localStorage.getItem(STATS_KEY)) ||
                   { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
        } catch (_) {
            return { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
        }
    }

    function saveStats(stats) {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    }

    function recordResult(result) {          // result: 'win' | 'loss' | 'draw'
        const s = loadStats();
        s.gamesPlayed++;
        if (result === 'win')   s.wins++;
        else if (result === 'loss') s.losses++;
        else s.draws++;
        saveStats(s);
    }

    function getWinRate() {
        const s = loadStats();
        if (s.gamesPlayed === 0) return '–';
        return Math.round((s.wins / s.gamesPlayed) * 100) + '%';
    }

    // ── Game state ─────────────────────────────────────────
    function saveGame(state) {
        try {
            localStorage.setItem(GAME_KEY, JSON.stringify({
                pits: state.pits,
                scores: state.scores,
                currentPlayer: state.currentPlayer,
                mode: state.mode,
                names: state.names,
                timestamp: Date.now()
            }));
        } catch (_) {}
    }

    function loadGame() {
        try {
            const raw = localStorage.getItem(GAME_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            // Discard saves older than 24 h
            if (Date.now() - data.timestamp > 86400000) {
                clearGame();
                return null;
            }
            return data;
        } catch (_) {
            return null;
        }
    }

    function clearGame() {
        localStorage.removeItem(GAME_KEY);
    }

    function hasSavedGame() {
        return !!loadGame();
    }

    return { saveGame, loadGame, clearGame, hasSavedGame, loadStats, recordResult, getWinRate };
})();

window.SaveManager = SaveManager;
