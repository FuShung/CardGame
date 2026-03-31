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
    const roleAlert       = document.getElementById('role-editor-alert');
    const dataAlert       = document.getElementById('data-editor-alert');
    // #endregion

    const DIGNITY_MODES = new Set([2, 3]);

    // #region --- 身分清單（字典） ---
    // editingRoles: { [name]: { count: number } }
    var editingRoles = {};

    function refreshDrawerRoleSelect(selectedName) {
        const isDignityMode = DIGNITY_MODES.has(parseInt(selectDrawerMode.value));
        selectDrawerRole.classList.toggle('hidden', !isDignityMode);
        if (!isDignityMode) return;
        selectDrawerRole.innerHTML = '';
        Object.keys(editingRoles).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            if (name === selectedName) opt.selected = true;
            selectDrawerRole.appendChild(opt);
        });
    }

    // 渲染單筆身分列，append 到 roleListEl
    function renderRole(name, role) {
        const row = document.createElement('div');
        row.className = 'input-container';
        row.dataset.roleName = name;

        const nameLabel = document.createElement('span');
        nameLabel.innerText = name;

        const cMinus = document.createElement('button');
        cMinus.className = 'btn-outline-dark';
        cMinus.textContent = '−';

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min  = 1;
        countInput.value = role.count;
        countInput.addEventListener('change', () => {
            const v = parseInt(countInput.value);
            editingRoles[name].count = isNaN(v) || v < 1 ? 1 : v;
            countInput.value = editingRoles[name].count;
        });

        cMinus.addEventListener('click', () => {
            if (editingRoles[name].count > 1) {
                editingRoles[name].count--;
                countInput.value = editingRoles[name].count;
            } else {
                renderAlert(roleAlert, `身分「${name}」數量最少為 1，如需移除請按 ✕`, 'gray');
            }
        });

        const cPlus = document.createElement('button');
        cPlus.className = 'btn-outline-blue';
        cPlus.textContent = '+';
        cPlus.addEventListener('click', () => {
            editingRoles[name].count++;
            countInput.value = editingRoles[name].count;
            renderAlert(roleAlert);
        });

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-outline-red';
        btnDel.textContent = '✕';
        btnDel.addEventListener('click', () => {
            delete editingRoles[name];
            row.remove();
            refreshDrawerRoleSelect(selectDrawerRole.value);
            renderAlert(roleAlert, `已刪除身分「${name}」`, 'red');
        });

        [nameLabel, cMinus, countInput, cPlus, btnDel].forEach(c => row.appendChild(c));
        roleListEl.appendChild(row);
    }

    function renderRoleList() {
        roleListEl.innerHTML = '';
        Object.entries(editingRoles).forEach(([name, role]) => renderRole(name, role));
        refreshDrawerRoleSelect(selectDrawerRole.value);
    }
    // #endregion

    // #region --- 新增身分 ---
    const inputRole = document.getElementById('input-role');

    function addRole() {
        const name = inputRole.value.trim();
        if (!name) {
            renderAlert(roleAlert, '請輸入身分名稱', 'red');
            inputRole.focus();
            return;
        }
        if (editingRoles[name]) {
            renderAlert(roleAlert, `身分「${name}」已存在`, 'red');
            inputRole.focus();
            return;
        }
        editingRoles[name] = { count: 1 };
        renderRole(name, editingRoles[name]);
        refreshDrawerRoleSelect(selectDrawerRole.value);
        inputRole.value = '';
        renderAlert(roleAlert, `身分「${name}」新增完成`, 'green');
    }

    document.getElementById('btn-add-role').addEventListener('click', addRole);
    inputRole.addEventListener('keydown', e => { if (e.key === 'Enter') addRole(); });
    // #endregion

    // #region --- 載入 ---
    async function load() {
        const data = await getDeckData();
        if (!data) return;

        inputTitle.value = data.title || '';
        inputRules.value = data.rules || '';
        selectDrawerMode.value = String(data.player_draw_mode ?? 1);

        editingRoles = {};
        (data.roles || []).forEach(r => {
            if (r.name) editingRoles[r.name] = { count: r.count || 1 };
        });
        renderRoleList();
        refreshDrawerRoleSelect(data.player_draw_mode_role || '');
    }
    // #endregion

    // #region --- 儲存 ---
    async function save() {
        const title = inputTitle.value.trim();
        if (!title) {
            renderAlert(dataAlert, '請輸入標題', 'red');
            inputTitle.focus();
            return;
        }
        const drawerMode = parseInt(selectDrawerMode.value);
        const data = await getDeckData();
        data.title                 = title;
        data.rules                 = inputRules.value;
        data.player_draw_mode      = drawerMode;
        data.player_draw_mode_role = DIGNITY_MODES.has(drawerMode) ? selectDrawerRole.value : '';
        data.roles = Object.entries(editingRoles).map(([name, r]) => ({ name, count: r.count }));
        setStorageData(data);
        renderTitle(title);
        renderAlert(dataAlert, `遊戲「${title}」儲存完成`, 'green');
    }
    // #endregion

    // #region --- 事件綁定 ---
    selectDrawerMode.addEventListener('change', () => {
        refreshDrawerRoleSelect(selectDrawerRole.value);
        renderAlert(dataAlert);
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
        renderAlert(dataAlert, `已匯出遊戲「${data.title}」`, 'green');
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-input').click();
    });

    document.getElementById('import-input').addEventListener('change', (e) => {
        const r = new FileReader();
        r.onload = async (ev) => {
            let data;
            try { data = JSON.parse(ev.target.result); }
            catch {
                renderAlert(dataAlert, '匯入失敗：不是有效的 JSON 格式', 'red');
                return;
            }
            const err = validateDeckData(data);
            if (err) {
                renderAlert(dataAlert, `匯入失敗：${err}`, 'red');
                return;
            }
            setStorageData(ev.target.result);
            await load();
            renderAlert(dataAlert, `已匯入「${data.title}」，共 ${data.cards.length} 張卡牌、${data.decks.length} 個牌組`, 'green');
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
