/* =========================================================
   main.js  —  Application Bootstrap and Game Loop
   ========================================================= */
'use strict';

let scene, camera, renderer;
let boardManager, stonesManager, cameraManager;
let game, ai, ui;

let isAnimatingMove = false;
let gameMode = 'local'; // local, easy, medium, hard, custom
let clock = new THREE.Clock();

// ── Custom Mode State ─────────────────────────────────────────
const customState = {
    active:        false,  // true while mid-sow (phase 2)
    preSelectedPit: -1,    // pit highlighted but not yet confirmed
    sourcePit:     -1,
    lastPlacedPit: -1,
    seedsInHand:   0,
    nextValidPit:  -1,
};

function showSeedsInHand(count) {
    const badge = document.getElementById('hud-seeds-in-hand');
    const counter = document.getElementById('hud-seeds-count');
    counter.textContent = count;
    badge.style.display = 'flex';
}

function hideSeedsInHand() {
    document.getElementById('hud-seeds-in-hand').style.display = 'none';
}

let customToastTimeout;
function showCustomToast(msg) {
    const toast = document.getElementById('custom-mode-toast');
    const text = document.getElementById('custom-toast-text');
    if (!toast || !text) return;
    text.textContent = msg;
    toast.classList.add('show');
    
    clearTimeout(customToastTimeout);
    customToastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function hideCustomToast() {
    const toast = document.getElementById('custom-mode-toast');
    if (toast) toast.classList.remove('show');
    clearTimeout(customToastTimeout);
}

function updateCustomHighlights() {
    boardManager.clearHighlights();
    // Gold on pre-selected pit (Phase 0)
    if (!customState.active && customState.preSelectedPit >= 0) {
        boardManager.pulsePit(customState.preSelectedPit);
    }
    // Gold on source pit (Phase 1/2)
    if (customState.sourcePit >= 0) {
        boardManager.pulsePit(customState.sourcePit);
    }
    // Cyan on next valid pit
    if (customState.nextValidPit >= 0) {
        boardManager.highlightNextValidPit(customState.nextValidPit);
    }
}

function cancelCustomSow() {
    if (game && game.customTurn && game.customTurn.active) {
        game.undo();
    }
    customState.active        = false;
    customState.preSelectedPit = -1;
    customState.sourcePit     = -1;
    customState.lastPlacedPit = -1;
    customState.seedsInHand   = 0;
    customState.nextValidPit  = -1;
    boardManager.clearHighlights();
    boardManager.clearNextValidHighlight();
    hideSeedsInHand();
    hideCustomToast();
    stonesManager.syncWithGameState(game);
    ui.updateHUD(game, gameMode);
    boardManager.highlightValidMoves(game.getValidMoves(game.currentPlayer));
}

// Resolves one individual seed placement in custom mode
async function handleCustomClick(pitIndex) {
    if (isAnimatingMove) return;

    // ── PHASE 0: Pre-selection & Confirmation ──
    if (!customState.active) {
        const isOwnValidPit = game.ownsPit(game.currentPlayer, pitIndex) && game.pits[pitIndex] > 0;
        
        if (customState.preSelectedPit === -1) {
            // Nothing pre-selected yet
            if (isOwnValidPit) {
                customState.preSelectedPit = pitIndex;
                updateCustomHighlights();
                AudioManager.haptic([10]);
                showCustomToast('Tap the selected hole again to start sowing.');
            } else {
                AudioManager.haptic([5, 50, 5]);
                showCustomToast('Tap one of your non-empty holes to select it.');
            }
            return;
        } else {
            // A pit is already pre-selected
            if (pitIndex === customState.preSelectedPit) {
                // CONFIRM! Start the move.
                const result = game.beginCustomMove(pitIndex);
                if (!result) return;
        
                customState.active        = true;
                customState.sourcePit     = pitIndex;
                customState.lastPlacedPit = pitIndex;
                customState.seedsInHand   = result.seedsInHand;
                customState.nextValidPit  = result.nextValidPit;
        
                AudioManager.haptic([15]);
                AudioManager.playSeedDrop();
                stonesManager.pickUp(pitIndex);
                showSeedsInHand(customState.seedsInHand);
                updateCustomHighlights();
                hideCustomToast();
                ui.setStatus('');
                return;
            } else if (isOwnValidPit) {
                // Change selection
                customState.preSelectedPit = pitIndex;
                updateCustomHighlights();
                AudioManager.haptic([10]);
                showCustomToast('Tap the selected hole again to start sowing.');
                return;
            } else {
                // Invalid tap during pre-selection
                AudioManager.haptic([5, 50, 5]);
                showCustomToast('Tap the golden hole to confirm, or another valid hole to change.');
                return;
            }
        }
    }

    // ── PHASE 2: Mid-sow → must tap the highlighted next pit ──
    if (pitIndex !== customState.nextValidPit) {
        // Invalid tap — seed sowing already underway or wrong pit entirely
        AudioManager.haptic([5, 30, 5]);
        ui.setStatus('❌ Invalid! Tap the glowing cyan pit.');
        setTimeout(() => ui.setStatus(''), 1500);
        return;
    }

    // Valid tap — place one seed
    isAnimatingMove = true;

    const result = game.placeOneSeed(pitIndex);
    if (!result || !result.ok) {
        isAnimatingMove = false;
        return;
    }

    // Animate one seed arc
    const stonesInHand = stonesManager.stones.filter(s => s.userData.state === 'in-hand');
    if (stonesInHand.length > 0) {
        const stone = stonesInHand[stonesInHand.length - 1];
        stone.userData.state = 'sowing';
        stonesManager.sowOne(stone, pitIndex);
        boardManager.highlightPit(pitIndex, 0x00FFCC, 1.5); // brief cyan flash on landing
        await new Promise(r => setTimeout(r, 420));
        AudioManager.playSeedDrop();
        AudioManager.haptic([10]);
    }

    // Handle immediate 4-capture
    if (result.capture4) {
        const ev = result.capture4;
        boardManager.highlightPit(ev.pit, 0xFF4400, 2.5);
        stonesManager.capture(ev.pit, ev.player);
        const pitPos = boardManager.getPitWorldPos(ev.pit);
        const vec = pitPos.project(camera);
        const sx = (vec.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (vec.y * -0.5 + 0.5) * window.innerHeight;
        EffectsManager.floatingScore('+4', sx, sy);
        AudioManager.playCapture();
        AudioManager.haptic([20, 50, 20]);
        ui.updateHUD(game, gameMode);
        await new Promise(r => setTimeout(r, 600));
    }

    isAnimatingMove = false;

    // Update state
    customState.seedsInHand   = result.seedsRemaining;
    customState.lastPlacedPit = pitIndex;
    customState.nextValidPit  = result.nextValidPit;

    showSeedsInHand(customState.seedsInHand);

    if (customState.seedsInHand > 0) {
        // More seeds to place — update highlights and wait for next tap
        updateCustomHighlights();
        return;
    }

    // ── All seeds placed: finish the turn ──
    isAnimatingMove = true;
    customState.active        = false;
    customState.sourcePit     = -1;
    customState.lastPlacedPit = -1;
    customState.nextValidPit  = -1;
    boardManager.clearNextValidHighlight();
    hideSeedsInHand();

    const events = game.finishCustomMove();
    if (events) {
        for (const ev of events) {
            await processGameEvent(ev);
        }
    }

    boardManager.clearHighlights();
    stonesManager.syncWithGameState(game);
    ui.updateHUD(game, gameMode);

    if (!game.gameOver) {
        boardManager.highlightValidMoves(game.getValidMoves(game.currentPlayer));
    }

    isAnimatingMove = false;
    SaveManager.saveGame(game);

    if (game.gameOver) {
        handleGameOver();
    }
}

function init() {
    // 1. Initialize UI & Audio
    ui = new UIManager();
    AudioManager.init();
    ui.applySettingsToUI();
    
    // Check for saved game
    const btnResume = document.getElementById('btn-resume-game');
    if (SaveManager.hasSavedGame()) {
        btnResume.style.display = 'block';
    } else {
        btnResume.style.display = 'none';
    }
    
    ui.showScreen('splash');

    // 2. Setup Three.js Scene
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Initialize Game Objects
    boardManager = new Board(scene);
    stonesManager = new StonesManager(scene, boardManager);
    cameraManager = new CameraManager(camera, renderer);
    
    // 4. Interaction (Raycaster)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    let hoveredPit = -1;

    // ── Pointer Hover (Cursor and Glow) ───────────────────────
    renderer.domElement.addEventListener('pointermove', (e) => {
        if (isAnimatingMove || !game || game.gameOver) {
            document.body.style.cursor = 'default';
            if (boardManager) boardManager.clearHover();
            hoveredPit = -1;
            return;
        }

        // In custom mode, always show pointer on any pit (we handle validity in click)
        const isCustom = gameMode === 'custom';

        if (!isCustom && gameMode !== 'local' && game.currentPlayer === 1) {
            document.body.style.cursor = 'default';
            if (boardManager) boardManager.clearHover();
            hoveredPit = -1;
            return;
        }

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(boardManager.pitMeshes);

        if (intersects.length > 0) {
            const pitIndex = intersects[0].object.userData.pitIndex;

            let isHoverable;
            if (isCustom && customState.active) {
                // Mid-sow: only the next valid pit is hoverable
                isHoverable = pitIndex === customState.nextValidPit;
            } else if (isCustom) {
                // Pre-sow: only own non-empty pits
                isHoverable = game.ownsPit(game.currentPlayer, pitIndex) && game.pits[pitIndex] > 0;
            } else {
                isHoverable = game.ownsPit(game.currentPlayer, pitIndex) && game.pits[pitIndex] > 0;
            }

            if (isHoverable) {
                document.body.style.cursor = 'pointer';
                if (hoveredPit !== pitIndex) {
                    hoveredPit = pitIndex;
                    boardManager.setHover(pitIndex);
                }
                return;
            }
        }
        
        document.body.style.cursor = 'default';
        if (hoveredPit !== -1) {
            hoveredPit = -1;
            boardManager.clearHover();
        }
    });

    // ── Pointer Click (Select Pit) ───────────────────────────
    renderer.domElement.addEventListener('pointerdown', (e) => {
        if (!game || game.gameOver) return;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(boardManager.pitMeshes);
        
        if (intersects.length > 0) {
            const pitObj   = intersects[0].object;
            const pitIndex = pitObj.userData.pitIndex;

            console.log(`[Interaction] Pointer down on pit ${pitIndex}`);

            // ── Custom Mode ──────────────────────────────────
            if (gameMode === 'custom') {
                // In local custom both players use this; in future single-player custom we'd gate P2
                handleCustomClick(pitIndex);
                return;
            }

            // ── Standard / AI Modes ──────────────────────────
            if (isAnimatingMove) return;
            if (gameMode !== 'local' && game.currentPlayer === 1) return;

            if (game.ownsPit(game.currentPlayer, pitIndex) && game.pits[pitIndex] > 0) {
                AudioManager.haptic([15]);
                boardManager.pulsePit(pitIndex);
                document.body.style.cursor = 'default';
                console.log(`[Move Start] Player ${game.currentPlayer} selected pit ${pitIndex} containing ${game.pits[pitIndex]} stones.`);
                executeMove(pitIndex);
            } else {
                AudioManager.haptic([5, 50, 5]);
                ui.setStatus(Settings.t('selectPit'));
                setTimeout(() => ui.setStatus(''), 1000);
            }
        }
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // If in top view, adjust zoom dynamically
        if (cameraManager && cameraManager.isTopView && !cameraManager.isAnimating) {
            camera.position.y = cameraManager.getOptimalTopHeight();
        }
    });

    // 5. Setup DOM Event Listeners
    setupEventListeners();

    // 6. Start Render Loop
    renderer.setAnimationLoop(animate);
}


function setupEventListeners() {
    // Main Menu
    document.getElementById('btn-play').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('mode');
    });
    
    document.getElementById('btn-resume-game').addEventListener('click', () => {
        AudioManager.playTap();
        const saved = SaveManager.loadGame();
        if (saved) {
            startGame(saved.mode, saved);
        }
    });

    // Mode Selection -> Setup Screen
    let pendingGameMode = null;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            AudioManager.playTap();
            pendingGameMode = e.currentTarget.getAttribute('data-mode');
            
            const p1Input = document.getElementById('input-p1-name');
            const p2Input = document.getElementById('input-p2-name');
            
            p1Input.value = Settings.get('player1Name') || 'Player 1';
            
            if (pendingGameMode === 'local' || pendingGameMode === 'custom') {
                p2Input.value = Settings.get('player2Name') || 'Player 2';
                p2Input.disabled = false;
                p2Input.style.opacity = '1';
            } else {
                p2Input.value = Settings.t('computer');
                p2Input.disabled = true;
                p2Input.style.opacity = '0.5';
            }
            
            ui.showScreen('setup');
        });
    });
    
    document.getElementById('btn-back-setup').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('mode');
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
        AudioManager.playTap();
        
        let p1 = document.getElementById('input-p1-name').value.trim();
        let p2 = document.getElementById('input-p2-name').value.trim();
        
        if (!p1) p1 = 'Player 1';
        if (!p2) p2 = 'Player 2';
        
        Settings.set('player1Name', p1);
        if (pendingGameMode === 'local' || pendingGameMode === 'custom') {
            Settings.set('player2Name', p2);
        }
        
        startGame(pendingGameMode);
    });
    
    document.getElementById('btn-back-mode').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('splash');
    });

    // In-Game HUD & Pause
    const btnCamera = document.getElementById('btn-camera');
    // Set default active state for Top View
    btnCamera.style.color = 'var(--c-primary)';
    btnCamera.style.borderColor = 'var(--c-primary)';

    btnCamera.addEventListener('click', (e) => {
        AudioManager.playTap();
        const btn = e.currentTarget;
        cameraManager.toggleTopView((isTopView) => {
            if (isTopView) {
                btn.style.color = 'var(--c-primary)';
                btn.style.borderColor = 'var(--c-primary)';
                ui.setStatus('Top View Enabled');
            } else {
                btn.style.color = '';
                btn.style.borderColor = '';
                ui.setStatus('3D View Enabled');
            }
            setTimeout(() => ui.setStatus(''), 2000);
        });
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('pause');
    });
    
    document.getElementById('btn-undo').addEventListener('click', () => {
        AudioManager.playTap();
        if (isAnimatingMove) return;

        // In custom mode, if mid-sow, cancel the sow first
        if (gameMode === 'custom' && customState.active) {
            cancelCustomSow();
            return;
        }

        if (game.undo()) {
            stonesManager.syncWithGameState(game);
            ui.updateHUD(game, gameMode);
            ui.setStatus('');
            SaveManager.saveGame(game);
            // If playing vs AI and it's AI's turn after undo, undo twice to get back to player turn
            if (gameMode !== 'local' && gameMode !== 'custom' && game.currentPlayer === 1) {
                 if (game.undo()) {
                     stonesManager.syncWithGameState(game);
                     ui.updateHUD(game, gameMode);
                     SaveManager.saveGame(game);
                 }
            }
        }
    });
    
    document.getElementById('btn-resume-pause').addEventListener('click', () => {
        AudioManager.playTap();
        ui.hideModals();
    });
    
    document.getElementById('btn-home').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('splash');
        AudioManager.stopMusic();
        cameraManager.resetView();
    });
    
    document.getElementById('btn-restart').addEventListener('click', () => {
        AudioManager.playTap();
        if(confirm(Settings.t('confirmRestart'))) {
            startGame(gameMode);
        }
    });

    // Modals (Rules & Settings)
    document.querySelectorAll('.btn-rules').forEach(btn => {
        btn.addEventListener('click', () => {
            AudioManager.playTap();
            ui.showScreen('rules');
        });
    });
    
    document.querySelectorAll('.btn-settings').forEach(btn => {
        btn.addEventListener('click', () => {
            AudioManager.playTap();
            ui.showScreen('settings');
        });
    });
    
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            AudioManager.playTap();
            // If in game, back to pause. If splash, back to splash.
            if (scene && game && !game.gameOver && ui.els.screens.game.classList.contains('active')) {
                ui.showScreen('pause');
            } else {
                ui.showScreen('splash');
            }
        });
    });
    
    // Win Screen
    document.getElementById('btn-play-again').addEventListener('click', () => {
        AudioManager.playTap();
        startGame(gameMode);
    });
    
    document.getElementById('btn-win-home').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('splash');
        AudioManager.stopMusic();
        cameraManager.resetView();
    });

    // Settings Controls
    document.getElementById('btn-lang').addEventListener('click', () => {
        AudioManager.playTap();
        const cur = Settings.get('language');
        Settings.set('language', cur === 'en' ? 'kn' : 'en');
        ui.applySettingsToUI();
    });
    
    document.getElementById('btn-theme').addEventListener('click', () => {
        AudioManager.playTap();
        const cur = Settings.get('theme');
        Settings.set('theme', cur === 'dark' ? 'light' : 'dark');
        ui.applySettingsToUI();
    });
    
    document.getElementById('btn-haptic').addEventListener('click', () => {
        AudioManager.playTap();
        Settings.set('haptics', !Settings.get('haptics'));
        ui.applySettingsToUI();
        AudioManager.haptic([20]);
    });
    
    document.getElementById('slide-music').addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        Settings.set('musicVolume', v);
        AudioManager.setMusicVolume(v);
    });
    
    document.getElementById('slide-sfx').addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        Settings.set('sfxVolume', v);
        AudioManager.setSfxVolume(v);
    });
}

