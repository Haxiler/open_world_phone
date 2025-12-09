(function () {
    const SETTING_KEY = "open_world_phone_data";
    
    // === 核心升级：表情包字典 ===
    // label: 发送给AI的关键词 (AI读这个)
    // url: 手机显示的图片 (人读这个)
    // === 核心升级：表情包字典 (共53个精选) ===
    // label: 发送给AI的关键词 (AI读这个，越直白越好)
    // url: 手机显示的图片
    const EMOJI_DB = [
        // --- 基础互动 ---
        { label: "打招呼", url: "https://sharkpan.xyz/f/LgwT7/AC229A80203166B292155ADA057DE423_0.gif" },
        { label: "开心", url: "https://sharkpan.xyz/f/aVwtY/0CBEE9105C7A98E0E6162A79CCD09EFA_0.gif" },
        { label: "爱心", url: "https://sharkpan.xyz/f/53nhj/345FFC998474F46C1A40B1567335DA03_0.gif" },
        { label: "给你爱", url: "https://files.catbox.moe/sqa7c9.jpg" },
        { label: "好的", url: "https://files.catbox.moe/71kn5e.png" },
        { label: "晚安", url: "https://files.catbox.moe/duzx7n.png" },

        // --- 卖萌/撒娇 ---
        { label: "乖巧", url: "https://files.catbox.moe/4dnzcq.png" },
        { label: "害羞", url: "https://files.catbox.moe/ssgpgy.jpg" },
        { label: "飞奔", url: "https://sharkpan.xyz/f/kDOi6/0A231BF0BFAB3C2B243F9749B64F7444_0.gif" },
        { label: "蹭蹭", url: "https://files.catbox.moe/9p0x2t.png" },
        { label: "期待", url: "https://files.catbox.moe/i0ov5h.png" },
        { label: "送花", url: "https://files.catbox.moe/s1t2kd.jpg" },
        { label: "可怜", url: "https://sharkpan.xyz/f/XgmcW/817B66DAB2414E1FC8D717570A602193_0.gif" },
        { label: "流口水", url: "https://sharkpan.xyz/f/j36f6/3010464DF8BD77B4A99AB23730F2EE57_0.gif" },

        // --- 负面情绪/拒绝 ---
        { label: "哭哭", url: "https://files.catbox.moe/rw1cfk.png" },
        { label: "大哭", url: "https://files.catbox.moe/dbyrdf.png" },
        { label: "委屈", url: "https://sharkpan.xyz/f/gVySw/D90D0B53802301FCDB1F0718DEB08C79_0.gif" },
        { label: "生气", url: "https://files.catbox.moe/si6f0k.png" },
        { label: "不爽", url: "https://files.catbox.moe/amelbv.png" },
        { label: "嫌弃", url: "https://files.catbox.moe/t2e0nt.png" },
        { label: "无语", url: "https://files.catbox.moe/wgkwjh.png" },
        { label: "拒绝", url: "https://files.catbox.moe/bos6mn.jpg" },
        { label: "心碎", url: "https://files.catbox.moe/ueqlfe.jpg" },
        { label: "压力", url: "https://files.catbox.moe/ufz3ek.jpg" },

        // --- 攻击性/怼人 ---
        { label: "顶嘴", url: "https://sharkpan.xyz/f/vVBtL/mmexport1737057690899.png" },
        { label: "揍你", url: "https://sharkpan.xyz/f/oJ1i4/mmexport1737057862640.gif" },
        { label: "撞飞", url: "https://sharkpan.xyz/f/zMZu5/mmexport1737057848709.gif" },
        { label: "锁喉", url: "https://files.catbox.moe/mi8tk3.jpg" },
        { label: "滚", url: "https://sharkpan.xyz/f/1vAc2/mmexport1737057678306.png" },
        { label: "比中指", url: "https://files.catbox.moe/umpgjb.jpg" },
        { label: "吃屎", url: "https://files.catbox.moe/r26gox.png" },
        { label: "你是坏蛋", url: "https://sharkpan.xyz/f/8r2Sj/mmexport1737057726579.png" },
        { label: "我恨你", url: "https://files.catbox.moe/r6g32h.png" },

        // --- 搞笑/发疯/阴阳怪气 ---
        { label: "疑惑", url: "https://files.catbox.moe/gofdox.jpg" },
        { label: "震惊", url: "https://files.catbox.moe/q7683x.png" },
        { label: "尴尬", url: "https://files.catbox.moe/8eaawd.png" },
        { label: "偷看", url: "https://files.catbox.moe/72wkme.png" },
        { label: "发疯", url: "https://files.catbox.moe/8cqr43.jpg" },
        { label: "已老实", url: "https://files.catbox.moe/6eyzlg.png" },
        { label: "喝茶", url: "https://files.catbox.moe/1xvrb8.jpg" }, // 大人请用茶
        { label: "免礼", url: "https://sharkpan.xyz/f/pO6uQ/mmexport1737057701883.png" },
        { label: "满意", url: "https://sharkpan.xyz/f/e8KUw/mmexport1737057664689.png" },
        { label: "好困", url: "https://files.catbox.moe/7pncr1.jpg" },
        { label: "躺平", url: "https://files.catbox.moe/cq6ipd.png" },
        { label: "升天", url: "https://files.catbox.moe/o8td90.png" },
        { label: "大脑短路", url: "https://files.catbox.moe/d41e2q.png" },
        { label: "吃瓜", url: "https://files.catbox.moe/428w1c.png" }, // 围观
        { label: "吐魂", url: "https://files.catbox.moe/7yejey.png" },

        // --- 特殊类 ---
        { label: "我是狗", url: "https://files.catbox.moe/1bki7o.jpg" },
        { label: "汪", url: "https://files.catbox.moe/iwmiww.jpg" },
        { label: "投降", url: "https://files.catbox.moe/f4ogyw.png" }
    ];

    const State = {
        contacts: {}, 
        currentChat: null,
        isOpen: false,
        isDragging: false,
        showEmoji: false
    };

    function init() {
        console.log("[OW Phone] Init v1.4 - Emoji Semantics & Delete");
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

        // 拖拽逻辑
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

        addMessageLocal(target, text, 'sent');
        input.value = '';

        const command = `[SMS: ${target} | ${text}]`;
        appendToMainInput(command);
    }

    // === 升级：发送带语义的表情 ===
    function sendEmoji(item) {
        const target = State.currentChat;
        if (!target) return;

        // 1. 本地显示图片
        const imgHtml = `<img src="${item.url}" class="ow-msg-img">`;
        addMessageLocal(target, imgHtml, 'sent');
        $('#ow-emoji-panel').hide();

        // 2. 发送带关键词的指令
        // 格式: [SMS: 目标 | [表情: 顶嘴]]
        const command = `[SMS: ${target} | [表情: ${item.label}]]`;
        appendToMainInput(command);
    }

    // === 升级：删除消息功能 ===
    function deleteMessage(contactName, index) {
        if (!State.contacts[contactName]) return;
        State.contacts[contactName].messages.splice(index, 1);
        saveData();
        renderChat(contactName); // 重新渲染
        toastr.success("已删除该条消息");
    }

    function addMessageLocal(name, content, type) {
        if (!State.contacts[name]) {
            State.contacts[name] = { messages: [], unread: 0, color: getRandomColor() };
        }
        
        const messages = State.contacts[name].messages;
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        
        if (lastMsg && lastMsg.content === content && lastMsg.type === type) {
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

    function startMessageListener() {
        const observer = new MutationObserver(() => {
            const lastMsgEl = $('.mes_text').last();
            if (lastMsgEl.length === 0) return;
            const text = lastMsgEl.text();
            
            // 自动加好友
            let match;
            const addRegex = /\[ADD_CONTACT:\s*(.+?)\]/g;
            while ((match = addRegex.exec(text)) !== null) {
                const name = match[1].trim();
                if (!State.contacts[name]) {
                    State.contacts[name] = { messages: [], unread: 0, color: getRandomColor() };
                    saveData();
                    toastr.success(`📱 自动添加好友: ${name}`);
                    if(State.isOpen && !State.currentChat) renderContactList();
                }
            }

            // 接收短信
            const smsRegex = /\[SMS:\s*(.+?)\s*\|\s*(.+?)\]/g;
            while ((match = smsRegex.exec(text)) !== null) {
                const sender = match[1].trim();
                let content = match[2].trim();
                
                // === 升级：解析 AI 发来的表情包指令 ===
                // 如果 AI 发送 [表情: 顶嘴]，我们需要把它变成图片显示
                const emojiMatch = content.match(/\[表情:\s*(.+?)\]/);
                if (emojiMatch) {
                    const label = emojiMatch[1].trim();
                    const found = EMOJI_DB.find(e => e.label === label);
                    if (found) {
                        content = `<img src="${found.url}" class="ow-msg-img">`;
                    }
                }

                let type = 'recv';
                let target = sender;

                if (sender === '我' || sender.toLowerCase() === 'user' || sender === 'User') {
                    type = 'sent';
                    if (State.currentChat) {
                        target = State.currentChat;
                    } else {
                        const names = Object.keys(State.contacts);
                        if (names.length > 0) target = names[names.length - 1]; 
                        else return; 
                    }
                }

                addMessageLocal(target, content, type);
            }
        });

        const chatLog = document.getElementById('chat');
        if (chatLog) observer.observe(chatLog, { childList: true, subtree: true });
        else setTimeout(startMessageListener, 2000);
    }

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
        $('#ow-emoji-panel').hide();
        
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
            
            // 列表长按/右键删除联系人
            item.on('contextmenu', (e) => {
                e.preventDefault();
                if(confirm(`确定要删除联系人 ${name} 吗？`)) {
                    delete State.contacts[name];
                    saveData();
                    renderContactList();
                }
            });
            
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
        
        msgs.forEach((msg, index) => {
            const isMe = msg.type === 'sent';
            const div = $(`<div class="ow-msg ${isMe ? 'ow-msg-right' : 'ow-msg-left'}">${msg.content}</div>`);
            
            // === 升级：绑定右键删除事件 ===
            div.on('contextmenu', (e) => {
                e.preventDefault();
                if(confirm("删除这条消息？(仅删除本地记录)")) {
                    deleteMessage(name, index);
                }
            });
            
            view.append(div);
        });
        body.append(view);
        body[0].scrollTop = body[0].scrollHeight;
    }

    function renderEmojiPanel() {
        const panel = $('#ow-emoji-panel');
        panel.empty();
        // 遍历字典
        EMOJI_DB.forEach(item => {
            const img = $(`<img src="${item.url}" class="ow-emoji-item" title="${item.label}">`);
            img.click(() => sendEmoji(item)); // 传递整个 item 对象
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
