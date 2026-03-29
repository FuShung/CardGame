(function() {
    // #region --- 變數 ---

    // UI控件
    const lbRules = document.getElementById('rules-label');
    const lbDeckName = document.getElementById('lb-deck-name');
    const lbDeckRemaining = document.getElementById('lb-deck-remaining');
    const lbCurrentPlayer = document.getElementById('lb-current-player');
    const lbNextPlayer    = document.getElementById('lb-next-player');
    const lbDrawMode      = document.getElementById('lb-draw-mode');
    const groupDeckList = document.getElementById('sidebar-deck-list');
    const groupPlayerList = document.getElementById('sidebar-player-list');
    const board = document.getElementById('card-display-box');
    const cardBack = document.getElementById('card-back');
    const cardFront = document.getElementById('card-front');
    const lbCardName = document.getElementById('card-name-text');
    const lbCardRarity = document.getElementById('card-rarity-badge');
    const lbCardEffect = document.getElementById('card-effect-text');
    const lbCardScoreChanges = document.getElementById('card-score-changes');
    const challengeUI         = document.getElementById('challenge-ui');
    const btnChallengeSuccess = document.getElementById('btn-challenge-success');
    const btnChallengeFail    = document.getElementById('btn-challenge-fail');
    const gbTimer = document.getElementById('timer-ui');
    const btnStartTimer = document.getElementById('start-timer-btn');
    const timeRunningBox = document.getElementById('timer-running-box');
    const lbTimeClock = document.getElementById('timer-clock');
    const timeBar = document.getElementById('timer-bar');
    const gameMain   = document.getElementById('game-main');
    const setupPanel = document.getElementById('setup-panel');
    const setupList  = document.getElementById('setup-player-list');

    // 資料
    var cards = {};
    var decks = {};
    var roles = [];
    var activeDeck = null;
    var drawCounter = 1;
    var activeTimer = null;
    var targetTime = 0;
    var lastDrawnCard = '';

    // 遊戲狀態（傳給模組函式）
    const S = {
        get players()          { return players; },
        set players(v)         { players = v; },
        get currentPlayerIdx() { return currentPlayerIdx; },
        set currentPlayerIdx(v){ currentPlayerIdx = v; },
        get drawMode()         { return drawMode; },
        set drawMode(v)        { drawMode = v; },
        get drawModeRole()     { return drawModeRole; },
        set drawModeRole(v)    { drawModeRole = v; },
        get overridePlayer()   { return overridePlayer; },
        set overridePlayer(v)  { overridePlayer = v; },
        get pendingScoreChanges() { return pendingScoreChanges; },
        set pendingScoreChanges(v){ pendingScoreChanges = v; },
        get decks()            { return decks; },
        get roles()            { return roles; },
        get activeDeck()       { return activeDeck; },
    };

    var players = [];
    var currentPlayerIdx = 0;
    var drawMode = ROUND_PLAYER;
    var drawModeRole = '';
    var overridePlayer = null;
    var pendingKeepDrawer = null; // 舊格式相容，保留
    var currentDrawerIdx = 0;
    var nextUnknown = false;
    var pendingScoreChanges = [];

    const audio = {
        sounds: {
            tick:    new Audio('media/bee.mp3',     { preload: 'auto' }),
            correct: new Audio('media/correct.mp3', { preload: 'auto' })
        },
        playTick()  { this._play(this.sounds.tick); },
        playAlarm() { this._play(this.sounds.correct); },
        _play(a) {
            if (!a) return;
            a.pause(); a.currentTime = 0;
            a.play().catch(e => console.warn('音訊播放被阻擋:', e));
        }
    };
    // #endregion

    // #region --- 玩家設定畫面 ---
    function showSetup() {
        setupPanel.classList.remove('hidden');
        gameMain.classList.add('hidden');
        document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-content').forEach(p => p.classList.add('hidden'));
        document.getElementById('sidebar-panel').classList.remove('open');
    }

    function showGame() {
        setupPanel.classList.add('hidden');
        gameMain.classList.remove('hidden');
        renderPlayerPanel();
    }

    function renderPlayerPanel() {
        if (!groupPlayerList) return;
        groupPlayerList.innerHTML = '';
        players.forEach((p, idx) => {
            const isCurrent = idx === currentDrawerIdx;
            const isNext    = !nextUnknown && idx === currentPlayerIdx;
            let cls = 'player-row';
            if (isCurrent && isNext) cls += ' player-current player-drawing player-both';
            else if (isCurrent)      cls += ' player-drawing';
            else if (isNext)         cls += ' player-current';

            const row = document.createElement('div');
            row.className = cls;

            const nameEl = document.createElement('span');
            nameEl.className = 'player-name';
            nameEl.textContent = p.name;

            const metaEl = document.createElement('span');
            metaEl.className = 'player-meta';
            const tags = [];
            if (isCurrent) tags.push('🎴');
            if (isNext && !isCurrent) tags.push('▶');
            if (p.role) tags.push(p.role);
            tags.push(`${p.score ?? 0} 分`);
            metaEl.textContent = tags.join(' · ');

            row.appendChild(nameEl);
            row.appendChild(metaEl);
            groupPlayerList.appendChild(row);
        });

        if (lbDrawMode) {
            const modeNames = ['隨機玩家', '輪流玩家', '隨機身分', '輪流身分'];
            const modeName = modeNames[drawMode] || '—';
            lbDrawMode.textContent = drawModeRole ? `${modeName}（${drawModeRole}）` : modeName;
        }
        const cur = players[currentDrawerIdx];
        if (lbCurrentPlayer) {
            lbCurrentPlayer.textContent = cur ? (cur.role ? `${cur.name}（${cur.role}）` : cur.name) : '—';
        }
        if (lbNextPlayer) {
            if (nextUnknown) {
                lbNextPlayer.textContent = '未定';
            } else {
                const next = players[currentPlayerIdx];
                lbNextPlayer.textContent = next ? (next.role ? `${next.name}（${next.role}）` : next.name) : '—';
            }
        }
    }

    function renderSetupList() {
        setupList.innerHTML = '';
        players.forEach((p, idx) => {
            const row = document.createElement('div');
            row.className = 'setup-player-row';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = `玩家 ${idx + 1}`;
            nameInput.value = p.name;
            nameInput.addEventListener('input', () => { p.name = nameInput.value; });

            const roleSel = document.createElement('select');
            const optRandom = document.createElement('option');
            optRandom.value = '__random__'; optRandom.textContent = '隨機身分';
            roleSel.appendChild(optRandom);
            roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.name; opt.textContent = r.name;
                if (p.role === r.name) opt.selected = true;
                roleSel.appendChild(opt);
            });
            if (!p.role) roleSel.value = '__random__';
            roleSel.addEventListener('change', () => { p.role = roleSel.value === '__random__' ? '' : roleSel.value; });

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-outline-red'; btnDel.textContent = '✕';
            btnDel.addEventListener('click', () => { players.splice(idx, 1); renderSetupList(); });

            if (roles.length > 0) row.appendChild(roleSel);
            row.appendChild(nameInput);
            row.appendChild(btnDel);
            setupList.appendChild(row);
        });
    }

    function startGame() {
        let autoIdx = 1;
        players.forEach(p => { if (!p.name.trim()) p.name = `玩家${autoIdx}`; autoIdx++; });
        players = players.filter(p => p.name.trim());
        if (players.length === 0) { alert('請至少新增一位玩家'); return; }

        if (roles.length > 0) {
            const pool = [];
            roles.forEach(r => { for (let i = 0; i < r.count; i++) pool.push(r.name); });
            players.forEach(p => { if (p.role) { const i = pool.indexOf(p.role); if (i !== -1) pool.splice(i, 1); } });
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            players.forEach(p => { if (!p.role) p.role = pool.shift() || ''; });
        }

        getDeckData().then(data => {
            if (data) { data.players = players.map(p => ({ name: p.name, role: p.role, score: p.score ?? 0 })); setStorageData(data); }
        });
        showGame();
    }

    document.getElementById('btn-add-player').addEventListener('click', () => { players.push({ name: '', role: '' }); renderSetupList(); });
    document.getElementById('btn-start-game').addEventListener('click', startGame);
    document.getElementById('btn-restart-game').addEventListener('click', () => {
        currentPlayerIdx = 0; pendingKeepDrawer = null; currentDrawerIdx = 0;
        nextUnknown = false; pendingScoreChanges = []; overridePlayer = null;
        renderSetupList(); showSetup();
    });
    document.getElementById('btn-clear-scores').addEventListener('click', () => {
        if (!confirm('確定清除所有玩家積分？')) return;
        players.forEach(p => { p.score = 0; });
        renderPlayerPanel();
        getDeckData().then(data => {
            if (data) { data.players = players.map(p => ({ name: p.name, role: p.role, score: 0 })); setStorageData(data); }
        });
    });

    btnChallengeSuccess.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = cards[lastDrawnCard];
        if (!card) return;
        const drawerIdx = currentPlayerIdx;
        const results = applyActions(card, 'success', S);
        commitPendingScores(S, savePlayersAsync);
        challengeUI.classList.add('hidden');
        renderChallengeResult(results, true, drawerIdx);
        advancePlayer(card, S);
        nextUnknown = false;
        if (card._resolved_next_deck) { selectDeck(decks[card._resolved_next_deck]); delete card._resolved_next_deck; }
        renderPlayerPanel();
    });

    btnChallengeFail.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = cards[lastDrawnCard];
        if (!card) return;
        const drawerIdx = currentPlayerIdx;
        const results = applyActions(card, 'fail', S);
        commitPendingScores(S, savePlayersAsync);
        challengeUI.classList.add('hidden');
        renderChallengeResult(results, false, drawerIdx);
        advancePlayer(card, S);
        nextUnknown = false;
        if (card._resolved_next_deck) { selectDeck(decks[card._resolved_next_deck]); delete card._resolved_next_deck; }
        renderPlayerPanel();
    });
    // #endregion

    // #region --- 註冊事件 ---
    board.addEventListener('click', () => {
        if (!challengeUI.classList.contains('hidden')) return;
        draw();
    });
    btnStartTimer.addEventListener('click', (e) => { e.stopPropagation(); startTimer(); });

    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const panelId = btn.dataset.panel;
            const panel = document.getElementById('sidebar-panel');
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.sidebar-content').forEach(p => p.classList.add('hidden'));
            if (isActive) {
                panel.classList.remove('open');
            } else {
                btn.classList.add('active');
                document.getElementById(panelId).classList.remove('hidden');
                panel.classList.add('open');
            }
        });
    });
    // #endregion

    // #region --- 牌組 ---
    function selectDeck(deck) {
        activeDeck = deck;
        document.querySelectorAll('.btn-deck').forEach(btn => btn.checked = false);
        const deckChk = document.getElementById(`btn-deck-${deck.name}`);
        if (deckChk) deckChk.checked = true;
        lbDeckName.textContent = deck.name;
        lbDeckRemaining.textContent = deck.runtimeStates.remaining;
        board.innerHTML = '';
        board.className = '';
        board.appendChild(cardBack);
    }

    function renderDecks() {
        const activeDeckId = activeDeck ? activeDeck.name : null;
        groupDeckList.innerHTML = '';
        Object.values(decks).forEach(deck => {
            if (!deck.visible) return;
            if (!deck.runtimeStates) deck.runtimeStates = buildDeckState(deck);

            const container = document.createElement('div');
            container.className = 'input-container';

            const deckChk = document.createElement('input');
            deckChk.type = 'checkbox';
            deckChk.id = `btn-deck-${deck.name}`;
            deckChk.className = 'btn-deck input-check-blue';
            deckChk.dataset.labelOff = deck.name;
            deckChk.dataset.labelOn  = deck.name;
            deckChk.checked = deck.name === activeDeckId;
            deckChk.addEventListener('change', () => { if (deckChk.checked) selectDeck(deck); else deckChk.checked = true; });

            const lbRemaining = document.createElement('span');
            lbRemaining.id = `lb-deck-remaining-${deck.name}`;
            lbRemaining.textContent = deck.runtimeStates.remaining;

            const btnRefresh = document.createElement('button');
            btnRefresh.className = 'btn-primary-blue';
            btnRefresh.textContent = '↺';
            btnRefresh.title = '刷新牌組';
            btnRefresh.addEventListener('click', () => {
                deck.runtimeStates = buildDeckState(deck);
                if (deck.name === activeDeckId) selectDeck(deck);
            });

            container.appendChild(deckChk);
            container.appendChild(lbRemaining);
            container.appendChild(btnRefresh);
            groupDeckList.appendChild(container);
        });
    }
    // #endregion

    // #region --- 抽卡 ---
    function savePlayersAsync() {
        getDeckData().then(data => {
            if (data) { data.players = players.map(p => ({ name: p.name, role: p.role, score: p.score ?? 0 })); setStorageData(data); }
        });
    }

    function draw() {
        resetTimer();
        if (!activeDeck) return;
        commitPendingScores(S, savePlayersAsync);
        const cardName = drawByDeck(activeDeck.name, S, lbDeckRemaining);
        lastDrawnCard = cardName;
        if (cardName && cards[cardName]) {
            const card = cards[cardName];
            const drawerIdx = currentPlayerIdx;
            currentDrawerIdx = drawerIdx;
            if (card.is_challenge) {
                nextUnknown = true;
                renderCardEffect(cardName, [], drawerIdx);
                challengeUI.classList.remove('hidden');
                renderPlayerPanel();
            } else {
                const results = applyActions(card, null, S);
                advancePlayer(card, S);
                nextUnknown = false;
                if (card._resolved_next_deck) { selectDeck(decks[card._resolved_next_deck]); delete card._resolved_next_deck; }
                renderCardEffect(cardName, results, drawerIdx);
                renderPlayerPanel();
            }
        } else {
            renderCardEffect(cardName, [], currentPlayerIdx);
        }
    }

    function renderCardEffect(cardName, scoreResults = [], drawerIdx = currentPlayerIdx) {
        if (!cardName) {
            board.innerHTML = ''; board.className = ''; board.appendChild(cardBack); return;
        }
        const card = cards[cardName];
        const res = parseEffect(card.effect);

        lbCardRarity.textContent = '★'.repeat(card.rarity);
        lbCardName.textContent = card.name;
        setTextLines(lbCardEffect, res.text);
        challengeUI.classList.add('hidden');
        lbCardScoreChanges.innerHTML = '';

        const drawer = players[drawerIdx];
        if (drawer) {
            const drawerRow = document.createElement('p');
            drawerRow.className = 'score-change-line drawer-label';
            drawerRow.textContent = `🎴 ${drawer.role ? `${drawer.name}（${drawer.role}）` : drawer.name}`;
            lbCardScoreChanges.appendChild(drawerRow);
        }

        if (scoreResults.length) {
            lbCardScoreChanges.appendChild(Object.assign(document.createElement('div'), { className: 'glass-divider' }));
            scoreResults.forEach(r => {
                const row = document.createElement('p');
                row.className = 'score-change-line';
                row.textContent = formatActionResult(r, S);
                lbCardScoreChanges.appendChild(row);
            });
        }

        if (res.hasTime) {
            gbTimer.classList.remove('hidden');
            targetTime = res.timeVal;
            btnStartTimer.classList.replace('btn-primary-green', 'btn-primary-red');
            lbTimeClock.textContent = `${Math.floor(targetTime/60).toString().padStart(2,'0')}:${(targetTime%60).toString().padStart(2,'0')}`;
        } else if (!gbTimer.classList.contains('hidden')) {
            gbTimer.classList.add('hidden');
        }

        cardFront.className = 'glass-card card-glow-' + drawCounter;
        drawCounter = drawCounter >= 5 ? 1 : drawCounter + 1;
        board.innerHTML = '';
        board.appendChild(cardFront);
    }

    function renderChallengeResult(results, isSuccess, drawerIdx = currentPlayerIdx) {
        lbCardScoreChanges.innerHTML = '';
        const drawer = players[drawerIdx];
        if (drawer) {
            const drawerRow = document.createElement('p');
            drawerRow.className = 'score-change-line drawer-label';
            drawerRow.textContent = `🎴 ${drawer.role ? `${drawer.name}（${drawer.role}）` : drawer.name}`;
            lbCardScoreChanges.appendChild(drawerRow);
        }
        lbCardScoreChanges.appendChild(Object.assign(document.createElement('div'), { className: 'glass-divider' }));
        const label = document.createElement('p');
        label.className = 'score-change-line';
        label.textContent = isSuccess ? '✓ 挑戰成功' : '✕ 挑戰失敗';
        label.style.color = isSuccess ? 'rgb(34,197,94)' : 'rgb(239,68,68)';
        lbCardScoreChanges.appendChild(label);
        results.forEach(r => {
            const row = document.createElement('p');
            row.className = 'score-change-line';
            row.textContent = formatActionResult(r, S);
            lbCardScoreChanges.appendChild(row);
        });
    }
    // #endregion

    // #region --- 倒計時 ---
    function startTimer() {
        timeRunningBox.classList.remove('hidden');
        btnStartTimer.classList.replace('btn-primary-red', 'btn-primary-green');
        let rem = targetTime;
        if (activeTimer) clearInterval(activeTimer);
        const tick = () => {
            lbTimeClock.textContent = `${Math.floor(rem/60).toString().padStart(2,'0')}:${(rem%60).toString().padStart(2,'0')}`;
            timeBar.style.width = `${(rem / targetTime) * 100}%`;
            if (rem <= 3 && rem > 0 && audio) audio.playTick();
            if (rem === 0) {
                if (audio) audio.playAlarm();
                lbTimeClock.classList.remove('active');
                btnStartTimer.classList.replace('btn-primary-green', 'btn-primary-red');
            }
            if (rem-- <= 0) clearInterval(activeTimer);
        };
        tick();
        activeTimer = setInterval(tick, 1000);
    }

    function resetTimer() {
        if (activeTimer) clearInterval(activeTimer);
        timeBar.style.width = '100%';
    }
    // #endregion

    // #region --- 初始化 ---
    async function initGame() {
        const data = await getDeckData();
        if (!data) return;

        window._pageCleanup = () => {
            if (activeTimer) clearInterval(activeTimer);
            if (audio) { audio.sounds.tick.pause(); audio.sounds.correct.pause(); }
        };

        setTextLines(lbRules, data.rules || '');
        data.cards.forEach(card => cards[card.name] = card);
        renderTitle(data.title);

        if (data.decks) {
            decks = {};
            data.decks.forEach(deck => decks[deck.name] = deck);
        }

        roles = (data.roles || []).map(r => ({ name: r.name, count: r.count || 1 }));
        drawMode = data.player_draw_mode ?? ROUND_PLAYER;
        drawModeRole = data.player_draw_mode_role || '';

        if (!activeDeck) activeDeck = Object.values(decks).find(deck => deck.visible);
        renderDecks();
        selectDeck(activeDeck);

        if (data.players && data.players.length) {
            players = data.players.map(p => ({ name: p.name || '', role: p.role || '', score: p.score ?? 0 }));
            showGame();
        } else {
            const count = data.player_count || 2;
            for (let i = 0; i < count; i++) players.push({ name: '', role: '' });
            renderSetupList();
            showSetup();
        }
    }

    initGame();
    // #endregion
})();
