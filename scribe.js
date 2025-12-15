// ==================================================================================
// 模块: Scribe (书记员 - 负责同步世界书到文件) - v3.0 API & Persistence
// ==================================================================================
(function() {
    window.ST_PHONE = window.ST_PHONE || {};
    window.ST_PHONE.config = window.ST_PHONE.config || {};

    // 内部状态：记录上一次保存的内容，用于防抖和去重
    const state = {
        isSyncing: false,       // 锁：防止在上一次写入未完成时触发下一次
        lastContentMap: {}      // 缓存：联系人 -> 上次保存的文本内容
    };

    // --- 1. 基础工具 ---

    // 封装酒馆 API 调用
    async function apiCall(endpoint, body) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': window.checkCsrfToken ? window.checkCsrfToken() : undefined // 兼容 CSRF
                },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.warn(`📱 [Scribe] API调用失败 (${endpoint}):`, e);
            return null;
        }
    }

    // 格式化短信为剧本格式 (保持原有逻辑)
    function formatMessagesForWI(contactName, messages) {
        // 只取最近 30 条，避免 Token 爆炸
        const recentMsgs = messages.slice(-30);
        
        let transcript = `[短信记录: ${contactName}]\n`;
        transcript += `(以下是 User 与 ${contactName} 在手机上的近期短信往来，请参考此记录进行对话)\n`;
        
        recentMsgs.forEach(msg => {
            const senderName = msg.sender === 'user' ? '我' : contactName;
            // 格式: (10:00) 猫娘: 晚上吃鱼吗？
            transcript += `(${msg.timeStr.split(' ')[1] || msg.timeStr}) ${senderName}: ${msg.text}\n`;
        });

        return transcript;
    }

    // --- 2. 核心功能 ---

    window.ST_PHONE.scribe = {
        
        // 获取所有世界书文件名 (供 Settings 页面使用)
        getWorldBookList: async function() {
            // 尝试调用标准 API 获取列表
            const result = await apiCall('/api/worldinfo/getnames', {});
            // 返回格式通常是 { names: [...] } 或直接数组，做个兼容
            if (result && Array.isArray(result.names)) return result.names;
            if (Array.isArray(result)) return result;
            return [];
        },

        // 同步逻辑 (Core 模块定时调用)
        sync: async function(contacts) {
            // 0. 基础检查
            if (!contacts || contacts.length === 0) return;
            
            // 1. 获取目标世界书 (从配置中读)
            const targetBookName = window.ST_PHONE.config.targetWorldBook;
            if (!targetBookName) {
                // 如果用户没选书，就不执行同步，直接静默退出
                return;
            }

            // 2. 脏检查 (Dirty Check) - 看看是否有必要进行昂贵的 IO 操作
            let hasChanges = false;
            const currentTranscripts = {};

            contacts.forEach(contact => {
                if (contact.messages && contact.messages.length > 0) {
                    const content = formatMessagesForWI(contact.name, contact.messages);
                    currentTranscripts[contact.name] = content;
                    
                    // 如果缓存里没有，或者内容变了，标记为需要保存
                    if (state.lastContentMap[contact.name] !== content) {
                        hasChanges = true;
                    }
                }
            });

            if (!hasChanges) {
                // console.log('📱 [Scribe] 内容无变化，跳过同步');
                return;
            }

            // 3. 写入锁检查
            if (state.isSyncing) {
                console.log('📱 [Scribe] 上次同步尚未完成，跳过本次');
                return;
            }

            state.isSyncing = true;
            // console.log(`📱 [Scribe] 检测到变动，开始同步到世界书: ${targetBookName}`);

            try {
                // A. 读取：从服务器获取最新的世界书数据
                const bookData = await apiCall('/api/worldinfo/get', { name: targetBookName });
                
                if (!bookData || !bookData.entries) {
                    console.error('📱 [Scribe] 无法读取目标世界书或格式错误');
                    state.isSyncing = false;
                    return;
                }

                let bookModified = false;

                // B. 修改：遍历所有有短信的角色，更新对应的词条
                for (const name in currentTranscripts) {
                    const content = currentTranscripts[name];
                    const entryComment = `ST_PHONE_AUTO_${name}`;

                    // 在 entries 里找我们的专属词条
                    let entry = bookData.entries.find(e => e.comment === entryComment);

                    if (entry) {
                        // 如果找到了，检查内容是否需要更新
                        if (entry.content !== content) {
                            entry.content = content;
                            // 确保它处于启用状态
                            entry.enabled = true; 
                            bookModified = true;
                        }
                    } else {
                        // 没找到，新建一个
                        const newEntry = {
                            keys: `${name},手机,短信,message,phone`,
                            content: content,
                            comment: entryComment,
                            enabled: true,
                            position: 'before_char', // 插入位置：角色之前作为背景
                            selective: false,
                            constant: false,
                            id: Date.now() + Math.floor(Math.random() * 1000) // 随机唯一ID
                        };
                        // 放入 entries 数组
                        // 某些版本的 entries 是对象 map，某些是数组，SillyTavern 标准是数组
                        if (Array.isArray(bookData.entries)) {
                            bookData.entries.push(newEntry);
                            bookModified = true;
                        }
                    }
                }

                // C. 保存：如果有改动，写回服务器
                if (bookModified) {
                    const saveResult = await apiCall('/api/worldinfo/edit', { 
                        name: targetBookName, 
                        data: bookData 
                    });
                    
                    if (saveResult) {
                        console.log('📱 [Scribe] 同步成功！');
                        // 更新缓存，标记这些内容已保存
                        Object.assign(state.lastContentMap, currentTranscripts);
                    }
                } else {
                    // console.log('📱 [Scribe] 词条内容未变 (可能被其他进程更新)，跳过写入');
                    // 即使没写文件，也更新缓存，防止死循环
                    Object.assign(state.lastContentMap, currentTranscripts);
                }

            } catch (err) {
                console.error('📱 [Scribe] 同步过程中发生错误:', err);
            } finally {
                // 解锁
                state.isSyncing = false;
            }
        }
    };
})();
