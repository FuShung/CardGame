// #region --- 變數 ---
// --- 組態 ---
const version = "1.1"; // 版本號
const STORAGE_DATA_KEY = 'DRAW_GAME_DATA'; // 永久緩存資料鍵值
const DEFAULT_DATA_ROOT = 'decks/michael_drama.json'; // 預設載入檔案
const AUTO_CLEAR_STORAGE = false; // 是否自動清除緩存

// --- 抽卡模式 ---
const RANDOM_MODE = 0;
const REDRAW_MODE = 1;
const SEQUENCE_MODE = 2;

// --- 抽卡人員模式 ---
const RANDOM_PLAYER = 0;
const ROUND_PLAYER = 1;
const RANDOM_DIGNITY = 2;
const ROUND_DIGNITY = 3;
const SELECT_PLAYER = 4;

// --- 全域變數 ---
var GLOBAL_TITLE_TEXT = 'title';
// Release 模式判斷（由 build.js 注入的 <meta name="app-mode" content="release"> 決定）
const IS_RELEASE = document.querySelector('meta[name="app-mode"][content="release"]') !== null;
// #endregion

// #region --- 全域函式 ---
function setStorageData(data) {
    if(typeof data === 'object') {
        data = JSON.stringify(data);
    }
    localStorage.setItem(STORAGE_DATA_KEY, data);
}

async function getDeckData() {
    if(AUTO_CLEAR_STORAGE) {
        localStorage.removeItem(STORAGE_DATA_KEY);
    }

    var data = localStorage.getItem(STORAGE_DATA_KEY);
    if(data) {
        try {
            return JSON.parse(data);
        } catch(e) {
            console.warn('localStorage 資料損壞，重新載入預設檔案', e);
            localStorage.removeItem(STORAGE_DATA_KEY);
        }
    }

    if(IS_RELEASE) return null;

    try {
        const res = await fetch(DEFAULT_DATA_ROOT);
        if(res.ok) {
            data = await res.json();
            setStorageData(data);
            return data;
        }
    } catch(e) {
        console.error('載入預設資料失敗', e);
    }

    return null;
}
// 等待多個Promise完成
async function waitPromises(promises) {
    await Promise.all(promises);
}
function countDeckPool(deck) {
    let count = 0;
    switch(deck.draw_mode) {
        case SEQUENCE_MODE:
            return deck.pool.length;
        case REDRAW_MODE:
        case RANDOM_MODE:
            deck.pool.forEach(item => {
                if(item.count) {
                    count += item.count;
                }
                else {
                    count ++;
                }
            });
            break;
    }
    return count;
}
// #endregion