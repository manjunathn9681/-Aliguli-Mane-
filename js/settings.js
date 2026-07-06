/* =========================================================
   settings.js  —  Settings singleton & i18n
   ========================================================= */
'use strict';

const Settings = (() => {

    const STORAGE_KEY = 'chenn_settings';

    const defaults = {
        language: 'en',
        theme: 'dark',
        haptics: true,
        musicVolume: 0.4,
        sfxVolume: 0.8,
        player1Name: 'Player 1',
        player2Name: 'Player 2',
        fpsLimit: 'auto',
        showFps: false
    };

    let current = { ...defaults };

    // ── i18n string tables ──────────────────────────────────
    const strings = {
        en: {
            appName: 'Chennemane',
            subtitle: 'Aliguli Mane',
            tagline: 'The Royal Game of Karnataka',
            play: 'Play Game',
            stats: 'Statistics',
            rules: 'Rules',
            settings: 'Settings',
            twoPlayers: 'Two Players',
            twoPlayersDesc: 'Play locally with a friend',
            vsAI: 'vs Computer',
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard',
            resumeGame: 'Resume Previous Game',
            resume: '▶  Resume',
            undo: '↩  Undo Move',
            restart: 'Restart',
            home: '🏠  Main Menu',
            pause: 'Paused',
            yourTurn: 'YOUR TURN',
            player1: 'Player 1',
            player2: 'Player 2',
            computer: 'Computer',
            captured: 'Captured',
            wins: '🏆  Wins!',
            draw: 'Draw!',
            playAgain: '▶  Play Again',
            mainMenu: '🏠  Main Menu',
            gamesPlayed: 'Games Played',
            totalWins: 'Total Wins',
            totalLosses: 'Losses',
            winRate: 'Win Rate',
            language: 'Language',
            theme: 'Theme',
            dark: 'Dark',
            light: 'Light',
            haptic: 'Haptic Feedback',
            musicVol: 'Music Volume',
            sfxVol: 'Sound Volume',
            on: 'On',
            off: 'Off',
            rulesTitle: 'How to Play Chennemane',
            rulesContent: [
                { h: 'Objective', p: 'Capture more stones than your opponent. The player with the most captured stones at the end wins.' },
                { h: 'Setup', p: 'The board has 14 pits — 7 for each player. Each pit starts with 4 tamarind seeds (56 total).' },
                { h: 'Taking a Turn', p: 'Tap any non-empty pit on your side. Pick up ALL stones and sow them one at a time into each following pit counter-clockwise.' },
                { h: 'The 4-Stones Rule', p: 'If any pit reaches exactly 4 stones after a stone is dropped, those 4 stones are captured immediately by the current player.' },
                { h: 'End-of-Sow Capture', p: 'After dropping the last stone, if the very next pit is empty — skip it and capture all stones from the pit after that (if it has any).' },
                { h: 'Game Over', p: 'The game ends when the current player has no valid moves. The opponent collects all remaining stones. Highest total wins!' }
            ],
            confirmRestart: 'Restart the game?',
            yes: 'Yes',
            cancel: 'Cancel',
            noMoves: 'No moves available!',
            selectPit: 'Select one of your non-empty pits.',
            capturing: 'Capturing!',
            backMenu: '← Back',
            chooseModeTitle: 'Choose Game Mode',
            fpsLimit: 'FPS Limit',
            fpsAuto: 'Auto (Recommended)',
            fpsUnlimited: 'Unlimited',
            performance: 'Performance',
            showFps: 'Show Monitor',
            fpsNotSupported: '{fps} FPS is not supported on this device. Using {fallback} FPS instead.'
        },
        kn: {
            appName: 'ಚೆನ್ನೆಮಾನೆ',
            subtitle: 'ಅಲಿಗುಳಿ ಮನೆ',
            tagline: 'ಕರ್ನಾಟಕದ ರಾಜಮನೆತನದ ಆಟ',
            play: 'ಆಟ ಆಡಿ',
            stats: 'ಅಂಕಿಅಂಶಗಳು',
            rules: 'ನಿಯಮಗಳು',
            settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
            twoPlayers: 'ಇಬ್ಬರು ಆಟಗಾರರು',
            twoPlayersDesc: 'ಸ್ನೇಹಿತರೊಂದಿಗೆ ಸ್ಥಳೀಯವಾಗಿ ಆಡಿ',
            vsAI: 'ಕಂಪ್ಯೂಟರ್ ವಿರುದ್ಧ',
            easy: 'ಸುಲಭ',
            medium: 'ಮಧ್ಯಮ',
            hard: 'ಕಷ್ಟ',
            resumeGame: 'ಹಿಂದಿನ ಆಟ ಮುಂದುವರಿಸಿ',
            resume: '▶  ಮುಂದುವರಿಸಿ',
            undo: '↩  ಹಿಂತೆಗೆದುಕೊಳ್ಳಿ',
            restart: 'ಮರಳಿ ಶುರು',
            home: '🏠  ಮುಖಪುಟ',
            pause: 'ವಿರಾಮ',
            yourTurn: 'ನಿಮ್ಮ ಸರದಿ',
            player1: 'ಆಟಗಾರ ೧',
            player2: 'ಆಟಗಾರ ೨',
            computer: 'ಕಂಪ್ಯೂಟರ್',
            captured: 'ಹಿಡಿದ',
            wins: '🏆 ಗೆದ್ದರು!',
            draw: 'ಸಮ!',
            playAgain: '▶  ಮತ್ತೆ ಆಡಿ',
            mainMenu: '🏠  ಮುಖಪುಟ',
            gamesPlayed: 'ಆಡಿದ ಆಟಗಳು',
            totalWins: 'ಒಟ್ಟು ಗೆಲುವು',
            totalLosses: 'ಸೋಲು',
            winRate: 'ಗೆಲುವಿನ ದರ',
            language: 'ಭಾಷೆ',
            theme: 'ಥೀಮ್',
            dark: 'ಗಾಢ',
            light: 'ಬೆಳಕು',
            haptic: 'ಸ್ಪರ್ಶ ಪ್ರತಿಕ್ರಿಯೆ',
            musicVol: 'ಸಂಗೀತ ಶಬ್ದ',
            sfxVol: 'ಶಬ್ದ ಪರಿಣಾಮ',
            on: 'ಆನ್',
            off: 'ಆಫ್',
            rulesTitle: 'ಚೆನ್ನೆಮಾನೆ ಹೇಗೆ ಆಡಬೇಕು',
            rulesContent: [
                { h: 'ಗುರಿ', p: 'ಎದುರಾಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಳುಗಳನ್ನು ಸಂಗ್ರಹಿಸಿ. ಕೊನೆಯಲ್ಲಿ ಹೆಚ್ಚು ಕಾಳಿರುವ ಆಟಗಾರ ಗೆಲ್ಲುತ್ತಾರೆ.' },
                { h: 'ಆರಂಭ', p: 'ಮನೆಯಲ್ಲಿ ೧೪ ಗುಂಡಿಗಳಿವೆ — ಪ್ರತಿ ಆಟಗಾರರಿಗೆ ೭. ಪ್ರತಿ ಗುಂಡಿಯಲ್ಲಿ ೪ ಹುಣಸೆ ಕಾಳುಗಳು (ಒಟ್ಟು ೫೬).' },
                { h: 'ಸರದಿ', p: 'ನಿಮ್ಮ ಕಡೆಯ ಖಾಲಿ ಇಲ್ಲದ ಯಾವುದೇ ಗುಂಡಿಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ. ಎಲ್ಲ ಕಾಳುಗಳನ್ನು ತೆಗೆದು ಪ್ರತಿ ಗುಂಡಿಗೆ ಒಂದೊಂದಾಗಿ ಹಾಕಿ.' },
                { h: '೪ ಕಾಳು ನಿಯಮ', p: 'ಯಾವುದೇ ಗುಂಡಿಯಲ್ಲಿ ನಿಖರವಾಗಿ ೪ ಕಾಳು ತುಂಬಿದರೆ, ಅವುಗಳನ್ನು ಆ ಕ್ಷಣವೇ ಆಟಗಾರ ಸಂಗ್ರಹಿಸಿಕೊಳ್ಳುತ್ತಾರೆ.' },
                { h: 'ಕೊನೆಯ ಕಾಳು ಸಂಗ್ರಹ', p: 'ಕೊನೆಯ ಕಾಳು ಹಾಕಿದ ನಂತರ, ಮುಂದಿನ ಗುಂಡಿ ಖಾಲಿ ಇದ್ದರೆ ಅದನ್ನು ಬಿಟ್ಟು ಅದರ ಮುಂದಿನ ಗುಂಡಿಯ ಕಾಳುಗಳನ್ನು ಸಂಗ್ರಹಿಸಿ.' },
                { h: 'ಆಟ ಮುಗಿಯುವಿಕೆ', p: 'ಆಟ ಮುಗಿಯುವಾಗ ಬೋರ್ಡ್‌ನಲ್ಲಿ ಉಳಿದ ಎಲ್ಲ ಕಾಳುಗಳನ್ನು ಎದುರಾಳಿ ಸಂಗ್ರಹಿಸುತ್ತಾರೆ. ಹೆಚ್ಚು ಕಾಳಿರುವ ಆಟಗಾರ ಗೆಲ್ಲುತ್ತಾರೆ.' }
            ],
            confirmRestart: 'ಆಟ ಮರಳಿ ಶುರು ಮಾಡಬೇಕೇ?',
            yes: 'ಹೌದು',
            cancel: 'ರದ್ದು',
            noMoves: 'ಯಾವ ಚಲನೆಯೂ ಲಭ್ಯವಿಲ್ಲ!',
            selectPit: 'ನಿಮ್ಮ ಕಡೆಯ ಖಾಲಿ ಇಲ್ಲದ ಗುಂಡಿಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ.',
            capturing: 'ಸಂಗ್ರಹಿಸುತ್ತಿದ್ದಾರೆ!',
            backMenu: '← ಹಿಂದೆ',
            chooseModeTitle: 'ಆಟದ ವಿಧ ಆರಿಸಿ',
            fpsLimit: 'FPS ಮಿತಿ',
            fpsAuto: 'ಸ್ವಯಂ (ಶಿಫಾರಸು)',
            fpsUnlimited: 'ಮಿತಿಯಿಲ್ಲದ',
            performance: 'ಕಾರ್ಯಕ್ಷಮತೆ',
            showFps: 'ಮಾನಿಟರ್ ತೋರಿಸು',
            fpsNotSupported: '{fps} FPS ಈ ಸಾಧನದಲ್ಲಿ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. ಬದಲಾಗಿ {fallback} FPS ಬಳಸಲಾಗುತ್ತಿದೆ.'
        }
    };

    // ── Public API ──────────────────────────────────────────
    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved) current = { ...defaults, ...saved };
        } catch (_) {}
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }

    function get(key) { return current[key]; }

    function set(key, value) {
        current[key] = value;
        save();
    }

    function t(key) {
        const lang = current.language || 'en';
        return (strings[lang] || strings.en)[key] || strings.en[key] || key;
    }

    function getAll() { return { ...current }; }

    // initialise
    load();

    return { load, save, get, set, t, getAll };
})();

window.Settings = Settings;
