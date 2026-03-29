// modules/effect.js
// 卡牌效果文字解析（隨機選項、計時器）

function parseEffect(str) {
    let hasTime = false, timeVal = 0;
    const text = str.replace(/\[([^\]]+)\]/g, (_, inner) => {
        const isTime = inner.startsWith('time:');
        const content = isTime ? inner.replace('time:', '').trim() : inner;
        let options = [];
        content.split(',').forEach(p => {
            const part = p.trim();
            if (part.includes('~')) {
                const [min, max] = part.split('~').map(Number);
                for (let i = min; i <= max; i++) options.push(i);
            } else {
                const num = Number(part);
                options.push(isNaN(num) || part === '' ? part : num);
            }
        });
        const pick = options[Math.floor(Math.random() * options.length)];
        if (isTime) { hasTime = true; timeVal = Number(pick); }
        return pick;
    });
    return { text, hasTime, timeVal };
}
