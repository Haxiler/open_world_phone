(function () {
    const SETTING_KEY = "open_world_phone_data";
    
    // 表情包列表
    const EMOJI_LIST = [
        "https://sharkpan.xyz/f/vVBtL/mmexport1737057690899.png", // 顶嘴
        "https://sharkpan.xyz/f/pO6uQ/mmexport1737057701883.png", // 免礼
        "https://sharkpan.xyz/f/1vAc2/mmexport1737057678306.png", // 走吧
        "https://sharkpan.xyz/f/e8KUw/mmexport1737057664689.png", // 满意
        "https://sharkpan.xyz/f/oJ1i4/mmexport1737057862640.gif", // 揍你
        "https://sharkpan.xyz/f/8r2Sj/mmexport1737057726579.png", // 坏蛋
        "https://sharkpan.xyz/f/Gvmil/mmexport1737057801285.gif", // 关心
        "https://sharkpan.xyz/f/zMZu5/mmexport1737057848709.gif", // 撞飞
        "https://sharkpan.xyz/f/53nhj/345FFC998474F46C1A40B1567335DA03_0.gif", // 爱心
        "https://sharkpan.xyz/f/kDOi6/0A231BF0BFAB3C2B243F9749B64F7444_0.gif"  // 飞奔
    ];

    const State = {
        contacts: {}, 
        currentChat: null,
        isOpen: false,
        isDragging: false,
        showEmoji: false
    };

    function init() {
        console.log("[OW Phone] Init v1.3 - Auto Greeting Fix");
        loadData();
        
        const layout = `
        <div id="ow-phone-toggle" title="打开手机">
            💬<span id="ow-main-badge" class="ow-badge" style="display:none">0</span>
        </div>

        <div id="ow-phone-container" class="ow-hidden">
            <div id="ow-phone-header">
                <div class="ow-header-icon" id="ow-back-btn" style="display:none">❮</div>
                <div id="ow-header-title">通讯录</div>
                <div class="ow-header-icon" id="ow-add-btn" title="添加好友">➕</div>
                <div class="ow-header-icon" id="ow-close-btn" title="关闭">✖</div>
            </div>
            
            <div id="ow-phone-body"></div>
            
            <div id="ow-chat-footer" style="display:none">
                <div id="ow-input-row">
                    <input id="ow-input" placeholder="输入信息..." autocomplete="off">
                    <div class="ow-footer-icon" id="ow-emoji-btn">☺</div>
                    <button id="ow-send-btn">发送</button>
                </div>
                <div id="ow-emoji-panel" style="display:none"></div>
            </div>
        </div>
        `;
        $('body').append(layout);

        renderEmojiPanel();
        bindEvents();
        startMessageListener();
        renderContactList();
    }

    function bindEvents() {
        $('#ow-phone-toggle').click(() => togglePhone(true));
        $('#ow-close-btn').click(() => togglePhone(false));
        $('#ow-back-btn').click(() => { renderContactList(); });

        $('#ow-add-btn').click(() => {
            const name = prompt("【添加好友】请输入对方的名字：");
            if (name && name.trim()) {
                const cleanName = name.trim();
                if (!State.contacts[cleanName]) {
                    State.contacts[cleanName] = { messages: [], unread: 0, color: getRandomColor() };
                    saveData();
                }
                renderChat(cleanName);
            }
        });

        $('#ow-send-btn').click(handleUserSend);
        $('#ow-input').keypress((e) => { if(e.key === 'Enter') handleUserSend(); });

        $('#ow-emoji-btn').click(() => { $('#ow-emoji-panel').slideToggle(150); });

        const header = document.getElementById('ow-phone-header');
        const container = document.getElementById('ow-phone-container');
        let offset = {x:0, y:0};

        header.onmousedown = (e) => {
            if (e.target.classList.contains('ow-header-icon')) return;
            State.isDragging = true;
            offset.x = e.clientX - container.offsetLeft;
            offset.y = e.clientY - container.offsetTop;
            header.style.cursor = 'grabbing';
        };
        document.onmouseup = () => { State.isDragging = false; header.style.cursor = 'grab'; };
        document.onmousemove = (e) => {
            if(!State.isDragging) return;
            e.preventDefault();
            container.style.left = (e.clientX - offset.x) + 'px';
            container.style.top = (e.clientY - offset.y) + 'px';
            container.style.bottom = 'auto';
            container.style.right = 'auto';
        };
    }

    function appendToMainInput(text) {
        const textarea = document.getElementById('send_textarea');
        if (!textarea) return;
        let currentVal = textarea.value;
        if (currentVal.length > 0 && !currentVal.endsWith('\n')) currentVal += '\n';
        textarea.value = currentVal + text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
        toastr.info(`短信指令已填入输入框`);
    }

    function handleUserSend() {
        const input = document.getElementById('ow-input');
        const text = input.value.trim();
        const target = State.currentChat;
        if (!text || !target) return;

        // 1. 本地上屏 (伪造)
        addMessageLocal(target, text, 'sent');
        input.value = '';

        // 2. 填入指令
        const command = `[SMS: ${target} | ${text}]`;
        appendToMainInput(command);
    }

    function sendEmoji(url) {
        const target = State.currentChat;
        if (!target) return;
        const imgHtml = `<img src="${url}" class="ow-msg-img">`;
        addMessageLocal(target, imgHtml, 'sent');
        $('#ow-emoji-panel').hide();
        const command = `[SMS: ${target} | [发送了一个表情包]]`;
        appendToMainInput(command);
    }

    // === 数据逻辑 ===
    function addMessageLocal(name, content, type) {
        if (!State.contacts[name]) {
            State.contacts[name] = { messages: [], unread: 0, color: getRandomColor() };
        }
        
        // 防重检查：如果最后一条消息内容和类型都一样，且时间间隔很短，则不添加
        const messages = State.contacts[name].messages;
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        
        // 这里做一个简单的防重，防止 Listener 和 本地添加 撞车
        if (lastMsg && lastMsg.content === content && lastMsg.type === type) {
            // 如果是刚刚发的（5秒内），忽略
            if (Date.now() - lastMsg.time < 5000) return; 
        }

        messages.push({ type: type, content: content, time: Date.now() });

        if (type === 'recv' && State.currentChat !== name) {
            State.contacts[name].unread++;
        }
        
        saveData();
        updateMainBadge();
        
        if (State.isOpen) {
            if (State.currentChat === name) renderChat(name);
            else if (!State.currentChat) renderContactList();
        }
    }

    // === 核心修复：允许 AI 代表 User 发送 ===
    function startMessageListener() {
        const observer = new MutationObserver(() => {
            const lastMsgEl = $('.mes_text').last();
            if (lastMsgEl.length === 0) return;
            const text = lastMsgEl.text();
            
            // 1. 自动加好友
            let match;
            const addRegex = /\[ADD_CONTACT:\s*(.+?)\]/g;
            while ((match = addRegex.exec(text)) !== null) {
                const name = match[1].trim();
                // 只有当好友不存在时才提示，避免重复弹窗
                if (!State.contacts[name]) {
                    State.contacts[name] = { messages: [], unread: 0, color: getRandomColor() };
                    saveData();
                    toastr.success(`📱 自动添加好友: ${name}`);
                    if(State.isOpen && !State.currentChat) renderContactList();
                }
            }

            // 2. 消息监听 (User 和 NPC 全都要)
            // 现在的正则会匹配 [SMS: 任何人 | 内容]
            const smsRegex = /\[SMS:\s*(.+?)\s*\|\s*(.+?)\]/g;
            while ((match = smsRegex.exec(text)) !== null) {
                const sender = match[1].trim();
                const content = match[2].trim();
                
                // 判断发送者
                let type = 'recv';
                let target = sender; // 默认对方是 sender

                // 如果发送者是 '我' / 'User' / '{{user}}'
                // 说明这是 AI 代替 User 发的（自动问候），或者是 User 手动发的（回显）
                if (sender === '我' || sender.toLowerCase() === 'user' || sender === 'User') {
                    type = 'sent';
                    // 这种情况下，我们需要知道发给谁...
                    // 尴尬点：[SMS: User | 内容] 没有指定接收者！
                    // 解决方案：通常这种自动问候紧跟在 ADD_CONTACT 之后。
                    // 或者我们默认发给“当前上下文里提到的那个人”。
                    
                    // *修正策略*：为了避免逻辑混乱，我们假设自动问候是发给"刚刚添加的那个人"
                    // 或者，我们在 Prompt 里要求 AI 写成 [SMS: {{user}}->角色名 | 内容]？
                    // 不，那样太复杂。
                    
                    // 最简单的修正：
                    // 如果 AI 输出了 [SMS: User | 内容]，我们就把它归类为 "发给当前聊天窗口的人" 
                    // 或者 "最近一个 ADD_CONTACT 的人"。
                    
                    // 这里做一个简单的回退：如果检测到是 User 发的，且当前没有明确目标，
                    // 我们尝试去 recent contact 里找。
                    
                    // 但为了代码简单，我们先假设 AI 会严格按照 ADD_CONTACT -> SMS 的顺序。
                    // 我们可以去 State.contacts 里找最近更新的一个人。
                    
                    // 更加稳妥的方法：
                    // 让 AI 输出 [SMS: User->角色 | 内容]。如果不改 Prompt，
                    // 我们可以暂时把 User 发的消息归档给 "最近联系人" 或者 "State.currentChat"
                    
                    // 如果实在不知道发给谁，就暂存到 System 或 忽略。
                    // 但在这里，因为是扫码场景，我们假设发给“刚刚加的那个人”。
                    
                    // *Hack*: 遍历刚才正则捕获的 addMatch (如果存在)
                    // 但 regex exec 是独立的。
                    
                    // 让我们换个思路：如果 sender 是 User，我们忽略？
                    // 不，你说要体现。
                    
                    // 既然是扫码场景，对方一定是刚刚加的。
                    // 我们查找最近 1 秒内创建的联系人？
                    // 或者，我们仅仅依靠“当前打开的窗口”？
                    
                    // 算了，为了不让代码过于复杂，我们采用“双向绑定判定”：
                    // 如果上一条指令是 ADD_CONTACT: X，那么这条 SMS: User 就是发给 X 的。
                    
                    // 这里我们简化处理：如果是 User 发的，我们尝试获取当前聊天对象，或者最近添加的对象。
                    // 这是一个妥协。
                    
                    if (State.currentChat) {
                        target = State.currentChat;
                    } else {
                        // 找最近一个联系人
                        const names = Object.keys(State.contacts);
                        if (names.length > 0) target = names[names.length - 1]; // 最后添加的
                        else return; // 没好友，没法发
                    }
                }

                // 执行添加 (带防重)
                // 这里的 target 变成了接收者(如果是我发的) 或 发送者(如果是对方发的)
                // 统称为 "对话对象"
                addMessageLocal(target, content, type);
            }
        });

        const chatLog = document.getElementById('chat');
        if (chatLog) observer.observe(chatLog, { childList: true, subtree: true });
        else setTimeout(startMessageListener, 2000);
    }

    // ... (UI 渲染和工具函数保持 v1.2 不变) ...
    // 为节省篇幅，这里复用 v1.2 的 renderChat, renderContactList 等函数
    // 实际文件请务必保留 style.css 和完整的 render 函数
    
    function togglePhone(show) {
        State.isOpen = show;
        if (show) {
            $('#ow-phone-container').removeClass('ow-hidden');
            $('#ow-phone-toggle').hide();
            if (State.currentChat) renderChat(State.currentChat);
            else renderContactList();
        } else {
            $('#ow-phone-container').addClass('ow-hidden');
            $('#ow-phone-toggle').show();
        }
        updateMainBadge();
    }

    function renderContactList() {
        State.currentChat = null;
        $('#ow-header-title').text("通讯录");
        $('#ow-back-btn').hide();
        $('#ow-add-btn').show(); 
        $('#ow-close-btn').show();
        $('#ow-chat-footer').hide();
        const body = $('#ow-phone-body');
        body.empty();
        const names = Object.keys(State.contacts);
        if (names.length === 0) {
            body.html(`<div class="ow-empty-state"><div style="font-size:40px; margin-bottom:10px;">📭</div>暂无联系人<br>点击右上角 ➕ 添加好友</div>`);
            return;
        }
        names.forEach(name => {
            const info = State.contacts[name];
            const lastMsg = info.messages[info.messages.length - 1];
            let preview = lastMsg ? lastMsg.content : "暂无消息";
            if (preview.includes('<img')) preview = '[图片]';
            const item = $(`
                <div class="ow-contact-item">
                    <div class="ow-avatar" style="background:${info.color || '#555'}">
                        ${name[0].toUpperCase()}
                        ${info.unread > 0 ? `<div class="ow-badge">${info.unread}</div>` : ''}
                    </div>
                    <div class="ow-info">
                        <div class="ow-name">${name}</div>
                        <div class="ow-preview">${preview}</div>
                    </div>
                </div>
            `);
            item.click(() => renderChat(name));
            body.append(item);
        });
    }

    function renderChat(name) {
        State.currentChat = name;
        if(State.contacts[name]) State.contacts[name].unread = 0;
        updateMainBadge();
        saveData();
        $('#ow-header-title').text(name);
        $('#ow-back-btn').show(); 
        $('#ow-add-btn').hide();  
        $('#ow-chat-footer').show();
        $('#ow-emoji-panel').hide();
        const body = $('#ow-phone-body');
        body.empty();
        const view = $('<div class="ow-chat-view"></div>');
        const msgs = State.contacts[name]?.messages || [];
        msgs.forEach(msg => {
            const isMe = msg.type === 'sent';
            const div = $(`<div class="ow-msg ${isMe ? 'ow-msg-right' : 'ow-msg-left'}">${msg.content}</div>`);
            view.append(div);
        });
        body.append(view);
        body[0].scrollTop = body[0].scrollHeight;
    }

    function renderEmojiPanel() {
        const panel = $('#ow-emoji-panel');
        panel.empty();
        EMOJI_LIST.forEach(url => {
            const img = $(`<img src="${url}" class="ow-emoji-item">`);
            img.click(() => sendEmoji(url));
            panel.append(img);
        });
    }

    function updateMainBadge() {
        let total = 0;
        Object.values(State.contacts).forEach(c => total += (c.unread || 0));
        const badge = $('#ow-main-badge');
        if (total > 0) badge.text(total).show();
        else badge.hide();
    }

    function getRandomColor() {
        const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff', '#52c41a'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function saveData() { localStorage.setItem(SETTING_KEY, JSON.stringify(State.contacts)); }
    function loadData() {
        const raw = localStorage.getItem(SETTING_KEY);
        if(raw) State.contacts = JSON.parse(raw);
    }

    $(document).ready(() => setTimeout(init, 500));
})();
