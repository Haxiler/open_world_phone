// ==================================================================================
// 脚本名称: ST-iOS-Phone Loader (入口文件)
// 作用: 负责按顺序加载各模块，防止单文件过大
// ==================================================================================

(async function () {
    // 1. 基础配置
    const EXTENSION_NAME = "st-ios-phone"; // 必须与文件夹名/manifest name一致
    const EXTENSION_PATH = `/scripts/extensions/${EXTENSION_NAME}/`;
    
    // 2. 模块列表 (注意加载顺序：配置 -> 界面 -> 逻辑)
    const modules = [
        "config.js",  // 表情包、静态数据
        "view.js",    // HTML渲染、UI操作
        "core.js"     // 核心业务逻辑、事件监听
    ];

    console.log(`📱 ST-iOS-Phone: 开始加载模块...`);

    // 3. 加载函数
    function loadScript(filename) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = EXTENSION_PATH + filename + '?v=' + Date.now(); // 加个时间戳防缓存
            script.onload = () => {
                console.log(`   ✅ 模块加载: ${filename}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`   ❌ 模块失败: ${filename}`);
                reject();
            };
            document.head.appendChild(script);
        });
    }

    // 4. 按顺序执行加载
    try {
        // 先建立一个全局命名空间，方便各文件通信
        window.ST_PHONE = window.ST_PHONE || {
            state: {},
            ui: {},
            config: {}
        };

        for (const file of modules) {
            await loadScript(file);
        }
        
        console.log('📱 ST-iOS-Phone: 所有模块加载完毕，系统启动！');
        
        // 5. 如果核心加载完了，手动触发一次初始化 (假设 core.js 里有个 init 函数)
        if (window.ST_PHONE.init) {
            window.ST_PHONE.init();
        }

    } catch (err) {
        console.error('📱 ST-iOS-Phone: 启动失败', err);
    }
})();
