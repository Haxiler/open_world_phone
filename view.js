// ==================================================================================
// 模块: View (界面与交互) - v3.2 Input Fallback
// ==================================================================================
(function() {
    if (document.getElementById('st-ios-phone-root')) return;

    // 1. HTML 模板 (修改了 Settings 页结构)
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
                            <button class="nav-btn icon" id="btn-open-settings" title="设置">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>
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

                    <div class="page hidden-right" id="page-settings" style="background-color: #f2f2f7;">
                        <div class="nav-bar ios-nav">
                            <button class="nav-btn back-btn" id="btn-settings-back">
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="#007AFF" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                <span>信息</span>
                            </button>
                            <span class="nav-title">设置</span>
                            <div style="width: 40px;"></div>
                        </div>
                        <div style="padding: 20px 0;">
                            <div class="section-title">存储设置</div>
                            <div style="background: white; border-top: 0.5px solid #c6c6c8; border-bottom: 0.5px solid #c6c6c8; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 16px; color: #000;">存入世界书</span>
                                    <select id="setting-worldbook-select" style="font-size: 15px; color: #007AFF; border: none; background: transparent; outline: none; text-align: right; max-width: 180px;">
                                        <option value="">加载中...</option>
                                    </select>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #efeff4; padding-top: 8px;">
                                    <span style="font-size: 14px; color: #8e8e93;">或手动输入文件名:</span>
                                    <input type="text" id="setting-worldbook-input" placeholder="例如: Phone_History" style="text-align: right; border: none; outline: none; font-size: 14px; color: #333; width: 150px; background: transparent;">
                                </div>
                            </div>
                            <div style="padding: 8px 16px; font-size: 13px; color: #6d6d72;">
                                优先使用下拉选择。如果列表为空，请在下方手动输入文件名（保存时会自动创建）。
                                <br>自动匹配状态：<span id="auto-match-status">检测中...</span>
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

    // 2. 拖拽逻辑 (保持不变)
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

    // 3. 辅助：渲染消息 (保持不变)
    function renderMessageContent(text) {
        const bqbRegex = /\[bqb-(\d+)\]/g; 
        let html = text.replace(bqbRegex, (match, indexStr) => {
            const index = parseInt(indexStr);
            const stickers = window.ST_PHONE.config.stickers || [];
            const sticker = stickers[index]; 
            if (sticker) {
                 return `<img src="${sticker.url}" alt="${sticker.label || indexStr}" class="sticker-img" loading="lazy" />`;
            }
            return ''; 
        });
        const invalidBqbRegex = /\[bqb-([^\]\d]+)\]/g;
        html = html.replace(invalidBqbRegex, '');
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
                const unreadDot = contact.hasUnread ? `<div class="unread-dot-indicator"></div>` : '';
                el.innerHTML = `
                    <div class="info">
                        <div class="name-row">
                            <span class="name">
                                ${contact.name}
                                ${unreadDot}
                            </span>
                            <span class="time">${contact.time}</span>
                        </div>
                        <div class="preview">${contact.lastMsg}</div>
                    </div>
                `;
                el.onclick = () => window.ST_PHONE.ui.openChat(contact);
                container.appendChild(el);
            });
        },
        
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
            
            let lastRenderedTimestamp = 0;
            let lastRenderedDateStr = '';
            const TIME_GAP = 15 * 60 * 1000; 

            contact.messages.forEach((msg, index) => {
                let showTimestamp = false;
                if (index === 0) showTimestamp = true;
                if (msg.dateStr && msg.dateStr !== lastRenderedDateStr) showTimestamp = true;
                if (!showTimestamp && lastRenderedTimestamp > 0 && msg.timestamp > 0) {
                    if (msg.timestamp - lastRenderedTimestamp > TIME_GAP) {
                        showTimestamp = true;
                    }
                }

                if (showTimestamp) {
                    const timeEl = document.createElement('div');
                    timeEl.className = 'chat-timestamp';
                    timeEl.innerText = msg.timeStr; 
                    container.appendChild(timeEl);
                    lastRenderedTimestamp = msg.timestamp;
                    lastRenderedDateStr = msg.dateStr;
                }

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
            if (window.ST_PHONE.state.unreadIds) {
                window.ST_PHONE.state.unreadIds.delete(contact.id);
            }
            window.ST_PHONE.ui.renderContacts();

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
            window.ST_PHONE.ui.renderContacts();
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
                if (container.children.length === 0) {
                    const stickers = window.ST_PHONE.config.stickers || [];
                    stickers.forEach((s, index) => {
                        const img = document.createElement('img');
                        img.src = s.url;
                        img.title = s.label; 
                        img.onclick = () => {
                            const input = document.getElementById('msg-input');
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
        },

        // --- 设置页逻辑 (修复版) ---
        openSettings: async function() {
            const pageContacts = document.getElementById('page-contacts');
            const pageSettings = document.getElementById('page-settings');
            const select = document.getElementById('setting-worldbook-select');
            const input = document.getElementById('setting-worldbook-input');
            const statusSpan = document.getElementById('auto-match-status');

            // 1. 切换页面
            pageContacts.classList.add('hidden-left');
            pageContacts.classList.remove('active');
            pageSettings.classList.remove('hidden-right');
            pageSettings.classList.add('active');

            // 2. 加载世界书列表
            select.innerHTML = '<option value="">加载中...</option>';
            
            let worldBooks = [];
            // 使用我们新的 Omni-Scanner 获取列表
            if (window.ST_PHONE.scribe && window.ST_PHONE.scribe.getWorldBookList) {
                worldBooks = await window.ST_PHONE.scribe.getWorldBookList();
            }

            select.innerHTML = '<option value="">(暂不存储)</option>';
            
            const uniqueBooks = [...new Set(worldBooks)];
            uniqueBooks.forEach(name => {
                if(!name) return;
                const opt = document.createElement('option');
                opt.value = name;
                opt.innerText = name;
                select.appendChild(opt);
            });

            // 3. 回显状态 (优先 input，其次 select)
            let currentSelection = window.ST_PHONE.config.targetWorldBook;

            // 4. 自动匹配逻辑
            let matched = false;
            if (!currentSelection) {
                if (typeof SillyTavern !== 'undefined') {
                    try {
                        const context = SillyTavern.getContext();
                        const charId = context.characterId;
                        if (charId && SillyTavern.characters && SillyTavern.characters[charId]) {
                            const charData = SillyTavern.characters[charId].data;
                            const boundBook = charData.character_book;
                            if (boundBook) {
                                const boundName = (typeof boundBook === 'string') ? boundBook : boundBook.name;
                                if (boundName) {
                                    // 无论列表里有没有，都直接用这个绑定的名字
                                    currentSelection = boundName;
                                    window.ST_PHONE.config.targetWorldBook = currentSelection;
                                    matched = true;
                                    statusSpan.innerText = `已自动绑定: ${currentSelection}`;
                                    statusSpan.style.color = '#007AFF';
                                    
                                    // 保存一次，确保 index.js 里的监听器能拿到
                                    if(localStorage) {
                                        localStorage.setItem('ST_PHONE_PREFS', JSON.stringify({ targetWorldBook: currentSelection }));
                                    }
                                }
                            }
                        }
                    } catch(e) {}
                }
            }

            if (!matched && !currentSelection) {
                statusSpan.innerText = '未检测到角色绑定，请手动选择或输入';
                statusSpan.style.color = '#8e8e93';
            } else if (!matched) {
                 statusSpan.innerText = `当前使用: ${currentSelection}`;
                 statusSpan.style.color = '#007AFF';
            }

            // 5. 设置控件的值
            if (currentSelection) {
                // 如果这个值在列表里，就选下拉框
                if (uniqueBooks.includes(currentSelection)) {
                    select.value = currentSelection;
                    input.value = '';
                } else {
                    // 如果不在列表里，就填输入框
                    select.value = "";
                    input.value = currentSelection;
                }
            }
        },

        closeSettings: function() {
            const pageContacts = document.getElementById('page-contacts');
            const pageSettings = document.getElementById('page-settings');
            
            pageSettings.classList.add('hidden-right');
            pageSettings.classList.remove('active');
            pageContacts.classList.remove('hidden-left');
            pageContacts.classList.add('active');
        },
        
        // 统一保存逻辑：Input 优先
        saveSettings: function() {
            const select = document.getElementById('setting-worldbook-select');
            const input = document.getElementById('setting-worldbook-input');
            
            let val = input.value.trim();
            if (!val) val = select.value;
            
            window.ST_PHONE.config.targetWorldBook = val;
            console.log('📱 ST-iOS-Phone: 存储目标已更新为', val);
            
            // 手动触发 LocalStorage 保存 (因为 index.js 只监听了 select change)
            if(localStorage) {
                localStorage.setItem('ST_PHONE_PREFS', JSON.stringify({ targetWorldBook: val }));
            }
        }
    };

    // 事件绑定
    document.getElementById('st-phone-icon').addEventListener('click', () => {
        const isOpen = window.ST_PHONE.ui.toggleWindow();
        if(isOpen) document.dispatchEvent(new CustomEvent('st-phone-opened'));
    });
    document.getElementById('btn-back').onclick = window.ST_PHONE.ui.closeChat;
    
    // --- 新增：设置页事件绑定 ---
    document.getElementById('btn-open-settings').onclick = window.ST_PHONE.ui.openSettings;
    document.getElementById('btn-settings-back').onclick = window.ST_PHONE.ui.closeSettings;
    
    // 两个输入控件变动都触发保存
    document.getElementById('setting-worldbook-select').addEventListener('change', (e) => {
        document.getElementById('setting-worldbook-input').value = ''; // 清空输入框
        window.ST_PHONE.ui.saveSettings();
    });
    document.getElementById('setting-worldbook-input').addEventListener('input', window.ST_PHONE.ui.saveSettings);

    // 其余逻辑保持不变...
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

    const msgInput = document.getElementById('msg-input');
    if(msgInput) {
        msgInput.addEventListener('keydown', (e) => { 
            e.stopPropagation();
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    return;
                } else {
                    e.preventDefault();
                    if (e.target.value.trim()) {
                        document.getElementById('btn-send').click(); 
                    }
                    e.target.style.height = '36px'; 
                }
            }
        });
        msgInput.addEventListener('input', function() {
            this.style.height = '36px'; 
            this.style.height = (this.scrollHeight) + 'px'; 
        });
    }

})();