function startGame(mode, savedState = null) {
    ui.showScreen('game');
    ui.hideModals();
    AudioManager.startMusic();
    cameraManager.resetView();
    
    gameMode = mode;
    game = new ChennGame();

    // Reset custom-mode mid-turn state
    customState.active        = false;
    customState.preSelectedPit = -1;
    customState.sourcePit     = -1;
    customState.lastPlacedPit = -1;
    customState.seedsInHand   = 0;
    customState.nextValidPit  = -1;
    hideSeedsInHand();
    
    if (savedState) {
        game.pits = savedState.pits;
        game.scores = savedState.scores;
        game.currentPlayer = savedState.currentPlayer;
        // check game over state
        const validMoves = game.getValidMoves(game.currentPlayer);
        if(validMoves.length === 0) game.gameOver = true;
    }
    
    game.mode = mode; // For saving
    
    // 'custom' is always local 2-player — no AI
    if (mode !== 'local' && mode !== 'custom') {
        ai = new ChennAI(mode);
    }
    
    stonesManager.syncWithGameState(game);
    ui.updateHUD(game, mode);
    
    // Highlight valid moves for player if it's their turn
    if (gameMode === 'local' || gameMode === 'custom' || game.currentPlayer === 0) {
        boardManager.highlightValidMoves(game.getValidMoves(game.currentPlayer));
    } else {
        boardManager.clearHighlights();
    }
    
    isAnimatingMove = false;
    
    // Check AI first turn if resumed (not applicable to custom)
    if (gameMode !== 'local' && gameMode !== 'custom' && game.currentPlayer === 1 && !game.gameOver) {
        setTimeout(playAITurn, 1000);
    }
}

