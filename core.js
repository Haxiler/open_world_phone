// ==================================================================================
// 模块: Core (核心逻辑 - v1.9 Stable Fix)
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

    window.ST_PHONE.state.lastUserSendTime = 0;
    window.ST_PHONE.state.pendingMsgText = null;
    window.ST_PHONE.state.pendingMsgTarget = null;
    window.ST_PHONE.state.virtualTime = getSystemTimeStr(); 

    // 缓存系统
    let lastChatFingerprint = ''; 
    let cachedContactsMap = new Map(); 
    let lastChatLength = 0; // 【新增】用于检测新消息数量

    const REGEX_XML_MSG = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/gi;
    const REGEX_STORY_TIME = /(?:<|&lt;)time(?:>|&gt;)(.*?)(?:<|&lt;)\/time(?:>|&gt;)/i;

    function scanChatHistory() {
        if (typeof SillyTavern === 'undefined') return;
        
        const context = SillyTavern.getContext();
        const chat = context.chat; 
        if (!chat || chat.length === 0) return;

        // --- 1. 指纹检测 (性能优化) ---
        const lastMsg = chat[chat.length - 1];
        const lastMsgHash = lastMsg.mes ? lastMsg.mes.slice(-50) : ''; 
        const currentFingerprint = `${chat.length}|${lastMsgHash}|${context.name1}`; 

        let displayContactsMap = new Map(); // 本次循环用于显示的 Map
        let latestNarrativeTime = null; 
        let needFullScan = false;

        // 如果指纹变了，说明有新内容/修改，需要全量扫描
        if (currentFingerprint !== lastChatFingerprint) {
            needFullScan = true;
            lastChatFingerprint = currentFingerprint;
            
            // --- 2. 新消息通知检测 (基于长度变化) ---
            // 只有当消息变多了，且不是第一次加载时，才检测
            if (lastChatLength > 0 && chat.length > lastChatLength) {
                const isLastMsgUser = lastMsg.is_user || lastMsg.name === context.name1; // 简单的酒馆原生字段判断
                // 为了保险，再用我们的正则判断一次最后一条消息
                let isLastRealUser = false;
                const matches = [...(lastMsg.mes || '').matchAll(REGEX_XML_MSG)];
                if (matches.length > 0) {
                    const lastMatch = matches[matches.length - 1];
                    const sender = lastMatch[1].trim();
                    const myNames = ['{{user}}', '你', 'user', 'me', context.name1];
                    isLastRealUser = myNames.some(n => n && sender.toLowerCase().includes(n.toLowerCase()));
                }

                // 如果最后一条不是我发的 -> 触发通知
                if (!isLastRealUser && !window.ST_PHONE.state.isPhoneOpen) {
                     if (window.ST_PHONE.ui.setNotification) window.ST_PHONE.ui.setNotification(true);
                     if (window.ST_PHONE.ui.playNotificationSound) window.ST_PHONE.ui.playNotificationSound();
                }
            }
            lastChatLength = chat.length;

            // --- 3. 全量扫描逻辑 ---
            const currentUserPersona = context.name1 ? context.name1.trim() : null;
            let newContactsMap = new Map();

            chat.forEach(msg => {
                if (!msg.mes) return;
                const cleanMsg = msg.mes.replace(/```/g, ''); 
                
                const timeMatch = cleanMsg.match(REGEX_STORY_TIME);
                if (timeMatch && timeMatch[1]) latestNarrativeTime = timeMatch[1].trim();

                const matches = [...cleanMsg.matchAll(REGEX_XML_MSG)];
                matches.forEach(match => {
                    let sender = match[1].trim();
                    let receiver = match[2].trim();
                    const content = match[3].trim();
                    const msgTimeStr = match[4].trim();

                    if (msgTimeStr && !latestNarrativeTime) latestNarrativeTime = msgTimeStr;

                    let contactName = '';
                    let isMyMessage = false;

                    const myNames = ['{{user}}', '你', 'user', 'me', 'myself'];
                    if (currentUserPersona) {
                        myNames.push(currentUserPersona.toLowerCase());
                        myNames.push(currentUserPersona);
                    }

                    const isSenderUser = myNames.some(n => sender.toLowerCase() === n.toLowerCase()) || 
                                         (currentUserPersona && sender.includes(currentUserPersona));

                    if (isSenderUser) {
                        contactName = receiver; 
                        isMyMessage = true;
                    } else {
                        contactName = sender;
                        isMyMessage = false;
                    }
                    
                    if (myNames.some(n => contactName.toLowerCase() === n.toLowerCase())) return;

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
                    contact.time = msgTimeStr || latestNarrativeTime || getSystemTimeStr();
                });
            });

            // 更新缓存
            cachedContactsMap = newContactsMap;
            // 本次显示使用新生成的 map
            displayContactsMap = newContactsMap;

            if (latestNarrativeTime) window.ST_PHONE.state.virtualTime = latestNarrativeTime;

        } else {
            // === 缓存命中 ===
            // 【关键修复】这里不能直接用引用，必须创建一个浅拷贝
            // 否则后续添加 Pending 消息时会修改到 cachedContactsMap，导致无限重复
            displayContactsMap = new Map(cachedContactsMap);
        }

        // --- 4. Pending 消息处理 (防污染版) ---
        const pendingText = window.ST_PHONE.state.pendingMsgText;
        const pendingTarget = window.ST_PHONE.state.pendingMsgTarget;
        const now = Date.now();

        if (pendingText) {
            // 如果目标不存在，先创建一个空的
            if (!displayContactsMap.has(pendingTarget)) {
                 displayContactsMap.set(pendingTarget, {
                        id: pendingTarget,
                        name: pendingTarget,
                        lastMsg: '',
                        time: window.ST_PHONE.state.virtualTime,
                        messages: []
                 });
            }
            
            // 获取联系人对象（此时可能是缓存里的引用）
            const contact = displayContactsMap.get(pendingTarget);
            
            // 检查同步状态 (只有全量扫描时才检查，省性能)
            let isSynced = false;
            if (needFullScan) {
                const recentRealMsgs = contact.messages.slice(-5);
                isSynced = recentRealMsgs.some(m => m.text === pendingText && m.sender === 'user');
            }

            if (isSynced) {
                // 已同步，清除 pending 状态
                window.ST_PHONE.state.pendingMsgText = null;
                window.ST_PHONE.state.pendingMsgTarget = null;
            } else {
                // 未同步，显示虚影
                if (now - window.ST_PHONE.state.lastUserSendTime < 60000) {
                    // 【关键修复】深拷贝 contact 和 messages 数组
                    // 这样我们修改 displayContact 时，绝对不会影响到 cachedContactsMap
                    const displayContact = { 
                        ...contact,
                        messages: [...contact.messages] 
                    };
                    
                    displayContact.messages.push({
                        sender: 'user',
                        text: pendingText,
                        isPending: true 
                    });
                    displayContact.lastMsg = pendingText;
                    
                    // 将这个临时的克隆对象放入 displayMap
                    displayContactsMap.set(pendingTarget, displayContact);
                    
                } else {
                    window.ST_PHONE.state.pendingMsgText = null;
                }
            }
        }

        // 更新 UI
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
                if (currentContact) window.ST_PHONE.ui.renderChat(currentContact);
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
            const separator = originalText.length > 0 ? '\n' : '';
            mainTextArea.value = originalText + separator + xmlString;
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            window.ST_PHONE.state.lastUserSendTime = Date.now();
            window.ST_PHONE.state.pendingMsgText = text;
            window.ST_PHONE.state.pendingMsgTarget = targetName;
            
            // 立即刷新一次 UI
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
            // 即使关着手机也要检测，为了通知
            scanChatHistory();
        }, 2000);
        
        // 监听生成结束事件，确保通知更及时
        if (typeof jQuery !== 'undefined') {
            jQuery(document).on('generation_ended', () => {
                setTimeout(scanChatHistory, 500); 
            });
        }
    }
    setTimeout(() => {
        initAutomation();
        scanChatHistory();
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (v1.9 Stable Fix)');
    }, 1000);

})();
