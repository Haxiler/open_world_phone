// ==================================================================================
// 模块: Config & Data (配置与数据)
// ==================================================================================

(function() {
    // 确保命名空间存在
    window.ST_PHONE = window.ST_PHONE || {};

    // 表情包库 (外挂在这里)
    const stickerLibrary = [
        { id: 's1', name: '滑稽', url: 'http://img.../huaji.png' },
        { id: 's2', name: '点赞', url: 'http://img.../like.png' },
        // ... 以后在这里无限加 ...
    ];

    // 导出到全局
    window.ST_PHONE.config = {
        stickers: stickerLibrary,
        defaultUser: 'User',
        themeColor: '#007AFF'
    };

    console.log('   -> Config 模块就绪');
})();
