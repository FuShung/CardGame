// js/player.js
// PlayerManager：玩家狀態、積分、身分管理模組
// Feature: multi-player

const PlayerManager = {
  /** @type {import('./player.js').Player[]} */
  players: [],

  /**
   * 初始化玩家清單並依 roles 指派身分
   * @param {string[]} playerNames - 玩家名稱陣列（依序）
   * @param {Array<{name:string, count:number, assign:'fixed'|'random'}>} [roleDefs] - 來自 JSON 的 roles 欄位，選用
   * @returns {{ ok: boolean, error?: string }}
   */
  init(playerNames, roleDefs) {
    // 玩家數為 0 時回傳錯誤
    if (!playerNames || playerNames.length === 0) {
      return { ok: false, error: '玩家數不得為 0' };
    }

    const playerCount = playerNames.length;

    // roles 未設定：所有玩家身分為空字串
    if (!roleDefs || roleDefs.length === 0) {
      this.players = playerNames.map(name => ({ name, score: 0, role: '' }));
      return { ok: true };
    }

    // count 總和驗證：不符時回傳錯誤，不修改任何狀態
    const totalCount = roleDefs.reduce((sum, r) => sum + r.count, 0);
    if (totalCount !== playerCount) {
      return {
        ok: false,
        error: `roles 的 count 總和（${totalCount}）不等於玩家人數（${playerCount}）`,
      };
    }

    // 初始化玩家清單（先全部設為空字串）
    const newPlayers = playerNames.map(name => ({ name, score: 0, role: '' }));

    // 身分指派：先處理所有 fixed，再處理所有 random
    // 追蹤尚未被指派身分的玩家索引
    const unassigned = newPlayers.map((_, i) => i);

    // 第一輪：處理所有 assign === 'fixed'
    for (const roleDef of roleDefs) {
      if (roleDef.assign !== 'fixed') continue;
      for (let i = 0; i < roleDef.count; i++) {
        const idx = unassigned.shift();
        newPlayers[idx].role = roleDef.name;
      }
    }

    // 第二輪：處理所有 assign === 'random'
    for (const roleDef of roleDefs) {
      if (roleDef.assign !== 'random') continue;
      for (let i = 0; i < roleDef.count; i++) {
        // 從剩餘未指派玩家中隨機抽取
        const randPos = Math.floor(Math.random() * unassigned.length);
        const idx = unassigned.splice(randPos, 1)[0];
        newPlayers[idx].role = roleDef.name;
      }
    }

    this.players = newPlayers;
    return { ok: true };
  },

  /**
   * 依 Score_Target 字串解析出對應的玩家索引陣列
   * @param {string} target - "current" | "prev" | "next" | "role:{name}"
   * @param {number} currentIdx - 當前抽卡玩家索引
   * @returns {number[]}
   */
  resolveTarget(target, currentIdx) {
    const n = this.players.length;
    if (n === 0) return [];

    if (target === 'current') {
      return [currentIdx];
    }
    if (target === 'prev') {
      return [(currentIdx - 1 + n) % n];
    }
    if (target === 'next') {
      return [(currentIdx + 1) % n];
    }
    if (typeof target === 'string' && target.startsWith('role:')) {
      const roleName = target.slice(5);
      return this.getPlayersByRole(roleName);
    }
    return [];
  },

  /**
   * 執行單張卡牌的所有 score_changes
   * @param {{ target: string, delta: number }[]|undefined} scoreChanges
   * @param {number} currentIdx
   */
  applyScoreChanges(scoreChanges, currentIdx) {
    // 無 score_changes 欄位（undefined/null/空陣列）時不執行任何變動
    if (!scoreChanges || scoreChanges.length === 0) return;

    for (const change of scoreChanges) {
      const targets = this.resolveTarget(change.target, currentIdx);
      for (const idx of targets) {
        const player = this.players[idx];
        if (!player) continue;
        player.score = Math.max(0, player.score + change.delta);
      }
    }
  },

  /**
   * 執行 role_swap：交換兩個 Score_Target 對應玩家的身分
   * @param {[string, string]|undefined} roleSwap
   * @param {number} currentIdx
   * @returns {boolean}
   */
  applyRoleSwap(roleSwap, currentIdx) {
    // 卡牌無 role_swap 欄位（undefined/null）時不執行任何身分對調
    if (!roleSwap) return false;

    // 解析兩個 Score_Target，各取第一位玩家
    const idxA = this.resolveTarget(roleSwap[0], currentIdx)[0];
    const idxB = this.resolveTarget(roleSwap[1], currentIdx)[0];

    // 任一對象不存在時回傳 false，靜默忽略
    if (idxA === undefined || idxB === undefined) return false;

    const playerA = this.players[idxA];
    const playerB = this.players[idxB];
    if (!playerA || !playerB) return false;

    // 交換身分
    const tmpRole = playerA.role;
    playerA.role = playerB.role;
    playerB.role = tmpRole;

    return true;
  },

  /**
   * 取得指定索引的玩家
   * @param {number} idx
   * @returns {{ name: string, score: number, role: string }|null}
   */
  getPlayer(idx) {
    if (idx < 0 || idx >= this.players.length) return null;
    return this.players[idx];
  },

  /**
   * 取得所有持有指定身分的玩家索引
   * @param {string} roleName
   * @returns {number[]}
   */
  getPlayersByRole(roleName) {
    return this.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.role === roleName)
      .map(({ i }) => i);
  },

  /** 渲染玩家狀態面板至 #player-panel */
  renderPanel() {
    // 留空骨架，待任務 2.14 實作
  },
};

// 同時支援瀏覽器直接載入
if (typeof window !== 'undefined') window.PlayerManager = PlayerManager;
