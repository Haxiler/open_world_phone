// ==================================================================================
// 模块: Core (核心逻辑 - v1.6 Performance Optimized)
// ==================================================================================
(function() {
    
    // --- 辅助函数：获取系统时间 ---
    function getSystemTimeStr() {
        const now = new Date();
        const M = now.getMonth() + 1;
        const D = now.getDate();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        return `${M}月${D}日 ${h}:${m}`;
    }

    // 状态管理初始化
    window.ST_PHONE.state.lastUserSendTime = 0;
    window.ST_PHONE.state.pendingMsgText = null;
    window.ST_PHONE.state.pendingMsgTarget = null;
    window.ST_PHONE.state.virtualTime = getSystemTimeStr(); 

    // --- 【新增】缓存系统 ---
    let lastChatFingerprint = ''; // 记录上一次的聊天指纹
    let cachedContactsMap = new Map(); // 缓存上一次的解析结果

    // --- 正则定义 ---
    const REGEX_XML_MSG = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/gi;
    const REGEX_STORY_TIME = /(?:<|&lt;)time(?:>|&gt;)(.*?)(?:<|&lt;)\/time(?:>|&gt;)/i;

    function scanChatHistory() {
        if (typeof SillyTavern === 'undefined') return;
        
        // 1. 获取酒馆上下文
        const context = SillyTavern.getContext();
        const chat = context.chat; 
        if (!chat || chat.length === 0) return;

        // 2. 【新增】性能优化：计算指纹 (脏检查)
        // 指纹由“聊天记录总长度”和“最后一条消息内容的摘要”组成
        // 只要这两者没变，我们就认为无需重新扫描
        const lastMsg = chat[chat.length - 1];
        // 取最后50个字符做摘要即可，避免长文本性能消耗
        const lastMsgHash = lastMsg.mes ? lastMsg.mes.slice(-50) : ''; 
        const currentFingerprint = `${chat.length}|${lastMsgHash}|${context.name1}`; // 把用户名也加入指纹，防止切角色时不刷新

        let newContactsMap = new Map();
        let latestNarrativeTime = null; 
        let needFullScan = false;

        if (currentFingerprint !== lastChatFingerprint) {
            // === 指纹变了，执行全量扫描 (重逻辑) ===
            // console.log('📱 ST-Phone: 检测到变动，执行全量扫描...'); 
            needFullScan = true;
            lastChatFingerprint = currentFingerprint;

            // 动态获取当前用户名字
            const currentUserPersona = context.name1 ? context.name1.trim() : null;
            
            chat.forEach(msg => {
                if (!msg.mes) return;
                const cleanMsg = msg.mes.replace(/```/g, ''); 

                // A. 抓取剧情时间
                const timeMatch = cleanMsg.match(REGEX_STORY_TIME);
                if (timeMatch && timeMatch[1]) {
                    latestNarrativeTime = timeMatch[1].trim();
                }

                // B. 抓取短信
                const matches = [...cleanMsg.matchAll(REGEX_XML_MSG)];
                matches.forEach(match => {
                    let sender = match[1].trim();
                    let receiver = match[2].trim();
                    const content = match[3].trim();
                    const msgTimeStr = match[4].trim();

                    if (msgTimeStr && !latestNarrativeTime) {
                        latestNarrativeTime = msgTimeStr;
                    }

                    let contactName = '';
                    let isMyMessage = false;

                    // 身份判定逻辑
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

            // 如果这次扫描到了时间，更新全局时间
            if (latestNarrativeTime) {
                window.ST_PHONE.state.virtualTime = latestNarrativeTime;
            }

        } else {
            // === 指纹没变，使用缓存 (轻逻辑) ===
            // 直接复用上一次计算好的 map
            newContactsMap = cachedContactsMap;
        }

        // --- 无论是否全量扫描，以下 UI 逻辑都要运行 (特别是 Pending 消息的处理) ---

        // 刷新时间 UI
        if (window.ST_PHONE.ui.updateStatusBarTime) {
            window.ST_PHONE.ui.updateStatusBarTime(window.ST_PHONE.state.virtualTime);
        }

        // 保活逻辑 (Pending Msg)
        // 即使不扫描历史，也要检查 pending 消息是否超时，或者是否需要继续显示
        const pendingText = window.ST_PHONE.state.pendingMsgText;
        const pendingTarget = window.ST_PHONE.state.pendingMsgTarget;
        const now = Date.now();

        if (pendingText) {
            // 确保 target 在 map 里存在 (如果是新联系人，缓存里可能没有，需要临时补上)
            if (!newContactsMap.has(pendingTarget)) {
                 // 注意：这里我们得深拷贝一份缓存，不能直接改 cachedContactsMap，
                 // 否则下一次脏检查复用缓存时，会包含错误的 pending 状态
                 // 但为了性能，这里简化处理：Pending 状态通常是临时的
                 // 我们只修改当前这一轮的引用对象
                 newContactsMap.set(pendingTarget, {
                        id: pendingTarget,
                        name: pendingTarget,
                        lastMsg: '',
                        time: window.ST_PHONE.state.virtualTime,
                        messages: []
                 });
            }
            const contact = newContactsMap.get(pendingTarget);
            
            // 只有当执行了全量扫描(needFullScan = true)时，check isSynced 才有意义
            // 如果指纹没变，说明酒馆还没把新消息写进历史，那肯定没 sync
            let isSynced = false;
            if (needFullScan) {
                const recentRealMsgs = contact.messages.slice(-5);
                isSynced = recentRealMsgs.some(m => m.text === pendingText && m.sender === 'user');
            }

            if (isSynced) {
                window.ST_PHONE.state.pendingMsgText = null;
                window.ST_PHONE.state.pendingMsgTarget = null;
            } else {
                if (now - window.ST_PHONE.state.lastUserSendTime < 60000) {
                    // 还没超时，且还没同步 -> 强行插入一条虚影消息到当前展示列表
                    // 注意：不要 push 到 cachedContactsMap 的 messages 数组里，否则会无限增殖
                    // 我们在渲染前，临时构造一个包含 pending 消息的新数组
                    // 但由于 renderChat 是直接读 contact.messages 的，为了简便，
                    // 我们这里还是得 Push，但需要在扫描时因为是重新 new 的 Map，所以不会有脏数据残留
                    
                    // 等等，如果是“使用缓存”模式，cachedContactsMap 是持久的。
                    // 只要不在 cachedContactsMap 上直接 push pending 就行。
                    // 现有的逻辑是：contact.messages.push(...)
                    // 这会修改缓存！
                    
                    // 修正逻辑：Pending 消息由 UI 渲染层处理？或者在这里临时处理？
                    // 为了不改动 View 层，我们在“使用缓存”模式下，必须小心。
                    
                    // 最终方案：如果走了缓存模式，contact 引用的是缓存对象。
                    // 我们需要克隆这个 contact 对象，再往里加 pending msg，避免污染缓存。
                    
                    const cachedContact = newContactsMap.get(pendingTarget);
                    // 浅克隆
                    const displayContact = { ...cachedContact };
                    displayContact.messages = [...cachedContact.messages]; // 数组也要克隆
                    
                    displayContact.messages.push({
                        sender: 'user',
                        text: pendingText,
                        isPending: true 
                    });
                    displayContact.lastMsg = pendingText;
                    
                    // 临时替换 map 中的对象，仅供本次渲染使用，不影响 cachedContactsMap
                    newContactsMap.set(pendingTarget, displayContact);
                    
                } else {
                    window.ST_PHONE.state.pendingMsgText = null;
                }
            }
        }

        // 更新全局 State (供 UI 读取)
        window.ST_PHONE.state.contacts = Array.from(newContactsMap.values());
        
        // 渲染 UI
        // 只有当：1. 发生了全量扫描 OR 2. 有 Pending 消息在变动 时，才需要重绘 UI
        // 为了简单，只要 state.contacts 变了就渲染
        
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
            
            // 为了即时反馈，手动强制刷新一次 UI
            // 注意：这里不用改缓存，scanChatHistory 下一个循环会处理 pending 渲染
            // 但为了点击发送那一刻不卡顿，可以不做任何重操作，交给 2000ms 的轮询？
            // 不，用户体验会延迟。
            // 直接手动触发一次扫描即可，反正指纹没变，会走缓存+pending渲染逻辑，很快。
            setTimeout(scanChatHistory, 50);

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
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (v1.6 Performance Optimized)');
    }, 1000);

})();
