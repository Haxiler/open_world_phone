// 简单的状态管理
const PHONE_STATE = {
    contacts: {}, // 存储格式: { "角色名": [{sender: "角色名", content: "内容", type: "recv"}] }
    currentChat: null,
    isVisible: false,
    unreadCount: 0
};

// 1. 初始化界面
function initPhoneUI() {
    // 注入主HTML结构
    const html = `
    <div id="ow-phone-toggle" title="打开手机">
        📱<span id="ow-main-badge" class="ow-badge" style="display:none">0</span>
    </div>
    <div id="ow-phone-container" style="display:none">
        <div id="ow-phone-header">
            <span id="ow-header-title">通讯录</span>
            <span id="ow-close-btn" style="cursor:pointer">✖</span>
        </div>
        <div id="ow-phone-body"></div>
        <div id="ow-input-area" style="display:none">
            <input id="ow-input" placeholder="发送讯息..." autocomplete="off">
            <button id="ow-send-btn">发送</button>
        </div>
    </div>
    `;
    $('body').append(html);

    // 绑定事件：拖动
    $("#ow-phone-container").draggable({ handle: "#ow-phone-header" });

    // 绑定事件：显隐
    $('#ow-phone-toggle').click(() => togglePhone(true));
    $('#ow-close-btn').click(() => togglePhone(false));

    // 绑定事件：返回通讯录
    $('#ow-header-title').click(() => renderContactList());

    // 绑定事件：发送消息
    $('#ow-send-btn').click(handleUserSend);
    $('#ow-input').keypress((e) => { if(e.which == 13) handleUserSend(); });

    // 加载历史数据
    loadPhoneData();
}

// 2. 核心逻辑：解析AI消息 (Hook)
function parseIncomingMessage(text) {
    // 匹配格式：[SMS: 角色名 | 内容]
    const regex = /\[SMS:\s*(.+?)\s*\|\s*(.+?)\]/g;
    let match;
    let hasNewMsg = false;

    while ((match = regex.exec(text)) !== null) {
        const sender = match[1].trim();
        const content = match[2].trim();
        
        // 自动添加好友 & 存储消息
        addMessage(sender, content, 'recv');
        hasNewMsg = true;
    }

    if (hasNewMsg) {
        playSound();
        updateBadge();
        // 如果当前正好开着这个人的聊天框，刷新它
        if (PHONE_STATE.isVisible && PHONE_STATE.currentChat) {
            renderChatWindow(PHONE_STATE.currentChat);
        } else if (PHONE_STATE.isVisible) {
            renderContactList(); // 刷新通讯录看红点
        }
    }
}

// 3. 数据处理：添加消息
function addMessage(contactName, content, type) {
    if (!PHONE_STATE.contacts[contactName]) {
        PHONE_STATE.contacts[contactName] = { messages: [], unread: 0 };
        toastr.success(`📱 新联系人添加: ${contactName}`); // 系统通知
    }
    
    PHONE_STATE.contacts[contactName].messages.push({
        sender: type === 'recv' ? contactName : '我',
        content: content,
        type: type
    });

    if (type === 'recv' && PHONE_STATE.currentChat !== contactName) {
        PHONE_STATE.contacts[contactName].unread++;
        PHONE_STATE.unreadCount++;
    }
    
    savePhoneData();
}

// 4. 用户发送消息 (Inject Logic)
async function handleUserSend() {
    const content = $('#ow-input').val();
    const target = PHONE_STATE.currentChat;
    if (!content || !target) return;

    // 1. UI上显示
    addMessage(target, content, 'sent');
    $('#ow-input').val('');
    renderChatWindow(target);

    // 2. 【关键】注入到酒馆的聊天流中
    // 我们构造一个系统指令，假装是环境描写，告诉AI用户发短信了
    const systemPrompt = `\n[System: {{user}} just sent a text message to ${target}: "${content}". ${target} should reply via SMS format if they see it.]\n`;
    
    // 调用酒馆API发送（这里使用一种通用的注入方式，或者直接追加到输入框如果用户希望）
    // 为了更无缝，我们直接作为"User Message"发送，但带上特定Wrapper
    // 或者，更高级的做法是使用 '/send' 命令触发
    
    const textarea = document.getElementById('send_textarea');
    if (textarea) {
        const originalText = textarea.value;
        // 强制触发一次生成，告诉AI我发消息了
        // 注意：这里我们让AI知道发生了什么，但不强迫AI立刻描写场景，而是让它在后台处理
        const injection = `[短信发送给 ${target}: "${content}"]`;
        
        // 简单粗暴法：直接填入输入框并发送（你可以改为静默注入context）
        textarea.value = injection;
        // 触发发送按钮点击
        document.getElementById('send_but').click(); 
    }
}

