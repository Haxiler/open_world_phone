// ==================================================================================
// 脚本名称: ST-iOS-Phone Loader (v3.0 Robust)
// ==================================================================================
var scriptTag = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src;
        if (src && (src.includes('st-ios-phone') || src.includes('iOS')) && src.endsWith('index.js')) {
            return scripts[i];
        }
    }
    return null;
})();

(async function () {
    if (!scriptTag) return;

    const fullUrl = scriptTag.src;
    const EXTENSION_PATH = fullUrl.substring(0, fullUrl.lastIndexOf('/') + 1);
    
    // 1. 初始化全局命名空间 (防止后续模块报错)
    window.ST_PHONE = window.ST_PHONE || {
        state: {
            contacts: [],
            activeContactId: null,
            isPhoneOpen: false,
            isDragging: false,
            unreadIds: new Set(),
            pendingQueue: []
        },
        ui: {},     
        config: {}, 
        scribe: {}, // 预留位置
        path: EXTENSION_PATH 
    };

    // 辅助：可靠的脚本加载器
    function loadScript(filename) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // 添加时间戳防止缓存旧代码
            script.src = EXTENSION_PATH + filename + '?v=' + Date.now();
            script.onload = () => {
                console.log(`📱 [Loader] ${filename} loaded.`);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load ${filename}`));
            document.head.appendChild(script);
        });
    }

    try {
        console.log('📱 ST-iOS-Phone: 开始加载模块 (v3.0)...');

        // 2. 严格按依赖顺序加载
        // Config (配置) -> View (界面 DOM) -> Core (核心逻辑) -> Scribe (数据同步)
        await loadScript("config.js");
        
        // 读取本地偏好 (保留原版逻辑)
        try {
            const savedPrefsStr = localStorage.getItem('ST_PHONE_PREFS');
            if (savedPrefsStr) {
                const savedPrefs = JSON.parse(savedPrefsStr);
                Object.assign(window.ST_PHONE.config, savedPrefs);
            }
        } catch (e) { console.error(e); }

        await loadScript("view.js");
        await loadScript("core.js"); 
        await loadScript("scribe.js");

        // 3. 挂载设置页的自动保存监听器 (View 加载后 DOM 才存在)
        const settingSelect = document.getElementById('setting-worldbook-select');
        if (settingSelect) {
            settingSelect.addEventListener('change', (e) => {
                const newPref = { targetWorldBook: e.target.value };
                if (window.ST_PHONE.config) {
                    window.ST_PHONE.config.targetWorldBook = e.target.value;
                }
                localStorage.setItem('ST_PHONE_PREFS', JSON.stringify(newPref));
            });
        }
        
        // 4. 触发一个自定义事件，告诉其他模块“我好了”
        document.dispatchEvent(new Event('st-phone-ready'));
        console.log('📱 ST-iOS-Phone: 所有系统启动完成！');

    } catch (err) {
        console.error('📱 ST-iOS-Phone: 启动失败', err);
        alert('ST手机插件加载失败，请检查控制台(F12)');
    }
})();
