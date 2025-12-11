// ==================================================================================
// 模块: Core (核心逻辑 - v2.4 Sort & Unread & Manual Send)
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

    // 解析时间字符串为 Date 对象
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

    // 初始化状态
    window.ST_PHONE.state.lastUserSendTime = 0;
    window.ST_PHONE.state.pendingQueue = []; 
    window.ST_PHONE.state.virtualTime = getSystemTimeStr(); 
    // 【新增】未读消息ID集合
    window.ST_PHONE.state.unreadIds = window.ST_PHONE.state.unreadIds || new Set();

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

        // 无论指纹是否变化，先进行全量解析的逻辑准备（实际解析在指纹变化时做）
        // 这里为了简化逻辑，沿用原结构
        
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
                            id: contactName,
                            name: contactName,
                            lastMsg: '',
                            time: '', 
                            messages: [],
                            // 初始化时间戳，用于排序
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
                    // 更新联系人最后活跃时间
                    contact.lastTimestamp = parsedDate.getTime();
                });
            });

            // --- 【新增】未读消息检测 ---
            // 遍历新的联系人列表
            newContactsMap.forEach((contact, id) => {
                const oldContact = cachedContactsMap.get(id);
                const lastMsgObj = contact.messages[contact.messages.length - 1];
                
                // 如果是新出现的联系人，或者消息数量增加了，或者最后一条消息变了
                if (!oldContact || contact.messages.length > oldContact.messages.length || contact.lastMsg !== oldContact.lastMsg) {
                    // 只有当最后一条消息是对方发的 (char)，且当前没有打开该聊天窗口
                    if (lastMsgObj && lastMsgObj.sender === 'char') {
                        if (window.ST_PHONE.state.activeContactId !== id) {
                            window.ST_PHONE.state.unreadIds.add(id);
                        }
                    }
                }
                
                // 如果最后一条是我发的，肯定已读，清除未读标记（防止逻辑错误）
                if (lastMsgObj && lastMsgObj.sender === 'user') {
                    window.ST_PHONE.state.unreadIds.delete(id);
                }
            });

            cachedContactsMap = newContactsMap;
            displayContactsMap = newContactsMap;

            if (latestNarrativeTime) window.ST_PHONE.state.virtualTime = latestNarrativeTime;

            // C. 通知判定 (声音通知)
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
                // 只有当该联系人尚未在 Pending 循环中被克隆过，才进行浅拷贝
                // 如果已经存在于 map 中，需要确保我们在修改一个新的引用，不影响 cachedContactsMap
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
                // Pending 消息也是最新消息，更新排序时间
                contact.lastTimestamp = pendingDate.getTime();
                // 我发的消息，清除未读
                window.ST_PHONE.state.unreadIds.delete(pMsg.target);
            });
        }

        if (window.ST_PHONE.ui.updateStatusBarTime) {
            window.ST_PHONE.ui.updateStatusBarTime(window.ST_PHONE.state.virtualTime);
        }

        // --- 【新增】排序与未读标记注入 ---
        let contactList = Array.from(displayContactsMap.values());
        
        // 1. 注入 hasUnread 属性供 View 使用
        contactList.forEach(c => {
            c.hasUnread = window.ST_PHONE.state.unreadIds.has(c.id);
        });

        // 2. 排序：时间倒序
        contactList.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

        window.ST_PHONE.state.contacts = contactList;
        
        if (window.ST_PHONE.ui.renderContacts) {
            const searchInput = document.getElementById('phone-search-bar');
            if (!searchInput || !searchInput.value) {
                window.ST_PHONE.ui.renderContacts();
            }
            if (window.ST_PHONE.state.activeContactId) {
                const currentContact = window.ST_PHONE.state.contacts.find(c => c.id === window.ST_PHONE.state.activeContactId);
                // 已经在看这个联系人了，清除未读
                if (window.ST_PHONE.state.unreadIds.has(window.ST_PHONE.state.activeContactId)) {
                    window.ST_PHONE.state.unreadIds.delete(window.ST_PHONE.state.activeContactId);
                    if (currentContact) currentContact.hasUnread = false; // 实时更新对象状态
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
            
            // 【关键修改】去掉末尾的 '\n'，防止酒馆自动发送
            // 现在的逻辑是：注入文本 -> 用户自己点酒馆的发送
            mainTextArea.value = originalText + prefix + xmlString; 
            
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 依然加入 Pending 队列，让手机界面立刻显示消息气泡（假装已发）
            window.ST_PHONE.state.pendingQueue.push({
                text: text,
                target: targetName,
                sendTime: Date.now()
            });
            window.ST_PHONE.state.lastUserSendTime = Date.now();
            setTimeout(scanChatHistory, 50);

            input.value = '';
            // 不聚焦主输入框，保持在手机上，或者看用户习惯。
            // 如果必须手动发送，最好聚焦主输入框提示用户？
            // 既然是 Draft，还是聚焦主输入框方便用户按回车
            mainTextArea.focus(); 
        } else {
            alert('❌ 找不到酒馆主输入框 (#send_textarea)');
        }
    }

    document.addEventListener('st-phone-opened', () => { scanChatHistory(); });
    const sendBtn = document.getElementById('btn-send');
    if(sendBtn) sendBtn.onclick = sendDraftToInput;
    // 这里保持 view.js 处理 Shift+Enter 逻辑，核心只管怎么发出去
    
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
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (v2.4 Sorted & Unread)');
    }, 1000);

})();
