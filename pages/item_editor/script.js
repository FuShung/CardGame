(function() {
    // #region --- 變數 ---
    const inputItemSearch = document.getElementById('input-item-search');
    const itemDropdown    = document.getElementById('item-dropdown');
    const btnSaveItem     = document.getElementById('btn-save-item');
    const btnDeleteItem   = document.getElementById('btn-delete-item');
    const btnList         = document.getElementById('select-item-btn');
    const gbItemList      = document.getElementById('item-prototype-list');
    const itemListModal   = document.getElementById('item-editor-modal');
    const editItemName    = document.getElementById('edit-item-name');
    const editItemDesc    = document.getElementById('edit-item-desc');
    const editItemMax     = document.getElementById('edit-item-max');
    const labelAlert      = document.getElementById('item-editor-alert');

    var items = {};       // { name: { name, description, max_count, properties } }
    var editingItem = null;
    // #endregion

    // #region --- 工具列 ---
    function refreshToolbar() {
        const val = inputItemSearch.value.trim();
        const exists = !!items[val];
        const isNew = val && !exists;
        btnSaveItem.classList.toggle('disabled', !val);
        btnSaveItem.textContent = isNew ? '新增' : '儲存';
        btnSaveItem.classList.remove('btn-primary-green', 'btn-primary-blue');
        btnSaveItem.classList.add(isNew ? 'btn-primary-green' : 'btn-primary-blue');
        btnDeleteItem.classList.toggle('disabled', !exists);
    }

    function updateDropdown(forceAll) {
        const query = forceAll ? '' : inputItemSearch.value.trim().toLowerCase();
        const names = Object.keys(items).filter(n => !query || n.toLowerCase().includes(query));
        itemDropdown.innerHTML = '';
        if (!names.length) { itemDropdown.classList.add('hidden'); return; }
        names.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            li.addEventListener('mousedown', e => {
                e.preventDefault();
                inputItemSearch.value = name;
                hideDropdown();
                loadItemToEditor(name);
                renderAlert(labelAlert);
            });
            itemDropdown.appendChild(li);
        });
        itemDropdown.classList.remove('hidden');
    }

    function hideDropdown() { itemDropdown.classList.add('hidden'); }

    inputItemSearch.addEventListener('input', () => { updateDropdown(false); refreshToolbar(); });
    inputItemSearch.addEventListener('focus', () => { inputItemSearch.select(); updateDropdown(true); });
    inputItemSearch.addEventListener('blur', () => setTimeout(hideDropdown, 150));
    inputItemSearch.addEventListener('keypress', e => { if (e.key === 'Enter') btnSaveItem.click(); });

    btnList.addEventListener('click', () => itemListModal.classList.remove('hidden'));
    itemListModal.querySelector('.modal-close').onclick = () => itemListModal.classList.add('hidden');

    btnSaveItem.addEventListener('click', () => {
        const val = inputItemSearch.value.trim();
        if (!val) return;
        let actionText = '儲存';
        if (!items[val]) {
            actionText = '新增';
            items[val] = { name: val, max_count: 1 };
            renderItemCard(items[val]);
            loadItemToEditor(val);
        }
        
        saveEdit();
        refreshToolbar();
        
        renderAlert(labelAlert, `道具 [${val}] ${actionText}完成`, 'green');
    });

    btnDeleteItem.addEventListener('click', () => { 
        const name = inputItemSearch.value.trim();
        if(deleteItem(name))
            renderAlert(labelAlert, `道具 [${name}] 刪除完成`, 'red');
    });
    // #endregion

    // #region --- 道具列表 ---
    function renderItemCard(item) {
        const existing = document.getElementById(`item-${item.name}`);
        if (existing) {
            existing.querySelector('.item-card-max').textContent = `上限：${item.max_count ?? 1}`;
            return;
        }
        const d = document.createElement('div');
        d.id = `item-${item.name}`;
        d.className = 'glass-card';
        d.innerHTML = `<div class="card-info">
            <p class="item-card-max" style="font-size:var(--text-small-size);color:var(--text-secondary)">上限：${item.max_count ?? 1}</p>
            <p>${item.name}</p>
        </div>`;
        const btnGroup = document.createElement('div');
        btnGroup.className = 'input-container';
        const selectBtn = document.createElement('button');
        selectBtn.className = 'btn-outline-blue';
        selectBtn.innerText = '選擇';
        selectBtn.onclick = () => { 
            loadItemToEditor(item.name); 
            itemListModal.classList.add('hidden');
            renderAlert(labelAlert);
        };
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-outline-red';
        deleteBtn.innerText = '刪除';
        deleteBtn.onclick = () => { 
            if(deleteItem(item.name))
                renderAlert(labelAlert, `道具 [${card.name}] 刪除完成`, 'red');
        };
        btnGroup.appendChild(selectBtn);
        btnGroup.appendChild(deleteBtn);
        d.appendChild(btnGroup);
        gbItemList.appendChild(d);
    }
    // #endregion

    // #region --- 編輯區 ---
    function loadItemToEditor(name) {
        const item = items[name];
        if (!item) return;
        editingItem = name;
        inputItemSearch.value = name;
        refreshToolbar();
        editItemName.textContent = item.name;
        editItemDesc.value = item.description || '';
        editItemMax.value = item.max_count ?? 1;
    }

    function saveEdit() {
        if (!editingItem) return;
        const item = items[editingItem];
        item.description = editItemDesc.value.trim() || undefined;
        item.max_count   = parseInt(editItemMax.value) || 1;
        renderItemCard(item);
        saveItems();
    }

    function deleteItem(name) {
        if (!name || !items[name]) return false;
        if (!confirm(`確定刪除道具「${name}」？`)) return false;
        delete items[name];
        const el = document.getElementById(`item-${name}`);
        if (el) el.remove();
        saveItems();
        if (editingItem === name) {
            editingItem = null;
            editItemName.textContent = '道具';
            editItemDesc.value = '';
            editItemMax.value = 1;
        }
        const first = Object.keys(items)[0];
        if (first) loadItemToEditor(first);
        else { inputItemSearch.value = ''; refreshToolbar(); }
        return true;
    }
    // #endregion

    // #region --- 儲存 ---
    async function saveItems() {
        const data = await getDeckData();
        if (!data) return;
        data.items = Object.values(items).map(i => {
            const obj = { name: i.name, max_count: i.max_count ?? 1 };
            if (i.description) obj.description = i.description;
            if (i.properties && Object.keys(i.properties).length) obj.properties = i.properties;
            return obj;
        });
        setStorageData(data);
    }
    // #endregion

    // #region --- 初始化 ---
    async function initItemEditor() {
        renderTitle('道具編輯器');
        itemListModal.classList.add('hidden');
        const data = await getDeckData();
        if (!data) {
            renderAlert(labelAlert, '資料載入失敗。', 'red');
            return;
        }
        items = {};
        gbItemList.innerHTML = '';
        (data.items || []).forEach(i => { items[i.name] = { ...i }; renderItemCard(items[i.name]); });
        const first = Object.keys(items)[0];
        if (first) loadItemToEditor(first);
        else refreshToolbar();
        renderAlert(labelAlert);
    }

    initItemEditor();
    // #endregion
})();