async function executeMove(pitIndex) {
    if (isAnimatingMove) return;
    isAnimatingMove = true;
    
    const events = game.playMove(pitIndex);
    if (!events) {
        isAnimatingMove = false;
        return;
    }
    
    // Process animation events sequentially
    for (const ev of events) {
        await processGameEvent(ev);
    }
    
    boardManager.clearHighlights();
    stonesManager.syncWithGameState(game); // Ensure 100% consistency with game engine
    ui.updateHUD(game, gameMode);
    
    // Highlight valid moves for the next player (if human)
    if (!game.gameOver && (gameMode === 'local' || gameMode === 'custom' || game.currentPlayer === 0)) {
        boardManager.highlightValidMoves(game.getValidMoves(game.currentPlayer));
    }
    
    // Hard visual sync validation
    const totalMeshes = stonesManager.stones.length;
    if (totalMeshes !== 56) {
        console.error(`[CRITICAL ERROR] Visual desync: Found ${totalMeshes} seed meshes instead of 56! Rebuilding...`);
        stonesManager.syncWithGameState(game);
    }

    isAnimatingMove = false;
    
    SaveManager.saveGame(game);
    
    if (game.gameOver) {
        handleGameOver();
    } else if (gameMode !== 'local' && gameMode !== 'custom' && game.currentPlayer === 1) {
        // AI Turn
        setTimeout(playAITurn, 800);
    }
}

