/* =========================================================
   stones.js  —  Three.js seed sprites & layout sim
   ========================================================= */
'use strict';

class StonesManager {
    constructor(scene, board) {
        this.scene = scene;
        this.board = board;
        this.stones = [];
        this.pitContents = Array.from({ length: 14 }, () => []);
        this.lastPickUpPos = new THREE.Vector3(0, 0, 0);

        this._buildSeedMaterials();

        // Instantiate 56 seeds (sprites)
        for (let i = 0; i < 56; i++) {
            // Player 1 (pits 0-6) gets Blue seeds, Player 2 gets Green
            const mat = (i < 28) ? this.seedMatBlue : this.seedMatGreen;
            const sprite = new THREE.Sprite(mat);
            
            // Adjust scale of the sprite
            sprite.scale.set(0.4, 0.4, 1);
            
            sprite.userData.id = i;
            sprite.userData.state = 'idle'; // idle, moving, captured, in-hand
            sprite.userData.owner = (i < 28) ? 0 : 1;

            this.board.group.add(sprite);
            this.stones.push(sprite);
        }

        this.reset();
    }

    // ── Seed Sprites (Canvas 2D Oval) ────────────────────────
    _buildSeedMaterials() {
        const createOvalTexture = (color) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            // Draw a neat glowing oval
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(64, 64, 24, 40, 0, 0, Math.PI * 2);
            ctx.fill();

            // Inner core
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.ellipse(64, 64, 10, 24, 0, 0, Math.PI * 2);
            ctx.fill();

            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        };

        this.seedMatBlue = new THREE.SpriteMaterial({
            map: createOvalTexture('#0088FF'),
            transparent: true,
            depthTest: false // Ensures sprites always draw cleanly on top of the pit
        });
        
