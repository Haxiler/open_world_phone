// ==================================================================================
// 脚本名称: ST-iOS-Phone-Core (Phase 1.1 - No Avatar & Split Files)
// ==================================================================================

(function () {
    // 1. 防止重复加载
    if (document.getElementById('st-ios-phone-root')) return;

    // ==================================================================================
    // HTML 结构 (骨架)
    // ==================================================================================
    const html = `
    <div id="st-ios-phone-root">
        <div id="st-phone-icon">
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
                            <button class="nav-btn" style="visibility:hidden">编辑</button>
                            <span class="nav-title">信息</span>
                            <button class="nav-btn icon" id="btn-add-contact">+</button>
                        </div>
                        <div class="contact-list" id="contact-list-container">
                            </div>
                    </div>

                    <div class="page hidden-right" id="page-chat">
                        <div class="nav-bar">
                            <button class="nav-btn" id="btn-back">❮ 信息</button>
                            <span class="nav-title" id="chat-title">用户</span>
                            <button class="nav-btn" style="visibility:hidden">...</button>
                        </div>
                        <div class="chat-scroll-area" id="chat-messages-container">
                            </div>
                        <div class="input-area">
                            <div class="plus-btn" title="表情包/图片">+</div>
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

    // 将 HTML 注入到页面中
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);

    // ==================================================================================
    // 逻辑部分
    // ==================================================================================
    
    // --- 工具：拖拽逻辑 ---
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // 启用拖拽
    makeDraggable(document.getElementById("st-phone-window"), document.getElementById("phone-drag-handle"));
    makeDraggable(document.getElementById("st-phone-icon"), document.getElementById("st-phone-icon"));

    // --- 工具：显隐切换 ---
    const icon = document.getElementById('st-phone-icon');
    const windowEl = document.getElementById('st-phone-window');
    let isPhoneOpen = false;

    icon.addEventListener('click', () => {
        isPhoneOpen = !isPhoneOpen;
        windowEl.style.display = isPhoneOpen ? 'block' : 'none';
    });

    // --- 数据：模拟联系人和消息 (Mock Data) ---
    // 注意：这里已经移除了 avatar 字段
    const state = {
        activeContactId: null,
        contacts: [
            { 
                id: 'alice', 
                name: '艾丽丝', 
                lastMsg: '上次那个地牢真的太危险了！', 
                time: '12:30', 
                messages: [
                    { sender: 'user', text: '你好呀，艾丽丝！' },
                    { sender: 'char', text: '嘿！好久不见！' },
                    { sender: 'char', text: '上次那个地牢真的太危险了！' }
                ]
            },
            { 
                id: 'bob', 
                name: '鲍勃', 
                lastMsg: '装备我都修好了。', 
                time: '昨天', 
                messages: [
                    { sender: 'char', text: '老板，盾牌坏了。' },
                    { sender: 'user', text: '放我这，我帮你修。' },
                    { sender: 'char', text: '装备我都修好了。' }
                ]
            }
        ]
    };

    // --- 渲染：联系人列表 (已移除头像) ---
    function renderContacts() {
        const container = document.getElementById('contact-list-container');
        container.innerHTML = '';
        state.contacts.forEach(contact => {
            const el = document.createElement('div');
            el.className = 'contact-item';
            // 纯文本布局，没有头像div了
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

    // --- 渲染：聊天记录 ---
    function renderChat(contact) {
        const container = document.getElementById('chat-messages-container');
        container.innerHTML = '';
        // 顶部留白
        container.appendChild(document.createElement('div')).style.height = '10px';
        
        contact.messages.forEach(msg => {
            const el = document.createElement('div');
            el.className = `message-bubble ${msg.sender === 'user' ? 'sent' : 'received'}`;
            el.innerText = msg.text;
            container.appendChild(el);
        });
        
        // 自动滚动到底部
        setTimeout(() => container.scrollTop = container.scrollHeight, 50);
    }

    // --- 导航：页面切换逻辑 ---
    function openChat(contact) {
        state.activeContactId = contact.id;
        document.getElementById('chat-title').innerText = contact.name;
        renderChat(contact);
        
        // 进入动画
        document.getElementById('page-contacts').classList.add('hidden-left');
        document.getElementById('page-contacts').classList.remove('active');
        document.getElementById('page-chat').classList.remove('hidden-right');
        document.getElementById('page-chat').classList.add('active');
    }

    function closeChat() {
        state.activeContactId = null;
        
        // 返回动画
        document.getElementById('page-contacts').classList.remove('hidden-left');
        document.getElementById('page-contacts').classList.add('active');
        document.getElementById('page-chat').classList.add('hidden-right');
        document.getElementById('page-chat').classList.remove('active');
    }

    document.getElementById('btn-back').onclick = closeChat;

    // --- 交互：发送演示 (本地更新) ---
    document.getElementById('btn-send').onclick = () => {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text || !state.activeContactId) return;

        // 找到当前联系人推入消息
        const contact = state.contacts.find(c => c.id === state.activeContactId);
        if (contact) {
            contact.messages.push({ sender: 'user', text: text });
            contact.lastMsg = text;
            contact.time = '现在';
            renderChat(contact); // 刷新聊天视图
            renderContacts(); // 刷新列表视图（为了更新最新消息预览）
        }
        input.value = '';
    };

    // 启动
    renderContacts();
    console.log('ST-iOS-Phone-Core (No Avatar) 加载完成');

})();
