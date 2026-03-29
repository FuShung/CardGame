#!/usr/bin/env node
/**
 * build.js — 將開發版 index.html 打包成單一 index_Release.html
 * 執行方式：node build.js
 * 通用設計：所有設定從 index.html / index.js / define.js 自動讀取，無硬編碼
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const INPUT  = path.join(ROOT, 'index.html');
const OUTPUT = path.join(ROOT, 'index_Release.html');

// ─── 工具函式 ────────────────────────────────────────────

function read(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

function escapeForScriptTag(str) {
    return str.replace(/<\/script>/gi, '<\\/script>');
}

/** 將多行字串每行加上指定縮排 */
function indent(str, spaces = 4) {
    const pad = ' '.repeat(spaces);
    return str.split('\n').map(l => (l.trim() ? pad + l : l)).join('\n');
}

// ─── 從 define.js 讀取設定 ───────────────────────────────

const defineJs = read(path.join(ROOT, 'js', 'define.js'));

// 讀取 DEFAULT_DATA_ROOT
const defaultDataMatch = defineJs.match(/DEFAULT_DATA_ROOT\s*=\s*'([^']+)'/);
const DEFAULT_JSON = defaultDataMatch
    ? path.join(ROOT, defaultDataMatch[1])
    : path.join(ROOT, 'decks', 'michael_drama.json');

// 讀取 STORAGE_DATA_KEY
const storageKeyMatch = defineJs.match(/STORAGE_DATA_KEY\s*=\s*'([^']+)'/);
const STORAGE_DATA_KEY = storageKeyMatch ? storageKeyMatch[1] : 'DRAW_GAME_DATA';

console.log(`  [CFG] DEFAULT_JSON: ${path.relative(ROOT, DEFAULT_JSON)}`);
console.log(`  [CFG] STORAGE_DATA_KEY: ${STORAGE_DATA_KEY}`);

// ─── 從 index.js 讀取頁面設定 ────────────────────────────

// ─── 掃描 pages/ 資料夾 ──────────────────────────────────

