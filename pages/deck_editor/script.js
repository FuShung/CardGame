(function() {
    // #region --- 變數 ---

    // UI 控件
    const gbButtons = document.getElementById("btn-group");
    const inputDeckName = document.getElementById("input-deck-name");
    const btnEditDeck = document.getElementById("btn-edit-deck");
    const btnDeleteDeck = document.getElementById("btn-delete-deck");
    const gbDeckList = document.getElementById("deck-list");
    const deckEditModal = document.getElementById("decks-editor-modal");
    const editDeckName = document.getElementById("edit-deck-name");
    const editDeckMode = document.getElementById("edit-deck-mode");
    const lbEditorModeTitle = document.getElementById("editor-mode-title");
    const lbDeckTotalCount = document.getElementById("editor-total-count");
    const editorAddButtons = document.getElementById("editor-add-buttons");
    const editorListContainer = document.getElementById("editor-list-container");
    const btnCancelEdit = document.getElementById("btn-cancel-edit");
    const btnSaveEdit = document.getElementById("btn-save-edit");
    const tabCards = document.getElementById("tab-cards");
    const tabDecks = document.getElementById("tab-decks");

    // 資料
    var cards = [];       // 所有卡牌名稱清單
    var decks = {};       // 所有牌組 { name: deckObj }
    var editingPool = []; // 編輯中的牌池（暫存），元素為 { name, count }
    var editorSourceTab = 'cards'; // 目前左欄顯示的分頁：'cards' | 'decks'
    var editingDeckName = ''; // 目前正在編輯的牌組名稱（用於循環引用檢測）
    // #endregion

    // #region --- 註冊事件 ---
    inputDeckName.addEventListener('input', renderButtons);
    inputDeckName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') editInputDeck();
    });
    btnEditDeck.addEventListener('click', editInputDeck);
    btnDeleteDeck.addEventListener('click', deleteInputDeck);
    btnCancelEdit.addEventListener('click', closeDeckEditor);
    btnSaveEdit.addEventListener('click', saveEdit);

    editDeckMode.addEventListener('change', () => {
        toggleEditorModeUI();
        rebuildEditingPool();
        renderEditorList();
    });

    tabCards.addEventListener('click', () => switchEditorTab('cards'));
    tabDecks.addEventListener('click', () => switchEditorTab('decks'));
    // #endregion

    // #region --- 渲染 ---

    // 根據輸入框內容更新按鈕狀態
    function renderButtons() {
        const selectDeck = inputDeckName.value.trim();
        if (selectDeck) {
            btnEditDeck.classList.remove("disabled");
            if (decks[selectDeck]) {
                btnEditDeck.innerText = "修改";
                btnEditDeck.className = "btn-lg btn-primary-blue";
                btnDeleteDeck.classList.remove("disabled");
            } else {
                btnEditDeck.innerText = "新增";
                btnEditDeck.className = "btn-lg btn-primary-green";
                if (!btnDeleteDeck.classList.contains("disabled")) {
                    btnDeleteDeck.classList.add("disabled");
                }
            }
        } else {
            if (!btnEditDeck.classList.contains("disabled")) btnEditDeck.classList.add("disabled");
            if (!btnDeleteDeck.classList.contains("disabled")) btnDeleteDeck.classList.add("disabled");
        }
    }

    // 渲染單一牌組卡片到列表
    function renderDeck(deck) {
        const deckCount = countDeckPool(deck);
        const div = document.createElement('div');
        div.id = `deck-${deck.name}`;
        div.className = `glass-card deck-item ${deck.visible ? 'deck-visible' : ''}`;

        const headerDiv = document.createElement('div');
        headerDiv.className = "deck-header";

        const labelDeckName = document.createElement('span');
        labelDeckName.className = "glass-card-header";
        labelDeckName.id = `lb-${deck.name}-name`;
        labelDeckName.innerText = deck.name;
        labelDeckName.title = `切換${deck.visible ? '隱藏' : '顯示'}${deck.name}`;
        labelDeckName.onclick = () => switchVisible(deck.name);

        const lbDeckCount = document.createElement('span');
        lbDeckCount.className = "glass-card-content";
        lbDeckCount.id = `lb-${deck.name}-count`;
        lbDeckCount.innerText = `${deckCount} 枚卡片`;

        headerDiv.appendChild(labelDeckName);
        headerDiv.appendChild(lbDeckCount);

        const btnGroup = document.createElement('div');
        btnGroup.className = "input-container";

        const editBtn = document.createElement('button');
        editBtn.className = "btn-outline-blue";
        editBtn.innerText = "修改";
        editBtn.onclick = () => editDeck(deck.name);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "btn-outline-red";
        deleteBtn.innerText = "刪除";
        deleteBtn.onclick = () => deleteDeck(deck.name);

        btnGroup.appendChild(editBtn);
        btnGroup.appendChild(deleteBtn);

        div.appendChild(headerDiv);
        div.appendChild(btnGroup);
        gbDeckList.appendChild(div);
    }

    // 更新列表中某牌組的卡片數量顯示
    function refreshDeckCount(deckName) {
        const el = document.getElementById(`lb-${deckName}-count`);
        if (el) el.innerText = `${countDeckPool(decks[deckName])} 枚卡片`;
    }
    // #endregion

    // #region --- 牌組狀態 ---
    function editInputDeck() {
        editDeck(inputDeckName.value.trim());
    }

    function deleteInputDeck() {
        deleteDeck(inputDeckName.value.trim());
    }

    // 開啟牌組編輯器（新增或修改）
    function editDeck(deckName) {
        if (!deckName) return;
        if (!decks[deckName]) {
            decks[deckName] = {
                name: deckName,
                draw_mode: 1,
                visible: true,
                pool: [],
            };
            renderDeck(decks[deckName]);
            saveDecks();
        }

        const deck = decks[deckName];
        editingDeckName = deckName;
        editDeckName.textContent = deck.name;
        editDeckMode.value = deck.draw_mode;

        // 將牌組的 pool 複製為編輯暫存
        editingPool = deck.pool.map(item => {
            if (typeof item === 'object') return { name: item.name, count: item.count };
            return { name: item, count: 1 };
        });

        if (!gbButtons.classList.contains("disabled")) gbButtons.classList.add("disabled");
        if (!gbDeckList.classList.contains("disabled")) gbDeckList.classList.add("disabled");

        deckEditModal.classList.remove("hidden");

        // 預設顯示卡牌分頁
        editorSourceTab = 'cards';
        toggleEditorModeUI();
        renderEditorAvailableCards();
        renderEditorList();
    }

    function deleteDeck(deckName) {
        if (!deckName) return;
        if (confirm(`確定刪除牌組 ${deckName}？`)) {
            delete decks[deckName];
            const deckElement = document.getElementById(`deck-${deckName}`);
            if (deckElement) deckElement.remove();
            saveDecks();
            inputDeckName.value = "";
            renderButtons();
        }
    }

    function switchVisible(deckName) {
        let deck = decks[deckName];
        deck.visible = !deck.visible;
        decks[deckName] = deck;
        const deckEl = document.getElementById(`deck-${deckName}`);
        const nameEl = document.getElementById(`lb-${deckName}-name`);
        if (deck.visible) {
            deckEl.className = `glass-card deck-item deck-visible`;
            nameEl.title = `切換隱藏${deck.name}`;
            inputDeckName.value = deck.name;
            renderButtons();
        } else {
            deckEl.className = `glass-card deck-item`;
            nameEl.title = `切換顯示${deck.name}`;
        }
        saveDecks();
    }
    // #endregion

    // #region --- 牌組編輯器 ---

    // 根據模式更新右欄標題文字
    function toggleEditorModeUI() {
        const mode = parseInt(editDeckMode.value);
        const titles = { 0: '隨機模式（可設定數量）', 1: '重抽模式（可設定數量）', 2: '順序模式（可調整順序）' };
        lbEditorModeTitle.textContent = titles[mode] || '---';
    }

    // 切換左欄分頁（卡牌 / 牌組）
    function switchEditorTab(tab) {
        editorSourceTab = tab;
        tabCards.className = tab === 'cards' ? 'btn-primary-blue' : 'btn-outline-blue';
        tabDecks.className = tab === 'decks' ? 'btn-primary-blue' : 'btn-outline-blue';
        renderEditorAvailableCards();
    }

    // 渲染左欄：依分頁顯示可選卡牌或可選牌組
    function renderEditorAvailableCards() {
        editorAddButtons.innerHTML = '';

        if (editorSourceTab === 'cards') {
            // 顯示所有卡牌
            cards.forEach(cardName => {
                const btn = document.createElement('button');
                btn.className = "btn-outline-blue editor-source-btn";
                btn.innerText = `+ ${cardName}`;
                btn.onclick = () => addCardToEditor(cardName);
                editorAddButtons.appendChild(btn);
            });
        } else {
            // 顯示所有牌組，排除自身及會造成循環引用的牌組
            Object.keys(decks).forEach(deckName => {
                if (deckName === editingDeckName) return; // 排除自身
                if (wouldCauseCycle(editingDeckName, deckName)) return; // 排除循環引用

                const btn = document.createElement('button');
                btn.className = "btn-outline-blue editor-source-btn";
                btn.innerText = `+ ${deckName}`;
                btn.onclick = () => addCardToEditor(deckName);
                editorAddButtons.appendChild(btn);
            });

            // 若所有牌組都被排除，顯示提示
            if (editorAddButtons.children.length === 0) {
                const hint = document.createElement('span');
                hint.style.cssText = "color:var(--text-secondary); font-size:var(--text-small-size);";
                hint.innerText = '無可用牌組（避免循環引用）';
                editorAddButtons.appendChild(hint);
            }
        }
    }

    /**
     * 檢查將 candidateDeck 加入 targetDeck 的牌池是否會造成循環引用。
     * 使用 DFS 遍歷 candidateDeck 的所有子牌組，若途中出現 targetDeck 則代表有循環。
     * @param {string} targetDeck - 正在編輯的牌組名稱
     * @param {string} candidateDeck - 想要加入的牌組名稱
     * @returns {boolean}
     */
    function wouldCauseCycle(targetDeck, candidateDeck) {
        const visited = new Set();
        const stack = [candidateDeck];
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === targetDeck) return true;
            if (visited.has(current)) continue;
            visited.add(current);
            const deck = decks[current];
            if (!deck) continue;
            deck.pool.forEach(item => {
                const name = typeof item === 'object' ? item.name : item;
                if (decks[name]) stack.push(name); // 只追蹤牌組引用
            });
        }
        return false;
    }

    // 將卡牌加入暫存牌池
    function addCardToEditor(cardName) {
        const mode = parseInt(editDeckMode.value);
        if (mode === SEQUENCE_MODE) {
            // 順序模式：直接新增一筆（允許重複）
            editingPool.push({ name: cardName, count: 1 });
        } else {
            // 隨機/重抽模式：若已存在則 count+1，否則新增
            const existing = editingPool.find(item => item.name === cardName);
            if (existing) {
                existing.count++;
            } else {
                editingPool.push({ name: cardName, count: 1 });
            }
        }
        renderEditorList();
    }

    // 渲染右欄：目前牌池內容
    function renderEditorList() {
        editorListContainer.innerHTML = '';
        const mode = parseInt(editDeckMode.value);

        editingPool.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = "editor-pool-row";

            const nameSpan = document.createElement('span');
            nameSpan.className = "editor-pool-name";
            nameSpan.innerText = item.name;

            const controls = document.createElement('div');
            controls.className = "editor-pool-controls";

            if (mode === SEQUENCE_MODE) {
                // 順序模式：上移、下移按鈕
                const btnUp = document.createElement('button');
                btnUp.className = "btn-outline-blue";
                btnUp.innerText = "↑";
                btnUp.disabled = idx === 0;
                btnUp.onclick = () => moveInEditor(idx, -1);

                const btnDown = document.createElement('button');
                btnDown.className = "btn-outline-blue";
                btnDown.innerText = "↓";
                btnDown.disabled = idx === editingPool.length - 1;
                btnDown.onclick = () => moveInEditor(idx, 1);

                controls.appendChild(btnUp);
                controls.appendChild(btnDown);
            } else {
                // 隨機/重抽模式：數量調整
                const btnMinus = document.createElement('button');
                btnMinus.className = "btn-outline-dark";
                btnMinus.innerText = "−";
                btnMinus.onclick = () => changeRandomCount(idx, -1);

                const countInput = document.createElement('input');
                countInput.type = "number";
                countInput.className = "editor-pool-count";
                countInput.value = item.count;
                countInput.min = 1;
                countInput.addEventListener('change', () => {
                    const val = parseInt(countInput.value);
                    editingPool[idx].count = isNaN(val) || val < 1 ? 1 : val;
                    // 同步顯示修正後的值（如輸入 0 或負數）
                    countInput.value = editingPool[idx].count;
                    updateEditorTotal();
                });

                const btnPlus = document.createElement('button');
                btnPlus.className = "btn-outline-blue";
                btnPlus.innerText = "+";
                btnPlus.onclick = () => changeRandomCount(idx, 1);

                controls.appendChild(btnMinus);
                controls.appendChild(countInput);
                controls.appendChild(btnPlus);
            }

            // 移除按鈕
            const btnRemove = document.createElement('button');
            btnRemove.className = "btn-outline-red";
            btnRemove.innerText = "✕";
            btnRemove.onclick = () => removeFromEditor(idx);

            controls.appendChild(btnRemove);

            row.appendChild(nameSpan);
            row.appendChild(controls);
            editorListContainer.appendChild(row);
        });

        // 更新總數顯示
        updateEditorTotal();
    }

    // 順序模式：移動卡牌位置（dir: -1 上移, 1 下移）
    function moveInEditor(idx, dir) {
        const target = idx + dir;
        if (target < 0 || target >= editingPool.length) return;
        [editingPool[idx], editingPool[target]] = [editingPool[target], editingPool[idx]];
        renderEditorList();
    }

    // 隨機/重抽模式：調整數量（+/- 按鈕用，直接更新對應 input 避免重繪）
    function changeRandomCount(idx, delta) {
        editingPool[idx].count = Math.max(1, (editingPool[idx].count || 1) + delta);
        // 找到對應列的 input 直接更新，不重繪整個列表
        const inputs = editorListContainer.querySelectorAll('.editor-pool-count');
        if (inputs[idx]) inputs[idx].value = editingPool[idx].count;
        updateEditorTotal();
    }

    // 更新右欄總數顯示
    function updateEditorTotal() {
        const total = editingPool.reduce((sum, item) => sum + (item.count || 1), 0);
        lbDeckTotalCount.innerText = `${total} 枚卡片`;
    }

    // 從牌池移除
    function removeFromEditor(idx) {
        editingPool.splice(idx, 1);
        renderEditorList();
    }

    // 模式切換時，將 editingPool 統一轉為 { name, count } 格式（已是此格式，無需額外處理）
    function rebuildEditingPool() {
        // 切換到順序模式時，展開 count > 1 的項目為多筆
        const mode = parseInt(editDeckMode.value);
        if (mode === SEQUENCE_MODE) {
            const expanded = [];
            editingPool.forEach(item => {
                for (let i = 0; i < (item.count || 1); i++) {
                    expanded.push({ name: item.name, count: 1 });
                }
            });
            editingPool = expanded;
        }
        // 切換到隨機/重抽模式時，合併同名項目
        else {
            const merged = {};
            editingPool.forEach(item => {
                if (merged[item.name]) merged[item.name].count += (item.count || 1);
                else merged[item.name] = { name: item.name, count: item.count || 1 };
            });
            editingPool = Object.values(merged);
        }
    }

    // 關閉編輯器，恢復背景操作
    function closeDeckEditor() {
        gbButtons.classList.remove("disabled");
        gbDeckList.classList.remove("disabled");
        if (!deckEditModal.classList.contains("hidden")) {
            deckEditModal.classList.add("hidden");
        }
        editingPool = [];
    }

    // 儲存編輯結果
    function saveEdit() {
        const deckName = editDeckName.textContent.trim();
        const deck = decks[deckName];
        const mode = parseInt(editDeckMode.value);
        deck.draw_mode = mode;

        // 將 editingPool 轉換回正確的 pool 格式
        if (mode === SEQUENCE_MODE) {
            // 順序模式：pool 為純字串陣列
            deck.pool = editingPool.map(item => item.name);
        } else {
            // 隨機/重抽模式：count=1 存字串，count>1 存物件
            deck.pool = editingPool.map(item =>
                item.count === 1 ? item.name : { name: item.name, count: item.count }
            );
        }

        decks[deckName] = deck;
        refreshDeckCount(deckName);
        saveDecks();
        closeDeckEditor();
    }
    // #endregion

    // #region --- 資料存取 ---
    async function saveDecks() {
        let data = await getDeckData();
        data.decks = Object.values(decks);
        setStorageData(data);
    }
    // #endregion

    // #region --- 初始化 ---
    async function initDeckEditor() {
        renderTitle("編輯牌組");

        // 確保 modal 預設隱藏
        if (!deckEditModal.classList.contains("hidden")) {
            deckEditModal.classList.add("hidden");
        }
        // 叉叉關閉按鈕綁定頁面自訂關閉函式（含恢復背景 disabled 狀態）
        deckEditModal.querySelector('.modal-close').onclick = closeDeckEditor;

        const data = await getDeckData();
        if(!data) {
            gbDeckList.innerHTML = '<p style="color:var(--primary-red); padding:var(--gap);">資料載入失敗，請至「資料備份」頁面匯入資料。</p>';
            return;
        }

        // 載入所有卡牌名稱
        cards = data.cards.map(c => c.name);

        // 載入所有牌組
        gbDeckList.innerHTML = "";
        decks = {};
        data.decks.forEach(deck => {
            decks[deck.name] = deck;
            renderDeck(deck);
        });
    }

    initDeckEditor();
    // #endregion
})();