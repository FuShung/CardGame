// #region --- 變數 ---
const pages = {
    game: {
        title: "首頁"
    },
    item_editor: {
        title: "道具編輯器"
    },
    card_editor: {
        title: "卡牌編輯器",
        styles: [
            'css/start.css'
        ]
    },
    deck_editor: {
        title: "牌組編輯器"
    },
    game_editor: {
        title: "設定"
    }
}

const headerNavs = document.getElementById('header-navs');
// #endregion

// #region --- 註冊事件 ---
window.onload = function() {
    // 渲染導覽列
    renderNavBar(headerNavs, pages);
};
// #endregion