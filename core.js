// ==================================================================================
// 模块: Core (核心逻辑)
// ==================================================================================
(function() {
    
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
                    text: content
                });
                
                contact.lastMsg = content;
                contact.time = timeStr || getCurrentTimeStr();
            });
        });

        // 更新全局 State
        window.ST_PHONE.state.contacts = Array.from(newContactsMap.values());
        
        // 调用 View 更新 UI
        if (window.ST_PHONE.ui.renderContacts) {
            window.ST_PHONE.ui.renderContacts();
            
            // 如果当前正在聊天中，也要刷新聊天详情
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

        const contact = window.ST_PHONE.state.contacts.find(c => c.id === activeId);
        const targetName = contact ? contact.name : activeId;

        const xmlString = `<msg>{{user}}|${targetName}|${text}|${getCurrentTimeStr()}</msg>`;

        const mainTextArea = document.querySelector('#send_textarea');
        
        if (mainTextArea) {
            const originalText = mainTextArea.value;
            const separator = originalText.length > 0 ? '\n' : '';
            mainTextArea.value = originalText + separator + xmlString;
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            input.value = '';
            mainTextArea.focus();
        } else {
            alert('❌ 找不到酒馆主输入框 (#send_textarea)');
        }
    }

    // --- 事件绑定 ---
    // 监听 View 发出的“打开手机”事件
    document.addEventListener('st-phone-opened', () => {
        scanChatHistory();
    });

    // 刷新按钮 (保留了原来的旋转动画逻辑，虽然写在这里有点丑，但为了不改 View 代码就先这样)
    const reloadBtn = document.getElementById('btn-reload-data');
    if(reloadBtn) {
        reloadBtn.onclick = () => { 
            scanChatHistory(); 
            reloadBtn.style.transform = 'rotate(360deg)'; 
            setTimeout(()=> reloadBtn.style.transform = 'none', 500); 
        };
    }

    // 发送按钮
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

    // 启动
    setTimeout(() => {
        initAutomation();
        scanChatHistory();
        console.log('✅ ST-iOS-Phone: 逻辑核心已挂载');
    }, 1000);

})();
