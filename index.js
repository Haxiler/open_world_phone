(function () {
    // 存储前缀，用于隔离不同聊天的数
    const STORAGE_PREFIX = "ow_phone_";
    
    // 表情包字典 (保留你喜欢的)
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
        userName: "User",
        currentContextId: null, // 当前聊天的唯一ID
    };

    function init() {
        console.log("[OW Phone] Init v3.2 - Context Binding");
        
        // 尝试获取当前用户信息和聊天ID
        updateContextInfo();
        loadData(); // 加载对应 ID 的数据
        
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
        if ($('#ow-phone-container').length === 0) {
            $('body').append(layout);
            renderEmojiPanel();
            bindEvents();
        }

        // 监听 DOM 变化 (读取数据胶囊)
        const observer = new MutationObserver((mutations) => {
            // 1. 检查是否换了聊天卡 (Context ID 变化)
            updateContextInfo();
            
            // 2. 扫描新消息
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length) {
                    $(mutation.addedNodes).each(function() {
                        // 查找我们埋下的“数据胶囊”
                        const capsule = $(this).find('.ow-raw-data');
                        if (capsule.length > 0) {
                            const rawMsg = capsule.attr('data-raw');
                            console.log("捕捉到胶囊数据:", rawMsg);
                            parseCommand(rawMsg);
                        }
                        
                        // 兼容：有时候胶囊本身就是 addedNode
                        if ($(this).hasClass('ow-raw-data')) {
                            const rawMsg = $(this).attr('data-raw');
                            parseCommand(rawMsg);
                        }
                    });
                }
            });
        });

        const chatLog = document.getElementById('chat');
        if (chatLog) observer.observe(chatLog, { childList: true, subtree: true });
        
        renderContactList();
    }

    // === 核心：上下文绑定与更新 ===
    function updateContextInfo() {
        // 尝试从酒馆全局对象获取信息
        // 不同的酒馆版本，获取方式可能不同，这里做多重兼容
        let newContextId = null;
        let newUserName = "User";

        if (window.SillyTavern) {
            const context = window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
            if (context) {
                // 使用 characterId 或 chatId 作为唯一标识
                // 优先使用 characterId，这样同角色的聊天可以继承通讯录 (或者用 chatId 彻底隔离)
                // 这里我们用 characterId，体验更像“跟这个人聊天，手机里存着他”
                newContextId = context.characterId || context.groupId;
                
                if (context.name) newUserName = context.name;
                else if (context.user_name) newUserName = context.user_name;
            }
        }

        // 降级方案：如果 API 拿不到，就从 DOM 里凑合拿一个标识
        if (!newContextId) {
            // 比如读取当前角色名标题
            newContextId = $('#character-name').text() || "default_room";
        }

        // 如果 ID 变了，说明换人了！重新加载数据
        if (newContextId !== State.currentContextId) {
            console.log(`[OW Phone] 切换聊天环境: ${State.currentContextId} -> ${newContextId}`);
            State.currentContextId = newContextId;
            State.userName = newUserName;
            loadData(); // 加载新环境的数据
            renderContactList();
        }
    }

    // === 解析器 (读胶囊) ===
    function parseCommand(text) {
        if (!text) return;

        // 1. 加好友 [ADD_CONTACT:xxx]
        // 注意：因为正则可能把 ADD_CONTACT 也包进去了，或者它是独立的
        // 我们只处理 <msg>，ADD_CONTACT 建议直接在 JS 里处理，或者也包进胶囊
        // 简单起见，我们假设 ADD_CONTACT 依然是明文或者在胶囊旁边
        // 这里主要解析 <msg>
        
        const msgRegex = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/;
        const match = text.match(msgRegex);
        
        if (match) {
            let sender = match[1].trim();
            let receiver = match[2].trim();
            let content = match[3].trim();
            let timeStr = match[4].trim();

            const isSenderUser = checkIsUser(sender);
            const isReceiverUser = checkIsUser(receiver);

            content = parseEmojiContent(content);

            if (!isSenderUser && isReceiverUser) {
                // 别人发给我 -> 自动加好友
                addMessageLocal(sender, content, 'recv', timeStr);
            } else if (isSenderUser && !isReceiverUser) {
                // 我发给别人
                addMessageLocal(receiver, content, 'sent', timeStr);
            }
        }
        
        // 额外检查加好友指令 (如果它也在 raw text 里)
        const addMatch = text.match(/\[ADD_CONTACT:\s*(.+?)\]/);
        if (addMatch) {
            const name = addMatch[1].trim();
            if (!State.contacts[name]) {
                State.contacts[name] = { messages: [], unread: 0, color: getRandomColor() };
                saveData();
                toastr.success(`📱 自动添加好友: ${name}`);
            }
        }
    }

    function checkIsUser(name) {
        return (name === State.userName || name === '我' || name.toLowerCase() === 'user' || name === 'User' || name === '{{user}}');
    }

    function parseEmojiContent(text) {
        const bqbRegex = /\[bqb-(.+?)\]/;
        const match = text.match(bqbRegex);
        if (match) {
            const label = match[1].trim();
            const found = EMOJI_DB.find(e => e.label === label);
            if (found) return `<img src="${found.url}" class="ow-msg-img">`;
            return `[表情: ${label}]`;
        }
        return text;
    }

    // === 发送逻辑 ===
    function handleUserSend() {
        const input = document.getElementById('ow-input');
        const text = input.value.trim();
        const target = State.currentChat; 
        if (!text || !target) return;

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        addMessageLocal(target, text, 'sent', timeStr);
        input.value = '';

        // 构造指令
        const command = `\n<msg>{{user}}|${target}|${text}|${timeStr}</msg>`;
        appendToMainInput(command);
    }
    
    function sendEmoji(item) {
        const target = State.currentChat;
        if (!target) return;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const imgHtml = `<img src="${item.url}" class="ow-msg-img">`;
        addMessageLocal(target, imgHtml, 'sent', timeStr);
        $('#ow-emoji-panel').hide();
        const command = `\n<msg>{{user}}|${target}|[bqb-${item.label}]|${timeStr}</msg>`;
        appendToMainInput(command);
    }

    function appendToMainInput(text) {
        const textarea = document.getElementById('send_textarea');
        if (!textarea) return;
        
        let currentVal = textarea.value;
        if (currentVal.length > 0 && !currentVal.endsWith('\n')) currentVal += '\n';
        textarea.value = currentVal + text;
        
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    }

    // === 核心：带 Key 的存储 ===
    function addMessageLocal(name, content, type, timeStr) {
        if (!State.contacts[name]) {
            State.contacts[name] = { messages: [], unread: 0, color: getRandomColor() };
        }
        
        const msgs = State.contacts[name].messages;
        const lastMsg = msgs[msgs.length - 1];

        // 防重逻辑：内容相同且时间极短(3秒内)则忽略
        // 这是一个简单有效的防抖，防止 DOM 刷新导致重复读取
        if (lastMsg && lastMsg.content === content && lastMsg.type === type) {
            if (Date.now() - (lastMsg.realTime || 0) < 3000) return;
        }

        msgs.push({ 
            type: type, 
            content: content, 
            displayTime: timeStr || "刚刚",
            realTime: Date.now() 
        });

        if (type === 'recv' && State.currentChat !== name) {
            State.contacts[name].unread++;
        }
        
        saveData();
        updateMainBadge();
        
        if (State.isOpen) {
            if (State.currentChat === name) renderChat(name);
            else if (!State.currentChat) renderContactList();
        }
        
        // 每次更新数据时，顺便更新一下 Prompt 里的通讯录
        injectContactsToPrompt();
    }
    
    // === 动态注入：告诉 AI 谁在通讯录里 ===
    function injectContactsToPrompt() {
        // 获取所有好友名字
        const names = Object.keys(State.contacts).join(', ');
        if (!names) return;
        
        // 这是一个高级技巧：我们不改文件，直接挂载到 extension_prompt_types
        // 或者简单粗暴地，我们建议用户在 Author's Note 里留一个占位符
        // 这里演示最简单的：控制台输出，提醒用户
        // 实际上，只要 AI 记得住上下文，它不需要每次都看名单
        // 但为了稳妥，我们可以尝试修改 Author's Note (如果 API 允许)
        // 鉴于稳定性，这里暂不做自动修改 A/N，避免冲突
    }

    function saveData() { 
        // 使用带有 ID 的 Key 进行存储
        if (State.currentContextId) {
            localStorage.setItem(STORAGE_PREFIX + State.currentContextId, JSON.stringify(State.contacts));
        }
    }
    
    function loadData() {
        State.contacts = {}; // 先清空，防止串台
        if (State.currentContextId) {
            const raw = localStorage.getItem(STORAGE_PREFIX + State.currentContextId);
            if(raw) State.contacts = JSON.parse(raw);
        }
        updateMainBadge();
    }
    
    function deleteMessage(contactName, index) {
        if (!State.contacts[contactName]) return;
        State.contacts[contactName].messages.splice(index, 1);
        saveData();
        renderChat(contactName);
        toastr.success("消息已删除");
    }

    // ... (UI 渲染函数：bindEvents, togglePhone, renderContactList, renderChat, renderEmojiPanel, updateMainBadge, getRandomColor) ...
    // 请务必保留这些函数，代码与之前版本一致
    function bindEvents() {
        $('#ow-phone-toggle').click(() => togglePhone(true));
        $('#ow-close-btn').click(() => togglePhone(false));
        $('#ow-back-btn').click(() => { renderContactList(); });
        $('#ow-add-btn').click(() => {
            const name = prompt("添加好友：");
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
            const div = $(`
                <div class="ow-msg-wrapper" style="display:flex; flex-direction:column; align-items:${isMe?'flex-end':'flex-start'};">
                    <div class="ow-msg ${isMe ? 'ow-msg-right' : 'ow-msg-left'}">${msg.content}</div>
                    <div style="font-size:10px; color:#888; margin-top:2px;">${msg.displayTime || ''}</div>
                </div>
            `);
            div.find('.ow-msg').on('contextmenu', (e) => {
                e.preventDefault();
                if(confirm("删除这条消息？")) deleteMessage(name, index);
            });
            view.append(div);
        });
        body.append(view);
        body[0].scrollTop = body[0].scrollHeight;
    }

    function renderEmojiPanel() {
        const panel = $('#ow-emoji-panel');
        panel.empty();
        EMOJI_DB.forEach(item => {
            const img = $(`<img src="${item.url}" class="ow-emoji-item" title="${item.label}">`);
            img.click(() => sendEmoji(item)); 
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

    $(document).ready(() => setTimeout(init, 500));
})();
