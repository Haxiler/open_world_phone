// ==================================================================================
// 模块: Core (核心逻辑)
// ==================================================================================
(function() {
    
    // 状态管理
    window.ST_PHONE.state.lastUserSendTime = 0;
    window.ST_PHONE.state.pendingMsgText = null;
    window.ST_PHONE.state.pendingMsgTarget = null;

    // --- 辅助函数 ---
    function getCurrentTimeStr() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    // --- 核心：扫描聊天记录 ---
    const REGEX_XML_MSG = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/gi;

    function scanChatHistory() {
        if (typeof SillyTavern === 'undefined') return;
        
        const context = SillyTavern.getContext();
        const chat = context.chat; 
        if (!chat) return;

        const newContactsMap = new Map();

        // 1. 标准扫描 (构建真实历史)
        chat.forEach(msg => {
            if (!msg.mes) return;
            const cleanMsg = msg.mes.replace(/```/g, ''); 
            const matches = [...cleanMsg.matchAll(REGEX_XML_MSG)];

            matches.forEach(match => {
                const sender = match[1].trim();
                const receiver = match[2].trim();
                const content = match[3].trim();
                const timeStr = match[4].trim();

                let contactName = '';
                let isMyMessage = false;

                if (sender.toLowerCase().includes('{{user}}') || sender === '你' || sender.toLowerCase() === 'user') {
                    contactName = receiver;
                    isMyMessage = true;
                } else {
                    contactName = sender;
                    isMyMessage = false;
                }

                if (!newContactsMap.has(contactName)) {
                    newContactsMap.set(contactName, {
                        id: contactName,
                        name: contactName,
                        lastMsg: '',
                        time: '',
                        messages: []
                    });
                }
                const contact = newContactsMap.get(contactName);

                contact.messages.push({
                    sender: isMyMessage ? 'user' : 'char',
                    text: content,
                    isPending: false 
                });
                
                contact.lastMsg = content;
                contact.time = timeStr || getCurrentTimeStr();
            });
        });

        // 2. [保活逻辑升级：二重扫描]
        // 不再依赖短时间倒计时，而是依赖“是否已同步”。
        const pendingText = window.ST_PHONE.state.pendingMsgText;
        const pendingTarget = window.ST_PHONE.state.pendingMsgTarget;
        const now = Date.now();

        if (pendingText) {
            // 确保联系人存在（如果是新对话，真实记录里可能还没这个联系人）
            if (!newContactsMap.has(pendingTarget)) {
                 newContactsMap.set(pendingTarget, {
                        id: pendingTarget,
                        name: pendingTarget,
                        lastMsg: '',
                        time: getCurrentTimeStr(),
                        messages: []
                 });
            }
            const contact = newContactsMap.get(pendingTarget);

            // 【关键修改】检查真实记录的最后几条，看是否包含我的 pending 内容
            // 取最后5条防止并发时的顺序微差
            const recentRealMsgs = contact.messages.slice(-5);
            const isSynced = recentRealMsgs.some(m => m.text === pendingText && m.sender === 'user');

            if (isSynced) {
                // A. 找到了！说明酒馆已经同步成功，清除保活状态
                window.ST_PHONE.state.pendingMsgText = null;
                window.ST_PHONE.state.pendingMsgTarget = null;
            } else {
                // B. 没找到，说明还在路上（或者生成失败）
                // 只有当时间超过 60秒（兜底），才认为是彻底丢包了，停止显示
                if (now - window.ST_PHONE.state.lastUserSendTime < 60000) {
                    contact.messages.push({
                        sender: 'user',
                        text: pendingText,
                        isPending: true // 保持半透明状态
                    });
                    contact.lastMsg = pendingText; // 强制更新预览
                } else {
                    // 超时，放弃治疗
                    window.ST_PHONE.state.pendingMsgText = null;
                }
            }
        }

        // 更新全局 State
        window.ST_PHONE.state.contacts = Array.from(newContactsMap.values());
        
        // 调用 View 更新 UI
        if (window.ST_PHONE.ui.renderContacts) {
            const searchInput = document.getElementById('phone-search-bar');
            // 只有在没搜索时才自动刷新列表，防止打字干扰
            if (!searchInput || !searchInput.value) {
                window.ST_PHONE.ui.renderContacts();
            }
            
            if (window.ST_PHONE.state.activeContactId) {
                const currentContact = window.ST_PHONE.state.contacts.find(c => c.id === window.ST_PHONE.state.activeContactId);
                if (currentContact) window.ST_PHONE.ui.renderChat(currentContact);
            }
        }
    }

    // --- 核心：发送逻辑 ---
    function sendDraftToInput() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        const activeId = window.ST_PHONE.state.activeContactId;
        
        if (!text || !activeId) return;

        let contact = window.ST_PHONE.state.contacts.find(c => c.id === activeId);
        const targetName = contact ? contact.name : activeId;

        const xmlString = `<msg>{{user}}|${targetName}|${text}|${getCurrentTimeStr()}</msg>`;
        const mainTextArea = document.querySelector('#send_textarea');
        
        if (mainTextArea) {
            const originalText = mainTextArea.value;
            const separator = originalText.length > 0 ? '\n' : '';
            mainTextArea.value = originalText + separator + xmlString;
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 记录保活状态
            window.ST_PHONE.state.lastUserSendTime = Date.now();
            window.ST_PHONE.state.pendingMsgText = text;
            window.ST_PHONE.state.pendingMsgTarget = targetName;

            // 立即渲染（不等轮询）
            if (contact) {
                contact.messages.push({
                    sender: 'user',
                    text: text,
                    isPending: true
                });
                window.ST_PHONE.ui.renderChat(contact);
            }

            input.value = '';
            mainTextArea.focus();
        } else {
            alert('❌ 找不到酒馆主输入框 (#send_textarea)');
        }
    }

    // --- 事件绑定 ---
    document.addEventListener('st-phone-opened', () => { scanChatHistory(); });

    const reloadBtn = document.getElementById('btn-reload-data');
    if(reloadBtn) {
        reloadBtn.onclick = () => { 
            scanChatHistory(); 
            reloadBtn.style.transform = 'rotate(360deg)'; 
            setTimeout(()=> reloadBtn.style.transform = 'none', 500); 
        };
    }

    const sendBtn = document.getElementById('btn-send');
    if(sendBtn) sendBtn.onclick = sendDraftToInput;

    const msgInput = document.getElementById('msg-input');
    if(msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendDraftToInput();
        });
    }

    // 自动化轮询
    function initAutomation() {
        setInterval(() => {
            if (window.ST_PHONE.state.isPhoneOpen) {
                scanChatHistory();
            }
        }, 2000);

        if (typeof jQuery !== 'undefined') {
            jQuery(document).on('generation_ended', () => {
                setTimeout(scanChatHistory, 1000); 
            });
        }
    }

    setTimeout(() => {
        initAutomation();
        scanChatHistory();
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (保活增强版)');
    }, 1000);

})();
