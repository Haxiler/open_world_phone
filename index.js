(function () {
    const STORAGE_PREFIX = "ow_phone_v3_";
    let EMOJI_DB = []; 
    let lastProcessedContent = "";
    
    // --- 调试日志工具 ---
    function debugLog(step, message, data = null) {
        const time = new Date().toLocaleTimeString();
        console.log(`%c[${time}] [OW调试-步骤${step}] ${message}`, "color: #ff00ff; font-weight: bold;", data || "");
    }

    const State = {
        contacts: {}, 
        currentChat: null,
        isOpen: false,
        isDragging: false,
        userName: "User",
        currentChatFileId: null,
    };

    // --- 辅助函数 (前置定义，防止 ReferenceError) ---
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

    function saveData() { 
        if (State.currentChatFileId) {
            localStorage.setItem(STORAGE_PREFIX + State.currentChatFileId, JSON.stringify(State.contacts));
        }
    }

    function checkIsUser(name) {
        return (name === State.userName || name === '我' || name.toLowerCase() === 'user' || name === 'User' || name === '{{user}}');
    }

    // --- 主初始化流程 ---
// --- 辅助函数 (保持不变，确保它们定义在 init 之前或之后) ---
    // ... (updateMainBadge, getRandomColor, saveData, checkIsUser 等函数应保留在 init 之外) ...
    
    // --- 主初始化流程 (最终修复版) ---
    function init() {
        debugLog(0, "插件正在初始化...");
        
        // 尝试加载表情包
        $.getJSON('/extensions/open_world_phone/emojis.json', function(data) {
            debugLog(0.5, "表情包加载成功");
            EMOJI_DB = data;
            if ($('#ow-emoji-panel').is(':visible')) renderEmojiPanel();
        }).fail(function() {
             console.error("【严重】找不到表情包文件！请确认文件夹名为 open_world_phone");
        });

        updateContextInfo();
        
        // 注入 UI (保持不变)
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
            bindEvents();
        }

        // 核心修复：使用 Baibai 的多事件监听策略 (假设 getChatMessages/eventOn 可用)
        // 这些事件确保在任何可能改变聊天内容的情况下，都触发消息检查。
        if (window.eventOn && window.tavern_events && window.getChatMessages) {
            debugLog(1, "挂载柏柏式多事件监听器...");
            
            // 消息渲染完成 (NPC消息进入 DOM 的最佳时机)
            eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, () => {
                debugLog(2, "收到 'CHARACTER_MESSAGE_RENDERED' 事件");
                setTimeout(checkLatestMessage, 50); // 微延迟，确保 context 已更新
            });
            
            // 消息生成完成 (用户点击发送/AI开始或结束生成)
            eventOn(tavern_events.GENERATION_ENDED, () => {
                debugLog(2, "收到 'GENERATION_ENDED' 事件");
                setTimeout(checkLatestMessage, 50); // 微延迟，确保 context 已更新
            });
            
            // 消息更新 (用户编辑/删除/重发)
            eventOn(tavern_events.MESSAGE_UPDATED, () => {
                debugLog(2, "收到 'MESSAGE_UPDATED' 事件");
                // 消息更新可能发生在历史记录中，所以需要重新扫描
                reprocessAllMessages();
            });
            
            // 聊天切换/存档改变
            eventOn(tavern_events.CHAT_CHANGED, () => {
                debugLog(2, "收到 'CHAT_CHANGED' 事件");
                reprocessAllMessages();
            });

        } else {
            console.warn("【警告】未检测到 eventOn/tavern_events API。手机自动接收消息功能可能无法工作。");
            // 降级使用 V4.0 的旧逻辑，并希望有效（但已知这很可能失败）
            if (window.eventSource) {
                 window.eventSource.on('generation_ended', function() {
                    debugLog(2, "退回到旧的 'generation_ended' 监听");
                    setTimeout(checkLatestMessage, 500);
                });
            }
        }
        
        // 第一次加载时主动扫描一次
        reprocessAllMessages();
    }

    // --- 新增辅助函数：重新处理所有消息 ---
    async function reprocessAllMessages() {
        debugLog(7, "重新扫描所有消息");
        // 这里需要更精细地扫描所有消息，而不是只看最后一条。
        // 但为了最小改动，我们只触发一次最新的消息检查。
        // Baibai 的 Vo() 函数是重新加载并解析所有楼层，那是终极方案。
        // 我们先保证最新的能收到。
        checkLatestMessage();
    }

    // --- 修正后的 checkLatestMessage 函数 (确保它能读到原始数据) ---
    function checkLatestMessage() {
        if (!window.SillyTavern || !window.SillyTavern.getContext) return;
        const context = window.SillyTavern.getContext();
        const chat = context.chat;
        
        if (chat && chat.length > 0) {
            const lastMsg = chat[chat.length - 1];
            // 确保获取的是原始消息体 (.mes)，它不会被“格式显示”的正则修改
            const rawContent = lastMsg.mes; 
            
            if (rawContent === lastProcessedContent) return;
            lastProcessedContent = rawContent;
            
            debugLog(3, "检查最新消息内容", rawContent);

            if (rawContent.includes('<msg>')) {
                debugLog(4, "发现手机指令，开始解析");
                parseCommand(rawContent);
            }
        }
    }
    
    // ... (其他函数保持不变) ...

    // --- 核心消息读取逻辑 ---
    function checkLatestMessage() {
        if (!window.SillyTavern || !window.SillyTavern.getContext) return;
        
        const context = window.SillyTavern.getContext();
        const chat = context.chat;
        
        if (chat && chat.length > 0) {
            const lastMsg = chat[chat.length - 1];
            const rawContent = lastMsg.mes; // 获取原始文本，无视正则隐藏
            
            if (rawContent === lastProcessedContent) return;
            lastProcessedContent = rawContent;
            
            debugLog(3, "检查最新消息内容", rawContent);

            if (rawContent.includes('<msg>')) {
                debugLog(4, "发现手机指令，开始解析");
                parseCommand(rawContent);
            }
        }
    }

    function parseCommand(text) {
        if (!text) return;
        const decodedText = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        const msgRegex = /<msg>(.+?)\|(.+?)\|(.+?)\|(.+?)<\/msg>/g;
        let match;
        
        while ((match = msgRegex.exec(decodedText)) !== null) {
            let sender = match[1].trim();
            let receiver = match[2].trim();
            let content = match[3].trim();
            let timeStr = match[4].trim();

            debugLog(5, `解析成功: ${sender} -> ${receiver}`);

            if (sender.toLowerCase() === 'system' && content.startsWith('ADD:')) {
                const newContactName = content.replace('ADD:', '').trim();
                if (!State.contacts[newContactName]) {
                    State.contacts[newContactName] = { messages: [], unread: 0, color: getRandomColor() };
                }
                saveData();
                if(State.isOpen && !State.currentChat) renderContactList();
                continue;
            }

            const isSenderUser = checkIsUser(sender);
            const isReceiverUser = checkIsUser(receiver);
            content = parseEmojiContent(content);

            if (!isSenderUser && isReceiverUser) {
                if (!State.contacts[sender]) {
                    State.contacts[sender] = { messages: [], unread: 0, color: getRandomColor() };
                    saveData();
                }
                addMessageLocal(sender, content, 'recv', timeStr);
            }
            else if (isSenderUser && !isReceiverUser) {
                if (!State.contacts[receiver]) {
                    State.contacts[receiver] = { messages: [], unread: 0, color: getRandomColor() };
                    saveData();
                }
                addMessageLocal(receiver, content, 'sent', timeStr);
            }
        }
    }

    function addMessageLocal(name, content, type, timeStr) {
        if (!State.contacts[name]) {
            State.contacts[name] = { messages: [], unread: 0, color: getRandomColor() };
        }
        const msgs = State.contacts[name].messages;
        const lastMsg = msgs[msgs.length - 1];
        
        // 简单防抖
        if (lastMsg && lastMsg.content === content && lastMsg.type === type) {
            if (Date.now() - (lastMsg.realTime || 0) < 3000) return;
        }
        
        msgs.push({ type, content, displayTime: timeStr || "刚刚", realTime: Date.now() });
        if (type === 'recv' && State.currentChat !== name) State.contacts[name].unread++;
        
        saveData();
        updateMainBadge(); // 这里不会再报错了
        if (State.isOpen) {
            if (State.currentChat === name) renderChat(name);
            else if (!State.currentChat) renderContactList();
        }
    }

    // --- UI 渲染与交互 ---
    function updateContextInfo() {
        if (!window.SillyTavern || !window.SillyTavern.getContext) return;
        const context = window.SillyTavern.getContext();
        if (context.name) State.userName = context.name;
        else if (context.user_name) State.userName = context.user_name;

        const newFileId = context.chatId || context.characterId;
        if (newFileId && newFileId !== State.currentChatFileId) {
            State.currentChatFileId = newFileId;
            State.contacts = {}; 
            loadData(); 
            renderContactList();
        }
    }

    function loadData() {
        State.contacts = {}; 
        if (State.currentChatFileId) {
            const raw = localStorage.getItem(STORAGE_PREFIX + State.currentChatFileId);
            if(raw) {
                try { State.contacts = JSON.parse(raw); } catch(e) {}
            }
        }
        updateMainBadge();
    }

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
        let view = body.find(`.ow-chat-view[data-chat-id="${name}"]`);
        const msgs = State.contacts[name]?.messages || [];
        
        if (view.length === 0) {
            body.empty();
            view = $(`<div class="ow-chat-view" data-chat-id="${name}"></div>`);
            body.append(view);
            msgs.forEach((msg, index) => {
                appendMsgToView(view, msg, name, index);
            });
            body[0].scrollTop = body[0].scrollHeight;
        } else {
            const currentCount = view.children().length;
            const targetCount = msgs.length;
            if (targetCount > currentCount) {
                for (let i = currentCount; i < targetCount; i++) { appendMsgToView(view, msgs[i], name, i); }
                body.animate({ scrollTop: body[0].scrollHeight }, 300);
            } else if (targetCount < currentCount) {
                body.empty();
                renderChat(name); 
                return;
            }
        }
    }

    function appendMsgToView(viewContainer, msg, contactName, index) {
        const isMe = msg.type === 'sent';
        const div = $(`
            <div class="ow-msg-wrapper" style="display:flex; flex-direction:column; align-items:${isMe?'flex-end':'flex-start'};">
                <div class="ow-msg ${isMe ? 'ow-msg-right' : 'ow-msg-left'}">${msg.content}</div>
                <div style="font-size:10px; color:#888; margin-top:2px;">${msg.displayTime || ''}</div>
            </div>
        `);
        div.find('.ow-msg').on('contextmenu', (e) => {
            e.preventDefault();
            if(confirm("删除这条消息？")) deleteMessage(contactName, index);
        });
        viewContainer.append(div);
    }

    function parseEmojiContent(text) {
        const bqbMatch = text.match(/\[(?:bqb-|表情:)\s*(.+?)\]/);
        if (bqbMatch) {
            const label = bqbMatch[1].trim();
            const found = EMOJI_DB.find(e => e.label === label);
            if (found) return `<img src="${found.url}" class="ow-msg-img">`;
            return `[表情: ${label}]`;
        }
        return text;
    }

    function handleUserSend() {
        const input = document.getElementById('ow-input');
        const text = input.value.trim();
        const target = State.currentChat; 
        if (!text || !target) return;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        addMessageLocal(target, text, 'sent', timeStr);
        input.value = '';
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

    $(document).ready(() => setTimeout(init, 500));
})();
