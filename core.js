// ==================================================================================
// 模块: Core (核心逻辑 - v2.5 Fix & Multi-Unread)
// ==================================================================================
(function() {
    
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
    // 未读消息ID集合
    window.ST_PHONE.state.unreadIds = window.ST_PHONE.state.unreadIds || new Set();

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

        // 指纹检测
        const lastMsg = chat[chat.length - 1];
        const lastMsgHash = lastMsg.mes ? lastMsg.mes.slice(-50) : ''; 
        const currentFingerprint = `${chat.length}|${lastMsgHash}|${context.name1}`; 

        let displayContactsMap = new Map(); 
        let latestNarrativeTime = null; 
        let currentXmlMsgCount = 0;
        let lastParsedSmsWasMine = false;
        
        // 增量/全量解析
        if (currentFingerprint !== lastChatFingerprint) {
            const isFingerprintChanged = true;
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

            // B. 全量解析 & 新消息未读判定
            let newContactsMap = new Map();
            let newUnreadCandidates = new Set(); // 本次扫描发现的潜在未读发送者

            // 标记是否检测到新消息部分
            // 我们利用之前的 cachedContactsMap 来做增量比对有点麻烦
            // 简单点：记录所有解析到的消息，如果在 cachedContactsMap 里对应联系人的消息数量变多了，说明有新消息。

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
                            id: contactName,
                            name: contactName,
                            lastMsg: '',
                            time: '', 
                            messages: [],
                            lastTimestamp: 0
                        });
                    }
                    const contact = newContactsMap.get(contactName);

                    // 防复读
                    const lastMsgInHistory = contact.messages[contact.messages.length - 1];
                    if (isMyMessage && lastMsgInHistory && lastMsgInHistory.sender === 'user' && lastMsgInHistory.text === content) {
                        return; 
                    }

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

            // --- 未读消息检测逻辑 (修复版) ---
            // 遍历构建好的新 map
            newContactsMap.forEach((contact, id) => {
                const oldContact = cachedContactsMap.get(id);
                // 判定标准：消息变多了，或者内容变了 (简单粗暴用消息总数判断)
                const isCountIncreased = !oldContact || contact.messages.length > oldContact.messages.length;
                
                if (isCountIncreased) {
                    // 获取新增的那几条消息
                    const oldLen = oldContact ? oldContact.messages.length : 0;
                    const newMsgs = contact.messages.slice(oldLen);
                    
                    // 只要新增消息里有一条是 char 发的，就标记未读
                    const hasNewCharMsg = newMsgs.some(m => m.sender === 'char');
                    if (hasNewCharMsg) {
                        // 如果当前正好开着这个窗口，就不标记
                        if (window.ST_PHONE.state.activeContactId !== id) {
                            window.ST_PHONE.state.unreadIds.add(id);
                        }
                    }
                }
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
        const MAX_PENDING_TIME = 600000; 

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
                        messages: [],
                        lastTimestamp: Date.now() 
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
                
                // 我发消息了，这个人的未读状态应该清除
                window.ST_PHONE.state.unreadIds.delete(pMsg.target);
            });
        }

        if (window.ST_PHONE.ui.updateStatusBarTime) {
            window.ST_PHONE.ui.updateStatusBarTime(window.ST_PHONE.state.virtualTime);
        }

        // --- 排序与未读 ---
        let contactList = Array.from(displayContactsMap.values());
        
        contactList.forEach(c => {
            c.hasUnread = window.ST_PHONE.state.unreadIds.has(c.id);
        });

        // 按时间倒序
        contactList.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

        window.ST_PHONE.state.contacts = contactList;
        
        if (window.ST_PHONE.ui.renderContacts) {
            const searchInput = document.getElementById('phone-search-bar');
            if (!searchInput || !searchInput.value) {
                window.ST_PHONE.ui.renderContacts();
            }
            if (window.ST_PHONE.state.activeContactId) {
                const currentContact = window.ST_PHONE.state.contacts.find(c => c.id === window.ST_PHONE.state.activeContactId);
                // 实时清除未读
                if (window.ST_PHONE.state.unreadIds.has(window.ST_PHONE.state.activeContactId)) {
                    window.ST_PHONE.state.unreadIds.delete(window.ST_PHONE.state.activeContactId);
                    if (currentContact) currentContact.hasUnread = false; 
                }
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
            const prefix = originalText.length > 0 ? '\n' : '';
            
            // 【关键修改】恢复了末尾的 '\n'，因为 view.js 已经阻止了冒泡，这里不会导致误发
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
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (v2.5 Fix & Multi-Unread)');
    }, 1000);

})();
