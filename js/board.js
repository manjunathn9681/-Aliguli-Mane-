/* =========================================================
   board.js  —  Three.js 3D wooden board with 14 pits
   ========================================================= */
'use strict';

class Board {
    constructor(scene) {
        this.scene        = scene;
        this.group        = new THREE.Group();
        this.pitMeshes    = [];   // clickable pit meshes
        this.pitPositions = [];   // THREE.Vector3 in local space
        this.glowRings    = [];   // per-pit glow ring meshes
        this.pitLabels    = [];   // HTML div labels
        this._pulseIndex  = -1;
        this._pulseTime   = 0;

        scene.add(this.group);
        this._setupLights();
        this._buildTextures();
        this._buildBoard();
        this._buildPits();
        this._buildDecorations();
        this._buildPitLabels();
    }

    // ── Lighting ─────────────────────────────────────────────
    _setupLights() {
        // Warm ambient
        this.scene.add(new THREE.AmbientLight(0xFFE8C8, 0.35));

        // Main warm key light
        const key = new THREE.DirectionalLight(0xFFD580, 1.4);
        key.position.set(6, 14, 8);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near   = 0.5;
        key.shadow.camera.far    = 50;
        key.shadow.camera.left   = -18;
        key.shadow.camera.right  = 18;
        key.shadow.camera.top    = 12;
        key.shadow.camera.bottom = -12;
        key.shadow.bias          = -0.0005;
        key.shadow.normalBias    = 0.02;
        this.scene.add(key);
        this.keyLight = key;

        // Cool fill
        const fill = new THREE.DirectionalLight(0x8BAEFF, 0.25);
        fill.position.set(-8, 6, -5);
        this.scene.add(fill);

        // Warm rim from behind board
        const rim = new THREE.PointLight(0xFF9A50, 1.0, 22, 1.5);
        rim.position.set(0, 4, -10);
        this.scene.add(rim);

        // Subtle under light (bounce)
        const bounce = new THREE.PointLight(0xFFD9A0, 0.4, 15);
        bounce.position.set(0, -3, 5);
        this.scene.add(bounce);
    }

    // ── Procedural textures ─────────────────────────────────
    _buildTextures() {
        this.woodTex = this._makeWoodTexture(1024, 512);
        this.woodTex.wrapS = this.woodTex.wrapT = THREE.RepeatWrapping;
        this.woodTex.repeat.set(3, 1.5);
        this.woodTex.anisotropy = 8;

        this.woodNorm = this._makeWoodNormal(512, 256);
        this.woodNorm.wrapS = this.woodNorm.wrapT = THREE.RepeatWrapping;
        this.woodNorm.repeat.set(3, 1.5);

        this.pitTex = this._makePitTexture(256, 256);
    }

    _makeWoodTexture(w, h) {
        const cv  = document.createElement('canvas');
        cv.width  = w; cv.height = h;
        const ctx = cv.getContext('2d');

        // Rosewood base gradient
        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0.0, '#5A1A08');
        bg.addColorStop(0.2, '#7A2E14');
        bg.addColorStop(0.45,'#8C3D1E');
        bg.addColorStop(0.65,'#7B2D14');
        bg.addColorStop(1.0, '#5A1A08');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Long grain lines
        for (let i = 0; i < 120; i++) {
            const xBase = Math.random() * w;
            const amp   = 2 + Math.random() * 6;
            const freq  = 0.008 + Math.random() * 0.02;
            const alpha = 0.02 + Math.random() * 0.08;
            const lw    = 0.4 + Math.random() * 1.6;
            ctx.beginPath();
            ctx.moveTo(xBase, 0);
            for (let y = 0; y < h; y += 3) {
                ctx.lineTo(xBase + Math.sin(y * freq + Math.random() * 0.3) * amp, y);
            }
            ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
            ctx.lineWidth   = lw;
            ctx.stroke();
        }

