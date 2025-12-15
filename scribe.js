// ==================================================================================
// ST_PHONE Scribe - SMS WorldBook Injector (v4.0)
// ==================================================================================
(function () {

    const MAX_MESSAGES = 30;

    const state = {
        lastSnapshot: {},
        syncing: false
    };

    function getTargetWorldBook() {
        if (window.ST_PHONE?.config?.targetWorldBook) {
            return window.ST_PHONE.config.targetWorldBook;
        }
        try {
            const ctx = SillyTavern.getContext();
            const charId = ctx.characterId;
            const char = SillyTavern.characters?.[charId];
            const book = char?.data?.character_book;
            if (typeof book === 'string') return book;
            if (book?.name) return book.name;
        } catch {}
        return null;
    }

    async function api(endpoint, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (window.csrf_token) headers['X-CSRF-Token'] = window.csrf_token;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(endpoint);
        return res.json();
    }

    function buildContent(contact) {
        const msgs = contact.messages.slice(-MAX_MESSAGES);
        let out = `【手机短信记录｜${contact.name}】\n\n`;
        out += `以下是 {{user}} 与 ${contact.name} 之间的近期手机短信记录，仅在短信交流时用于回忆上下文。\n\n`;
        msgs.forEach(m => {
            const who = m.sender === 'user' ? '我' : contact.name;
            out += `(${m.timeStr}) ${who}：${m.text}\n`;
        });
        return out.trim();
    }

    window.ST_PHONE.scribe = {

        sync(contacts) {
            if (state.syncing || !contacts?.length) return;

            const bookName = getTargetWorldBook();
            if (!bookName) return;

            const snapshot = {};
            contacts.forEach(c => snapshot[c.name] = buildContent(c));

            const changed = Object.keys(snapshot).some(
                k => snapshot[k] !== state.lastSnapshot[k]
            );
            if (!changed) return;

            state.syncing = true;

            (async () => {
                let book;
                try {
                    book = await api('/api/worldinfo/get', { name: bookName });
                } catch {
                    book = { entries: [] };
                }

                if (!Array.isArray(book.entries)) book.entries = [];

                let modified = false;

                contacts.forEach(contact => {
                    const comment = `ST_PHONE_SMS::${contact.name}`;
                    const content = snapshot[contact.name];

                    let entry = book.entries.find(e => e.comment === comment);

                    if (!entry) {
                        entry = {
                            uid: crypto.randomUUID(),
                            comment,
                            enabled: true,
                            constant: false,
                            depth: 4,
                            priority: 50,
                            keys: [
                                '<msg>',
                                `${contact.name} | {{user}}`,
                                `{{user}} | ${contact.name}`,
                                '手机短信'
                            ],
                            content
                        };
                        book.entries.push(entry);
                        modified = true;
                    } else if (entry.content !== content) {
                        entry.content = content;
                        entry.enabled = true;
                        modified = true;
                    }
                });

                if (modified) {
                    await api('/api/worldinfo/edit', {
                        name: bookName,
                        data: book
                    });
                    state.lastSnapshot = snapshot;
                } else {
                    state.lastSnapshot = snapshot;
                }

                state.syncing = false;
            })().catch(() => {
                state.syncing = false;
            });
        }
    };

})();
