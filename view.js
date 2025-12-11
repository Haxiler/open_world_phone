// ==================================================================================
// 模块: View (界面与交互) - v2.1 Timestamp Logic
// ==================================================================================
(function() {
    if (document.getElementById('st-ios-phone-root')) return;

    // 1. HTML 模板 (保持不变)
    const html = `
    <div id="st-ios-phone-root">
        <div id="st-phone-icon" title="打开/关闭手机">
            <div id="st-notification-dot" class="notification-dot"></div>
            <svg viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>
        </div>
        <div id="st-phone-window">
            <div class="phone-notch-area" id="phone-drag-handle">
                <div id="status-bar-time">12:00</div>
                <div class="phone-notch"></div>
            </div>
            <div class="app-container">
                <div class="pages-wrapper">
                    <div class="page active" id="page-contacts">
                        <div class="nav-bar ios-nav">
                            <div style="width: 40px;"></div>
                            <span class="nav-title">信息</span>
                            <button class="nav-btn icon" id="btn-add-friend" title="新对话">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        </div>
                        <div class="ios-search-bar">
                            <div class="search-input">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="#8e8e93"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <input type="text" id="phone-search-bar" placeholder="搜索">
                            </div>
                        </div>
                        <div class="contact-list" id="contact-list-container"></div>
                    </div>
                    <div class="page hidden-bottom" id="page-new-msg">
                        <div class="nav-bar ios-nav">
                            <button class="nav-btn text-btn" id="btn-cancel-new">取消</button>
                            <span class="nav-title">新信息</span>
                            <button class="nav-btn" style="visibility:hidden; width: 40px"></button>
                        </div>
                        <div class="to-row">
                            <span class="to-label">收件人:</span>
                            <input type="text" id="new-msg-input" placeholder="输入角色名字">
                        </div>
                        <div class="section-title">建议</div>
                        <div class="contact-list" id="new-msg-suggestions"></div>
                    </div>
                    <div class="page hidden-right" id="page-chat">
                        <div class="nav-bar ios-nav-detail">
                            <button class="nav-btn back-btn" id="btn-back">
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="#007AFF" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                <span id="back-text">信息</span>
                            </button>
                            <div class="nav-title-group">
                                <span class="nav-title-small" id="chat-title">用户</span>
                            </div>
                            <button class="nav-btn" style="visibility:hidden; width: 40px"></button>
                        </div>
                        <div class="chat-scroll-area" id="chat-messages-container"></div>
                        <div class="input-area">
                            <div class="plus-btn" id="btn-toggle-stickers">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="#8e8e93"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
                            </div>
                            <textarea class="chat-input" placeholder="iMessage" id="msg-input" rows="1"></textarea>
                            <div class="send-btn" id="btn-send">
                                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                            </div>
                        </div>
                        <div id="sticker-panel" class="sticker-panel hidden">
                            <div class="sticker-grid" id="sticker-grid-container"></div>
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

    // 2. 拖拽逻辑
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            window.ST_PHONE.state.isDragging = false; 
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            window.ST_PHONE.state.isDragging = true;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
    makeDraggable(document.getElementById("st-phone-window"), document.getElementById("phone-drag-handle"));
    makeDraggable(document.getElementById("st-phone-icon"), document.getElementById("st-phone-icon"));

    // 3. 辅助：渲染消息
    function renderMessageContent(text) {
    // 1. 核心逻辑：只匹配 [bqb-数字] 格式
    const bqbRegex = /\[bqb-(\d+)\]/g; 
    
    let html = text.replace(bqbRegex, (match, indexStr) => {
        const index = parseInt(indexStr);
        const stickers = window.ST_PHONE.config.stickers || [];
        
        // 通过数字索引直接取图
        const sticker = stickers[index]; 
        
        if (sticker) {
             // 找到图片：渲染它
             // 这里的 alt 属性依然保留原标签名，方便鼠标悬停时查看含义
             return `<img src="${sticker.url}" alt="${sticker.label || indexStr}" class="sticker-img" loading="lazy" />`;
        }
        
        // 没找到图片（比如索引越界）：返回空字符串，实现“静默失败”
        return ''; 
    });

    // 2. 清理逻辑：清除所有如果不小心生造出来的非数字标签（如 [bqb-哈哈]）
    // 这是一道双重保险
    const invalidBqbRegex = /\[bqb-([^\]\d]+)\]/g;
    html = html.replace(invalidBqbRegex, '');
    
    // 3. 处理 Markdown 图片（保持原样）
    const mdImgRegex = /!\[.*?\]\((.*?)\)/g;
    html = html.replace(mdImgRegex, '<img src="$1" alt="sticker" loading="lazy" />');
    
    return html;
}

    // 4. UI 导出
    window.ST_PHONE.ui = {
        toggleWindow: function() {
            const windowEl = document.getElementById('st-phone-window');
            if (window.ST_PHONE.state.isDragging) {
                window.ST_PHONE.state.isDragging = false;
                return;
            }
            window.ST_PHONE.state.isPhoneOpen = !window.ST_PHONE.state.isPhoneOpen;
            windowEl.style.display = window.ST_PHONE.state.isPhoneOpen ? 'block' : 'none';
            if (window.ST_PHONE.state.isPhoneOpen) this.setNotification(false);
            return window.ST_PHONE.state.isPhoneOpen;
        },

        setNotification: function(active) {
            const dot = document.getElementById('st-notification-dot');
            if (dot) dot.classList.toggle('active', active);
        },

        playNotificationSound: function() {
            if (window.ST_PHONE.path) {
                const audio = new Audio(window.ST_PHONE.path + 'ding.mp3');
                audio.volume = 0.6; 
                audio.play().catch(e => console.log('声音播放被拦截或文件不存在', e));
            }
        },

        updateStatusBarTime: function(timeStr) {
            const el = document.getElementById('status-bar-time');
            if (el && timeStr) el.innerText = timeStr;
        },

        renderContacts: function(contactsOverride = null) {
            const container = document.getElementById('contact-list-container');
            const contacts = contactsOverride || window.ST_PHONE.state.contacts;
            container.innerHTML = '';
            if (contacts.length === 0) {
                container.innerHTML = `<div style="padding-top: 150px; text-align: center; color: #8e8e93;"><div style="font-size: 24px; margin-bottom: 8px;">无结果</div></div>`;
                return;
            }
            contacts.forEach(contact => {
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
                el.onclick = () => window.ST_PHONE.ui.openChat(contact);
                container.appendChild(el);
            });
        },
        
        // 【关键修改】renderChat: 智能滚动 + 智能时间戳
        renderChat: function(contact, forceScroll = false) {
            const container = document.getElementById('chat-messages-container');
            
            const threshold = 60; 
            const currentScrollTop = container.scrollTop;
            const currentScrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const isNearBottom = (currentScrollHeight - currentScrollTop - clientHeight) <= threshold;
            const isFirstLoad = container.children.length === 0;

            container.innerHTML = '';
            container.appendChild(document.createElement('div')).style.height = '10px';
            
            // --- 时间戳状态变量 ---
            let lastRenderedTimestamp = 0;
            let lastRenderedDateStr = '';
            const TIME_GAP = 15 * 60 * 1000; // 15分钟

            contact.messages.forEach((msg, index) => {
                // 1. 判断是否需要插入时间戳
                let showTimestamp = false;
                
                // 规则A: 第一条必显
                if (index === 0) showTimestamp = true;
                
                // 规则B: 跨天必显 (例如 10月23日 -> 10月24日)
                if (msg.dateStr && msg.dateStr !== lastRenderedDateStr) showTimestamp = true;
                
                // 规则C: 间隔 > 15分钟 (且不是跨天，因为跨天已经显了)
                // 只有当两个时间都有效(>0)时才计算间隔
                if (!showTimestamp && lastRenderedTimestamp > 0 && msg.timestamp > 0) {
                    if (msg.timestamp - lastRenderedTimestamp > TIME_GAP) {
                        showTimestamp = true;
                    }
                }

                // 2. 插入时间戳 DOM
                if (showTimestamp) {
                    const timeEl = document.createElement('div');
                    timeEl.className = 'chat-timestamp';
                    timeEl.innerText = msg.timeStr; // 显示完整时间字符串 (如 10月23日 10:30)
                    container.appendChild(timeEl);
                    
                    // 更新状态
                    lastRenderedTimestamp = msg.timestamp;
                    lastRenderedDateStr = msg.dateStr;
                }

                // 3. 插入消息气泡
                const el = document.createElement('div');
                el.className = `message-bubble ${msg.sender === 'user' ? 'sent' : 'received'} ${msg.isPending ? 'pending' : ''}`;
                el.innerHTML = renderMessageContent(msg.text);
                container.appendChild(el);
            });

            setTimeout(() => {
                const newHeight = container.scrollHeight;
                if (forceScroll || isNearBottom || isFirstLoad) {
                    container.scrollTop = newHeight;
                } else {
                    container.scrollTop = currentScrollTop;
                }
            }, 0);
        },

        openChat: function(contact) {
            window.ST_PHONE.state.activeContactId = contact.id;
            document.getElementById('chat-title').innerText = contact.name;
            window.ST_PHONE.ui.renderChat(contact, true);
            document.getElementById('sticker-panel').classList.add('hidden');
            document.getElementById('page-contacts').classList.add('hidden-left');
            document.getElementById('page-contacts').classList.remove('active');
            document.getElementById('page-chat').classList.remove('hidden-right');
            document.getElementById('page-chat').classList.add('active');
        },
        closeChat: function() {
            window.ST_PHONE.state.activeContactId = null;
            document.getElementById('page-contacts').classList.remove('hidden-left');
            document.getElementById('page-contacts').classList.add('active');
            document.getElementById('page-chat').classList.add('hidden-right');
            document.getElementById('page-chat').classList.remove('active');
        },
        toggleNewMsgSheet: function(show) {
            const sheet = document.getElementById('page-new-msg');
            const input = document.getElementById('new-msg-input');
            const suggestions = document.getElementById('new-msg-suggestions');
            if (show) {
                sheet.classList.add('modal-active');
                sheet.classList.remove('hidden-bottom');
                input.value = '';
                input.focus();
                suggestions.innerHTML = '';
                window.ST_PHONE.state.contacts.forEach(contact => {
                     const el = document.createElement('div');
                    el.className = 'contact-item';
                    el.innerHTML = `<div class="info"><div class="name-row"><span class="name">${contact.name}</span></div></div>`;
                    el.onclick = () => {
                        window.ST_PHONE.ui.toggleNewMsgSheet(false);
                        window.ST_PHONE.ui.openChat(contact);
                    };
                    suggestions.appendChild(el);
                });
            } else {
                sheet.classList.remove('modal-active');
                sheet.classList.add('hidden-bottom');
            }
        },
        openChatByName: function(name) {
            let contact = window.ST_PHONE.state.contacts.find(c => c.name === name);
            if (!contact) {
                contact = { id: name, name: name, lastMsg: '', time: '', messages: [] };
                window.ST_PHONE.state.contacts.push(contact);
            }
            window.ST_PHONE.ui.toggleNewMsgSheet(false);
            window.ST_PHONE.ui.openChat(contact);
        },
        toggleStickerPanel: function() {
            const panel = document.getElementById('sticker-panel');
            const container = document.getElementById('sticker-grid-container');
            const isHidden = panel.classList.contains('hidden');
            
            if (isHidden) {
                // 如果是第一次打开，生成表情网格
                if (container.children.length === 0) {
                    const stickers = window.ST_PHONE.config.stickers || [];
                    
                    // 【关键修改点 1】forEach 中加入 index 参数
                    stickers.forEach((s, index) => {
                        const img = document.createElement('img');
                        img.src = s.url;
                        img.title = s.label; // 鼠标悬停依然显示中文含义
                        
                        img.onclick = () => {
                            const input = document.getElementById('msg-input');
                            // 【关键修改点 2】发送时填入 [bqb-数字] 而不是 [bqb-中文]
                            input.value = `[bqb-${index}]`; 
                            document.getElementById('btn-send').click();
                            panel.classList.add('hidden');
                        };
                        container.appendChild(img);
                    });
                }
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        }
    };

    document.getElementById('st-phone-icon').addEventListener('click', () => {
        const isOpen = window.ST_PHONE.ui.toggleWindow();
        if(isOpen) document.dispatchEvent(new CustomEvent('st-phone-opened'));
    });
    document.getElementById('btn-back').onclick = window.ST_PHONE.ui.closeChat;
    document.getElementById('phone-search-bar').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const allContacts = window.ST_PHONE.state.contacts;
        if (!query) {
            window.ST_PHONE.ui.renderContacts(null);
            return;
        }
        const filtered = allContacts.filter(c => {
            const matchName = c.name.toLowerCase().includes(query);
            const matchMsg = c.messages.some(m => m.text.toLowerCase().includes(query));
            return matchName || matchMsg;
        });
        window.ST_PHONE.ui.renderContacts(filtered);
    });
    document.getElementById('btn-add-friend').onclick = () => window.ST_PHONE.ui.toggleNewMsgSheet(true);
    document.getElementById('btn-cancel-new').onclick = () => window.ST_PHONE.ui.toggleNewMsgSheet(false);
    document.getElementById('new-msg-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            window.ST_PHONE.ui.openChatByName(e.target.value.trim());
        }
    });
    document.getElementById('btn-toggle-stickers').onclick = window.ST_PHONE.ui.toggleStickerPanel;
})();
