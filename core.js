// ==================================================================================
// 模块: Core (核心逻辑)
// ==================================================================================
(function() {
    
    // --- 辅助函数：获取系统时间 (格式：12月10日 18:30) ---
    function getSystemTimeStr() {
        const now = new Date();
        const M = now.getMonth() + 1;
        const D = now.getDate();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        return `${M}月${D}日 ${h}:${m}`;
    }

    // 状态管理
    window.ST_PHONE.state.lastUserSendTime = 0;
    window.ST_PHONE.state.pendingMsgText = null;
    window.ST_PHONE.state.pendingMsgTarget = null;
    // 默认虚拟时间直接取当前系统时间，而不是写死的 "12:00"
    window.ST_PHONE.state.virtualTime = getSystemTimeStr(); 

    // --- 核心：扫描聊天记录 ---
    const REGEX_XML_MSG = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/gi;

    function scanChatHistory() {
        if (typeof SillyTavern === 'undefined') return;
        
        const context = SillyTavern.getContext();
        const chat = context.chat; 
        if (!chat) return;

        const newContactsMap = new Map();
        let lastCapturedTime = null; // 用于记录最后一条有效消息的时间

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

                // 只要有时间，就更新（因为是从前往后扫，最后留下的就是最新的）
                if (timeStr) lastCapturedTime = timeStr;

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
                
                // 如果消息里没有时间，就用系统时间兜底
                contact.lastMsg = content;
                contact.time = timeStr || getSystemTimeStr();
            });
        });

        // --- 核心改动：同步剧情时间 ---
        // 如果扫描到了时间，就更新虚拟时间；否则保持系统时间
        if (lastCapturedTime) {
            window.ST_PHONE.state.virtualTime = lastCapturedTime;
        } 
        
        // 更新 UI 上的时间
        if (window.ST_PHONE.ui.updateStatusBarTime) {
            window.ST_PHONE.ui.updateStatusBarTime(window.ST_PHONE.state.virtualTime);
        }

        // 2. [保活逻辑：二重扫描]
        const pendingText = window.ST_PHONE.state.pendingMsgText;
        const pendingTarget = window.ST_PHONE.state.pendingMsgTarget;
        const now = Date.now();

        if (pendingText) {
            if (!newContactsMap.has(pendingTarget)) {
                 newContactsMap.set(pendingTarget, {
                        id: pendingTarget,
                        name: pendingTarget,
                        lastMsg: '',
                        time: window.ST_PHONE.state.virtualTime,
                        messages: []
                 });
            }
            const contact = newContactsMap.get(pendingTarget);
            const recentRealMsgs = contact.messages.slice(-5);
            const isSynced = recentRealMsgs.some(m => m.text === pendingText && m.sender === 'user');

            if (isSynced) {
                window.ST_PHONE.state.pendingMsgText = null;
                window.ST_PHONE.state.pendingMsgTarget = null;
            } else {
                if (now - window.ST_PHONE.state.lastUserSendTime < 60000) {
                    contact.messages.push({
                        sender: 'user',
                        text: pendingText,
                        isPending: true 
                    });
                    contact.lastMsg = pendingText; 
                } else {
                    window.ST_PHONE.state.pendingMsgText = null;
                }
            }
        }

        // 更新全局 State
        window.ST_PHONE.state.contacts = Array.from(newContactsMap.values());
        
        // 调用 View 更新 UI
        if (window.ST_PHONE.ui.renderContacts) {
            const searchInput = document.getElementById('phone-search-bar');
            if (!searchInput || !searchInput.value) {
                window.ST_PHONE.ui.renderContacts();
            }
            
            if (window.ST_PHONE.state.activeContactId) {
                const currentContact = window.ST_PHONE.state.contacts.find(c => c.id === window.ST_PHONE.state.activeContactId);
                if (currentContact) window.ST_PHONE.ui.renderChat(currentContact);
            }
        }
    }

    // --- 核心：发送逻辑 (使用剧情时间) ---
    function sendDraftToInput() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        const activeId = window.ST_PHONE.state.activeContactId;
        
        if (!text || !activeId) return;

        let contact = window.ST_PHONE.state.contacts.find(c => c.id === activeId);
        const targetName = contact ? contact.name : activeId;

        // 使用当前顶栏显示的虚拟时间
        const timeToSend = window.ST_PHONE.state.virtualTime;

        const xmlString = `<msg>{{user}}|${targetName}|${text}|${timeToSend}</msg>`;
        const mainTextArea = document.querySelector('#send_textarea');
        
        if (mainTextArea) {
            const originalText = mainTextArea.value;
            const separator = originalText.length > 0 ? '\n' : '';
            mainTextArea.value = originalText + separator + xmlString;
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            window.ST_PHONE.state.lastUserSendTime = Date.now();
            window.ST_PHONE.state.pendingMsgText = text;
            window.ST_PHONE.state.pendingMsgTarget = targetName;

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

    const sendBtn = document.getElementById('btn-send');
    if(sendBtn) sendBtn.onclick = sendDraftToInput;

    const msgInput = document.getElementById('msg-input');
    if(msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendDraftToInput();
        });
    }

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
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (剧情时间同步版)');
    }, 1000);

})();
