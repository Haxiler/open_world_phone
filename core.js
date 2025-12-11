// ==================================================================================
// 模块: Core (核心逻辑 - v2.3 Timestamp Support & Anti-Parrot)
// ==================================================================================
(function() {
    
    // 生成系统时间字符串
    function getSystemTimeStr() {
        const now = new Date();
        const M = now.getMonth() + 1;
        const D = now.getDate();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        return `${M}月${D}日 ${h}:${m}`;
    }

    // 【新增】解析时间字符串为 Date 对象
    // 支持格式: "10月23日 10:30" 或 简单的 "10:30" (如果是后者，日期默认今天)
    function parseTimeStr(str) {
        if (!str) return new Date();
        const now = new Date();
        let year = now.getFullYear();
        
        // 尝试匹配 "X月X日 XX:XX"
        const fullMatch = str.match(/(\d+)月(\d+)日\s*(\d+)[:：](\d+)/);
        if (fullMatch) {
            return new Date(year, parseInt(fullMatch[1]) - 1, parseInt(fullMatch[2]), parseInt(fullMatch[3]), parseInt(fullMatch[4]));
        }
        
        // 尝试匹配仅时间 "XX:XX"
        const timeMatch = str.match(/(\d+)[:：](\d+)/);
        if (timeMatch) {
            return new Date(year, now.getMonth(), now.getDate(), parseInt(timeMatch[1]), parseInt(timeMatch[2]));
        }

        return now; // 解析失败兜底
    }

    // 初始化状态
    window.ST_PHONE.state.lastUserSendTime = 0;
    window.ST_PHONE.state.pendingQueue = []; 
    window.ST_PHONE.state.virtualTime = getSystemTimeStr(); 

    // 缓存系统
    let lastChatFingerprint = ''; 
    let cachedContactsMap = new Map(); 
    let lastChatLength = 0; 
    let lastXmlMsgCount = -1;

    const REGEX_XML_MSG = /<msg>(.+?)\|(.+?)\|([\s\S]+?)\|(.*?)<\/msg>/gi;
    const REGEX_STORY_TIME = /(?:<|&lt;)time(?:>|&gt;)(.*?)(?:<|&lt;)\/time(?:>|&gt;)/i;

    function isUserSender(name, context) {
        const myNames = ['{{user}}', '你', 'user', 'me', 'myself'];
        if (context.name1) {
            myNames.push(context.name1.toLowerCase());
            myNames.push(context.name1);
        }
        return myNames.some(n => n && name.toLowerCase() === n.toLowerCase());
    }

    function scanChatHistory() {
        if (typeof SillyTavern === 'undefined') return;
        
        const context = SillyTavern.getContext();
        const chat = context.chat; 
        if (!chat || chat.length === 0) return;

        // --- 1. 指纹检测 ---
        const lastMsg = chat[chat.length - 1];
        const lastMsgHash = lastMsg.mes ? lastMsg.mes.slice(-50) : ''; 
        const currentFingerprint = `${chat.length}|${lastMsgHash}|${context.name1}`; 

        let displayContactsMap = new Map(); 
        let latestNarrativeTime = null; 
        let currentXmlMsgCount = 0;
        let lastParsedSmsWasMine = false;

        if (currentFingerprint !== lastChatFingerprint) {
            lastChatFingerprint = currentFingerprint;
            
            // A. 队列清除逻辑
            if (lastChatLength > 0 && chat.length > lastChatLength) {
                const newMessages = chat.slice(lastChatLength);
                let hasNewUserMsg = false;
                newMessages.forEach(msg => {
                    let isMe = msg.is_user || (context.name1 && msg.name === context.name1);
                    if (!isMe) {
                         const matches = [...(msg.mes || '').matchAll(REGEX_XML_MSG)];
                         if (matches.length > 0) {
                             const sender = matches[matches.length - 1][1].trim();
                             if (isUserSender(sender, context)) isMe = true;
                         }
                    }
                    if (isMe) hasNewUserMsg = true;
                });
                
                if (hasNewUserMsg) window.ST_PHONE.state.pendingQueue = [];
            }
            lastChatLength = chat.length;

            // B. 全量解析
            const currentUserPersona = context.name1 ? context.name1.trim() : null;
            let newContactsMap = new Map();

            chat.forEach(msg => {
                if (!msg.mes) return;
                const cleanMsg = msg.mes.replace(/```/g, ''); 
                
                const timeMatch = cleanMsg.match(REGEX_STORY_TIME);
                if (timeMatch && timeMatch[1]) latestNarrativeTime = timeMatch[1].trim();

                const matches = [...cleanMsg.matchAll(REGEX_XML_MSG)];
                matches.forEach(match => {
                    currentXmlMsgCount++;

                    let sender = match[1].trim();
                    let receiver = match[2].trim();
                    const content = match[3].trim();
                    const msgTimeStr = match[4].trim();

                    if (msgTimeStr && !latestNarrativeTime) latestNarrativeTime = msgTimeStr;

                    // 最终确定的显示时间字符串
                    const finalTimeStr = msgTimeStr || latestNarrativeTime || getSystemTimeStr();
                    // 【新增】解析为对象，用于后续计算
                    const parsedDate = parseTimeStr(finalTimeStr);
                    // 提取日期部分 "10月23日" 用于判断跨天
                    const datePartMatch = finalTimeStr.match(/(\d+月\d+日)/);
                    const dateStr = datePartMatch ? datePartMatch[1] : '';

                    let isMyMessage = false;
                    let contactName = '';

                    if (isUserSender(sender, context)) {
                        contactName = receiver; 
                        isMyMessage = true;
                    } else {
                        contactName = sender;
                        isMyMessage = false;
                    }

                    lastParsedSmsWasMine = isMyMessage;
                    
                    if (isUserSender(contactName, context)) return;

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

                    // ============================================================
                    // 【修复】防复读去重逻辑 (Anti-Parrot Logic)
                    // ============================================================
                    // 获取该联系人历史记录里的最后一条消息
                    const lastMsgInHistory = contact.messages[contact.messages.length - 1];
                    
                    // 判断条件：
                    // 1. 当前准备入库的消息是用户发的 (isMyMessage)
                    // 2. 且 历史记录里确实有上一条消息
                    // 3. 且 上一条消息也是用户发的
                    // 4. 且 内容完全一致
                    if (isMyMessage && lastMsgInHistory && lastMsgInHistory.sender === 'user' && lastMsgInHistory.text === content) {
                        // 满足以上所有条件，判定为 AI 复读，直接跳过，不添加到列表里
                        return; 
                    }
                    // ============================================================

                    contact.messages.push({
                        sender: isMyMessage ? 'user' : 'char',
                        text: content,
                        isPending: false,
                        // 【新增】存储时间元数据
                        timeStr: finalTimeStr,
                        timestamp: parsedDate.getTime(),
                        dateStr: dateStr
                    });
                    
                    contact.lastMsg = content;
                    contact.time = finalTimeStr;
                });
            });

            cachedContactsMap = newContactsMap;
            displayContactsMap = newContactsMap;

            if (latestNarrativeTime) window.ST_PHONE.state.virtualTime = latestNarrativeTime;

            // C. 通知判定
            if (lastXmlMsgCount === -1) {
                lastXmlMsgCount = currentXmlMsgCount;
            } else {
                if (currentXmlMsgCount > lastXmlMsgCount) {
                    if (!lastParsedSmsWasMine && !window.ST_PHONE.state.isPhoneOpen) {
                        if (window.ST_PHONE.ui.setNotification) window.ST_PHONE.ui.setNotification(true);
                        if (window.ST_PHONE.ui.playNotificationSound) window.ST_PHONE.ui.playNotificationSound();
                    }
                }
                lastXmlMsgCount = currentXmlMsgCount;
            }

        } else {
            // 缓存命中
            displayContactsMap = new Map(cachedContactsMap);
        }

        // --- 4. Pending 消息渲染 ---
        const queue = window.ST_PHONE.state.pendingQueue;
        const now = Date.now();
        const MAX_PENDING_TIME = 600000; // 10分钟

        if (queue.length > 0) {
            let modifiedContactIds = new Set();
            const activeQueue = queue.filter(pMsg => (now - pMsg.sendTime < MAX_PENDING_TIME));
            window.ST_PHONE.state.pendingQueue = activeQueue; 

            activeQueue.forEach(pMsg => {
                let contact = displayContactsMap.get(pMsg.target);
                if (!contact) {
                    contact = {
                        id: pMsg.target,
                        name: pMsg.target,
                        lastMsg: '',
                        time: window.ST_PHONE.state.virtualTime,
                        messages: []
                    };
                    displayContactsMap.set(pMsg.target, contact);
                    modifiedContactIds.add(pMsg.target);
                } else {
                    if (!modifiedContactIds.has(pMsg.target)) {
                        contact = { ...contact, messages: [...contact.messages] };
                        displayContactsMap.set(pMsg.target, contact);
                        modifiedContactIds.add(pMsg.target);
                    }
                }
                
                // 【新增】Pending 消息的时间处理
                // 因为是刚发的，直接用当前时间
                const pendingTimeStr = window.ST_PHONE.state.virtualTime;
                const pendingDate = parseTimeStr(pendingTimeStr); // 也要解析，为了保持格式一致
                const datePartMatch = pendingTimeStr.match(/(\d+月\d+日)/);

                contact.messages.push({
                    sender: 'user',
                    text: pMsg.text,
                    isPending: true,
                    // 补全元数据
                    timeStr: pendingTimeStr,
                    timestamp: pendingDate.getTime(), 
                    dateStr: datePartMatch ? datePartMatch[1] : ''
                });
                contact.lastMsg = pMsg.text;
            });
        }

        if (window.ST_PHONE.ui.updateStatusBarTime) {
            window.ST_PHONE.ui.updateStatusBarTime(window.ST_PHONE.state.virtualTime);
        }

        window.ST_PHONE.state.contacts = Array.from(displayContactsMap.values());
        
        if (window.ST_PHONE.ui.renderContacts) {
            const searchInput = document.getElementById('phone-search-bar');
            if (!searchInput || !searchInput.value) {
                window.ST_PHONE.ui.renderContacts();
            }
            if (window.ST_PHONE.state.activeContactId) {
                const currentContact = window.ST_PHONE.state.contacts.find(c => c.id === window.ST_PHONE.state.activeContactId);
                if (currentContact) window.ST_PHONE.ui.renderChat(currentContact, false);
            }
        }
    }

    // --- 发送逻辑 ---
    function sendDraftToInput() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        const activeId = window.ST_PHONE.state.activeContactId;
        if (!text || !activeId) return;

        let contact = window.ST_PHONE.state.contacts.find(c => c.id === activeId);
        const targetName = contact ? contact.name : activeId;
        const timeToSend = window.ST_PHONE.state.virtualTime;

        const xmlString = `<msg>{{user}}|${targetName}|${text}|${timeToSend}</msg>`;
        const mainTextArea = document.querySelector('#send_textarea');
        
        if (mainTextArea) {
            const originalText = mainTextArea.value;
            // 确保如果有旧内容，先换行；注入xml后，再自动加一个换行(\n)方便下一条
            const prefix = originalText.length > 0 ? '\n' : '';
            
            // 【关键修改】末尾加上 '\n'
            mainTextArea.value = originalText + prefix + xmlString + '\n'; 
            
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            window.ST_PHONE.state.pendingQueue.push({
                text: text,
                target: targetName,
                sendTime: Date.now()
            });
            window.ST_PHONE.state.lastUserSendTime = Date.now();
            setTimeout(scanChatHistory, 50);

            input.value = '';
            mainTextArea.focus();
        } else {
            alert('❌ 找不到酒馆主输入框 (#send_textarea)');
        }
    }

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
            scanChatHistory();
        }, 2000);
        if (typeof jQuery !== 'undefined') {
            jQuery(document).on('generation_ended', () => {
                setTimeout(scanChatHistory, 500); 
            });
        }
    }
    setTimeout(() => {
        initAutomation();
        scanChatHistory();
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (v2.3 Timestamp Support)');
    }, 1000);

})();
