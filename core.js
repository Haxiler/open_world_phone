// ==================================================================================
// 模块: Core (核心逻辑 - v3.6 MutationObserver)
// ==================================================================================
(function() {
    // 1. 稳健启动：等待 #chat 容器出现
    const waitForST = setInterval(() => {
        const hasST = typeof SillyTavern !== 'undefined' && SillyTavern.getContext;
        const hasChat = document.getElementById('chat');
        
        if (hasST && hasChat) {
            clearInterval(waitForST);
            console.log('📱 ST-iOS-Phone: 核心已挂载 (Observer Mode)');
            initCore();
        }
    }, 200);

    function getSystemTimeStr() {
        const now = new Date();
        const M = now.getMonth() + 1;
        const D = now.getDate();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        return `${M}月${D}日 ${h}:${m}`;
    }

    function parseTimeStr(str) {
        if (!str) return new Date();
        const now = new Date();
        let year = now.getFullYear();
        const fullMatch = str.match(/(\d+)月(\d+)日\s*(\d+)[:：](\d+)/);
        if (fullMatch) {
            return new Date(year, parseInt(fullMatch[1]) - 1, parseInt(fullMatch[2]), parseInt(fullMatch[3]), parseInt(fullMatch[4]));
        }
        const timeMatch = str.match(/(\d+)[:：](\d+)/);
        if (timeMatch) {
            return new Date(year, now.getMonth(), now.getDate(), parseInt(timeMatch[1]), parseInt(timeMatch[2]));
        }
        return now;
    }

    window.ST_PHONE.state.lastUserSendTime = 0;
    window.ST_PHONE.state.pendingQueue = []; 
    window.ST_PHONE.state.virtualTime = getSystemTimeStr(); 
    window.ST_PHONE.state.unreadIds = window.ST_PHONE.state.unreadIds || new Set();

    let cachedContactsMap = new Map(); 
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
        
        try {
            const context = SillyTavern.getContext();
            const chat = context.chat; 
            if (!chat || !Array.isArray(chat)) return;

            let latestNarrativeTime = null; 
            let currentXmlMsgCount = 0;
            let lastParsedSmsWasMine = false;
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

                    const finalTimeStr = msgTimeStr || latestNarrativeTime || getSystemTimeStr();
                    const parsedDate = parseTimeStr(finalTimeStr);
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
                            id: contactName, name: contactName, lastMsg: '', time: '', messages: [], lastTimestamp: 0
                        });
                    }
                    const contact = newContactsMap.get(contactName);

                    const lastMsgInHistory = contact.messages[contact.messages.length - 1];
                    if (isMyMessage && lastMsgInHistory && lastMsgInHistory.sender === 'user' && lastMsgInHistory.text === content) return; 

                    contact.messages.push({
                        sender: isMyMessage ? 'user' : 'char',
                        text: content,
                        isPending: false, 
                        timeStr: finalTimeStr,
                        timestamp: parsedDate.getTime(),
                        dateStr: dateStr
                    });
                    contact.lastMsg = content;
                    contact.time = finalTimeStr;
                    contact.lastTimestamp = parsedDate.getTime();
                });
            });

            // 更新未读
            newContactsMap.forEach((contact, id) => {
                const oldContact = cachedContactsMap.get(id);
                const isCountIncreased = !oldContact || contact.messages.length > oldContact.messages.length;
                if (isCountIncreased) {
                    const lastMsg = contact.messages[contact.messages.length - 1];
                    if (lastMsg && lastMsg.sender !== 'user' && window.ST_PHONE.state.activeContactId !== id) {
                        window.ST_PHONE.state.unreadIds.add(id);
                    }
                }
            });

            cachedContactsMap = newContactsMap;
            if (latestNarrativeTime) window.ST_PHONE.state.virtualTime = latestNarrativeTime;

            // 变化检测
            if (lastXmlMsgCount === -1) {
                lastXmlMsgCount = currentXmlMsgCount;
            } else {
                if (currentXmlMsgCount > lastXmlMsgCount) {
                    window.ST_PHONE.state.pendingQueue = [];
                    if (!lastParsedSmsWasMine && !window.ST_PHONE.state.isPhoneOpen) {
                        if (window.ST_PHONE.ui.setNotification) window.ST_PHONE.ui.setNotification(true);
                        if (window.ST_PHONE.ui.playNotificationSound) window.ST_PHONE.ui.playNotificationSound();
                    }
                }
                lastXmlMsgCount = currentXmlMsgCount;
            }

            // Pending 处理
            const queue = window.ST_PHONE.state.pendingQueue;
            const now = Date.now();
            const MAX_PENDING_TIME = 600000; 

            if (queue.length > 0) {
                const activeQueue = queue.filter(pMsg => (now - pMsg.sendTime < MAX_PENDING_TIME));
                window.ST_PHONE.state.pendingQueue = activeQueue; 
                
                activeQueue.forEach(pMsg => {
                    let contact = newContactsMap.get(pMsg.target);
                    if (!contact) {
                        contact = {
                            id: pMsg.target, name: pMsg.target, lastMsg: '', time: window.ST_PHONE.state.virtualTime, messages: [], lastTimestamp: Date.now() 
                        };
                        newContactsMap.set(pMsg.target, contact);
                    }
                    const pendingTimeStr = window.ST_PHONE.state.virtualTime;
                    const pendingDate = parseTimeStr(pendingTimeStr);
                    const datePartMatch = pendingTimeStr.match(/(\d+月\d+日)/);
                    
                    contact.messages.push({
                        sender: 'user', 
                        text: pMsg.text, 
                        isPending: true, 
                        timeStr: pendingTimeStr, 
                        timestamp: pendingDate.getTime(), 
                        dateStr: datePartMatch ? datePartMatch[1] : ''
                    });
                    contact.lastMsg = pMsg.text;
                    contact.lastTimestamp = pendingDate.getTime();
                    window.ST_PHONE.state.unreadIds.delete(pMsg.target);
                });
            }

            let contactList = Array.from(newContactsMap.values());
            contactList.forEach(c => c.hasUnread = window.ST_PHONE.state.unreadIds.has(c.id));
            contactList.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
            window.ST_PHONE.state.contacts = contactList;

            if (window.ST_PHONE.ui.updateStatusBarTime) window.ST_PHONE.ui.updateStatusBarTime(window.ST_PHONE.state.virtualTime);

            // 触发存档
            if (window.ST_PHONE.scribe && typeof window.ST_PHONE.scribe.sync === 'function') {
                try { window.ST_PHONE.scribe.sync(window.ST_PHONE.state.contacts); } catch(e) {}
            }
            
            if (window.ST_PHONE.ui.renderContacts) {
                const searchInput = document.getElementById('phone-search-bar');
                if (!searchInput || !searchInput.value) window.ST_PHONE.ui.renderContacts();
                
                if (window.ST_PHONE.state.activeContactId) {
                    const currentContact = window.ST_PHONE.state.contacts.find(c => c.id === window.ST_PHONE.state.activeContactId);
                    if (window.ST_PHONE.state.unreadIds.has(window.ST_PHONE.state.activeContactId)) {
                        window.ST_PHONE.state.unreadIds.delete(window.ST_PHONE.state.activeContactId);
                        if (currentContact) currentContact.hasUnread = false; 
                    }
                    if (currentContact) window.ST_PHONE.ui.renderChat(currentContact, false);
                }
            }
        } catch(err) {
            console.error('ST-Phone: Scan Error', err);
        }
    }

    async function sendDraftToInput() {
        const input = document.getElementById('msg-input'); 
        const text = input.value.trim();
        const activeId = window.ST_PHONE.state.activeContactId;
        
        if (!text || !activeId) return;

        let contact = window.ST_PHONE.state.contacts.find(c => c.id === activeId);
        const targetName = contact ? contact.name : activeId;
        const timeToSend = window.ST_PHONE.state.virtualTime;
        const xmlString = `<msg>{{user}}|${targetName}|${text}|${timeToSend}</msg>`;

        try {
            const mainTextArea = document.getElementById('send_textarea');
            if (mainTextArea) {
                const currentContent = mainTextArea.value;
                const prefix = currentContent ? '\n' : '';
                mainTextArea.value = currentContent + prefix + xmlString + '\n';
                mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
                mainTextArea.focus();
                mainTextArea.scrollTop = mainTextArea.scrollHeight; 

                window.ST_PHONE.state.pendingQueue.push({
                    text: text, target: targetName, sendTime: Date.now()
                });
                window.ST_PHONE.state.lastUserSendTime = Date.now();
                input.value = '';
                scanChatHistory(); 
            }
        } catch (e) {
            console.error('ST Phone Send Error:', e);
        }
    }

    function initCore() {
        const sendBtn = document.getElementById('btn-send');
        if(sendBtn) sendBtn.onclick = sendDraftToInput;

        scanChatHistory();

        // 【天眼系统】 MutationObserver
        // 监控聊天框的变化，自动触发扫描，替代 EventSource
        const chatContainer = document.getElementById('chat');
        if (chatContainer) {
            const observer = new MutationObserver(debounce(() => {
                scanChatHistory();
            }, 200));
            
            observer.observe(chatContainer, { 
                childList: true, 
                subtree: true,   
                characterData: true 
            });
        } else {
            // 保底轮询
            setInterval(scanChatHistory, 2000);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
})();
