// ==================================================================================
// 模块: Scribe (书记员 - 负责同步世界书)
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

    // 核心：更新世界书
    function updateWorldInfoEntry(contactName, content) {
        // 1. 获取酒馆全局世界书对象
        // 不同版本的酒馆变量名可能不同，这里尝试兼容获取
        let context = null;
        if (typeof SillyTavern !== 'undefined') {
             context = SillyTavern.getContext();
        }
        
        // 如果无法获取上下文，直接退出
        if (!context || !context.worldInfo) return;

        const worldInfoList = context.worldInfo;
        
        // 2. 寻找专属词条
        // 我们的策略是：为每个联系人维护一个唯一的词条
        // 识别特征：comment 字段标记为 "ST_PHONE_AUTO_GEN"
        let entry = worldInfoList.find(e => 
            e.comment === `ST_PHONE_AUTO_${contactName}` || 
            // 兼容性查找：如果没标记，尝试找 keys 匹配且由插件创建的
            (e.keys.includes(contactName) && e.keys.includes('短信')) 
        );

        // 3. 构造词条数据
        const entryData = {
            // 触发关键词：提到角色名、手机、短信时触发
            keys: `${contactName},手机,短信,message,phone`,
            // 这里的 content 就是我们要覆写的“快照”
            content: content,
            // 设为常量，确保一直生效（或者你可以设为 true 节省资源，看需求）
            constant: false, 
            // 标记这个词条是我们自动生成的
            comment: `ST_PHONE_AUTO_${contactName}`,
            // 启用状态
            enabled: true,
            // 插入位置：插在前面作为背景设定，还是插在后面作为最近记忆？
            // 建议：插在 Character 之后 (1) 或者 这里的 Order 逻辑视版本而定
            position: 'before_char', 
            // 关键：不递归扫描，防止死循环
            selective: false 
        };

        if (entry) {
            // A. 存在 -> 覆盖 (这就是“自动删除”的奥义：用新的直接把旧的冲掉)
            // 只有当内容真变了才更新，避免无意义的 IO
            if (entry.content !== content) {
                Object.assign(entry, entryData);
                // console.log(`📱 [Scribe] 已更新 ${contactName} 的记忆快照`);
            }
        } else {
            // B. 不存在 -> 新建
            worldInfoList.push(entryData);
            console.log(`📱 [Scribe] 已新建 ${contactName} 的记忆快照`);
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
            
            // 触发酒馆保存（可选，防止刷新丢失，视具体 API 而定）
            // 这里的 saveWorldInfo 是部分版本有的全局函数，如果没有也不会报错
            if (typeof saveWorldInfo === 'function') {
                // saveWorldInfo(); 
            }
        }
    };
})();
