// ==================================================================================
// 模块: Core (核心逻辑 - 剧情时间同步版)
// ==================================================================================
(function() {
    
    // --- 辅助函数：获取系统时间 (兜底用) ---
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
    // 初始时间先给个系统时间，等扫描到剧情时间会自动覆盖
    window.ST_PHONE.state.virtualTime = getSystemTimeStr(); 

    // --- 正则定义 ---
    // 1. 短信正则 (保持不变)
    const REGEX_XML_MSG = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/gi;
    // 2. 剧情时间正则 (新增：专门抓取 <time>标签)
    // 这里的 (.*?) 会无视冒号是全角还是半角，只要在标签里都抓
    const REGEX_STORY_TIME = /(?:<|&lt;)time(?:>|&gt;)(.*?)(?:<|&lt;)\/time(?:>|&gt;)/i;

    function scanChatHistory() {
        if (typeof SillyTavern === 'undefined') return;
        
        const context = SillyTavern.getContext();
        const chat = context.chat; 
        if (!chat) return;

        const newContactsMap = new Map();
        let latestNarrativeTime = null; // 用于记录最新的剧情时间

        // --- 主扫描循环 ---
        chat.forEach(msg => {
            if (!msg.mes) return;
            const cleanMsg = msg.mes.replace(/```/g, ''); 

            // A. 抓取剧情时间 (独立于短信)
            // 只要这一段里有 <time> 标签，就更新时间
            // 因为是从前往后扫，最后留下的就是最新的
            const timeMatch = cleanMsg.match(REGEX_STORY_TIME);
            if (timeMatch && timeMatch[1]) {
                latestNarrativeTime = timeMatch[1].trim();
            }

            // B. 抓取短信 (构建通讯录)
            const matches = [...cleanMsg.matchAll(REGEX_XML_MSG)];
            matches.forEach(match => {
                const sender = match[1].trim();
                const receiver = match[2].trim();
                const content = match[3].trim();
                const msgTimeStr = match[4].trim();

                // 兼容逻辑：如果短信里自带了时间，也可以作为备选时间源
                // 但如果本条消息同时也扫到了 <time> 标签，上面 A 步骤已经处理了，这里可以不强制覆盖
                if (msgTimeStr && !latestNarrativeTime) {
                    latestNarrativeTime = msgTimeStr;
                }

                let contactName = '';
                let isMyMessage = false;

                // 判断是谁发的
                if (sender.toLowerCase().includes('{{user}}') || sender === '你' || sender.toLowerCase() === 'user') {
                    contactName = receiver;
                    isMyMessage = true;
                } else {
                    contactName = sender;
                    isMyMessage = false;
                }

                // 初始化联系人
                if (!newContactsMap.has(contactName)) {
                    newContactsMap.set(contactName, {
                        id: contactName,
                        name: contactName,
                        lastMsg: '',
                        time: '', // 这个 time 是显示在通讯录列表里的
                        messages: []
                    });
                }
                const contact = newContactsMap.get(contactName);

                contact.messages.push({
                    sender: isMyMessage ? 'user' : 'char',
                    text: content,
                    isPending: false 
                });
                
                // 更新联系人列表预览
                contact.lastMsg = content;
                // 通讯录里每条短信的时间，优先用短信自带的，没有就用当前的剧情时间
                contact.time = msgTimeStr || latestNarrativeTime || getSystemTimeStr();
            });
        });

        // --- 核心改动：同步全局剧情时间 ---
        // 如果扫到了 <time>，就更新全局状态；如果没扫到，就保持原样 (不要回退到系统时间)
        if (latestNarrativeTime) {
            window.ST_PHONE.state.virtualTime = latestNarrativeTime;
        } 
        
        // 立即刷新 UI 顶部状态栏
        if (window.ST_PHONE.ui.updateStatusBarTime) {
            window.ST_PHONE.ui.updateStatusBarTime(window.ST_PHONE.state.virtualTime);
        }

        // --- 保活逻辑 (处理刚发出去还没存入历史的消息) ---
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
            // 检查是否已经同步成功
            const isSynced = recentRealMsgs.some(m => m.text === pendingText && m.sender === 'user');

            if (isSynced) {
                window.ST_PHONE.state.pendingMsgText = null;
                window.ST_PHONE.state.pendingMsgTarget = null;
            } else {
                // 没同步且在60秒内，显示虚影
                if (now - window.ST_PHONE.state.lastUserSendTime < 60000) {
                    contact.messages.push({
                        sender: 'user',
                        text: pendingText,
                        isPending: true 
                    });
                    contact.lastMsg = pendingText; 
                } else {
                    // 超时丢弃
                    window.ST_PHONE.state.pendingMsgText = null;
                }
            }
        }

        // 更新全局 State
        window.ST_PHONE.state.contacts = Array.from(newContactsMap.values());
        
        // 渲染 UI
        if (window.ST_PHONE.ui.renderContacts) {
            const searchInput = document.getElementById('phone-search-bar');
            // 只有当没在搜索时才自动刷新列表，防止打字被打断
            if (!searchInput || !searchInput.value) {
                window.ST_PHONE.ui.renderContacts();
            }
            
            if (window.ST_PHONE.state.activeContactId) {
                const currentContact = window.ST_PHONE.state.contacts.find(c => c.id === window.ST_PHONE.state.activeContactId);
                if (currentContact) window.ST_PHONE.ui.renderChat(currentContact);
            }
        }
    }

    // --- 发送逻辑 (发送时带上当前的剧情时间) ---
    function sendDraftToInput() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        const activeId = window.ST_PHONE.state.activeContactId;
        
        if (!text || !activeId) return;

        let contact = window.ST_PHONE.state.contacts.find(c => c.id === activeId);
        const targetName = contact ? contact.name : activeId;

        // 【关键】发送时，直接使用当前锁定的剧情时间
        const timeToSend = window.ST_PHONE.state.virtualTime;

        // 构造 XML
        const xmlString = `<msg>{{user}}|${targetName}|${text}|${timeToSend}</msg>`;
        const mainTextArea = document.querySelector('#send_textarea');
        
        if (mainTextArea) {
            const originalText = mainTextArea.value;
            const separator = originalText.length > 0 ? '\n' : '';
            mainTextArea.value = originalText + separator + xmlString;
            // 触发酒馆输入框的事件，确保数据绑定更新
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 记录待发送状态
            window.ST_PHONE.state.lastUserSendTime = Date.now();
            window.ST_PHONE.state.pendingMsgText = text;
            window.ST_PHONE.state.pendingMsgTarget = targetName;

            // 乐观更新 UI (立即显示)
            if (contact) {
                contact.messages.push({
                    sender: 'user',
                    text: text,
                    isPending: true
                });
                window.ST_PHONE.ui.renderChat(contact);
            }

            input.value = '';
            // 焦点切回主输入框，方便用户继续输入剧情
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
        // 定时轮询 (2秒一次)
        setInterval(() => {
            if (window.ST_PHONE.state.isPhoneOpen) {
                scanChatHistory();
            }
        }, 2000);

        // 监听酒馆生成结束事件
        if (typeof jQuery !== 'undefined') {
            jQuery(document).on('generation_ended', () => {
                setTimeout(scanChatHistory, 1000); 
            });
        }
    }

    setTimeout(() => {
        initAutomation();
        scanChatHistory();
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载 (剧情时间同步 - Tag版)');
    }, 1000);

})();
