// ==================================================================================
// 模块: Scribe (书记员 - 负责同步世界书) - v2.0 Fix Character Book
// ==================================================================================
(function() {
    window.ST_PHONE = window.ST_PHONE || {};

    // 格式化短信为剧本格式
    function formatMessagesForWI(contactName, messages) {
        // 只取最近 20 条，避免 Token 爆炸
        const recentMsgs = messages.slice(-20);
        
        let transcript = `[短信记录: ${contactName}]\n`;
        transcript += `(以下是 User 与 ${contactName} 在手机上的近期短信往来，请参考此记录进行对话)\n`;
        
        recentMsgs.forEach(msg => {
            const senderName = msg.sender === 'user' ? '我' : contactName;
            // 格式: (10:00) 猫娘: 晚上吃鱼吗？
            transcript += `(${msg.timeStr.split(' ')[1] || msg.timeStr}) ${senderName}: ${msg.text}\n`;
        });

        return transcript;
    }

    // 核心：更新角色专属世界书 (Character Book)
    function updateWorldInfoEntry(contactName, content) {
        if (typeof SillyTavern === 'undefined') return;

        const context = SillyTavern.getContext();
        // 1. 获取当前正在聊天的角色 ID
        const charId = context.characterId;
        if (charId === undefined || charId === null) return;

        // 2. 获取角色对象
        const character = context.characters[charId];
        if (!character) return;

        // 3. 确保角色数据中有 character_book 对象 (这是 V2 角色卡规范中的内置世界书)
        if (!character.data.character_book) {
            character.data.character_book = {
                entries: [],
                name: "Character Book"
            };
            console.log(`📱 [Scribe] 为角色 ${character.name} 初始化了内置世界书`);
        }

        const charBook = character.data.character_book;
        // 确保 entries 是数组
        if (!Array.isArray(charBook.entries)) {
            charBook.entries = [];
        }

        // 4. 在角色专属书中查找条目
        let entry = charBook.entries.find(e => 
            e.comment === `ST_PHONE_AUTO_${contactName}` || 
            (e.keys && e.keys.includes(contactName) && e.content.includes('[短信记录:'))
        );

        // 构造条目数据 (符合 V2 Spec)
        // 注意：keys 最好是数组，以兼容不同版本的酒馆
        const keysArray = [contactName, '手机', '短信', 'message', 'phone'];
        
        const entryData = {
            keys: keysArray,
            content: content,
            enabled: true,
            insertion_order: 50, // 默认优先级
            case_sensitive: false,
            constant: false,
            comment: `ST_PHONE_AUTO_${contactName}`, // 关键标记
            selective: false,
            secondary_keys: []
        };

        let needSave = false;

        if (entry) {
            // A. 存在 -> 仅当内容变动时更新
            if (entry.content !== content) {
                // 仅更新内容和必要的字段，保留用户可能手动调整过的设置（如权重）
                entry.content = content;
                entry.keys = keysArray; // 确保触发词也是新的
                needSave = true;
                // console.log(`📱 [Scribe] 更新了 ${contactName} 的短信记忆`);
            }
        } else {
            // B. 不存在 -> 推入新条目
            charBook.entries.push(entryData);
            needSave = true;
            console.log(`📱 [Scribe] 新建了 ${contactName} 的短信记忆到角色卡`);
        }

        // 5. 触发保存 (关键步骤)
        // 只有调用了保存函数，修改才会写入本地文件，并在刷新后保留
        if (needSave) {
            // saveCharacterDebounced 是酒馆全局提供的防抖保存函数，适合频繁调用
            if (typeof saveCharacterDebounced === 'function') {
                saveCharacterDebounced();
            } else if (typeof saveCharacter === 'function') {
                saveCharacter(charId);
            }
        }
    }

    // 暴露给全局
    window.ST_PHONE.scribe = {
        sync: function(contacts) {
            if (!contacts) return;
            contacts.forEach(contact => {
                // 只有当有消息时才同步
                if (contact.messages && contact.messages.length > 0) {
                    const transcript = formatMessagesForWI(contact.name, contact.messages);
                    updateWorldInfoEntry(contact.name, transcript);
                }
            });
        }
    };
})();
