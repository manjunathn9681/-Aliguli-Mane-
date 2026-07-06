/* =========================================================
   game.js  —  Pure game-logic engine (no Three.js)
   Pit layout (viewed from above, P1 at bottom):
   
   P2:  [13][12][11][10][ 9][ 8][ 7]   ← top row
   P1:  [ 0][ 1][ 2][ 3][ 4][ 5][ 6]  ← bottom row

   Counter-clockwise sowing: 0→1→…→6→7→8→…→13→0→…
   nextPit(i) = (i + 1) % 14
   ========================================================= */
'use strict';

class ChennGame {
    constructor() {
        this.reset();
    }

    reset() {
        this.pits          = new Array(14).fill(4);   // 4 stones per pit
        this.scores        = [0, 0];                   // [P1, P2]
        this.currentPlayer = 0;                        // 0 = P1, 1 = P2
        this.gameOver      = false;
        this.winner        = null;                     // 0, 1, or 'draw'
        this.history       = [];                       // undo stack
        this.moveCount     = 0;
    }

    // ── Helpers ─────────────────────────────────────────────
    nextPit(pit) { return (pit + 1) % 14; }

    getPlayerPits(player) {
        return player === 0 ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
    }

    ownsPit(player, pit) {
        return player === 0 ? pit <= 6 : pit >= 7;
    }

    getValidMoves(player) {
        if (player === undefined) player = this.currentPlayer;
        return this.getPlayerPits(player).filter(p => this.pits[p] > 0);
    }

    verifyState() {
        return this.getTotalStones() === 56;
    }

    // ── Execute a move — returns array of animation events ─
    playMove(pit) {
        if (this.gameOver)                                 return null;
        if (!this.ownsPit(this.currentPlayer, pit))        return null;
        if (this.pits[pit] === 0)                          return null;

        // Save state for undo (keep max 10)
        this.history.push({
            pits: [...this.pits],
            scores: [...this.scores],
            currentPlayer: this.currentPlayer
        });
        if (this.history.length > 10) this.history.shift();

        const events = [];

        // 1. Pick up all stones
        const stonesPickedUp = this.pits[pit];
        this.pits[pit] = 0;
        events.push({ type: 'pick', pit, count: stonesPickedUp });

        // 2. Sow stones one at a time
        let current  = pit;
        let inHand   = stonesPickedUp;
        let lastPit  = pit;

        while (inHand > 0) {
            current = this.nextPit(current);
            this.pits[current]++;
            inHand--;
            lastPit = current;
            events.push({ type: 'sow', pit: current, count: this.pits[current] });

            // 2a. 4-stones rule: immediate capture if pit reaches exactly 4
            if (this.pits[current] === 4) {
                this.pits[current] = 0;
                this.scores[this.currentPlayer] += 4;
                events.push({
                    type: 'capture4',
                    pit: current,
                    player: this.currentPlayer,
                    score: this.scores[this.currentPlayer]
                });
            }
        }

        // 3. End-of-sow capture rule
        const nextP = this.nextPit(lastPit);
        if (this.pits[nextP] === 0) {
            const afterEmpty = this.nextPit(nextP);
            if (afterEmpty !== pit && this.pits[afterEmpty] > 0) {
                const captured = this.pits[afterEmpty];
                this.pits[afterEmpty] = 0;
                this.scores[this.currentPlayer] += captured;
                events.push({
                    type: 'captureEnd',
                    emptyPit: nextP,
                    pit: afterEmpty,
                    count: captured,
                    player: this.currentPlayer,
                    score: this.scores[this.currentPlayer]
                });
            }
        }

        // 4. Switch turns
        this.currentPlayer = 1 - this.currentPlayer;
        events.push({ type: 'turnSwitch', player: this.currentPlayer });

        // 5. Check game over
        const validMoves = this.getValidMoves(this.currentPlayer);
        if (validMoves.length === 0) {
            // Opponent collects all remaining stones
            const opponent = 1 - this.currentPlayer;
            let remaining = 0;
            for (let i = 0; i < 14; i++) {
                remaining += this.pits[i];
                this.pits[i] = 0;
            }
            this.scores[opponent] += remaining;
            events.push({ type: 'collectRemaining', player: opponent, count: remaining });

            this.gameOver = true;
            if (this.scores[0] > this.scores[1])      this.winner = 0;
            else if (this.scores[1] > this.scores[0]) this.winner = 1;
            else                                       this.winner = 'draw';

            events.push({ type: 'gameOver', winner: this.winner, scores: [...this.scores] });
        }

        // 6. Verify State Consistency
        if (!this.verifyState()) {
            console.error(`[CRITICAL ERROR] Rule violation detected! Total stones != 56. Rolling back move.`);
            this.undo();
            return null;
        }

        console.log(`[Validation] Move accepted. Valid state: ${this.getTotalStones()} stones.`);
        this.moveCount++;
        return events;
    }

