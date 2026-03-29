// modules/actions.js
// 積分計算、target 解析、action 執行、結果格式化
// 所有函式接收 state 物件，不持有自身狀態

// --- 積分計算 ---

function parseExpr(expr) {
    const m = expr.trim().match(/^([+\-*/=])(\-?\d+)(?:~(\-?\d+))?$/);
    if (!m) return null;
    const op = m[1];
    let val = Number(m[2]);
    if (m[3] !== undefined) {
        const max = Number(m[3]);
        val = Math.floor(Math.random() * (max - val + 1)) + val;
    }
    return { op, val };
}

function exprToText(op, val) {
    switch (op) {
        case '+': return `積分加 ${val}`;
        case '-': return `積分減 ${val}`;
        case '*': return `積分乘以 ${val}`;
        case '/': return `積分除以 ${val}`;
        case '=': return val === 0 ? '積分歸零' : `積分設為 ${val}`;
    }
    return '';
}

// --- Target 解析 ---

function resolveTargetLabel(target, state) {
    const { players, currentPlayerIdx } = state;
    const n = players.length;
    if (target === 'current' || target === 'skip:0')
        return `【${players[currentPlayerIdx]?.name || '當前玩家'}】`;
    if (target.startsWith('skip:')) {
        const offset = parseInt(target.slice(5));
        if (!isNaN(offset)) {
            const idx = ((currentPlayerIdx + offset) % n + n) % n;
            return `【${players[idx]?.name || `+${offset}位`}】`;
        }
    }
    if (target.startsWith('role:')) return `【${target.slice(5)}】`;
    return `【${target}】`;
}

function resolveTarget(target, state) {
    const { players, currentPlayerIdx } = state;
    const n = players.length;
    if (!n) return [];
    if (target === 'current' || target === 'skip:0') return [currentPlayerIdx];
    if (target.startsWith('skip:')) {
        const offset = parseInt(target.slice(5));
        if (!isNaN(offset)) return [((currentPlayerIdx + offset) % n + n) % n];
    }
    if (target.startsWith('role:')) {
        const roleName = target.slice(5);
        return players.map((p, i) => p.role === roleName ? i : -1).filter(i => i !== -1);
    }
    return [];
}

// --- Action 執行 ---

/**
 * 執行卡牌 actions
 * @param {object} card
 * @param {string|null} trigger - null=非挑戰, 'success'|'fail'=挑戰結果
 * @param {object} state - { players, currentPlayerIdx, decks, pendingScoreChanges, drawMode, drawModeRole }
 * @returns {Array} 顯示用結果陣列
 */
function applyActions(card, trigger, state) {
    const results = [];
    const actions = card.actions || [];

    // 相容舊格式
    const legacyActions = [];
    (card.score_changes || []).forEach(sc =>
        legacyActions.push({ type: 'score', on: 'always', target: sc.target, expr: sc.expr }));
    (card.score_success || []).forEach(sc =>
        legacyActions.push({ type: 'score', on: 'success', target: sc.target, expr: sc.expr }));
    (card.score_fail    || []).forEach(sc =>
        legacyActions.push({ type: 'score', on: 'fail',    target: sc.target, expr: sc.expr }));
    const allActions = legacyActions.length ? legacyActions : actions;

    allActions.forEach(action => {
        const on = action.on || 'always';
        if (on !== 'always' && on !== trigger) return;

        if (action.type === 'score') {
            const parsed = parseExpr(action.expr);
            if (!parsed) return;
            const targets = resolveTarget(action.target || 'skip:0', state);
            targets.forEach(idx => state.pendingScoreChanges.push({ playerIdx: idx, parsed }));
            results.push({ kind: 'score', targetLabel: resolveTargetLabel(action.target || 'skip:0', state), op: parsed.op, val: parsed.val });

        } else if (action.type === 'swap_roles') {
            const idxA = resolveTarget(action.target_a || 'skip:0', state)[0];
            const idxB = resolveTarget(action.target_b || 'skip:1', state)[0];
            if (idxA !== undefined && idxB !== undefined && idxA !== idxB) {
                const tmp = state.players[idxA].role;
                state.players[idxA].role = state.players[idxB].role;
                state.players[idxB].role = tmp;
                results.push({ kind: 'swap_roles',
                    labelA: state.players[idxA].name, roleA: state.players[idxA].role,
                    labelB: state.players[idxB].name, roleB: state.players[idxB].role });
            }

        } else if (action.type === 'change_drawer') {
            card._resolved_next_drawer = action.target;
            results.push({ kind: 'change_drawer', target: action.target });

        } else if (action.type === 'change_draw_mode') {
            state.drawMode = action.mode;
            state.drawModeRole = action.role || '';
            results.push({ kind: 'change_draw_mode', mode: action.mode, role: action.role || '' });

        } else if (action.type === 'change_draw_player') {
            card._resolved_draw_player = action.target;
            results.push({ kind: 'change_draw_player', target: action.target });

        } else if (action.type === 'change_deck') {
            const deckName = action.target;
            if (deckName && state.decks[deckName]) {
                card._resolved_next_deck = deckName;
                results.push({ kind: 'change_deck', target: deckName });
            }
        }
    });

    return results;
}

