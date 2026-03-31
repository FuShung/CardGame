# 抽卡系統

一個純前端的抽卡遊戲系統，支援自訂卡牌、牌組管理與即時遊戲。資料存於瀏覽器 localStorage，無需後端或安裝。

---

## 目錄

**使用者指南**
- [快速開始](#快速開始)
- [功能頁面](#功能頁面)
- [資料管理](#資料管理)
- [效果語法](#效果語法)
- [卡牌效果（Actions）](#卡牌效果actions)
- [抽卡模式](#抽卡模式)

**開發者指南**
- [專案結構](#專案結構)
- [本地開發](#本地開發)
- [打包](#打包)
- [設定（js/define.js）](#設定jsdefinejs)
- [資料格式](#資料格式)
- [頁面清理鉤子](#頁面清理鉤子)

---

## 使用者指南

### 快速開始

直接用瀏覽器開啟 `index_Release.html` 即可，不需要伺服器或任何安裝。

> 若使用開發版 `index.html`，需透過本地伺服器開啟（見下方開發者指南）。

### 功能頁面

| 頁面 | 說明 |
|------|------|
| 遊戲 | 選擇牌組並抽卡，顯示卡牌效果，支援倒計時與音效 |
| 道具編輯器 | 新增、修改、刪除道具，設定允許持有數量 |
| 卡牌編輯器 | 新增、修改、刪除卡牌，設定稀有度（1–5 星）、效果文字、Actions 與抽卡條件 |
| 牌組編輯器 | 建立與管理牌組，設定抽取模式與牌池內容 |
| 遊戲設定 | 設定遊戲標題、規則、身分清單、預設抽卡人員模式，匯出／匯入資料 |

### 資料管理

所有資料存在瀏覽器的 localStorage，關閉頁面後仍會保留。

- 匯出：前往「遊戲設定」頁面，點擊匯出按鈕下載 JSON 檔案
- 匯入：將 JSON 檔案拖入或選取上傳，即可覆蓋目前資料
- 清除：重新匯入或清除 localStorage 可還原預設資料

### 效果語法

卡牌效果文字中的 `[...]` 會在抽卡時隨機解析：

- `[A, B, C]` — 從選項中隨機選一個
- `[1~5]` — 隨機產生範圍內的整數
- `[time: 5~10]` — 隨機產生範圍內的整數，並自動啟動倒計時

範例：`每位玩家選擇 [攻擊, 防禦, 逃跑]，持續 [time: 3~8] 秒。`

### 卡牌效果（Actions）

每張卡牌可設定多個 Action，在抽卡時依序執行。每個 Action 有觸發條件：

| 條件 | 說明 |
|------|------|
| `always` | 總是執行 |
| `success` | 挑戰成功時執行 |
| `fail` | 挑戰失敗時執行 |

> 非挑戰卡只執行 `always`；挑戰卡執行 `always` + 對應結果。

#### 積分（score）

修改玩家積分，支援以下運算式：

| 格式 | 說明 |
|------|------|
| `+N` | 加 N 分 |
| `-N` | 減 N 分（最低為 0） |
| `*N` | 乘以 N |
| `/N` | 除以 N（無條件捨去） |
| `=N` | 設為 N |
| `+A~B` | 隨機加 A 到 B 分 |

目標（target）可指定：`skip:0`（當前）、`skip:1`（下一位）、`skip:-1`（上一位）、`skip:N`（偏移 N 位）、`role:<身分名稱>`

#### 身分交換（swap_roles）

身分交換兩位玩家的身分，target_a / target_b 同上（`skip:N` 或 `role:<身分>`）。

#### 抽卡模式（change_draw_mode）

改變主抽卡人員模式，下一輪起生效：

| mode | 說明 |
|------|------|
| `0` | 隨機玩家 |
| `1` | 輪流玩家 |
| `2` | 隨機身分（需指定 role） |
| `3` | 輪流身分（需指定 role） |

#### 指定抽卡人員（change_draw_player）

指定下一輪由誰抽卡（一次性，抽完後回主模式）：

| target | 說明 |
|--------|------|
| `skip:1` | 下一位（+1） |
| `skip:-1` | 上一位（-1） |
| `skip:N` | 偏移 N 位（正數往後，負數往前） |
| `skip:0` | 當前玩家再抽一次 |
| `role:<身分>` | 指定身分的玩家 |

#### 切換牌組（change_deck）

切換到指定牌組，target 為牌組名稱。

#### 道具（item_changes）

給予或移除玩家持有的道具：

| 欄位 | 說明 |
|------|------|
| `target` | 目標玩家（同 score 的 target 格式） |
| `give` | 給予的道具名稱陣列 |
| `take` | 移除的道具名稱陣列 |

#### 抽卡條件（requires）

卡牌可設定抽卡條件表達式，只有符合條件的玩家才能抽到該卡：

```
道具A AND (道具B OR NOT 道具C)
```

支援運算子：`AND`、`OR`、`NOT`、`()`。條件在 card_editor 的「抽卡條件」彈跳視窗中編輯。

> 道具數量限制由道具編輯器的「允許持有數量」控制：
> - 有 `take` 道具的卡：玩家未持有該道具時不會被抽到
> - 有 `give` 道具的卡：玩家持有數已達上限時不會被抽到

### 抽卡模式（牌組）

| 模式 | 說明 |
|------|------|
| 隨機（0） | 每次從牌池隨機抽取，不消耗牌 |
| 重抽（1） | 同隨機，但每張牌可設定數量上限，抽完後重置 |
| 順序（2） | 依序抽取，抽完後自動重置 |

---

## 開發者指南

### 專案結構

```
├── index.html              # 開發版入口（SPA 框架）
├── index_Release.html      # 打包版（單一 HTML，可直接開啟）
├── index.js                # 頁面路由設定
├── build.js                # 打包腳本（Node.js）
├── js/
│   ├── define.js           # 全域常數、設定、資料存取函式
│   ├── common.js           # 共用 UI（導覽列、頁面渲染、彈跳框、星級編輯器）
│   ├── player.js           # PlayerManager（舊模組，保留備用）
│   ├── actions.js          # 積分計算、action 執行、結果格式化
│   ├── draw.js             # 抽卡邏輯（buildDeckState、advancePlayer 等）
│   └── effect.js           # 卡牌效果文字解析
├── css/
│   ├── root.css            # CSS 變數
│   ├── style.css           # 全域樣式（含 combobox）
│   ├── glass.css           # 玻璃擬態元件
│   └── start.css           # 星級評分樣式
├── pages/
│   ├── game/               # 遊戲主頁
│   ├── item_editor/        # 道具編輯器
│   ├── card_editor/        # 卡牌編輯器
│   ├── deck_editor/        # 牌組編輯器
│   └── game_editor/        # 遊戲設定（標題、規則、身分、匯入匯出）
├── decks/                  # 預設資料 JSON
│   ├── michael_drama.json  # 預設載入資料
│   └── test_actions.json   # 效果測試資料
└── media/                  # 音效檔（.mp3）
```

### 本地開發

開發版 `index.html` 使用 `fetch` 載入各頁面資源，需透過 HTTP 伺服器開啟：

```bash
npx serve .
# 或
python -m http.server
```

### 打包

執行以下指令將開發版打包成單一 `index_Release.html`：

```bash
node build.js
```

打包流程會將所有 CSS、JS、頁面 HTML 與預設 JSON 資料內嵌至單一檔案。打包版可直接以 `file://` 開啟，無需伺服器。

### 設定（js/define.js）

| 常數 | 預設值 | 說明 |
|------|--------|------|
| `DEFAULT_DATA_ROOT` | `'decks/michael_drama.json'` | 預設載入的資料檔路徑 |
| `AUTO_CLEAR_STORAGE` | `false` | 每次載入是否清除 localStorage |
| `RANDOM_MODE` | `0` | 牌組抽取：隨機 |
| `REDRAW_MODE` | `1` | 牌組抽取：重抽 |
| `SEQUENCE_MODE` | `2` | 牌組抽取：順序 |
| `RANDOM_PLAYER` | `0` | 抽卡人員：隨機玩家 |
| `ROUND_PLAYER` | `1` | 抽卡人員：輪流玩家 |
| `RANDOM_DIGNITY` | `2` | 抽卡人員：隨機身分 |
| `ROUND_DIGNITY` | `3` | 抽卡人員：輪流身分 |
| `SELECT_PLAYER` | `4` | 抽卡人員：指定玩家（保留） |

### 資料格式

```json
{
  "title": "遊戲標題",
  "rules": "規則說明文字",
  "player_draw_mode": 1,
  "player_draw_mode_role": "",
  "roles": [
    { "name": "身分名稱" }
  ],
  "items": [
    { "name": "道具名稱", "max_count": 1, "description": "描述（選填）" }
  ],
  "cards": [
    {
      "name": "卡牌名稱",
      "rarity": 3,
      "effect": "效果描述 [選項A, 選項B]，持續 [time: 5~10] 秒。",
      "is_challenge": false,
      "requires": "道具A AND NOT 道具B",
      "actions": [
        { "type": "score",        "on": "always",  "target": "skip:0", "expr": "+1" },
        { "type": "item_changes", "on": "success", "target": "skip:0", "give": ["道具A"], "take": [] }
      ]
    }
  ],
  "decks": [
    {
      "name": "牌組名稱",
      "draw_mode": 1,
      "visible": true,
      "pool": ["卡牌名稱", { "name": "卡牌名稱", "count": 3 }]
    }
  ]
}
```

`player_draw_mode` 對應 define.js 的抽卡人員模式常數（預設 `1` = 輪流玩家）。
`player_draw_mode_role` 在模式為 `2`（隨機身分）或 `3`（輪流身分）時指定目標身分名稱。

### 頁面清理鉤子

切換頁面時，`common.js` 會呼叫 `window._pageCleanup()`。各頁面若有需要清理的背景資源（如計時器），可在初始化時設定：

```js
window._pageCleanup = () => clearInterval(myTimer);
```
