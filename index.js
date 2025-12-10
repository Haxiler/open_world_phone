// ==================================================================================
// 脚本名称: ST-iOS-Phone-Core (Phase 3 Final - XML Protocol & Interaction)
// ==================================================================================

(function () {
    // 1. 防止重复加载
    if (document.getElementById('st-ios-phone-root')) return;

    console.log('📱 ST-iOS-Phone: 最终版启动中...');

    // ==================================================================================
    // HTML 结构
    // ==================================================================================
    const html = `
    <div id="st-ios-phone-root">
        <div id="st-phone-icon" title="打开/关闭手机">
            <svg viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>
        </div>

        <div id="st-phone-window">
            <div class="phone-notch-area" id="phone-drag-handle">
                <div class="phone-notch"></div>
            </div>
            
            <div class="app-container">
                <div class="pages-wrapper">
                    
                    <div class="page active" id="page-contacts">
                        <div class="nav-bar">
                            <span class="nav-title">信息</span>
                            <button class="nav-btn icon" id="btn-reload-data" title="手动刷新">↻</button>
                        </div>
                        <div class="contact-list" id="contact-list-container">
                            </div>
                    </div>

                    <div class="page hidden-right" id="page-chat">
                        <div class="nav-bar">
                            <button class="nav-btn" id="btn-back">❮ 信息</button>
                            <span class="nav-title" id="chat-title">用户</span>
                        </div>
                        <div class="chat-scroll-area" id="chat-messages-container">
                            </div>
                        <div class="input-area">
                            <div class="plus-btn">+</div>
                            <input type="text" class="chat-input" placeholder="iMessage" id="msg-input">
                            <div class="send-btn" id="btn-send">
                                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);

    // ==================================================================================
    // 核心逻辑：数据管理
    // ==================================================================================

    let phoneState = { contacts: [] };
    let activeContactId = null;
    let isPhoneOpen = false;

    // --- 核心正则：XML 解析 ---
    // 捕获组: $1=发送人, $2=接收人, $3=内容, $4=时间
    const REGEX_XML_MSG = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/gi;

    // --- 辅助：获取当前时间 HH:mm ---
    function getCurrentTimeStr() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    // --- 核心：扫描聊天记录 ---
    async function scanChatHistory() {
        if (typeof SillyTavern === 'undefined') return;
        
        const context = SillyTavern.getContext();
        const chat = context.chat; 
        if (!chat) return;

        const newContactsMap = new Map();

        // 遍历聊天记录
        chat.forEach(msg => {
            if (!msg.mes) return;
            
            // 移除可能存在的 Markdown 代码块标记
            const cleanMsg = msg.mes.replace(/```/g, ''); 
            
            // 使用 matchAll 捕获所有标签
            const matches = [...cleanMsg.matchAll(REGEX_XML_MSG)];

            matches.forEach(match => {
                const sender = match[1].trim();   // 发送人
                const receiver = match[2].trim(); // 接收人
                const content = match[3].trim();  // 内容
                const timeStr = match[4].trim();  // 时间

                // --- 归属判定逻辑 ---
                let contactName = '';
                let isMyMessage = false;

                // 如果发送人是 {{user}} 或 "你"，那就是我发给别人的
                if (sender.toLowerCase().includes('{{user}}') || sender === '你' || sender.toLowerCase() === 'user') {
                    contactName = receiver; // 联系人是对方
                    isMyMessage = true;
                } else {
                    // 否则是别人发给我的
                    contactName = sender;
                    isMyMessage = false;
                }

                if (!newContactsMap.has(contactName)) {
                    newContactsMap.set(contactName, {
                        id: contactName, // 简单用名字做ID
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
                
                // 更新最新状态
                contact.lastMsg = content;
                contact.time = timeStr || getCurrentTimeStr();
            });
        });

        // 更新全局数据
        phoneState.contacts = Array.from(newContactsMap.values());
        
        // 刷新 UI
        renderContacts();
        if (activeContactId) {
            const currentContact = phoneState.contacts.find(c => c.id === activeContactId);
            if (currentContact) renderChat(currentContact);
        }
    }

    // --- 核心：发送逻辑 (Draft Mode) ---
    function sendDraftToInput() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        
        if (!text || !activeContactId) return;

        // 1. 获取当前聊天对象的名字
        const contact = phoneState.contacts.find(c => c.id === activeContactId);
        const targetName = contact ? contact.name : activeContactId;

        // 2. 封装 XML 格式
        // 格式: <msg>{{user}}|接收人|内容|时间</msg>
        const xmlString = `<msg>{{user}}|${targetName}|${text}|${getCurrentTimeStr()}</msg>`;

        // 3. 寻找酒馆主输入框并追加内容
        const mainTextArea = document.querySelector('#send_textarea');
        
        if (mainTextArea) {
            const originalText = mainTextArea.value;
            const separator = originalText.length > 0 ? '\n' : '';
            mainTextArea.value = originalText + separator + xmlString;
            mainTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 清空手机输入框并聚焦主输入框
            input.value = '';
            mainTextArea.focus();
        } else {
            alert('❌ 找不到酒馆主输入框 (#send_textarea)');
        }
    }

    // --- 自动化：轮询与监听 ---
    function initAutomation() {
        // 1. 启动心跳轮询 (每2秒)
        setInterval(() => {
            if (isPhoneOpen) {
                scanChatHistory();
            }
        }, 2000);

        // 2. 备用：尝试注册 jQuery 事件
        if (typeof jQuery !== 'undefined') {
            jQuery(document).on('generation_ended', () => {
                setTimeout(scanChatHistory, 1000); 
            });
        }
    }

    // ==================================================================================
    // UI 交互 (含防误触修复)
    // ==================================================================================
    
    // 🚩 全局标记：是否正在拖拽
    let isDragging = false;

    // 拖拽逻辑
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // 按下瞬间，先假设不是拖拽
            isDragging = false; 
            
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // 只要发生了移动，就是拖拽
            isDragging = true;

            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            // 注意：不要在这里重置 isDragging，因为 click 事件紧接着触发
        }
    }
    
    // 初始化拖拽
    makeDraggable(document.getElementById("st-phone-window"), document.getElementById("phone-drag-handle"));
    makeDraggable(document.getElementById("st-phone-icon"), document.getElementById("st-phone-icon"));

    // 显隐切换 + 立即刷新 + 防误触
    const icon = document.getElementById('st-phone-icon');
    const windowEl = document.getElementById('st-phone-window');

    icon.addEventListener('click', () => {
        // 🚩 修复：如果刚刚发生了拖拽，则视为移动操作，直接返回
        if (isDragging) {
            isDragging = false; // 重置状态
            return;
        }

        isPhoneOpen = !isPhoneOpen;
        windowEl.style.display = isPhoneOpen ? 'block' : 'none';
        
        if (isPhoneOpen) {
            scanChatHistory(); // 开屏立即扫描
        }
    });

    // 渲染联系人
    function renderContacts() {
        const container = document.getElementById('contact-list-container');
        container.innerHTML = '';
        if (phoneState.contacts.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:13px;">暂无消息<br>等待正则捕获...</div>';
            return;
        }
        phoneState.contacts.forEach(contact => {
            const el = document.createElement('div');
            el.className = 'contact-item';
            el.innerHTML = `
                <div class="info">
                    <div class="name-row">
                        <span class="name">${contact.name}</span>
                        <span class="time">${contact.time}</span>
                    </div>
                    <div class="preview">${contact.lastMsg}</div>
                </div>
            `;
            el.onclick = () => openChat(contact);
            container.appendChild(el);
        });
    }

    // 渲染聊天
    function renderChat(contact) {
        const container = document.getElementById('chat-messages-container');
        container.innerHTML = '';
        container.appendChild(document.createElement('div')).style.height = '10px';
        contact.messages.forEach(msg => {
            const el = document.createElement('div');
            el.className = `message-bubble ${msg.sender === 'user' ? 'sent' : 'received'}`;
            el.innerText = msg.text;
            container.appendChild(el);
        });
        setTimeout(() => container.scrollTop = container.scrollHeight, 0);
    }

    // 页面导航
    function openChat(contact) {
        activeContactId = contact.id;
        document.getElementById('chat-title').innerText = contact.name;
        renderChat(contact);
        document.getElementById('page-contacts').classList.add('hidden-left');
        document.getElementById('page-contacts').classList.remove('active');
        document.getElementById('page-chat').classList.remove('hidden-right');
        document.getElementById('page-chat').classList.add('active');
    }

    function closeChat() {
        activeContactId = null;
        document.getElementById('page-contacts').classList.remove('hidden-left');
        document.getElementById('page-contacts').classList.add('active');
        document.getElementById('page-chat').classList.add('hidden-right');
        document.getElementById('page-chat').classList.remove('active');
    }

    // 绑定基础事件
    document.getElementById('btn-back').onclick = closeChat;
    document.getElementById('btn-reload-data').onclick = () => { 
        scanChatHistory(); 
        const btn = document.getElementById('btn-reload-data'); 
        btn.style.transform = 'rotate(360deg)'; 
        setTimeout(()=> btn.style.transform = 'none', 500); 
    };

    // 发送事件 -> Draft
    document.getElementById('btn-send').onclick = sendDraftToInput;
    document.getElementById('msg-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendDraftToInput();
    });

    // ==================================================================================
    // 启动
    // ==================================================================================
    setTimeout(() => {
        initAutomation();
        scanChatHistory();
        console.log('✅ ST-iOS-Phone: Phase 3 Ready (防误触优化版)');
    }, 2000);

})();
