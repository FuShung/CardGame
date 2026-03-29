(function () {

    // #region --- 資料驗證 ---
    function validateDeckData(data) {
        if (!data || typeof data !== 'object') return '資料格式錯誤';
        if (!data.title || typeof data.title !== 'string') return '缺少 title 欄位';
        if (!Array.isArray(data.cards))  return '缺少 cards 陣列';
        if (!Array.isArray(data.decks))  return '缺少 decks 陣列';
        for (const card of data.cards) {
            if (!card.name) return '卡牌缺少 name 欄位';
            if (typeof card.rarity !== 'number') return `卡牌「${card.name}」缺少 rarity`;
        }
        for (const deck of data.decks) {
            if (!deck.name) return '牌組缺少 name 欄位';
            if (!Array.isArray(deck.pool)) return `牌組「${deck.name}」缺少 pool 陣列`;
        }
        return null;
    }
    // #endregion

    // #region --- DOM refs ---
    const inputTitle       = document.getElementById('input-title');
    const inputRules       = document.getElementById('input-rules');
    const selectDrawerMode = document.getElementById('select-drawer-mode');
    const selectDrawerRole = document.getElementById('select-drawer-role');
    const roleListEl       = document.getElementById('role-list');
    // #endregion

    // 需要指定身分的模式
    const DIGNITY_MODES = new Set([2, 3]);

    // #region --- 身分清單 ---
    var editingRoles = [];

    function refreshDrawerRoleSelect(selectedName) {
        const isDignityMode = DIGNITY_MODES.has(parseInt(selectDrawerMode.value));
        selectDrawerRole.classList.toggle('hidden', !isDignityMode);
        if (!isDignityMode) return;

        selectDrawerRole.innerHTML = '';
        editingRoles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.name;
            opt.textContent = r.name || '（未命名）';
            if (r.name === selectedName) opt.selected = true;
            selectDrawerRole.appendChild(opt);
        });
    }

    function renderRoleList() {
        roleListEl.innerHTML = '';
        editingRoles.forEach((role, idx) => {
            const row = document.createElement('div');
            row.className = 'input-container role-row';

            const nameLabel = document.createElement('span');
            nameLabel.innerText = '身分';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = '身分名稱';
            nameInput.value = role.name;
            nameInput.addEventListener('input', () => {
                editingRoles[idx].name = nameInput.value;
                refreshDrawerRoleSelect(selectDrawerRole.value);
            });

            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.min  = 1;
            countInput.value = role.count;
            countInput.addEventListener('change', () => {
                const v = parseInt(countInput.value);
                editingRoles[idx].count = isNaN(v) || v < 1 ? 1 : v;
                countInput.value = editingRoles[idx].count;
            });

            const cMinus = document.createElement('button');
            cMinus.className = 'btn-outline-dark';
            cMinus.textContent = '−';
            cMinus.addEventListener('click', () => {
                if (editingRoles[idx].count > 1) {
                    editingRoles[idx].count--;
                    countInput.value = editingRoles[idx].count;
                }
            });

            const cPlus = document.createElement('button');
            cPlus.className = 'btn-outline-blue';
            cPlus.textContent = '+';
            cPlus.addEventListener('click', () => {
                editingRoles[idx].count++;
                countInput.value = editingRoles[idx].count;
            });

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-outline-red';
            btnDel.textContent = '✕';
            btnDel.addEventListener('click', () => {
                editingRoles.splice(idx, 1);
                renderRoleList();
                refreshDrawerRoleSelect(selectDrawerRole.value);
            });

            [nameLabel, nameInput, cMinus, countInput, cPlus, btnDel].forEach(c => row.appendChild(c));
            roleListEl.appendChild(row);
        });
        refreshDrawerRoleSelect(selectDrawerRole.value);
    }
    // #endregion

    // #region --- 載入 ---
    async function load() {
        const data = await getDeckData();
        if (!data) return;

        inputTitle.value = data.title || '';
        inputRules.value = data.rules || '';

        selectDrawerMode.value = String(data.player_draw_mode ?? 1);

        editingRoles = (data.roles || []).map(r => ({
            name:  r.name  || '',
            count: r.count || 1,
        }));
        renderRoleList();
        refreshDrawerRoleSelect(data.player_draw_mode_role || '');
    }
    // #endregion

    // #region --- 儲存 ---
    async function save() {
        const title = inputTitle.value.trim();
        if (!title) { alert('標題不能為空'); return; }
        for (const r of editingRoles) {
            if (!r.name.trim()) { alert('身分名稱不能為空'); return; }
        }

        const drawerMode = parseInt(selectDrawerMode.value);
        const data = await getDeckData();
        data.title                = title;
        data.rules                = inputRules.value;
        data.player_draw_mode     = drawerMode;
        data.player_draw_mode_role = DIGNITY_MODES.has(drawerMode) ? selectDrawerRole.value : '';
        data.roles                = editingRoles.map(r => ({ name: r.name.trim(), count: r.count }));
        setStorageData(data);
        renderTitle(title);
        alert('已儲存');
    }
    // #endregion

    // #region --- 事件綁定 ---
    selectDrawerMode.addEventListener('change', () => {
        refreshDrawerRoleSelect(selectDrawerRole.value);
    });

    document.getElementById('btn-add-role').addEventListener('click', () => {
        editingRoles.push({ name: '', count: 1 });
        renderRoleList();
    });

    document.getElementById('btn-save').addEventListener('click', save);

    document.getElementById('btn-export').addEventListener('click', async () => {
        const data = await getDeckData();
        const json = JSON.stringify(data, null, 2).replace(/\n/g, '\r\n');
        const b = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = data.title + '.json';
        a.click();
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-input').click();
    });

    document.getElementById('import-input').addEventListener('change', (e) => {
        const r = new FileReader();
        r.onload = async (ev) => {
            let data;
            try { data = JSON.parse(ev.target.result); }
            catch { alert('匯入失敗：檔案不是有效的 JSON 格式'); return; }
            const err = validateDeckData(data);
            if (err) { alert(`匯入失敗：${err}`); return; }
            setStorageData(ev.target.result);
            await load();
            alert(`已匯入「${data.title}」，共 ${data.cards.length} 張卡牌、${data.decks.length} 個牌組`);
        };
        r.readAsText(e.target.files[0]);
        e.target.value = '';
    });
    // #endregion

    // #region --- 初始化 ---
    async function init() {
        renderTitle('設定');
        await load();
    }

    init();
    // #endregion

})();
