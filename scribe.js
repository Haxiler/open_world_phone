// ==================================================================================
// 模块: Scribe (书记员 - v3.95 UI Auto-Refresh)
// ==================================================================================
(function () {

    const MAX_MESSAGES = 30;

    const state = {
        debounceTimer: null
    };

    function buildContent(contact) {
        if (!contact.messages || contact.messages.length === 0) return '';
        const msgs = contact.messages.slice(-MAX_MESSAGES);
        let out = `【手机短信记录｜${contact.name}】\n\n`;
        out += `以下是 {{user}} 与 ${contact.name} 之间的近期手机短信记录，仅在短信交流时用于回忆上下文。\n\n`;
        msgs.forEach(m => {
            const who = m.sender === 'user' ? '我' : contact.name;
            out += `(${m.timeStr}) ${who}：${m.text}\n`;
        });
        return out.trim();
    }

    // jQuery API 请求封装
    async function apiFetch(url, body) {
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'POST',
                url: url,
                data: JSON.stringify(body),
                contentType: 'application/json',
                headers: { 'X-CSRF-Token': window.csrf_token },
                success: function(data) { resolve(data); },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error(`❌ [API Fail] ${url}`, jqXHR.status);
                    reject(new Error(`API Error: ${jqXHR.status}`));
                }
            });
        });
    }

    // 获取列表
    async function fetchWorldBookList() {
        let names = [];
        try {
            if (typeof window.world_names !== 'undefined' && Array.isArray(window.world_names)) return window.world_names;
            const select = document.querySelector('#world_editor_select');
            if (select && select.options.length > 0) {
                names = Array.from(select.options)
                    .map(o => (o.innerText || o.text || "").trim())
                    .filter(v => v && v !== "Select World Info" && v !== "None");
            }
        } catch(e) {}
        return names;
    }

    // ==========================================================
    // 核心逻辑: 同步 + 详细调试探针
    // ==========================================================
    async function performSync(contacts) {
        // [探针 1] 触发监测
        console.group("🕵️‍♀️ [Scribe-Debug] 同步流程启动");
        console.log(`⏰ 时间: ${new Date().toLocaleTimeString()}`);
        console.log(`📦 传入联系人数量: ${contacts ? contacts.length : 0}`);
        
        if (!contacts || !contacts.length) {
            console.warn("⚠️ 调试信息: 联系人列表为空，跳过。");
            console.groupEnd();
            return;
        }

        let targetBookName = window.ST_PHONE.config.targetWorldBook;
        let isEmbedded = false;
        let charId = null;
        const context = SillyTavern.getContext();

        // 自动探测
        if (!targetBookName && context.characterId) {
            charId = context.characterId;
            const char = SillyTavern.characters[charId];
            if (char && char.data && char.data.character_book) {
                const bookRef = char.data.character_book;
                if (typeof bookRef === 'object') {
                    isEmbedded = true; 
                    targetBookName = "Embedded_Book"; 
                } else if (typeof bookRef === 'string' && bookRef.trim() !== '') {
                    targetBookName = bookRef;
                }
            }
        }

        if (!targetBookName) {
            console.warn("⚠️ 调试信息: 未找到目标世界书，请在手机设置中检查。");
            console.groupEnd();
            return;
        }

        // 1. 读取原始数据
        // [探针 2] 读取新鲜度监测
        console.log(`📚 [Step 1] 正在读取世界书: ${targetBookName} (模式: ${isEmbedded ? '内嵌' : '全局'})`);
        
        let bookObj = null;
        if (isEmbedded) {
            const char = SillyTavern.characters[charId];
            if (!char.data.character_book) char.data.character_book = { entries: [] };
            bookObj = char.data.character_book;
        } else {
            try {
                // 强制从服务器拉取，不依赖缓存
                const res = await apiFetch('/api/worldinfo/get', { name: targetBookName });
                if (!res) throw new Error("API返回空");
                bookObj = res;
            } catch(e) {
                console.error("❌ 读取失败", e);
                console.groupEnd();
                return;
            }
        }

        // 2. 准备修改
        if (!bookObj.entries) bookObj.entries = [];
        const entriesCollection = bookObj.entries;
        const isDict = !Array.isArray(entriesCollection);
        const entryList = isDict ? Object.values(entriesCollection) : entriesCollection;
        
        let modified = false;

        contacts.forEach(contact => {
            const comment = `ST_PHONE_SMS::${contact.name}`;
            const content = buildContent(contact);
            if (!content) return;

            // 查找
            let existingEntry = entryList.find(e => e.comment === comment);

            if (!existingEntry) {
                console.log(`🆕 新增条目: ${contact.name}`);
                const newEntry = createEntry(contact.name, comment, content);
                if (isDict) bookObj.entries[newEntry.uid] = newEntry;
                else bookObj.entries.push(newEntry);
                modified = true;
            } else {
                if (existingEntry.content !== content) {
                    console.log(`⚡ 更新条目: ${contact.name}`);
                    existingEntry.content = content;
                    existingEntry.enabled = true;
                    modified = true;
                }
            }
        });

        // 3. 提交与验证
        if (modified) {
            console.log(`💾 [Step 3] 检测到变化，正在提交...`);
            
            if (isEmbedded) {
                if (SillyTavern.saveCharacterDebounced) SillyTavern.saveCharacterDebounced(charId);
                else SillyTavern.saveCharacter(charId);
                console.log("✅ 内存已更新 (内嵌模式)");
                
                // 内嵌模式下，尝试刷新字符编辑器界面（如果开着的话）
                // 通常 ST 会监听 save 事件自动刷新，但为了保险：
                if (typeof window.drawCharacterBook === 'function') {
                    // 如果当前正好开着这个角色的书
                    // 这是一个尝试性的刷新，不一定总是有效，视 ST 版本而定
                }

            } else {
                // 全局书模式提交
                await apiFetch('/api/worldinfo/edit', { name: targetBookName, data: bookObj });
                console.log("✅ API 响应成功 (200 OK)");
                
                // === 关键修复：主动刷新 UI ===
                // 检查用户当前是否正看着这本世界书，如果是，强制 UI 重载
                try {
                    const editorSelect = document.getElementById('world_editor_select');
                    // 如果编辑器下拉框存在，且选中的书名就是我们刚更新的这本书
                    if (editorSelect && editorSelect.value === targetBookName) {
                        console.log("🔄 检测到世界书编辑器已打开，正在刷新界面...");
                        
                        // 调用 ST 内部的加载函数 (兼容不同版本的函数名)
                        const loadFunc = window.loadWorldInfo || (SillyTavern && SillyTavern.loadWorldInfo);
                        if (typeof loadFunc === 'function') {
                            loadFunc(targetBookName);
                            console.log("✅ 界面刷新指令已发送");
                        }
                    } else {
                        console.log("💤 编辑器未打开或未选中该书，跳过 UI 刷新");
                    }
                } catch(err) {
                    console.warn("⚠️ UI 刷新尝试失败 (非致命错误):", err);
                }
            }
        } else {
            console.log("🛑 [Step 3] 无需提交 (无变化)");
        }
        
        console.groupEnd();
    }

    function createEntry(contactName, comment, content) {
        return {
            uid: generateUUID(), 
            key: ['<msg>', '短信', '手机', contactName], 
            keys: ['<msg>', '短信', '手机', contactName],
            comment: comment,
            content: content,
            enabled: true,
            constant: false,
            selectiveLogic: 0,
            depth: 2,
            order: 100, 
            priority: 100
        };
    }

    function generateUUID() {
        if (crypto && crypto.randomUUID) return crypto.randomUUID();
        return Date.now().toString(); 
    }

    window.ST_PHONE.scribe = {
        sync: function(contacts) {
            if (state.debounceTimer) clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => { performSync(contacts); }, 2000);
        },
        getWorldBookList: fetchWorldBookList,
        forceSync: () => performSync(window.ST_PHONE.state.contacts)
    };

    console.log('✅ ST-iOS-Phone: 书记员 v3.95 (UI自动刷新版已就绪)');
})();