const PAGES = fs.readdirSync(path.join(ROOT, 'pages'), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

// ─── 從 index.js 讀取頁面額外樣式設定 ───────────────────

const PAGE_EXTRA_STYLES = {};
try {
    const indexSrc = read(path.join(ROOT, 'index.js'));
    PAGES.forEach(page => {
        const re = new RegExp(`['"]?${page}['"]?\\s*:\\s*\\{[^}]*styles\\s*:\\s*\\[([^\\]]+)\\]`, 's');
        const m = indexSrc.match(re);
        if (m) {
            PAGE_EXTRA_STYLES[page] = (m[1].match(/['"]([^'"]+)['"]/g) || [])
                .map(s => s.replace(/['"]/g, ''));
        }
    });
    const found = Object.entries(PAGE_EXTRA_STYLES).map(([p, s]) => `${p}:[${s}]`).join(', ');
    if (found) console.log(`  [CFG] 額外樣式: ${found}`);
} catch (e) {
    console.warn('  [WARN] 無法解析 index.js 的 styles 設定:', e.message);
}

console.log(`  [SCAN] 找到頁面: ${PAGES.join(', ')}`);

// ─── 主流程 ──────────────────────────────────────────────

let html = read(INPUT);

// 1. 收集所有 <link rel="stylesheet"> 合併成單一 <style>
const cssContents = [];
html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (match, href) => {
    const filePath = path.join(ROOT, href);
    if (!fs.existsSync(filePath)) {
        console.warn(`  [WARN] CSS 不存在，略過: ${href}`);
        return '';
    }
    console.log(`  [CSS] 收集: ${href}`);
    cssContents.push(`/* ${href} */\n${read(filePath)}`);
    return '';
});
if (cssContents.length) {
    const styleBlock = `    <style>\n${cssContents.join('\n\n')}\n    </style>`;
    html = html.replace('</head>', `${styleBlock}\n    __JS_PLACEHOLDER__\n</head>`);
    console.log(`  [CSS] 合併 ${cssContents.length} 個樣式檔`);
}

// 2. 準備 define.js 的預設資料注入片段
let inlineDataScript = '';
if (fs.existsSync(DEFAULT_JSON)) {
    const inlineData = read(DEFAULT_JSON).replace(/\s+/g, ' ').trim();
    inlineDataScript = [
        '',
        '// 預設資料（由 build.js 注入，僅在 localStorage 為空時生效）',
        `(function(){`,
        `    if(!localStorage.getItem('${STORAGE_DATA_KEY}')){`,
        `        var _d=${inlineData};`,
        `        if(_d) localStorage.setItem('${STORAGE_DATA_KEY}', JSON.stringify(_d));`,
        `    }`,
        `})();`,
    ].join('\n');
    console.log(`  [JSON] 內嵌預設資料: ${path.relative(ROOT, DEFAULT_JSON)}`);
} else {
    console.warn(`  [WARN] 預設 JSON 不存在: ${DEFAULT_JSON}`);
}

// 3. 收集 <script src="...">：index.js 單獨放到 </body> 前，其餘合併進 <head>
const jsContents = [];
let bodyScript = '';
html = html.replace(/<script\s+src="([^"]+)"><\/script>/g, (match, src) => {
    const filePath = path.join(ROOT, src);
    if (!fs.existsSync(filePath)) {
        console.warn(`  [WARN] JS 不存在，略過: ${src}`);
        return '';
    }
    let content = escapeForScriptTag(read(filePath));
    if (src === 'js/define.js') content += inlineDataScript;
    // index.js 需要在 DOM 就緒後執行，單獨放到 </body> 前
    if (src === 'index.js') {
        bodyScript = `    <script>\n/* index.js */\n${content}\n    </script>`;
        console.log(`  [JS]  body: ${src}`);
    } else {
        jsContents.push(`/* ${src} */\n${content}`);
        console.log(`  [JS]  收集: ${src}`);
    }
    return '';
});
if (jsContents.length) {
    const scriptBlock = `    <script>\n${jsContents.join('\n\n')}\n    </script>`;
    html = html.replace('    __JS_PLACEHOLDER__', scriptBlock);
    console.log(`  [JS]  合併 ${jsContents.length} 個腳本檔`);
} else {
    html = html.replace('\n    __JS_PLACEHOLDER__', '');
}
// 4. 在 </body> 前注入各頁面的 template、style、script（index.js 放最後）
const pageInjects = PAGES.map(page => {
    const pageDir = path.join(ROOT, 'pages', page);
    const parts = [];

    // 頁面 HTML → <template id="page-{page}">
    const htmlFile = path.join(pageDir, 'index.html');
    if (fs.existsSync(htmlFile)) {
        const inner = indent(read(htmlFile).trim());
        parts.push(`    <!-- page: ${page} -->`);
        parts.push(`    <template id="page-${page}">\n${inner}\n    </template>`);
        console.log(`  [HTML] 內嵌頁面: pages/${page}/index.html`);
    }

    // 頁面 CSS → <style id="style-{page}">
    const cssFile = path.join(pageDir, 'style.css');
    if (fs.existsSync(cssFile)) {
        parts.push(`    <style id="style-${page}">\n${read(cssFile).trim()}\n    </style>`);
        console.log(`  [CSS] 內嵌頁面樣式: pages/${page}/style.css`);
    }

    // 額外 CSS
    (PAGE_EXTRA_STYLES[page] || []).forEach(extraCss => {
        const extraFile = path.join(ROOT, extraCss);
        if (fs.existsSync(extraFile)) {
            const safeId = extraCss.replace(/[^a-z0-9]/gi, '-');
            parts.push(`    <style id="style-extra-${safeId}">\n${read(extraFile).trim()}\n    </style>`);
            console.log(`  [CSS] 內嵌額外樣式: ${extraCss}`);
        }
    });

    // 頁面 JS → <script type="text/template" id="script-{page}">
    const jsFile = path.join(pageDir, 'script.js');
    if (fs.existsSync(jsFile)) {
        parts.push(`    <script type="text/template" id="script-${page}">\n${read(jsFile).trim()}\n    </script>`);
        console.log(`  [JS]  內嵌頁面腳本: pages/${page}/script.js`);
    }

    return parts.join('\n');
}).join('\n\n');

html = html.replace('</body>', `\n${pageInjects}\n${bodyScript ? bodyScript + '\n' : ''}</body>`);
html = html.replace(
    '<meta name="description"',
    '<meta name="app-mode" content="release">\n    <meta name="description"'
);
console.log(`  [META] 注入 app-mode=release`);

// 6. 清理排版：統一換行、移除行尾空白、壓縮連續空行
html = html
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');

// 7. 寫出
fs.writeFileSync(OUTPUT, html, 'utf-8');
const sizeKB = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
console.log(`\n✅ 打包完成 → ${path.relative(ROOT, OUTPUT)} (${sizeKB} KB)`);