        // Highlight streaks
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * w;
            ctx.beginPath();
            for (let y = 0; y < h; y += 5) {
                if (y === 0) ctx.moveTo(x, 0);
                else ctx.lineTo(x + Math.sin(y * 0.04) * 4, y);
            }
            ctx.strokeStyle = `rgba(255,160,80,${0.02 + Math.random() * 0.04})`;
            ctx.lineWidth   = 1 + Math.random() * 2;
            ctx.stroke();
        }

        // Subtle dark knots
        for (let i = 0; i < 4; i++) {
            const kx = 80 + Math.random() * (w - 160);
            const ky = 40 + Math.random() * (h - 80);
            const r  = 12 + Math.random() * 20;
            const kg = ctx.createRadialGradient(kx, ky, 2, kx, ky, r);
            kg.addColorStop(0,   'rgba(20,5,0,0.5)');
            kg.addColorStop(0.5, 'rgba(40,10,0,0.15)');
            kg.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = kg;
            ctx.beginPath();
            ctx.ellipse(kx, ky, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        return new THREE.CanvasTexture(cv);
    }

    _makeWoodNormal(w, h) {
        const cv  = document.createElement('canvas');
        cv.width  = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#8080FF'; // flat normal
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * w, amp = 3 + Math.random() * 5;
            ctx.beginPath(); ctx.moveTo(x, 0);
            for (let y = 0; y < h; y += 3) ctx.lineTo(x + Math.sin(y * 0.02) * amp, y);
            const v = Math.floor(110 + Math.random() * 40);
            ctx.strokeStyle = `rgb(${v},${v},255)`;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.stroke();
        }
        return new THREE.CanvasTexture(cv);
    }

    _makePitTexture(w, h) {
        const cv  = document.createElement('canvas');
        cv.width  = w; cv.height = h;
        const ctx = cv.getContext('2d');
        const g   = ctx.createRadialGradient(w/2, h/2, 4, w/2, h/2, w/2);
        g.addColorStop(0,   '#1A0800');
        g.addColorStop(0.5, '#2E1005');
        g.addColorStop(0.85,'#4A1E0A');
        g.addColorStop(1,   '#5C2810');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // carving lines
        for (let i = 0; i < 20; i++) {
            const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * (w * 0.4);
            ctx.beginPath();
            ctx.arc(w/2, h/2, r, a, a + 0.3);
            ctx.strokeStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.15})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        return new THREE.CanvasTexture(cv);
    }

    // ── Board geometry ───────────────────────────────────────
    _buildBoard() {
        const woodMat = new THREE.MeshStandardMaterial({
            map:           this.woodTex,
            normalMap:     this.woodNorm,
            normalScale:   new THREE.Vector2(0.6, 0.6),
            roughness:     0.28,
            metalness:     0.08,
            envMapIntensity: 0.6
        });

        // Main board slab
        const boardGeo = new THREE.BoxGeometry(17.2, 0.55, 5.2, 12, 1, 6);
        const board    = new THREE.Mesh(boardGeo, woodMat);
        board.receiveShadow = true;
        board.castShadow    = true;
        this.group.add(board);

        // Dark edge trim material
        const trimMat = new THREE.MeshStandardMaterial({
            color:     0x2E0E04,
            roughness: 0.25,
            metalness: 0.12
        });

        // Left / right end caps
        const endGeo = new THREE.BoxGeometry(0.9, 0.7, 5.6);
        for (const x of [-9.05, 9.05]) {
            const e = new THREE.Mesh(endGeo, trimMat);
            e.position.set(x, 0.075, 0);
            e.castShadow = e.receiveShadow = true;
            this.group.add(e);
        }

        // Top / bottom rails
        const railGeo = new THREE.BoxGeometry(19.0, 0.7, 0.55);
        for (const z of [-3.0, 3.0]) {
            const r = new THREE.Mesh(railGeo, trimMat);
            r.position.set(0, 0.075, z);
            r.castShadow = r.receiveShadow = true;
            this.group.add(r);
        }

        // Polished brass corner studs
        const studMat = new THREE.MeshStandardMaterial({
            color:     0xB8962A,
            roughness: 0.12,
            metalness: 0.85,
            emissive:  new THREE.Color(0x4A3A0A),
            emissiveIntensity: 0.15
        });
        const studGeo = new THREE.SphereGeometry(0.18, 16, 12);
        for (const [x, z] of [[-8.4,-2.8],[-8.4,2.8],[8.4,-2.8],[8.4,2.8]]) {
            const s = new THREE.Mesh(studGeo, studMat);
            s.position.set(x, 0.42, z);
            s.castShadow = true;
            this.group.add(s);
        }

        // Tilt board 8° toward viewer for perspective feel
        this.group.rotation.x = -0.14;
    }

    // ── 14 pits ──────────────────────────────────────────────
    _buildPits() {
        const pitBaseMat = new THREE.MeshStandardMaterial({
            map:      this.pitTex,
            roughness: 0.9,
            metalness: 0.0
        });
        const rimMat = new THREE.MeshStandardMaterial({
            color:     0x4A1E0A,
            roughness: 0.3,
            metalness: 0.08
        });

        for (let i = 0; i < 14; i++) {
            const pos = this._pitLocalPos(i);
            this.pitPositions.push(new THREE.Vector3(pos.x, pos.y, pos.z));

            // --- Pit well (concave bowl effect with lathe) ---
            const pts = [];
            const steps = 18, R = 0.68, depth = 0.38;
            for (let s = steps; s >= 0; s--) {
                const t  = s / steps;
                const r  = R * Math.sin(t * Math.PI * 0.5 + Math.PI * 0.5) * 0.97;
                const yy = -t * depth;
                pts.push(new THREE.Vector2(r, yy));
            }
            const latheGeo = new THREE.LatheGeometry(pts, 28);
            const pitMesh  = new THREE.Mesh(latheGeo, pitBaseMat.clone());
            pitMesh.position.set(pos.x, 0.28, pos.z);
            pitMesh.receiveShadow = true;
            this.group.add(pitMesh);

            // --- Invisible Hit Mesh for foolproof Raycasting ---
            const hitGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.4, 16);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.set(pos.x, 0.28, pos.z);
            hitMesh.userData.pitIndex  = i;
            hitMesh.userData.isPit     = true;
            hitMesh.userData.player    = i < 7 ? 0 : 1;
            this.pitMeshes.push(hitMesh);
            this.group.add(hitMesh);

            // --- Pit rim ring ---
            const rimGeo  = new THREE.TorusGeometry(0.71, 0.055, 10, 36);
            const rimMesh = new THREE.Mesh(rimGeo, rimMat);
            rimMesh.rotation.x = Math.PI / 2;
            rimMesh.position.set(pos.x, 0.285, pos.z);
            rimMesh.receiveShadow = true;
            this.group.add(rimMesh);

            // --- Gold glow ring (selection highlight) ---
            const glowGeo  = new THREE.TorusGeometry(0.82, 0.05, 8, 36);
            const glowMat  = new THREE.MeshStandardMaterial({
                color:            0xFFCC00,
                emissive:         new THREE.Color(0xFFCC00),
                emissiveIntensity: 0,
                roughness:        0.1,
                metalness:        0.6,
                transparent:      true,
                opacity:          0
            });
            const glowRing = new THREE.Mesh(glowGeo, glowMat);
            glowRing.rotation.x = Math.PI / 2;
            glowRing.position.set(pos.x, 0.295, pos.z);
            this.glowRings.push(glowRing);
            this.group.add(glowRing);
        }
    }

    // Local position for pit index i
    _pitLocalPos(i) {
        let col;
        const z = i < 7 ? 1.25 : -1.25;
        if (i < 7) {
            col = i;
        } else {
            col = 6 - (i - 7);   // pit 7→col6, pit13→col0
        }
        const x = -6 + col * 2;
        return { x, y: 0.28, z };
    }

    // ── Decorations ──────────────────────────────────────────
    _buildDecorations() {
        const engraveMat = new THREE.MeshStandardMaterial({
            color:     0x220800,
            roughness: 0.6,
            metalness: 0.05
        });

        // Center divider line
        const divGeo  = new THREE.BoxGeometry(16.5, 0.01, 0.07);
        const divLine = new THREE.Mesh(divGeo, engraveMat);
        divLine.position.set(0, 0.28, 0);
        this.group.add(divLine);

        // Engraved border lines
        for (const z of [-2.2, 2.2]) {
            const bl = new THREE.Mesh(divGeo, engraveMat);
            bl.position.set(0, 0.28, z);
            this.group.add(bl);
        }

        // Small lotus pattern in center (decorative)
        const goldMat = new THREE.MeshStandardMaterial({
            color:     0xC8A22A,
            roughness: 0.15,
            metalness: 0.75,
            emissive:  new THREE.Color(0x4A3A00),
            emissiveIntensity: 0.2
        });
        for (let k = 0; k < 8; k++) {
            const a    = (k / 8) * Math.PI * 2;
            const r    = 0.28;
            const pGeo = new THREE.TorusGeometry(0.1, 0.02, 6, 16);
            const p    = new THREE.Mesh(pGeo, goldMat);
            p.rotation.x = Math.PI / 2;
            p.position.set(Math.cos(a) * r, 0.285, Math.sin(a) * r);
            this.group.add(p);
        }
        const centerGeo = new THREE.SphereGeometry(0.07, 12, 8);
        const center    = new THREE.Mesh(centerGeo, goldMat);
        center.position.set(0, 0.29, 0);
        this.group.add(center);

        // Vertical score-area pillar accents (left and right)
        for (const x of [-8.6, 8.6]) {
            const pillarGeo = new THREE.BoxGeometry(0.12, 0.65, 4.8);
            const pillar    = new THREE.Mesh(pillarGeo, engraveMat);
            pillar.position.set(x, 0.12, 0);
            this.group.add(pillar);
        }

        // Player-side engraved text area markers
        const areaMatP1 = new THREE.MeshStandardMaterial({ color: 0x3A1008, roughness: 0.5 });
        const areaMatP2 = new THREE.MeshStandardMaterial({ color: 0x08203A, roughness: 0.5 });
        const areaGeo   = new THREE.BoxGeometry(15.8, 0.005, 0.18);
        const areaP1    = new THREE.Mesh(areaGeo, areaMatP1);
        areaP1.position.set(0, 0.278, 2.35);
        this.group.add(areaP1);
        const areaP2    = new THREE.Mesh(areaGeo, areaMatP2);
        areaP2.position.set(0, 0.278, -2.35);
        this.group.add(areaP2);
    }

    // ── HTML pit-count labels ─────────────────────────────────
    _buildPitLabels() {
        const container = document.getElementById('pitLabels');
        for (let i = 0; i < 14; i++) {
            const d = document.createElement('div');
            d.className   = 'pit-count-label';
            d.id          = `pit-lbl-${i}`;
            d.textContent = '4';
            container.appendChild(d);
            this.pitLabels.push(d);
        }
    }

    // ── Highlight API ─────────────────────────────────────────
    highlightPit(index, color = 0xFFCC00, intensity = 1.5) {
        const ring = this.glowRings[index];
        if (!ring) return;
        ring.material.color.setHex(color);
        ring.material.emissive.setHex(color);
        ring.material.emissiveIntensity = intensity;
        ring.material.opacity = Math.min(intensity * 0.5, 1);
    }

    clearHighlights() {
        this.glowRings.forEach(r => {
            r.material.emissiveIntensity = 0;
            r.material.opacity = 0;
        });
        this._pulseIndex = -1;
        this._nextValidIndex = -1;
    }

    // Cyan pulsing ring — marks the single pit the player MUST tap next in Custom mode
    highlightNextValidPit(index) {
        this._nextValidIndex = index;
        this._nextValidTime  = 0;
    }

    clearNextValidHighlight() {
        if (this._nextValidIndex >= 0) {
            const r = this.glowRings[this._nextValidIndex];
            if (r) { r.material.emissiveIntensity = 0; r.material.opacity = 0; }
        }
        this._nextValidIndex = -1;
    }

    pulsePit(index) {
        this._pulseIndex = index;
        this._pulseTime  = 0;
    }

    setHover(index) {
        this._hoverIndex = index;
        this._hoverTime = 0;
    }

    clearHover() {
        if (this._hoverIndex !== -1 && this._hoverIndex !== this._pulseIndex) {
            this.highlightPit(this._hoverIndex, 0xFFCC00, 0); // hide
        }
        this._hoverIndex = -1;
    }

    highlightValidMoves(validIndices) {
        // First clear all existing highlights that aren't hovering or pulsing
        this.glowRings.forEach((r, i) => {
            if (i !== this._pulseIndex && i !== this._hoverIndex) {
                r.material.emissiveIntensity = 0;
                r.material.opacity = 0;
            }
        });
        
        // Then highlight the valid ones mildly
        validIndices.forEach(idx => {
            if (idx !== this._pulseIndex && idx !== this._hoverIndex) {
                this.highlightPit(idx, 0x00FF00, 0.4); // subtle green glow
            }
        });
    }

    // ── Label update (called every frame) ────────────────────
    updateLabels(pits, camera, renderer) {
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;

        for (let i = 0; i < 14; i++) {
            const worldPos = this.pitPositions[i].clone();
            this.group.localToWorld(worldPos);
            const proj = worldPos.clone().project(camera);

            const sx = ( proj.x * 0.5 + 0.5) * w;
            const sy = (-proj.y * 0.5 + 0.5) * h;

            const lbl = this.pitLabels[i];
            lbl.style.transform = `translate(-50%,-180%) translate(${sx}px,${sy}px)`;
            lbl.textContent     = pits[i];

            // Style based on state
            lbl.classList.toggle('label-zero',  pits[i] === 0);
            lbl.classList.toggle('label-four',  pits[i] === 4);
        }
    }

    // ── Animation update ─────────────────────────────────────
    update(dt) {
        if (this._pulseIndex >= 0) {
            this._pulseTime += dt;
            const intensity = 1.2 + Math.sin(this._pulseTime * 7) * 0.6;
            this.highlightPit(this._pulseIndex, 0xFFCC00, intensity);
        }
        
        if (this._hoverIndex >= 0 && this._hoverIndex !== this._pulseIndex) {
            this._hoverTime += dt;
            const intensity = 0.5 + Math.sin(this._hoverTime * 4) * 0.3;
            this.highlightPit(this._hoverIndex, 0xFFFFFF, intensity);
        }

        // Cyan pulse for Custom Mode "next valid pit"
        if (this._nextValidIndex >= 0 && this._nextValidIndex !== this._pulseIndex) {
            this._nextValidTime = (this._nextValidTime || 0) + dt;
            const intensity = 1.0 + Math.sin(this._nextValidTime * 9) * 0.7;
            this.highlightPit(this._nextValidIndex, 0x00FFCC, intensity);
        }
    }


    // ── Helper: world-space position of a pit's center ───────
    getPitWorldPos(index) {
        const v = this.pitPositions[index].clone();
        this.group.localToWorld(v);
        return v;
    }
}

window.Board = Board;
