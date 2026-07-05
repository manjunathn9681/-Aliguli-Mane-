/* =========================================================
   ai.js  —  AI engine: Easy / Medium / Hard
   ========================================================= */
'use strict';

class ChennAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
    }

    // ── Entry point ─────────────────────────────────────────
    getBestMove(game) {
        const moves = game.getValidMoves();
        if (!moves.length) return null;

        switch (this.difficulty) {
            case 'easy':   return this._random(moves);
            case 'medium': return this._greedy(game, moves);
            case 'hard':   return this._minimax(game, moves);
            default:       return this._random(moves);
        }
    }

    // ── Easy — random valid move ────────────────────────────
    _random(moves) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    // ── Medium — maximise immediate captures ────────────────
    _greedy(game, moves) {
        let best = moves[0], bestGain = -Infinity;
        const player = game.currentPlayer;

        for (const m of moves) {
            const sim = game.clone();
            const before = sim.scores[player];
            sim.playMove(m);
            const gain = sim.scores[player] - before;
            if (gain > bestGain) { bestGain = gain; best = m; }
        }
        return best;
    }

    // ── Hard — minimax with alpha-beta pruning (depth 6) ───
    _minimax(game, moves) {
        const player = game.currentPlayer;
        let best = moves[0], bestScore = -Infinity;

        for (const m of moves) {
            const sim = game.clone();
            sim.playMove(m);
            const score = this._ab(sim, 5, -Infinity, Infinity, false, player);
            if (score > bestScore) { bestScore = score; best = m; }
        }
        return best;
    }

    _ab(game, depth, alpha, beta, isMax, origPlayer) {
        if (depth === 0 || game.gameOver) return this._evaluate(game, origPlayer);

        const moves = game.getValidMoves();
        if (!moves.length) return this._evaluate(game, origPlayer);

        if (isMax) {
            let v = -Infinity;
            for (const m of moves) {
                const sim = game.clone();
                sim.playMove(m);
                v = Math.max(v, this._ab(sim, depth - 1, alpha, beta, false, origPlayer));
                alpha = Math.max(alpha, v);
                if (beta <= alpha) break;
            }
            return v;
        } else {
            let v = Infinity;
            for (const m of moves) {
                const sim = game.clone();
                sim.playMove(m);
                v = Math.min(v, this._ab(sim, depth - 1, alpha, beta, true, origPlayer));
                beta = Math.min(beta, v);
                if (beta <= alpha) break;
            }
            return v;
        }
    }

    // Heuristic: score diff + 4-stone threats + mobility
    _evaluate(game, player) {
        const opp = 1 - player;
        let score = game.scores[player] - game.scores[opp];

        // Reward pits close to 4 (threat of capture)
        for (const pit of game.getPlayerPits(player)) {
            if (game.pits[pit] === 3) score += 1.5;
        }
        // Penalise giving opponent near-4 pits
        for (const pit of game.getPlayerPits(opp)) {
            if (game.pits[pit] === 3) score -= 1.0;
        }
        // Mobility bonus
        score += game.getValidMoves(player).length * 0.2;

        return score;
    }
}

window.ChennAI = ChennAI;
