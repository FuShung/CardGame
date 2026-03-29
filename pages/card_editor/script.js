(function() {
    // #region --- 變數 ---
    const inputCardSearch    = document.getElementById("input-card-search");
    const cardDropdown       = document.getElementById("card-dropdown");
    const btnSaveEdit        = document.getElementById("btn-save-edit");
    const btnDeleteCard      = document.getElementById("btn-delete-card");
    const btnList            = document.getElementById("select-card-btn");
    const gbCardList         = document.getElementById("card-prototype-list");
    const cardListModal      = document.getElementById("card-editor-modal");
    const editCardRarityStar = document.getElementById("edit-card-rarity-star");
    const editCardName       = document.getElementById("edit-card-name");
    const editCardEffect     = document.getElementById("edit-card-effect");
    const editCardRarity     = document.getElementById("edit-card-rarity");
    const editIsChallenge    = document.getElementById('edit-is-challenge');
    const actionsList        = document.getElementById('actions-list');

    var cards = {};
    var roles = [];
    var decks_list = {};
    var editingCard = null;
    var editingActions = [];
    // #endregion

    // #region --- 工具列 ---

    // 依輸入框的值更新按鈕狀態與文字
    function refreshToolbar() {
        const val = inputCardSearch.value.trim();
        const exists = !!cards[val];
        const isNew = val && !exists;
        btnSaveEdit.classList.toggle('disabled', !val);
        btnSaveEdit.textContent = isNew ? '新增' : '儲存';
        btnSaveEdit.classList.remove('btn-primary-green', 'btn-primary-blue');
        btnSaveEdit.classList.add(isNew ? 'btn-primary-green' : 'btn-primary-blue');
        btnDeleteCard.classList.toggle('disabled', !exists);
    }

    function updateDropdown(forceAll) {
        const query = forceAll ? '' : inputCardSearch.value.trim().toLowerCase();
        const names = Object.keys(cards).filter(n => !query || n.toLowerCase().includes(query));
        cardDropdown.innerHTML = '';
        if (names.length === 0) { cardDropdown.classList.add('hidden'); return; }
        names.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                inputCardSearch.value = name;
                hideDropdown();
                loadCardToEditor(name);
            });
            cardDropdown.appendChild(li);
        });
        cardDropdown.classList.remove('hidden');
    }

    function hideDropdown() { cardDropdown.classList.add('hidden'); }

    inputCardSearch.addEventListener('input', () => {
        updateDropdown(false);
        refreshToolbar();
    });
    inputCardSearch.addEventListener('focus', () => {
        inputCardSearch.select();
        updateDropdown(true);
    });
    inputCardSearch.addEventListener('blur', () => setTimeout(hideDropdown, 150));
    inputCardSearch.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnSaveEdit.click(); });

    btnList.addEventListener('click', () => cardListModal.classList.remove('hidden'));
    cardListModal.querySelector('.modal-close').onclick = () => cardListModal.classList.add('hidden');

    // 儲存按鈕：新增或儲存合一
    btnSaveEdit.addEventListener('click', () => {
        const val = inputCardSearch.value.trim();
        if (!val) return;
        if (!cards[val]) {
            // 新增
            cards[val] = { name: val, rarity: 1 };
            renderCard(cards[val]);
            loadCardToEditor(val);
        } else {
            // 儲存
            saveEdit();
        }
        refreshToolbar();
    });

    btnDeleteCard.addEventListener('click', () => deleteCard(inputCardSearch.value.trim()));
    // #endregion

    // #region --- 卡牌列表 ---
    function renderCard(card) {
        const existing = document.getElementById(`card-${card.name}`);
        if (existing) {
            existing.querySelector(`#card-${card.name}-rarity`).innerHTML = '★'.repeat(card.rarity);
            return;
        }
        const d = document.createElement('div');
        d.id = `card-${card.name}`;
        d.className = "glass-card";
        d.innerHTML = `<div class="card-info">
            <p id="card-${card.name}-rarity" class="star active">${'★'.repeat(card.rarity)}</p>
            <p>${card.name}</p>
        </div>`;
        const btnGroup = document.createElement('div');
        btnGroup.className = "input-container";
        const selectBtn = document.createElement('button');
        selectBtn.className = "btn-outline-blue";
        selectBtn.innerText = "選擇";
        selectBtn.onclick = () => { loadCardToEditor(card.name); cardListModal.classList.add('hidden'); };
        const deleteBtn = document.createElement('button');
        deleteBtn.className = "btn-outline-red";
        deleteBtn.innerText = "刪除";
        deleteBtn.onclick = () => deleteCard(card.name);
        btnGroup.appendChild(selectBtn);
        btnGroup.appendChild(deleteBtn);
        d.appendChild(btnGroup);
        gbCardList.appendChild(d);
    }
    // #endregion

    // #region --- 編輯區載入 ---
    function loadCardToEditor(name) {
        const card = cards[name];
        if (!card) return;
        editingCard = name;
        inputCardSearch.value = name;
        refreshToolbar();

        editCardName.textContent = card.name;
        editCardEffect.value = card.effect || "";
        const rarity = parseInt(card.rarity) || 1;
        editCardRarity.value = rarity;
        renderStarts(editCardRarityStar, rarity);
        editIsChallenge.checked = !!card.is_challenge;

        // 相容舊格式
        const legacy = [];
        (card.score_changes || []).forEach(sc =>
            legacy.push({ type: 'score', on: 'always',  target: sc.target || 'skip:0', expr: sc.expr || '+1' }));
        (card.score_success || []).forEach(sc =>
            legacy.push({ type: 'score', on: 'success', target: sc.target || 'skip:0', expr: sc.expr || '+1' }));
        (card.score_fail    || []).forEach(sc =>
            legacy.push({ type: 'score', on: 'fail',    target: sc.target || 'skip:0', expr: sc.expr || '-1' }));

        editingActions = legacy.length ? legacy : (card.actions || []).map(a => ({ ...a }));

        renderActionsList();
    }
    // #endregion

    // #region --- 效果列表 ---
        const ON_OPTIONS = [
        ['always',  '總是',   'btn-primary-dark'],
        ['success', '✓ 成功', 'btn-primary-green'],
        ['fail',    '✕ 失敗', 'btn-primary-red'],
    ];

    function buildTargetOptions(sel, current) {
        sel.innerHTML = '';
        [['skip:0','當前玩家'], ['skip:1','下一位'], ['skip:-1','上一位']].forEach(([v, t]) => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = t;
            if (current === v) opt.selected = true;
            sel.appendChild(opt);
        });
        roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = 'role:' + r.name;
            opt.textContent = '身分：' + r.name;
            if (current === opt.value) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function buildNextDrawerOptions(sel, current) {
        sel.innerHTML = '';
        [
            ['', '依照當前模式'],
            ['current:current', '持續抽卡：當前玩家'],
            ['current:next', '持續抽卡：下一位'],
            ['current:prev', '持續抽卡：上一位'],
            ['next', '下一位玩家'],
            ['prev', '上一位玩家'],
            ['mode:0', '隨機玩家'],
            ['mode:1', '輪流玩家'],
            ['mode:2', '隨機身分'],
            ['mode:3', '輪流身分'],
        ].forEach(([v, t]) => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = t;
            if (current === v) opt.selected = true;
            sel.appendChild(opt);
        });
        roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = 'role:' + r.name;
            opt.textContent = '指定身分：' + r.name;
            if (current === opt.value) opt.selected = true;
            sel.appendChild(opt);
        });
        roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = 'current:role:' + r.name;
            opt.textContent = '持續抽卡：' + r.name;
            if (current === opt.value) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function buildDeckOptions(sel, current) {
        sel.innerHTML = '';
        Object.keys(decks_list).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            if (current === name) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function buildOnSelect(action, idx) {
        const btn = document.createElement('button');
        btn.style.width = '5rem';
        btn.style.flexShrink = '0';
        // 非挑戰模式時隱藏
        if (!editIsChallenge.checked) {
            btn.classList.add('hidden');
            return btn;
        }
        function update() {
            const cur = ON_OPTIONS.find(([v]) => v === (editingActions[idx]?.on || 'always')) || ON_OPTIONS[0];
            btn.textContent = cur[1];
            btn.className = cur[2];
        }
        btn.addEventListener('click', () => {
            const curIdx = ON_OPTIONS.findIndex(([v]) => v === (editingActions[idx].on || 'always'));
            editingActions[idx].on = ON_OPTIONS[(curIdx + 1) % ON_OPTIONS.length][0];
            update();
        });
        update();
        return btn;
    }

    function buildDelBtn(idx) {
        const btn = document.createElement('button');
        btn.className = 'btn-primary-red';
        btn.textContent = '✕';
        btn.addEventListener('click', () => { editingActions.splice(idx, 1); renderActionsList(); });
        return btn;
    }

    function renderActionRow(action, idx) {
        const inner = document.createElement('div');
        inner.className = 'input-container full-w';

        const lbAction = document.createElement('label');
        inner.appendChild(lbAction);
        inner.appendChild(buildOnSelect(action, idx));

        if (action.type === 'score') {
            lbAction.innerText = '積分';
            const targetSel = document.createElement('select');
            buildTargetOptions(targetSel, action.target || 'current');
            targetSel.addEventListener('change', () => { editingActions[idx].target = targetSel.value; });
            const exprlabel = document.createElement('label');
            exprlabel.innerText = '計算式'
            const exprInput = document.createElement('input');
            exprInput.type = 'text';
            exprInput.placeholder = '+1、-1~5、*2、/5、=0';
            exprInput.value = action.expr || '';
            exprInput.addEventListener('input', () => { editingActions[idx].expr = exprInput.value; });
            inner.appendChild(targetSel);
            inner.appendChild(exprlabel);
            inner.appendChild(exprInput);

        } else if (action.type === 'swap_roles') {
            lbAction.innerText = '身分交換';
            const labelA = document.createElement('span');
            labelA.textContent = '對掉';
            const selA = document.createElement('select');
            buildTargetOptions(selA, action.target_a || 'current');
            selA.addEventListener('change', () => { editingActions[idx].target_a = selA.value; });
            const labelB = document.createElement('span');
            labelB.textContent = '↔';
            const selB = document.createElement('select');
            buildTargetOptions(selB, action.target_b || 'next');
            selB.addEventListener('change', () => { editingActions[idx].target_b = selB.value; });
            inner.appendChild(labelA);
            inner.appendChild(selA);
            inner.appendChild(labelB);
            inner.appendChild(selB);

        } else if (action.type === 'change_drawer') {
            lbAction.innerText = '抽卡';
            const label = document.createElement('span');
            label.textContent = '改為';
            const targetSel = document.createElement('select');
            buildNextDrawerOptions(targetSel, action.target || '');
            targetSel.addEventListener('change', () => { editingActions[idx].target = targetSel.value; });
            inner.appendChild(label);
            inner.appendChild(targetSel);

        } else if (action.type === 'change_draw_mode') {
            lbAction.innerText = '抽卡模式';
            const modeSel = document.createElement('select');
            [
                ['0', '隨機玩家'],
                ['1', '輪流玩家'],
                ['2', '隨機身分'],
                ['3', '輪流身分'],
            ].forEach(([v, t]) => {
                const opt = document.createElement('option');
                opt.value = v; opt.textContent = t;
                if (String(action.mode) === v) opt.selected = true;
                modeSel.appendChild(opt);
            });
            modeSel.addEventListener('change', () => {
                editingActions[idx].mode = parseInt(modeSel.value);
                renderActionsList();
            });
            inner.appendChild(modeSel);
            // RANDOM_DIGNITY(2) / ROUND_DIGNITY(3) 需額外指定身分
            if (action.mode === 2 || action.mode === 3) {
                const roleLabel = document.createElement('span');
                roleLabel.textContent = '身分';
                const roleSel = document.createElement('select');
                roles.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.name; opt.textContent = r.name;
                    if (action.role === r.name) opt.selected = true;
                    roleSel.appendChild(opt);
                });
                roleSel.addEventListener('change', () => { editingActions[idx].role = roleSel.value; });
                inner.appendChild(roleLabel);
                inner.appendChild(roleSel);
            }

        } else if (action.type === 'change_draw_player') {
            lbAction.innerText = '指定抽卡人員';
            const playerSel = document.createElement('select');
            const presets = ['skip:1','skip:-1','skip:2','skip:-2'];
            [
                ['skip:1',  '下一位(+1)'],
                ['skip:-1', '上一位(-1)'],
                ['skip:2',  '跳過下一位(+2)'],
                ['skip:-2', '跳過上一位(-2)'],
                ['current', '當前玩家再抽一次'],
            ].forEach(([v, t]) => {
                const opt = document.createElement('option');
                opt.value = v; opt.textContent = t;
                if (action.target === v) opt.selected = true;
                playerSel.appendChild(opt);
            });
            roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = 'role:' + r.name;
                opt.textContent = '身分：' + r.name;
                if (action.target === opt.value) opt.selected = true;
                playerSel.appendChild(opt);
            });
            // 自訂偏移
            const skipOpt = document.createElement('option');
            skipOpt.value = '__custom__'; skipOpt.textContent = '自訂偏移...';
            if (action.target?.startsWith('skip:') && !presets.includes(action.target)) skipOpt.selected = true;
            playerSel.appendChild(skipOpt);

            const skipInput = document.createElement('input');
            skipInput.type = 'number';
            skipInput.placeholder = '偏移量';
            skipInput.style.width = '5rem';
            const isCustomSkip = action.target?.startsWith('skip:') && !presets.includes(action.target);
            skipInput.value = isCustomSkip ? action.target.slice(5) : '';
            skipInput.classList.toggle('hidden', !isCustomSkip);

            playerSel.addEventListener('change', () => {
                if (playerSel.value === '__custom__') {
                    skipInput.classList.remove('hidden');
                    editingActions[idx].target = `skip:${skipInput.value || 0}`;
                } else {
                    skipInput.classList.add('hidden');
                    editingActions[idx].target = playerSel.value;
                }
            });
            skipInput.addEventListener('input', () => {
                editingActions[idx].target = `skip:${skipInput.value || 0}`;
            });
            inner.appendChild(playerSel);
            inner.appendChild(skipInput);
        } else if (action.type === 'change_deck') {
            lbAction.innerText = '切換牌組';
            const label = document.createElement('span');
            label.textContent = '改為';
            const targetSel = document.createElement('select');
            buildDeckOptions(targetSel, action.target || '');
            targetSel.addEventListener('change', () => { editingActions[idx].target = targetSel.value; });
            inner.appendChild(label);
            inner.appendChild(targetSel);
        }

        inner.appendChild(buildDelBtn(idx));
        return inner;
    }

    function renderActionsList() {
        actionsList.innerHTML = '';
        editingActions.forEach((action, idx) => actionsList.appendChild(renderActionRow(action, idx)));
    }

    editIsChallenge.addEventListener('change', renderActionsList);

    document.getElementById('btn-add-action').addEventListener('click', () => {
        const type = document.getElementById('select-add-action').value;
        if (!type) return;
        if (type === 'score')
            editingActions.push({ type: 'score', on: 'always', target: 'skip:0', expr: '+1' });
        else if (type === 'swap_roles')
            editingActions.push({ type: 'swap_roles', on: 'always', target_a: 'skip:0', target_b: 'skip:1' });
        else if (type === 'change_drawer')
            editingActions.push({ type: 'change_drawer', on: 'always', target: '' });
        else if (type === 'change_draw_mode')
            editingActions.push({ type: 'change_draw_mode', on: 'always', mode: 0 });
        else if (type === 'change_draw_player')
            editingActions.push({ type: 'change_draw_player', on: 'always', target: 'skip:1' });
        else if (type === 'change_deck')
            editingActions.push({ type: 'change_deck', on: 'always', target: Object.keys(decks_list)[0] || '' });
        renderActionsList();
    });
    // #endregion

    // #region --- 儲存 / 刪除 ---
    async function saveCards() {
        const data = await getDeckData();
        data.cards = Object.values(cards);
        setStorageData(data);
    }

    function saveEdit() {
        if (!editingCard) return;
        const card = cards[editingCard];
        card.effect       = editCardEffect.value.trim();
        card.rarity       = parseInt(editCardRarity.value) || 1;
        card.is_challenge = editIsChallenge.checked || undefined;
        card.actions      = editingActions.length ? editingActions.map(a => ({ ...a })) : undefined;
        delete card.score_changes;
        delete card.score_success;
        delete card.score_fail;
        renderCard(card);
        saveCards();
    }

    function deleteCard(name) {
        if (!name || !cards[name]) return;
        if (!confirm(`確定刪除卡牌「${name}」？`)) return;
        delete cards[name];
        const el = document.getElementById(`card-${name}`);
        if (el) el.remove();
        saveCards();
        if (editingCard === name) {
            editingCard = null;
            editCardName.textContent = '卡牌';
            editCardEffect.value = '';
        }
        // 刪除後選第一張
        const first = Object.keys(cards)[0];
        if (first) loadCardToEditor(first);
        else { inputCardSearch.value = ''; refreshToolbar(); }
    }
    // #endregion

    // #region --- 初始化 ---
    async function initCardEditors() {
        renderTitle("編輯卡牌");
        initStarRating();
        cardListModal.classList.add('hidden');
        const data = await getDeckData();
        if (!data) {
            gbCardList.innerHTML = '<p style="color:var(--primary-red); padding:var(--gap);">資料載入失敗，請至「設定」頁面匯入資料。</p>';
            return;
        }
        cards = {};
        gbCardList.innerHTML = "";
        roles = (data.roles || []).map(r => ({ name: r.name }));
        decks_list = {};
        (data.decks || []).forEach(d => { decks_list[d.name] = d; });
        data.cards.forEach(c => { cards[c.name] = c; renderCard(c); });

        // 預設選第一張卡牌
        const first = Object.keys(cards)[0];
        if (first) loadCardToEditor(first);
        else refreshToolbar();
    }

    initCardEditors();
    // #endregion
})();