function processGameEvent(ev) {
    return new Promise(resolve => {
        if (ev.type === 'pick') {
            console.log(`[Animation] Picking up ${ev.count} stones from pit ${ev.pit}`);
            stonesManager.pickUp(ev.pit);
            AudioManager.playSeedDrop(); // generic rustle
            setTimeout(resolve, 400); // Wait for pickup animation
        } 
        else if (ev.type === 'sow') {
            console.log(`[Animation] Sowing stone into pit ${ev.pit}`);
            const stonesInHand = stonesManager.stones.filter(s => s.userData.state === 'in-hand');
            if (stonesInHand.length > 0) {
                const stoneToSow = stonesInHand[stonesInHand.length - 1]; // pop last
                stoneToSow.userData.state = 'sowing';
                stonesManager.sowOne(stoneToSow, ev.pit);
                
                // Focus camera on action if it goes to opponent side
                // cameraManager.focusOnPit(boardManager, ev.pit);
                boardManager.highlightPit(ev.pit, 0xFFFFFF, 0.5);
                
                setTimeout(() => {
                    AudioManager.playSeedDrop();
                    AudioManager.haptic([10]);
                    resolve();
                }, 400);
            } else {
                resolve();
            }
        }
        else if (ev.type === 'capture4' || ev.type === 'captureEnd') {
            console.log(`[Animation] Captured ${ev.count} stones! (Type: ${ev.type})`);
            ui.setStatus(Settings.t('capturing'));

            boardManager.highlightPit(ev.pit, 0xFF0000, 2.0);
            stonesManager.capture(ev.pit, ev.player);
            
            setTimeout(() => {
                AudioManager.playCapture();
                AudioManager.haptic([20, 50, 20]);
                
                // Floating score text with correct count
                const pitPos = boardManager.getPitWorldPos(ev.pit);
                const vector = pitPos.project(camera);
                const x = (vector.x * .5 + .5) * window.innerWidth;
                const y = (vector.y * -.5 + .5) * window.innerHeight;
                EffectsManager.floatingScore('+' + (ev.count || 0), x, y);
                
                ui.setStatus('');
                resolve();
            }, 800);
        }
        else if (ev.type === 'turnSwitch') {
            AudioManager.playTurnChange();
            ui.updateHUD(game, gameMode);
            setTimeout(resolve, 300);
        }
        else if (ev.type === 'collectRemaining') {
            // Collect all remaining at game over
            for (let i = 0; i < 14; i++) {
                if (stonesManager.pitContents[i].length > 0) {
                    stonesManager.capture(i, ev.player);
                }
            }
            setTimeout(resolve, 1000);
        }
        else {
            resolve();
        }
    });
}