    // ── Custom-Mode: interactive sowing API ──────────────────
    // State held between beginCustomMove → placeOneSeed calls → finishCustomMove
    // { active, sourcePit, lastPlacedPit, seedsInHand }

    beginCustomMove(pit) {
        if (this.gameOver)                                return null;
        if (!this.ownsPit(this.currentPlayer, pit))       return null;
        if (this.pits[pit] === 0)                         return null;
        if (this.customTurn && this.customTurn.active)    return null; // already mid-sow

        // Save state for undo
        this.history.push({
            pits:          [...this.pits],
            scores:        [...this.scores],
            currentPlayer: this.currentPlayer
        });
        if (this.history.length > 10) this.history.shift();

        const seedsInHand = this.pits[pit];
        this.pits[pit] = 0;

        this.customTurn = {
            active:         true,
            sourcePit:      pit,
            lastPlacedPit:  pit,
            seedsInHand
        };

        const nextValidPit = this.nextPit(pit);
        return { seedsInHand, nextValidPit };
    }

    // Returns the only valid next pit given where we last placed
    getNextValidPit() {
        if (!this.customTurn || !this.customTurn.active) return -1;
        return this.nextPit(this.customTurn.lastPlacedPit);
    }

    // Place exactly one seed into toPit. Returns result object or null on error.
    placeOneSeed(toPit) {
        if (!this.customTurn || !this.customTurn.active) return null;
        const expected = this.nextPit(this.customTurn.lastPlacedPit);
        if (toPit !== expected) return { ok: false, reason: 'invalid' };

        this.pits[toPit]++;
        this.customTurn.seedsInHand--;
        this.customTurn.lastPlacedPit = toPit;

        const result = { ok: true, seedsRemaining: this.customTurn.seedsInHand, nextValidPit: this.nextPit(toPit) };

        // Immediate 4-stones capture
        if (this.pits[toPit] === 4) {
            this.pits[toPit] = 0;
            this.scores[this.currentPlayer] += 4;
            result.capture4 = {
                type:   'capture4',
                pit:    toPit,
                player: this.currentPlayer,
                count:  4,
                score:  this.scores[this.currentPlayer]
            };
        }

        return result;
    }

    // Call after seedsInHand === 0. Applies end-of-sow capture, switches turn, checks game over.
    finishCustomMove() {
        if (!this.customTurn || !this.customTurn.active) return null;

        const events = [];
        const lastPit = this.customTurn.lastPlacedPit;
        this.customTurn = null; // clear mid-turn state

        // End-of-sow capture rule
        const nextP = this.nextPit(lastPit);
        if (this.pits[nextP] === 0) {
            const afterEmpty = this.nextPit(nextP);
            if (this.pits[afterEmpty] > 0) {
                const captured = this.pits[afterEmpty];
                this.pits[afterEmpty] = 0;
                this.scores[this.currentPlayer] += captured;
                events.push({
                    type:     'captureEnd',
                    emptyPit: nextP,
                    pit:      afterEmpty,
                    count:    captured,
                    player:   this.currentPlayer,
                    score:    this.scores[this.currentPlayer]
                });
            }
        }

        // Switch turns
        this.currentPlayer = 1 - this.currentPlayer;
        events.push({ type: 'turnSwitch', player: this.currentPlayer });
        this.moveCount++;

        // Check game over
        const validMoves = this.getValidMoves(this.currentPlayer);
        if (validMoves.length === 0) {
            const opponent = 1 - this.currentPlayer;
            let remaining = 0;
            for (let i = 0; i < 14; i++) { remaining += this.pits[i]; this.pits[i] = 0; }
            this.scores[opponent] += remaining;
            events.push({ type: 'collectRemaining', player: opponent, count: remaining });
            this.gameOver = true;
            if      (this.scores[0] > this.scores[1]) this.winner = 0;
            else if (this.scores[1] > this.scores[0]) this.winner = 1;
            else                                       this.winner = 'draw';
            events.push({ type: 'gameOver', winner: this.winner, scores: [...this.scores] });
        }

        return events;
    }

    // ── Undo last move ─────────────────────────────────────
    undo() {
        if (this.history.length === 0) return false;
        const state        = this.history.pop();
        this.pits          = state.pits;
        this.scores        = state.scores;
        this.currentPlayer = state.currentPlayer;
        this.gameOver      = false;
        this.winner        = null;
        return true;
    }

    // ── Snapshot for AI ────────────────────────────────────
    clone() {
        const c = new ChennGame();
        c.pits          = [...this.pits];
        c.scores        = [...this.scores];
        c.currentPlayer = this.currentPlayer;
        c.gameOver      = this.gameOver;
        c.winner        = this.winner;
        return c;
    }

    getTotalStones() {
        return this.pits.reduce((a, b) => a + b, 0) +
               this.scores[0] + this.scores[1];
    }
}

window.ChennGame = ChennGame;
