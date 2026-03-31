// #region --- 共用涵式 ---

function setTextLines(element, text) {
    const lines = text.split('\n');
    element.innerHTML = '';
    lines.forEach(line => {
        const lineElement = document.createElement('p');
        lineElement.textContent = line;
        element.appendChild(lineElement);
    });
}

function deleteAllChildNodes(className) {
    const allLoadingElements = document.querySelectorAll(`.${className}`);
    allLoadingElements.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
    });
}
// #endregion

// #region --- 頁面渲染 ---

// 內嵌資源快取：在 DOM 載入後將所有 style-* / page-* / script-* 從 document 移除並存入 Map
const _inlineCache = { styles: {}, templates: {}, scripts: {} };

function _collectInlineResources() {
    // 收集頁面 CSS：<style id="style-{page}"> 與 <style id="style-extra-*">
    document.querySelectorAll('style[id^="style-"]').forEach(el => {
        _inlineCache.styles[el.id] = el.textContent;
        el.remove();
    });
    // 收集頁面 HTML：<template id="page-{page}">
    document.querySelectorAll('template[id^="page-"]').forEach(el => {
        _inlineCache.templates[el.id] = el.innerHTML;
        el.remove();
    });
    // 收集頁面 JS：<script type="text/template" id="script-{page}">
    document.querySelectorAll('script[type="text/template"][id^="script-"]').forEach(el => {
        _inlineCache.scripts[el.id] = el.textContent;
        el.remove();
    });
}

function renderTitle(text, select_class = 'title') {
    GLOBAL_TITLE_TEXT = document.title = text;
    document.querySelectorAll(`title`).forEach(el => el.textContent = text);
    document.querySelectorAll(`.${select_class}`).forEach(el => el.textContent = text);
}

// 導覽列
function renderNavBar(element, pages, select = null) {
    _collectInlineResources();
    element.innerHTML = '';
    if(select === null) {
        const url = new URL(window.location);
        select = url.searchParams.get('page') || Object.keys(pages)[0];
    }
    let targetNav = null;
    Object.entries(pages).forEach(([key, config]) => {
        const button = document.createElement('button');
        button.textContent = config.title;
        button.className = "btn-nav";
        button.id = "tab-" + key;
        button.addEventListener('click', () => switchNavTab(button, key, config));
        if(key === select) {
            targetNav = button;
        }
        element.appendChild(button);
    });

    if(targetNav) {
        targetNav.click();
    }
}

function switchNavTab(button, page, config) {
    const parent = button.parentElement;
    parent.childNodes.forEach(element => {
        if (element === button) {
            element.classList.add('btn-nav-active');
            element.classList.remove('btn-nav');
        }
        else {
            element.classList.remove('btn-nav-active');
            element.classList.add('btn-nav');
        }
    });
    
    renderPage(page, config);
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
}

async function renderPage(page, config) {
    // 切換頁面前先執行清理（清除計時器等背景資源）
    _cleanupCurrentPage();

    deleteAllChildNodes('page-item');

    // 注入頁面 CSS（優先從內嵌快取取得，否則用外部連結）
    const inlineStyleContent = _inlineCache.styles[`style-${page}`];
    if (inlineStyleContent) {
        const style = document.createElement('style');
        style.className = 'page-item';
        style.textContent = inlineStyleContent;
        document.head.appendChild(style);
    } else if (!IS_RELEASE) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `pages/${page}/style.css`;
        link.className = 'page-item';
        document.head.appendChild(link);
    }

    if(config.styles) {
        config.styles.forEach(styleId => {
            const extraKey = `style-extra-${styleId.replace(/[^a-z0-9]/gi, '-')}`;
            const inlineExtraContent = _inlineCache.styles[extraKey];
            if (inlineExtraContent) {
                const style = document.createElement('style');
                style.className = 'page-item';
                style.textContent = inlineExtraContent;
                document.head.appendChild(style);
            } else if (!IS_RELEASE) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = styleId;
                link.className = 'page-item';
                document.head.appendChild(link);
            }
        });
    }

    let mainContent = document.querySelector('main');
    if (!mainContent) {
        mainContent = document.createElement('main');
        document.body.appendChild(mainContent);
    }

    // 注入頁面 HTML（優先從內嵌快取取得，否則用 fetch）
    const tmplContent = _inlineCache.templates[`page-${page}`];
    if (tmplContent) {
        mainContent.innerHTML = tmplContent;
    } else if (!IS_RELEASE) {
        await fetch(`pages/${page}/index.html`).then(async response => {
            if (response.ok) {
                await response.text().then(html => mainContent.innerHTML = html);
            }
        });
    }

    // 注入頁面 JS（優先從內嵌快取取得，否則用外部連結）
    const inlineScriptContent = _inlineCache.scripts[`script-${page}`];
    const script = document.createElement('script');
    script.className = 'page-item';
    if (inlineScriptContent) {
        script.textContent = inlineScriptContent;
        document.body.appendChild(script);
        bindModalCloseButtons();
    } else if (!IS_RELEASE) {
        script.src = `pages/${page}/script.js`;
        document.body.appendChild(script);
        script.addEventListener('load', () => bindModalCloseButtons());
    }
}

// 綁定所有 .modal-close 按鈕，點擊後關閉最近的 .pop-modal
// 各頁面 script 若有自訂關閉邏輯，可在初始化時覆寫對應按鈕的 onclick
function bindModalCloseButtons() {
    document.querySelectorAll('.modal-close').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            const modal = btn.closest('.pop-modal');
            if (modal) modal.classList.add('hidden');
        });
    });
}

// 頁面切換前的清理鉤子：各頁面可將需要清理的資源註冊到此
// 例如 game 頁面在初始化時設定 window._pageCleanup = () => clearInterval(activeTimer)
function _cleanupCurrentPage() {
    if (typeof window._pageCleanup === 'function') {
        window._pageCleanup();
        window._pageCleanup = null;
    }
}

// 彈跳框
function openModal(modal) {
    modal.classList.remove('hidden');
    const panel = document.getElementById(modal.getAttribute('for'));
    if (panel) {
        panel.classList.add('disabled');
    }
}

function closeModal(modal) {
    modal.classList.add('hidden');
    const panel = document.getElementById(modal.getAttribute('for'));
    if (panel) {
        panel.classList.remove('disabled');
    }
}

// 五星編輯器
function initStarRating(selector = '.star-editor') {
    const containers = document.querySelectorAll(selector);
    containers.forEach((container, containerIdx) => {
        const input = document.getElementById(container.getAttribute('for'));
        const value = parseInt(input.value) || 0;
        input.onchange = () => {
            const newValue = parseInt(input.value) || 0;
            renderStarts(container, newValue);
        }

        for (let i = 0; i < 5; i++) {
            // 創建按鈕
            const button = document.createElement('button');
            button.textContent = '★';
            button.className = "star"
            button.onclick = () => {
                input.value = i + 1;
                renderStarts(container, i + 1);
            }

            container.appendChild(button);
        }
        renderStarts(container, value);
    });
}

function renderStarts(container, value) {
    const stars = container.querySelectorAll('.star');
    stars.forEach((star, idx) => {
        if (idx < value) {
            star.classList.add('active');
        }
        else {
            star.classList.remove('active');
        }
    });
}

// alert標籤
function renderAlert(label, text = false, color='red') {
    if(text) {
        label.innerText = text;
        label.className = `alert-${color}`;
    }
    else {
        label.innerText = '';
        label.className = 'hidden';
    }
}
// #endregion