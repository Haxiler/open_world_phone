// ==================================================================================
// 脚本名称: ST-iOS-Phone Loader (入口文件)
// 作用: 按顺序加载模块，不包含业务逻辑
// ==================================================================================

(async function () {
    const EXTENSION_NAME = "st-ios-phone"; 
    const EXTENSION_PATH = `/scripts/extensions/${EXTENSION_NAME}/`;
    
    // 模块列表 (顺序很重要：先配置，再界面，最后逻辑)
    const modules = [
        "config.js",
        "view.js",
        "core.js"
    ];

    console.log('📱 ST-iOS-Phone: 正在加载模块...');

    // 初始化全局命名空间，用于模块间通信
    window.ST_PHONE = window.ST_PHONE || {
        state: {
            contacts: [],
            activeContactId: null,
            isPhoneOpen: false,
            isDragging: false // 拖拽状态放到全局，方便 view 和 core 共享
        },
        ui: {},     // 存放 view.js 导出的函数
        config: {}  // 存放 config.js 的配置
    };

    function loadScript(filename) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = EXTENSION_PATH + filename + '?v=' + Date.now();
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    try {
        for (const file of modules) {
            await loadScript(file);
        }
        console.log('📱 ST-iOS-Phone: 启动成功 (模块化重构版)');
    } catch (err) {
        console.error('📱 ST-iOS-Phone: 模块加载失败', err);
    }
})();