// 5. 渲染：通讯录
function renderContactList() {
    PHONE_STATE.currentChat = null;
    $('#ow-header-title').text("通讯录 (点击进入)");
    $('#ow-input-area').hide();
    const list = $('#ow-phone-body');
    list.empty();

    Object.keys(PHONE_STATE.contacts).forEach(name => {
        const info = PHONE_STATE.contacts[name];
        const unreadBadge = info.unread > 0 ? `<span style="color:red;margin-left:5px">(${info.unread})</span>` : '';
        const item = $(`<div class="ow-contact-item"><span>${name}${unreadBadge}</span><span>></span></div>`);
        item.click(() => renderChatWindow(name));
        list.append(item);
    });
}

// 6. 渲染：聊天窗口
function renderChatWindow(name) {
    PHONE_STATE.currentChat = name;
    // 清除未读
    const diff = PHONE_STATE.contacts[name].unread;
    PHONE_STATE.unreadCount -= diff;
    PHONE_STATE.contacts[name].unread = 0;
    updateBadge();

    $('#ow-header-title').html(`<span style="color:#aaa"><</span> ${name}`);
    $('#ow-input-area').show();
    
    const list = $('#ow-phone-body');
    list.empty();
    
    // 构建消息流
    const msgs = PHONE_STATE.contacts[name].messages;
    msgs.forEach(msg => {
        const div = $(`<div class="ow-msg ${msg.type === 'recv' ? 'ow-msg-left' : 'ow-msg-right'}">${msg.content}</div>`);
        list.append(div);
    });
    
    // 滚动到底部
    list.scrollTop(list[0].scrollHeight);
}

// 辅助功能
function togglePhone(show) {
    PHONE_STATE.isVisible = show;
    if (show) {
        $('#ow-phone-container').fadeIn(200);
        $('#ow-phone-toggle').fadeOut(200);
        if(!PHONE_STATE.currentChat) renderContactList();
    } else {
        $('#ow-phone-container').fadeOut(200);
        $('#ow-phone-toggle').fadeIn(200);
    }
}

function updateBadge() {
    const badge = $('#ow-main-badge');
    if (PHONE_STATE.unreadCount > 0) {
        badge.text(PHONE_STATE.unreadCount).show();
    } else {
        badge.hide();
    }
}

function playSound() {
    // 尝试播放同目录下的 notify.mp3
    const audio = new Audio('/scripts/extensions/open_world_phone/notify.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('声音播放失败，可能需要交互', e));
}

// 数据持久化 (保存到 extension_settings)
function savePhoneData() {
    if (window.extensionsAPI) {
        // 酒馆的标准扩展API
        // extensionsAPI.settings.save('open_world_phone', PHONE_STATE.contacts);
        // 为了简单演示，这里先存 localStorage，生产环境建议用 extensionsAPI
        localStorage.setItem('ow_phone_data', JSON.stringify(PHONE_STATE.contacts));
    }
}

function loadPhoneData() {
    const data = localStorage.getItem('ow_phone_data');
    if (data) {
        PHONE_STATE.contacts = JSON.parse(data);
        // 重新计算未读
        let count = 0;
        Object.values(PHONE_STATE.contacts).forEach(c => count += c.unread || 0);
        PHONE_STATE.unreadCount = count;
        updateBadge();
    }
}

// === 入口 ===
jQuery(document).ready(function () {
    initPhoneUI();

    // 监听酒馆的消息接收事件
    // 注意：SillyTavern 的事件系统通常是通过 eventSource 或 mutationObserver
    // 这里使用最通用的 extensionAPI 如果可用，或者监听 socket
    
    // 这是一个简化的 Hook，实际在酒馆里建议使用 extensionAPI.event.on('message_received', ...)
    // 为了确保你能用，我们用一个更底层的 MutationObserver 监听聊天区域的变化
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                $(mutation.addedNodes).each(function() {
                    // 检查是否是新消息 div
                    if ($(this).hasClass('mes')) { 
                        const text = $(this).find('.mes_text').text();
                        // 1. 解析消息
                        parseIncomingMessage(text);
                        // 2. 可选：隐藏掉消息里的 [SMS] 标签，保持界面整洁
                        // (这需要更复杂的DOM操作，暂时略过，为了完美可以加)
                    }
                });
            }
        });
    });

    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        observer.observe(chatContainer, { childList: true, subtree: true });
    }
});