function commitPendingScores(state, saveCallback) {
    if (!state.pendingScoreChanges.length) return;
    state.pendingScoreChanges.forEach(({ playerIdx, parsed }) => {
        const p = state.players[playerIdx];
        if (!p) return;
        let s = p.score ?? 0;
        switch (parsed.op) {
            case '+': s += parsed.val; break;
            case '-': s -= parsed.val; break;
            case '*': s *= parsed.val; break;
            case '/': s = parsed.val !== 0 ? Math.floor(s / parsed.val) : s; break;
            case '=': s  = parsed.val; break;
        }
        p.score = Math.max(0, s);
    });
    state.pendingScoreChanges = [];
    if (saveCallback) saveCallback();
}

// --- 結果格式化 ---

function formatDrawerTarget(target, state) {
    const { players, currentPlayerIdx } = state;
    const n = players.length;
    if (!target) return '依照當前模式';
    if (target === 'current') return '當前玩家繼續';
    if (target.startsWith('current:')) {
        const sub = target.slice(8);
        if (sub === 'current') return `持續抽卡：${players[currentPlayerIdx]?.name || '當前玩家'}`;
        if (sub === 'next')    return `持續抽卡：${players[(currentPlayerIdx + 1) % n]?.name || '下一位'}`;
        if (sub === 'prev')    return `持續抽卡：${players[(currentPlayerIdx - 1 + n) % n]?.name || '上一位'}`;
        if (sub.startsWith('role:')) return `持續抽卡：${sub.slice(5)}`;
    }
    if (target.startsWith('role:')) return `指定身分：${target.slice(5)}`;
    if (target === 'mode:0') return '隨機玩家';
    if (target === 'mode:1') return '輪流玩家';
    if (target === 'mode:2') return '隨機身分';
    if (target === 'mode:3') return '輪流身分';
    return target;
}

function formatActionResult(r, state) {
    if (r.kind === 'score') return `${r.targetLabel}${exprToText(r.op, r.val)}`;
    if (r.kind === 'swap_roles') return `${r.labelA} ↔ ${r.labelB} 身分對調（${r.roleA} / ${r.roleB}）`;
    if (r.kind === 'change_drawer') return `下一輪抽卡：${formatDrawerTarget(r.target, state)}`;
    if (r.kind === 'change_draw_mode') {
        const modeNames = ['隨機玩家', '輪流玩家', '隨機身分', '輪流身分'];
        const name = modeNames[r.mode] || r.mode;
        return `抽卡模式：${name}${r.role ? `（${r.role}）` : ''}`;
    }
    if (r.kind === 'change_draw_player') {
        const t = r.target;
        if (t === 'current' || t === 'skip:0') return '指定抽卡：當前玩家再抽一次';
        if (t.startsWith('skip:')) {
            const n = parseInt(t.slice(5));
            if (n === 1)  return '指定抽卡：下一位';
            if (n === -1) return '指定抽卡：上一位';
            return n > 0 ? `跳過 ${n - 1} 位（+${n}）` : `往前跳 ${Math.abs(n) - 1} 位（${n}）`;
        }
        if (t.startsWith('role:')) return `指定抽卡：${t.slice(5)}`;
        return `指定抽卡：${t}`;
    }
    if (r.kind === 'change_deck') return `切換牌組：${r.target}`;
    return '';
}
