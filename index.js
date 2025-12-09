(function () {
    const SETTING_KEY = "open_world_phone_data";
    
    // 简单的表情包列表 (参考柏柏手机，使用了 sharkpan 图床)
    // 你可以随时在这里添加新的链接
    const EMOJI_LIST = [
        "https://sharkpan.xyz/f/vVBtL/mmexport1737057690899.png", // 你敢顶嘴
        "https://sharkpan.xyz/f/pO6uQ/mmexport1737057701883.png", // 免礼
        "https://sharkpan.xyz/f/1vAc2/mmexport1737057678306.png", // 你走吧
        "https://sharkpan.xyz/f/e8KUw/mmexport1737057664689.png", // 我很满意
        "https://sharkpan.xyz/f/oJ1i4/mmexport1737057862640.gif", // 揍你哦
        "https://sharkpan.xyz/f/8r2Sj/mmexport1737057726579.png", // 坏蛋
        "https://sharkpan.xyz/f/Gvmil/mmexport1737057801285.gif", // 关心你
        "https://sharkpan.xyz/f/zMZu5/mmexport1737057848709.gif", // 撞飞你
        "https://sharkpan.xyz/f/53nhj/345FFC998474F46C1A40B1567335DA03_0.gif", // 剪纸爱心
        "https://sharkpan.xyz/f/kDOi6/0A231BF0BFAB3C2B243F9749B64F7444_0.gif"  // 飞奔过来
    ];

    const State = {
        contacts: {}, 
        currentChat: null,
        isOpen: false,
        isDragging: false,
        showEmoji: false
    };

    function init() {
        console.log("[OW Phone] Init v1.1");
        loadData();
        
        // 注入HTML
        const layout = `
        <div id="ow-phone-toggle" title="打开手机">
            💬<span id="ow-main-badge" class="ow-badge" style="display:none">0</span>
        </div>

        <div id="ow-phone-container" class="ow-hidden">
            <div id="ow-phone-header">
                <div id="ow-back-btn" class="ow-header-btn" style="display:none">❮</div>
                <div id="ow-header-title">通讯录</div>
                <div id="ow-close-btn" class="ow-header-btn">✖</div>
            </div>
            
            <div id="ow-phone-body"></div>
            
            <div id="ow-bottom-area" style="display:none">
                <div id="ow-input-wrapper">
                    <div id="ow-input-row">
                        <input id="ow-input" placeholder="输入短信..." autocomplete="off">
                        <div id="ow-send-btn">➤</div>
                    </div>
                    <div id="ow-func-row">
                        <div class="ow-func-btn" id="btn-emoji" title="表情包">😊</div>
                        <div class="ow-func-btn" id="btn-add-contact" title="手动加人">➕</div>
                        <div class="ow-func-btn" id="btn-clear" title="清空记录">🗑️</div>
                    </div>
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
        // 基础按钮
        $('#ow-phone-toggle').click(() => togglePhone(true));
        $('#ow-close-btn').click(() => togglePhone(false));
        $('#ow-back-btn').click(() => {
            $('#ow-emoji-panel').hide();
            renderContactList();
        });

        // 发送相关
        $('#ow-send-btn').click(handleUserSend);
        $('#ow-input').keypress((e) => { if(e.key === 'Enter') handleUserSend(); });

        // 功能按钮
        $('#btn-emoji').click(() => {
            $('#ow-emoji-panel').slideToggle(100);
        });

        $('#btn-add-contact').click(() => {
            const name = prompt("请输入新联系人的名字：");
            if (name) {
                addContact(name);
                renderChat(name); // 直接跳进聊天
            }
        });

        $('#btn-clear').click(() => {
            if(confirm("确定要清空与该角色的聊天记录吗？")) {
                if(State.contacts[State.currentChat]) {
                    State.contacts[State.currentChat].messages = [];
                    saveData();
                    renderChat(State.currentChat);
                }
            }
        });

        // 拖拽逻辑 (原生JS)
        const header = document.getElementById('ow-phone-header');
        const container = document.getElementById('ow-phone-container');
        let offset = {x:0, y:0};

        header.onmousedown = (e) => {
            State.isDragging = true;
            offset.x = e.clientX - container.offsetLeft;
            offset.y = e.clientY - container.offsetTop;
            header.style.cursor = 'grabbing';
        };
        document.onmouseup = () => {
            State.isDragging = false;
            header.style.cursor = 'grab';
        };
        document.onmousemove = (e) => {
            if(!State.isDragging) return;
            e.preventDefault();
            container.style.left = (e.clientX - offset.x) + 'px';
            container.style.top = (e.clientY - offset.y) + 'px';
            container.style.bottom = 'auto';
            container.style.right = 'auto';
        };
    }

    // === 核心交互：追加到主输入框 ===
    function appendToMainInput(text) {
        const textarea = document.getElementById('send_textarea');
        if (!textarea) return;

        // 检查当前输入框是否有内容
        let currentVal = textarea.value;
        if (currentVal.length > 0 && !currentVal.endsWith('\n')) {
            currentVal += '\n';
        }

        // 追加内容
        textarea.value = currentVal + text;
        
        // 触发 React/Vue 的绑定更新事件
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
        
        // 提示用户
        toastr.info("短信已添加到输入框，请随正文一起发送");
    }

    function handleUserSend() {
        const input = document.getElementById('ow-input');
        const text = input.value.trim();
        const target = State.currentChat;

        if (!text || !target) return;

        // 1. 手机界面上屏 (伪造已发送)
        addMessageLocal(target, text, 'sent');
        input.value = '';

        // 2. 构造格式并追加到主输入框
        // 格式： [SMS: 目标 | 内容]
        const smsCommand = `\n[SMS: ${target} | ${text}]`;
        appendToMainInput(smsCommand);
    }

    function sendEmoji(url) {
        const target = State.currentChat;
        if (!target) return;

        // 1. 本地上屏
        addMessageLocal(target, `<img src="${url}" class="ow-msg-img">`, 'sent');
        $('#ow-emoji-panel').hide();

        // 2. 追加指令
        // 格式： [SMS: 目标 | [表情包] ]
        // 这里我们可以简化，也可以发 url，看你怎么设定 prompt
        const smsCommand = `\n[SMS: ${target} | [发送了表情包]]`;
        appendToMainInput(smsCommand);
    }

    // === 消息处理逻辑 ===
    function addContact(name) {
        if (!State.contacts[name]) {
            State.contacts[name] = { 
                messages: [], 
                unread: 0,
                color: '#' + Math.floor(Math.random()*16777215).toString(16)
            };
            saveData();
        }
    }

    function addMessageLocal(name, content, type) {
        if (!State.contacts[name]) addContact(name);
        
        State.contacts[name].messages.push({
            type: type,
            content: content,
            time: Date.now()
        });
        
        // 如果是接收且未读
        if (type === 'recv' && State.currentChat !== name) {
            State.contacts[name].unread++;
        }

        saveData();
        if (State.currentChat === name) renderChat(name);
        else renderContactList();
        updateBadge();
    }

    // 监听酒馆输出
    function startMessageListener() {
        const observer = new MutationObserver(() => {
            const lastMsgEl = $('.mes_text').last();
            if (lastMsgEl.length === 0) return;
            const text = lastMsgEl.text();
            
            // 1. 自动加好友 [ADD_CONTACT: name]
            const addRegex = /\[ADD_CONTACT:\s*(.+?)\]/g;
            let match;
            while ((match = addRegex.exec(text)) !== null) {
                addContact(match[1].trim());
            }

            // 2. 接收短信 [SMS: sender | content]
            const smsRegex = /\[SMS:\s*(.+?)\s*\|\s*(.+?)\]/g;
            let smsMatch;
            while ((smsMatch = smsRegex.exec(text)) !== null) {
                const sender = smsMatch[1].trim();
                const content = smsMatch[2].trim();
                // 排除自己发的
                if (sender !== '我' && sender.toLowerCase() !== 'user' && sender !== 'User') {
                    // 简单去重：检查最后一条消息是否相同（防止重复渲染触发）
                    const contact = State.contacts[sender];
                    const lastMsg = contact ? contact.messages[contact.messages.length-1] : null;
                    if (!lastMsg || lastMsg.content !== content) {
                        addMessageLocal(sender, content, 'recv');
                    }
                }
            }
        });

        const chatLog = document.getElementById('chat');
        if (chatLog) observer.observe(chatLog, { childList: true, subtree: true });
        else setTimeout(startMessageListener, 2000);
    }

    // === UI 渲染 ===
    function togglePhone(show) {
        State.isOpen = show;
        const container = $('#ow-phone-container');
        const toggle = $('#ow-phone-toggle');
        
        if (show) {
            container.removeClass('ow-hidden');
            toggle.hide();
            if (State.currentChat) renderChat(State.currentChat);
            else renderContactList();
        } else {
            container.addClass('ow-hidden');
            toggle.show();
        }
        updateBadge();
    }

    function renderContactList() {
        State.currentChat = null;
        $('#ow-header-title').text("通讯录");
        $('#ow-back-btn').hide();
        $('#ow-bottom-area').hide();
        
        const body = $('#ow-phone-body');
        body.empty();

        const names = Object.keys(State.contacts);
        if (names.length === 0) {
            body.html(`<div style="text-align:center; margin-top:50px; opacity:0.5">暂无联系人<br>点击底部 + 号添加</div>`);
        }

        names.forEach(name => {
            const info = State.contacts[name];
            const lastMsg = info.messages[info.messages.length - 1];
            let preview = lastMsg ? lastMsg.content : "暂无消息";
            if (preview.includes('<img')) preview = '[图片]';

            const el = $(`
                <div class="ow-contact-item">
                    <div class="ow-avatar" style="background:${info.color}">
                        ${name[0]}
                        ${info.unread > 0 ? `<div class="ow-badge">${info.unread}</div>` : ''}
                    </div>
                    <div class="ow-info">
                        <div class="ow-name">${name}</div>
                        <div class="ow-preview">${preview}</div>
                    </div>
                </div>
            `);
            el.click(() => renderChat(name));
            body.append(el);
        });
        
        // 在通讯录底部显示加号（如果列表为空时方便点，虽然底部也有栏）
        if (names.length === 0) {
             $('#ow-bottom-area').show(); // 复用底部栏来显示加号
             $('#ow-input-wrapper').hide(); // 隐藏输入框
             $('#ow-func-row').show(); // 显示功能钮
        }
    }

    function renderChat(name) {
        State.currentChat = name;
        if(State.contacts[name]) State.contacts[name].unread = 0;
        updateBadge();
        saveData();

        $('#ow-header-title').text(name);
        $('#ow-back-btn').show();
        
        $('#ow-bottom-area').show();
        $('#ow-input-wrapper').show();
        $('#ow-func-row').show();

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
        body.scrollTop(body[0].scrollHeight);
    }

    function renderEmojiPanel() {
        const panel = $('#ow-emoji-panel');
        EMOJI_LIST.forEach(url => {
            const img = $(`<img src="${url}" class="ow-emoji-item">`);
            img.click(() => sendEmoji(url));
            panel.append(img);
        });
    }

    function updateBadge() {
        let total = 0;
        Object.values(State.contacts).forEach(c => total += (c.unread || 0));
        const badge = $('#ow-main-badge');
        if (total > 0) badge.text(total).show();
        else badge.hide();
    }

    function saveData() { localStorage.setItem(SETTING_KEY, JSON.stringify(State.contacts)); }
    function loadData() {
        const raw = localStorage.getItem(SETTING_KEY);
        if(raw) State.contacts = JSON.parse(raw);
    }

    $(document).ready(() => setTimeout(init, 1000));
})();