        this.seedMatGreen = new THREE.SpriteMaterial({
            map: createOvalTexture('#00FF66'),
            transparent: true,
            depthTest: false
        });
    }

    // ── Reset & Layout ───────────────────────────────────────
    reset() {
        this.pitContents.forEach(p => p.length = 0);
        
        // Put 4 stones in each pit (maintaining original owner distribution)
        let p1Idx = 0;
        let p2Idx = 28;
        
        for (let pit = 0; pit < 14; pit++) {
            for (let i = 0; i < 4; i++) {
                const isP1 = pit < 7;
                const s = this.stones[isP1 ? p1Idx++ : p2Idx++];
                s.userData.pit = pit;
                s.userData.state = 'idle';
                s.visible = true;
                this.pitContents[pit].push(s);
            }
            this._rearrangePit(pit, true); // instant snap
        }
    }

    // Arranges seeds neatly inside the pit based on count
    _rearrangePit(pitIndex, instant = false) {
        const stones = this.pitContents[pitIndex];
        const count = stones.length;
        if (count === 0) return;

        const pitPos = this.board.pitPositions[pitIndex];
        const yOffset = pitPos.y + 0.1; // sit slightly above the pit bottom

        // Layout geometries
        const layout = [];
        const scale = 0.22; // distance scale between seeds

        if (count === 1) {
            layout.push({ x: 0, z: 0 });
        } else if (count === 2) {
            layout.push({ x: -scale, z: 0 }, { x: scale, z: 0 });
        } else if (count === 3) {
            const h = scale * Math.sqrt(3) / 2;
            layout.push(
                { x: 0, z: -h },
                { x: -scale, z: h },
                { x: scale, z: h }
            );
        } else if (count === 4) {
            layout.push(
                { x: -scale, z: -scale }, { x: scale, z: -scale },
                { x: -scale, z: scale }, { x: scale, z: scale }
            );
        } else if (count === 5) {
            layout.push(
                { x: 0, z: 0 },
                { x: -scale*1.2, z: -scale*1.2 }, { x: scale*1.2, z: -scale*1.2 },
                { x: -scale*1.2, z: scale*1.2 }, { x: scale*1.2, z: scale*1.2 }
            );
        } else {
            // Circular rings for 6+
            layout.push({ x: 0, z: 0 }); // center
            let ring = 1;
            let added = 1;
            while (added < count) {
                const itemsInRing = Math.min(count - added, ring * 6);
                const r = ring * scale * 1.3;
                for (let i = 0; i < itemsInRing; i++) {
                    const angle = (i / itemsInRing) * Math.PI * 2;
                    layout.push({
                        x: Math.cos(angle) * r,
                        z: Math.sin(angle) * r
                    });
                }
                added += itemsInRing;
                ring++;
            }
        }

        // Apply layout
        stones.forEach((s, i) => {
            if (i >= layout.length) return; // safety
            const pos = layout[i];
            const targetX = pitPos.x + pos.x;
            const targetZ = pitPos.z + pos.z;
            const targetY = yOffset + (i * 0.001); // tiny layering offset to prevent z-fighting

            if (instant) {
                s.position.set(targetX, targetY, targetZ);
            } else {
                // Smoothly slide into place
                this._animateStone(s, {
                    x: targetX, y: targetY, z: targetZ, duration: 0.25
                });
            }
        });
    }

    // ── Update Board State (from Undo/Reset) ─────────────────
    syncWithGameState(game) {
        this.pitContents.forEach(p => p.length = 0);
        let p1Idx = 0;
        let p2Idx = 28;

        for (let pit = 0; pit < 14; pit++) {
            const count = game.pits[pit];
            for (let i = 0; i < count; i++) {
                // Prefer placing original colored seeds on their side, but fallback if necessary
                const isP1 = pit < 7;
                let s;
                if (isP1 && p1Idx < 28) s = this.stones[p1Idx++];
                else if (!isP1 && p2Idx < 56) s = this.stones[p2Idx++];
                else if (p1Idx < 28) s = this.stones[p1Idx++];
                else s = this.stones[p2Idx++];
                
                s.userData.pit = pit;
                s.userData.state = 'idle';
                s.visible = true;
                this.pitContents[pit].push(s);
            }
            this._rearrangePit(pit, true);
        }

        // Remaining are captured
        while (p1Idx < 28) {
            const s = this.stones[p1Idx++];
            s.userData.state = 'captured';
            s.visible = false;
            s.position.set(0, -10, 0); 
        }
        while (p2Idx < 56) {
            const s = this.stones[p2Idx++];
            s.userData.state = 'captured';
            s.visible = false;
            s.position.set(0, -10, 0); 
        }
    }

    // ── Animation Simulation ───────────────────────
    
    // Pick up stones from a pit — Hide them as they enter the "hand"
    pickUp(pitIndex) {
        const stones = [...this.pitContents[pitIndex]];
        this.pitContents[pitIndex].length = 0;
        this.lastPickUpPos.copy(this.board.pitPositions[pitIndex]);
        
        stones.forEach((s) => {
            s.userData.state = 'in-hand';
            s.visible = false; // Hide from board while in hand
            // Reset position to center of pit for when it arcs out later
            s.position.set(this.lastPickUpPos.x, this.lastPickUpPos.y + 0.1, this.lastPickUpPos.z);
        });
        
        return stones;
    }

    // Sow one stone into a pit — Animate arc from last pick-up pos
    sowOne(stone, pitIndex) {
        this.pitContents[pitIndex].push(stone);
        stone.userData.pit = pitIndex;
        stone.visible = true; // Reveal it for the arc
        
        const count = this.pitContents[pitIndex].length;
        const pitPos = this.board.pitPositions[pitIndex];
        
        // Target center roughly, then rearrange cleanly on land
        const tx = pitPos.x;
        const tz = pitPos.z;
        const ty = pitPos.y + 0.1;

        // If it was in hand, start from hand position. If not, from its current pos.
        if (stone.userData.state === 'in-hand') {
            stone.position.set(this.lastPickUpPos.x, this.lastPickUpPos.y + 0.5, this.lastPickUpPos.z);
        }
        
        this._animateStoneArc(stone, tx, ty, tz, 0.35, () => {
            // Once landed, nicely rearrange the whole pit
            this._rearrangePit(pitIndex, false);
            // Update last pickup pos to this pit for the next seed in the chain
            this.lastPickUpPos.copy(pitPos);
        });
    }

    // Capture stones from a pit
    capture(pitIndex, playerIndex) {
        const stones = [...this.pitContents[pitIndex]];
        this.pitContents[pitIndex].length = 0;
        
        const targetX = 0;
        const targetZ = playerIndex === 0 ? 4 : -4;
        const targetY = 0.5;
        
        stones.forEach((s, i) => {
            s.userData.state = 'captured';
            s.visible = true;
            this._animateStoneArc(s, targetX + (Math.random()-0.5)*2, targetY, targetZ + (Math.random()-0.5), 0.5 + (i * 0.05), () => {
                s.visible = false; // Hide after animation finishes
                s.position.set(0, -10, 0); 
            });
        });
        
        return stones;
    }
    
    // Custom simple linear/ease animation
    _animateStone(stone, { x, y, z, duration, onComplete }) {
        const startX = stone.position.x;
        const startY = stone.position.y;
        const startZ = stone.position.z;
        
        let t = 0;
        const update = () => {
            t += 1 / (duration * 60); 
            if (t >= 1) {
                stone.position.set(x, y, z);
                if (stone.userData.state !== 'captured' && stone.userData.state !== 'in-hand') {
                    stone.userData.state = 'idle';
                }
                if (onComplete) onComplete();
                return;
            }
            const ease = t * (2 - t); // ease out quad
            stone.position.set(
                startX + (x - startX) * ease,
                startY + (y - startY) * ease,
                startZ + (z - startZ) * ease
            );
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
    
    // Arc animation (parabola)
    _animateStoneArc(stone, x, y, z, duration, onComplete) {
        const startX = stone.position.x;
        const startY = stone.position.y;
        const startZ = stone.position.z;
        
        const midY = Math.max(startY, y) + 1.2; // Arc height

        let t = 0;
        const update = () => {
            t += 1 / (duration * 60);
            if (t >= 1) {
                stone.position.set(x, y, z);
                if (stone.userData.state !== 'captured' && stone.userData.state !== 'in-hand') {
                    stone.userData.state = 'idle';
                }
                if (onComplete) onComplete();
                return;
            }
            
            const px = startX + (x - startX) * t;
            const pz = startZ + (z - startZ) * t;
            
            // Parabola
            const a = 2*startY - 4*midY + 2*y;
            const b = -3*startY + 4*midY - y;
            const c = startY;
            const py = a*t*t + b*t + c;

            stone.position.set(px, py, pz);

            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
}

window.StonesManager = StonesManager;

