/* =========================================================
   stones.js  —  Three.js tamarind seed models & physics sim
   ========================================================= */
'use strict';

class StonesManager {
    constructor(scene, board) {
        this.scene = scene;
        this.board = board;
        this.stones = [];
        this.pitContents = Array.from({ length: 14 }, () => []);

        // Reusable geometry and material
        this._buildSeedModel();

        // Instantiate 56 seeds
        for (let i = 0; i < 56; i++) {
            const mesh = new THREE.Mesh(this.seedGeo, this.seedMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Randomize slight scaling to make them look natural
            const sx = 0.95 + Math.random() * 0.1;
            const sy = 0.95 + Math.random() * 0.1;
            const sz = 0.95 + Math.random() * 0.1;
            mesh.scale.set(sx, sy, sz);

            // Give each stone a unique ID
            mesh.userData.id = i;
            mesh.userData.state = 'idle'; // idle, moving, captured

            this.scene.add(mesh);
            this.stones.push(mesh);
        }

        this.reset();
    }

    // ── Seed Model (Tamarind Seed) ───────────────────────────
    _buildSeedModel() {
        // Tamarind seeds are somewhat flattened, squarish/oval
        this.seedGeo = new THREE.SphereGeometry(0.18, 16, 16);
        this.seedGeo.scale(1.0, 0.7, 1.2);

        this.seedMat = new THREE.MeshStandardMaterial({
            color: 0x4A2511, // Dark reddish-brown
            roughness: 0.4,
            metalness: 0.1,
            envMapIntensity: 0.8
        });
    }

    // ── Reset & Layout ───────────────────────────────────────
    reset() {
        // Clear logic state
        this.pitContents.forEach(p => p.length = 0);
        
        // Put 4 stones in each pit
        let stoneIdx = 0;
        for (let pit = 0; pit < 14; pit++) {
            for (let i = 0; i < 4; i++) {
                const s = this.stones[stoneIdx++];
                this._placeStoneInPit(s, pit, i, 4);
            }
        }
    }

    // Helper: arrange stones naturally in a pit
    _placeStoneInPit(stone, pitIndex, stoneIndexInPit, totalInPit) {
        stone.userData.pit = pitIndex;
        stone.userData.state = 'idle';
        this.pitContents[pitIndex].push(stone);

        // Get world pos of pit center
        const pitPos = this.board.getPitWorldPos(pitIndex);
        
        // Distribute stones in a small circle/spiral pattern within the pit
        const radius = 0.25;
        const angle = (stoneIndexInPit / totalInPit) * Math.PI * 2 + Math.random() * 0.5;
        const offsetR = radius * (0.3 + Math.random() * 0.7);
        
        const tx = pitPos.x + Math.cos(angle) * offsetR;
        const tz = pitPos.z + Math.sin(angle) * offsetR;
        
        // Stack height slightly
        const stackLayer = Math.floor(stoneIndexInPit / 4);
        const ty = pitPos.y - 0.2 + (stackLayer * 0.15) + (Math.random() * 0.05);

        // Set pos and random rotation
        stone.position.set(tx, ty, tz);
        stone.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
    }

    // ── Update Board State (from Undo/Reset) ─────────────────
    syncWithGameState(game) {
        // Clear all current logic
        this.pitContents.forEach(p => p.length = 0);
        let stoneIdx = 0;

        // Distribute to pits
        for (let pit = 0; pit < 14; pit++) {
            const count = game.pits[pit];
            for (let i = 0; i < count; i++) {
                if (stoneIdx >= 56) break;
                const s = this.stones[stoneIdx++];
                this._placeStoneInPit(s, pit, i, count);
            }
        }

        // Remaining are captured
        while (stoneIdx < 56) {
            const s = this.stones[stoneIdx++];
            s.userData.state = 'captured';
            // Hide them or move them off-screen (to score area)
            s.position.set(0, -10, 0); 
        }
    }

    // ── Animation / Physics Simulation ───────────────────────
    // To keep it simple and performant, we'll use targeted animations rather than a full physics engine.
    
    // Pick up stones from a pit
    pickUp(pitIndex) {
        const stones = [...this.pitContents[pitIndex]];
        this.pitContents[pitIndex].length = 0;
        
        // Animate them lifting up
        const targetY = this.board.getPitWorldPos(pitIndex).y + 1.5;
        
        stones.forEach((s, i) => {
            s.userData.state = 'moving';
            this._animateStone(s, {
                x: s.position.x,
                y: targetY + (Math.random() * 0.5),
                z: s.position.z,
                duration: 0.3 + (i * 0.05)
            });
        });
        
        return stones;
    }

    // Sow one stone into a pit
    sowOne(stone, pitIndex) {
        this.pitContents[pitIndex].push(stone);
        stone.userData.pit = pitIndex;
        
        const count = this.pitContents[pitIndex].length;
        const pitPos = this.board.getPitWorldPos(pitIndex);
        
        const angle = Math.random() * Math.PI * 2;
        const r = 0.1 + Math.random() * 0.25;
        const tx = pitPos.x + Math.cos(angle) * r;
        const tz = pitPos.z + Math.sin(angle) * r;
        const ty = pitPos.y - 0.2 + (Math.floor(count / 4) * 0.15);

        // Arc trajectory
        this._animateStoneArc(stone, tx, ty, tz, 0.4);
    }

    // Capture stones from a pit
    capture(pitIndex, playerIndex) {
        const stones = [...this.pitContents[pitIndex]];
        this.pitContents[pitIndex].length = 0;
        
        // Target area based on player
        const targetX = 0;
        const targetZ = playerIndex === 0 ? 5 : -5;
        const targetY = 1.0; // above board
        
        stones.forEach((s, i) => {
            s.userData.state = 'captured';
            this._animateStoneArc(s, targetX + (Math.random()-0.5)*2, targetY, targetZ + (Math.random()-0.5), 0.6 + (i * 0.05), () => {
                s.position.set(0, -10, 0); // Hide after animation
            });
        });
        
        return stones;
    }
    
    // Custom simple animation wrapper
    _animateStone(stone, { x, y, z, duration, onComplete }) {
        const startX = stone.position.x;
        const startY = stone.position.y;
        const startZ = stone.position.z;
        const startRx = stone.rotation.x;
        const startRy = stone.rotation.y;
        const startRz = stone.rotation.z;
        
        const endRx = startRx + (Math.random() * Math.PI * 2);
        const endRy = startRy + (Math.random() * Math.PI * 2);
        const endRz = startRz + (Math.random() * Math.PI * 2);

        let t = 0;
        const update = () => {
            t += 1 / (duration * 60); // assuming 60fps
            if (t >= 1) {
                stone.position.set(x, y, z);
                stone.rotation.set(endRx, endRy, endRz);
                if (stone.userData.state !== 'captured') stone.userData.state = 'idle';
                if (onComplete) onComplete();
                return;
            }
            // ease out quad
            const ease = t * (2 - t);
            stone.position.set(
                startX + (x - startX) * ease,
                startY + (y - startY) * ease,
                startZ + (z - startZ) * ease
            );
            stone.rotation.set(
                startRx + (endRx - startRx) * ease,
                startRy + (endRy - startRy) * ease,
                startRz + (endRz - startRz) * ease
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
        
        const endRx = stone.rotation.x + Math.PI;
        const endRy = stone.rotation.y + Math.PI;
        
        // Height of the arc
        const midY = Math.max(startY, y) + 1.5;

        let t = 0;
        const update = () => {
            t += 1 / (duration * 60);
            if (t >= 1) {
                stone.position.set(x, y, z);
                if (stone.userData.state !== 'captured') stone.userData.state = 'idle';
                if (onComplete) onComplete();
                return;
            }
            
            // Linear interpolate X and Z
            const px = startX + (x - startX) * t;
            const pz = startZ + (z - startZ) * t;
            
            // Parabola for Y
            // At t=0 -> startY
            // At t=0.5 -> midY
            // At t=1 -> y
            // y = a*t^2 + b*t + c
            const a = 2*startY - 4*midY + 2*y;
            const b = -3*startY + 4*midY - y;
            const c = startY;
            const py = a*t*t + b*t + c;

            stone.position.set(px, py, pz);
            stone.rotation.x += 0.1;
            stone.rotation.y += 0.1;

            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

}

window.StonesManager = StonesManager;