function playAITurn() {
    if (game.gameOver || isAnimatingMove) return;
    const move = ai.getBestMove(game);
    if (move !== null) {
        boardManager.pulsePit(move);
        setTimeout(() => {
            executeMove(move);
        }, 500);
    }
}

function handleGameOver() {
    SaveManager.clearGame();
    
    // Record stats (only for AI modes, not local or custom)
    if (gameMode !== 'local' && gameMode !== 'custom') {
        if (game.winner === 0) SaveManager.recordResult('win');
        else if (game.winner === 1) SaveManager.recordResult('loss');
        else SaveManager.recordResult('draw');
    }
    
    setTimeout(() => {
        AudioManager.playVictory();
        cameraManager.victorySpin();
        EffectsManager.triggerConfetti();
        ui.showWinScreen(game, gameMode);
        document.getElementById('btn-resume-game').style.display = 'none'; // hide resume
    }, 1000);
}

// ── Render Loop ──────────────────────────────────────────────
function animate() {
    const dt = clock.getDelta();
    
    if (boardManager && game && scene) {
        boardManager.update(dt);
        boardManager.updateLabels(game.pits, camera, renderer, stonesManager);
    }
    
    if (cameraManager) {
        cameraManager.update();
    }
    
    renderer.render(scene, camera);
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
