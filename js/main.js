/* =========================================================
   main.js  —  Application Bootstrap and Game Loop
   ========================================================= */
'use strict';

let scene, camera, renderer;
let boardManager, stonesManager, cameraManager;
let game, ai, ui;

let isAnimatingMove = false;
let gameMode = 'local'; // local, easy, medium, hard
let clock = new THREE.Clock();

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
    scene.background = new THREE.Color(0x111111); // Fallback background
    
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
    
    renderer.domElement.addEventListener('pointerdown', (e) => {
        if (isAnimatingMove || !game || game.gameOver) return;
        
        // If AI turn, ignore clicks
        if (gameMode !== 'local' && game.currentPlayer === 1) return;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(boardManager.pitMeshes);
        
        if (intersects.length > 0) {
            const pitObj = intersects[0].object;
            const pitIndex = pitObj.userData.pitIndex;
            
            if (game.ownsPit(game.currentPlayer, pitIndex) && game.pits[pitIndex] > 0) {
                AudioManager.haptic([15]);
                boardManager.pulsePit(pitIndex);
                executeMove(pitIndex);
            } else {
                AudioManager.haptic([5, 50, 5]); // Error bump
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

    // Mode Selection
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            AudioManager.playTap();
            const mode = e.target.getAttribute('data-mode');
            startGame(mode);
        });
    });
    
    document.getElementById('btn-back-mode').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('splash');
    });

    // In-Game HUD & Pause
    document.getElementById('btn-pause').addEventListener('click', () => {
        AudioManager.playTap();
        ui.showScreen('pause');
    });
    
    document.getElementById('btn-undo').addEventListener('click', () => {
        AudioManager.playTap();
        if (isAnimatingMove) return;
        if (game.undo()) {
            stonesManager.syncWithGameState(game);
            ui.updateHUD(game, gameMode);
            ui.setStatus('');
            SaveManager.saveGame(game);
            // If playing vs AI and it's AI's turn after undo (shouldn't happen if we undo 2 steps, but let's be safe), 
            // for simplicity, if against AI, undo twice to get back to player turn.
            if (gameMode !== 'local' && game.currentPlayer === 1) {
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
    
    if (savedState) {
        game.pits = savedState.pits;
        game.scores = savedState.scores;
        game.currentPlayer = savedState.currentPlayer;
        // check game over state
        const validMoves = game.getValidMoves(game.currentPlayer);
        if(validMoves.length === 0) game.gameOver = true; // simplifying
    }
    
    game.mode = mode; // For saving
    
    if (mode !== 'local') {
        ai = new ChennAI(mode);
    }
    
    stonesManager.syncWithGameState(game);
    ui.updateHUD(game, mode);
    boardManager.clearHighlights();
    isAnimatingMove = false;
    
    // Check AI first turn if resumed
    if (gameMode !== 'local' && game.currentPlayer === 1 && !game.gameOver) {
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
    ui.updateHUD(game, gameMode);
    isAnimatingMove = false;
    
    SaveManager.saveGame(game);
    
    if (game.gameOver) {
        handleGameOver();
    } else if (gameMode !== 'local' && game.currentPlayer === 1) {
        // AI Turn
        setTimeout(playAITurn, 800);
    }
}

function processGameEvent(ev) {
    return new Promise(resolve => {
        if (ev.type === 'pick') {
            stonesManager.pickUp(ev.pit);
            AudioManager.playSeedDrop(); // generic rustle
            setTimeout(resolve, 400); // Wait for pickup animation
        } 
        else if (ev.type === 'sow') {
            const stonesInHand = stonesManager.stones.filter(s => s.userData.state === 'moving');
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
            ui.setStatus(Settings.t('capturing'));
            let targetPits = ev.type === 'capture4' ? [ev.pit] : [ev.pit];
            
            targetPits.forEach(p => {
                boardManager.highlightPit(p, 0xFF0000, 2.0);
                stonesManager.capture(p, ev.player);
            });
            
            setTimeout(() => {
                AudioManager.playCapture();
                AudioManager.haptic([20, 50, 20]);
                
                // Floating score text
                const pitPos = boardManager.getPitWorldPos(ev.type === 'capture4' ? ev.pit : ev.pit);
                // Map world to screen (roughly) for floating score
                const vector = pitPos.project(camera);
                const x = (vector.x * .5 + .5) * window.innerWidth;
                const y = (vector.y * -.5 + .5) * window.innerHeight;
                EffectsManager.floatingScore('+' + ev.count, x, y);
                
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
    
    // Record stats
    if (gameMode !== 'local') {
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
        boardManager.updateLabels(game.pits, camera, renderer);
    }
    
    if (cameraManager) {
        cameraManager.update();
    }
    
    renderer.render(scene, camera);
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
