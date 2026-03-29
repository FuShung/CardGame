// modules/draw.js
// 抽卡邏輯：buildDeckState、drawByDeck、advancePlayer、applyDrawMode

function buildDeckState(deck) {
    const pool = [];
    deck.pool.forEach(item => {
        if (typeof item === 'string') {
            pool.push(item);
        } else if (item.name) {
            const count = item.count || 1;
            for (let i = 0; i < count; i++) pool.push(item.name);
        }
    });
    const result = { pool, remaining: pool.length };
    if (deck.draw_mode === SEQUENCE_MODE) result.nextIdx = 0;
    return result;
}

function drawByDeck(deckName, state, lbDeckRemaining) {
    const { decks, activeDeck } = state;
    const deck = decks[deckName];
    if (!deck.runtimeStates || deck.runtimeStates.remaining < 0) {
        deck.runtimeStates = buildDeckState(deck);
        return drawByDeck(deckName, state, lbDeckRemaining);
    }

    if (deck.runtimeStates.remaining <= 0 && deck.draw_mode !== REDRAW_MODE) {
        deck.runtimeStates = buildDeckState(deck);
        return '';
    }

    const s = deck.runtimeStates;
    // 過濾不符合 requires 條件的卡（RANDOM/REDRAW 模式）
    const eligiblePool = (deck.draw_mode !== SEQUENCE_MODE && state.cards)
        ? s.pool.filter(name => {
            const card = state.cards[name];
            return !card || checkCardRequires(card, state);
          })
        : s.pool;

    let cardName;
    switch (deck.draw_mode) {
        case RANDOM_MODE:
            s.remaining--;
        case REDRAW_MODE:
            if (!eligiblePool.length) return '';
            cardName = eligiblePool[Math.floor(Math.random() * eligiblePool.length)];
            break;
        case SEQUENCE_MODE:
            // 順序模式：跳過不符合條件的卡
            while (s.nextIdx < s.pool.length) {
                const candidate = s.pool[s.nextIdx];
                s.nextIdx++;
                s.remaining--;
                const card = state.cards && state.cards[candidate];
                if (!card || checkCardRequires(card, state)) {
                    cardName = candidate;
                    break;
                }
            }
            if (!cardName) return '';
            break;
    }

    if (activeDeck && deck.name === activeDeck.name && lbDeckRemaining) {
        lbDeckRemaining.textContent = s.remaining;
    }
    const lbEl = document.getElementById(`lb-deck-remaining-${deckName}`);
    if (lbEl) lbEl.textContent = s.remaining;

    if (decks[cardName]) return drawByDeck(cardName, state, lbDeckRemaining);
    return cardName;
}

function applyDrawerTarget(target, state) {
    const n = state.players.length;
    if (target === 'current' || target === 'skip:0') {
        // 不變
    } else if (target.startsWith('skip:')) {
        const offset = parseInt(target.slice(5));
        if (!isNaN(offset)) state.currentPlayerIdx = ((state.currentPlayerIdx + offset) % n + n) % n;
    } else if (target.startsWith('role:')) {
        const roleName = target.slice(5);
        const idx = state.players.findIndex(p => p.role === roleName);
        if (idx !== -1) state.currentPlayerIdx = idx;
    }
}

function applyDrawMode(state) {
    const { players, roles, drawMode, drawModeRole } = state;
    const n = players.length;
    switch (drawMode) {
        case RANDOM_PLAYER:
            state.currentPlayerIdx = Math.floor(Math.random() * n);
            break;
        case ROUND_PLAYER:
            state.currentPlayerIdx = (state.currentPlayerIdx + 1) % n;
            break;
        case RANDOM_DIGNITY: {
            const pool = players.map((p, i) => (!drawModeRole || p.role === drawModeRole) ? i : -1).filter(i => i !== -1);
            if (pool.length) state.currentPlayerIdx = pool[Math.floor(Math.random() * pool.length)];
            break;
        }
        case ROUND_DIGNITY: {
            const roleOrder = roles.map(r => r.name);
            if (drawModeRole) {
                const pool = players.map((p, i) => p.role === drawModeRole ? i : -1).filter(i => i !== -1);
                if (pool.length) {
                    const cur = pool.indexOf(state.currentPlayerIdx);
                    state.currentPlayerIdx = pool[(cur + 1) % pool.length];
                }
            } else {
                const curRole = players[state.currentPlayerIdx].role;
                const curRoleIdx = roleOrder.indexOf(curRole);
                const nextRole = roleOrder[(curRoleIdx + 1) % roleOrder.length];
                const idx = players.findIndex(p => p.role === nextRole);
                if (idx !== -1) state.currentPlayerIdx = idx;
            }
            break;
        }
    }
}

function applyLegacyDrawer(nd, state) {
    if (nd === 'current') return;
    if (nd.startsWith('current:')) {
        const sub = nd.slice(8);
        applyDrawerTarget(sub === 'current' ? 'skip:0' : sub, state);
        state.overridePlayer = { target: 'skip:0', once: false };
        return;
    }
    if (nd === 'next' || nd === 'prev' || nd.startsWith('role:')) {
        applyDrawerTarget(nd === 'next' ? 'skip:1' : nd === 'prev' ? 'skip:-1' : nd, state);
        return;
    }
    if (nd.startsWith('mode:')) {
        state.drawMode = parseInt(nd.slice(5));
        state.drawModeRole = '';
        applyDrawMode(state);
    }
}

function advancePlayer(card, state) {
    if (!state.players.length) return;

    if (card._resolved_draw_player !== undefined) {
        const target = card._resolved_draw_player;
        delete card._resolved_draw_player;
        if (target === 'current' || target === 'skip:0') {
            state.overridePlayer = null;
            return;
        }
        applyDrawerTarget(target, state);
        state.overridePlayer = null;
        return;
    }

    const nd = card._resolved_next_drawer ?? card.next_drawer;
    delete card._resolved_next_drawer;
    if (nd) { applyLegacyDrawer(nd, state); return; }

    if (state.overridePlayer) {
        const { target, once } = state.overridePlayer;
        applyDrawerTarget(target, state);
        if (once) state.overridePlayer = null;
        return;
    }

    applyDrawMode(state);
}
