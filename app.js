// 漫画ビューワ - メインアプリケーション
class MangaViewer {
    constructor() {
        // 画像ファイルのリスト（001.png～006.png）
        this.images = ['001.png', '002.png', '003.png', '004.png', '005.png', '006.png'];
        this.currentPage = 0;
        this.viewMode = 'single'; // 'single' or 'spread'
        this.isDarkMode = false;
        this.zoom = 1.0;
        this.zoomMin = 0.5;
        this.zoomMax = 3.0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.panOffset = { x: 0, y: 0 };
        this.animationSpeed = 0.3;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 3000;
        
        // タッチ操作用
        this.touchStart = { x: 0, y: 0 };
        this.touchStartDistance = 0;
        this.initialZoom = 1.0;
        this.touchHandled = false; // タッチイベントが処理されたかどうか
        
        // コントロールパネル状態管理
        this.isControlPanelMinimized = false;
        this.isControlPanelExpanded = false;
        
        this.init();
    }
    
    init() {
        this.detectBrowser(); // ブラウザ判定
        this.loadSettings();
        this.setupDOM();
        this.setViewportHeight(); // 動的にビューポート高さを設定
        this.loadBookmark();
        this.displayPage();
        this.setupEventListeners();
        this.generateThumbnails();
    }
    
    detectBrowser() {
        // ブラウザ判定してbody要素にクラスを追加
        // iPhone ChromeはCriOS、Android ChromeはChromeというUser Agent文字列を使う
        const isChrome = (/Chrome|CriOS/.test(navigator.userAgent)) && !/Line/.test(navigator.userAgent);
        const isLine = /Line/.test(navigator.userAgent);
        
        if (isChrome) {
            document.body.classList.add('is-chrome');
            
            // Chrome専用：JavaScriptで直接スタイルを適用
            setTimeout(() => {
                const viewer = document.getElementById('viewer');
                if (viewer && this.isMobile()) {
                    viewer.style.setProperty('align-items', 'flex-start', 'important');
                    viewer.style.setProperty('padding-top', '140px', 'important');
                }
            }, 100);
        }
        
        if (isLine) {
            document.body.classList.add('is-line');
        }
    }
    
    setViewportHeight() {
        // visualViewport APIを使って正確な表示領域を取得
        const updateViewport = () => {
            if (window.visualViewport) {
                // visualViewport: ブラウザUIを除いた実際の表示領域
                const vh = window.visualViewport.height * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                // ブラウザ判定
                const isChrome = /Chrome/.test(navigator.userAgent) && !/Line/.test(navigator.userAgent);
                const isLine = /Line/.test(navigator.userAgent);
                
                // Chrome専用の調整（offsetTopを考慮）
                if (isChrome && window.visualViewport.offsetTop > 0) {
                    const adjustedHeight = window.visualViewport.height - window.visualViewport.offsetTop;
                    const adjustedVh = adjustedHeight * 0.01;
                    document.documentElement.style.setProperty('--vh', `${adjustedVh}px`);
                    console.log('[Chrome] visualViewport.offsetTop:', window.visualViewport.offsetTop);
                    console.log('[Chrome] adjusted height:', adjustedHeight);
                }
                
                // デバッグ用ログ
                console.log('=== Viewport Debug ===');
                console.log('Browser:', isChrome ? 'Chrome' : isLine ? 'LINE' : 'Other');
                console.log('visualViewport.height:', window.visualViewport.height);
                console.log('visualViewport.offsetTop:', window.visualViewport.offsetTop);
                console.log('visualViewport.offsetLeft:', window.visualViewport.offsetLeft);
                console.log('window.innerHeight:', window.innerHeight);
                console.log('--vh value:', document.documentElement.style.getPropertyValue('--vh'));
                console.log('====================');
            } else {
                // フォールバック
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
            }
        };
        
        updateViewport();
        
        // リサイズとスクロール時にも更新（URLバーの表示/非表示に対応）
        window.addEventListener('resize', updateViewport);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateViewport);
            window.visualViewport.addEventListener('scroll', updateViewport);
        }
    }
    
    setupDOM() {
        this.pageContainer = document.getElementById('page-container');
        this.progressBar = document.getElementById('progress-bar');
        this.pageInfo = document.getElementById('page-info');
        this.viewer = document.getElementById('viewer');
        this.viewerContainer = document.getElementById('viewer-container');
        this.controlPanel = document.getElementById('control-panel');
        
        // ダークモードの適用
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // アニメーション速度の適用
        document.documentElement.style.setProperty('--animation-speed', `${this.animationSpeed}s`);
        
        // デスクトップでは初期状態で最小化
        if (!this.isMobile()) {
            this.controlPanel.classList.add('minimized');
            this.isControlPanelMinimized = true;
        } else {
            // モバイルでは初期状態は縮小（expandedクラスなし）
            this.controlPanel.classList.remove('expanded');
            this.isControlPanelExpanded = false;
        }
    }
    
    setupEventListeners() {
        // コントロールボタン
        document.getElementById('prev-btn').addEventListener('click', () => this.prevPage());
        document.getElementById('next-btn').addEventListener('click', () => this.nextPage());
        document.getElementById('view-mode-btn').addEventListener('click', () => this.toggleViewMode());
        document.getElementById('thumbnail-btn').addEventListener('click', () => this.toggleThumbnailPanel());
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('settings-btn').addEventListener('click', () => this.toggleSettingsPanel());
        document.getElementById('darkmode-btn').addEventListener('click', () => this.toggleDarkMode());
        document.getElementById('expand-btn').addEventListener('click', () => this.toggleControlPanel());
        
        // パネル閉じるボタン
        document.getElementById('thumbnail-close-btn').addEventListener('click', () => this.toggleThumbnailPanel());
        document.getElementById('settings-close-btn').addEventListener('click', () => this.toggleSettingsPanel());
        
        // 設定項目
        document.getElementById('animation-speed').addEventListener('input', (e) => this.updateAnimationSpeed(e.target.value));
        document.getElementById('bg-color').addEventListener('input', (e) => this.updateBackgroundColor(e.target.value));
        document.getElementById('auto-play').addEventListener('change', (e) => this.toggleAutoPlay(e.target.checked));
        document.getElementById('auto-play-interval').addEventListener('input', (e) => this.updateAutoPlayInterval(e.target.value));
        document.getElementById('reset-bookmark').addEventListener('click', () => this.resetBookmark());
        
        // キーボード操作
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // マウス操作（ページクリック）
        this.viewer.addEventListener('click', (e) => this.handleViewerClick(e));
        
        // マウスホイール（ズーム）
        this.viewer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // ドラッグ操作（パン）
        this.viewer.addEventListener('mousedown', (e) => this.handlePanStart(e));
        document.addEventListener('mousemove', (e) => this.handlePanMove(e));
        document.addEventListener('mouseup', () => this.handlePanEnd());
        
        // タッチ操作
        this.viewer.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.viewer.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.viewer.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        
        // 進捗バークリック
        document.getElementById('progress-container').addEventListener('click', (e) => this.handleProgressBarClick(e));
        
        // ページ遷移前にブックマーク保存
        window.addEventListener('beforeunload', () => this.saveBookmark());
        
        // ウィンドウリサイズ
        window.addEventListener('resize', () => this.handleResize());
        
        // マウス移動での自動展開は廃止
    }
    
    isMobile() {
        return window.innerWidth < 768;
    }
    
    
    toggleControlPanel() {
        if (this.isMobile()) {
            // モバイル：展開/縮小切替（自動非表示なし）
            this.isControlPanelExpanded = !this.isControlPanelExpanded;
            if (this.isControlPanelExpanded) {
                this.controlPanel.classList.add('expanded');
            } else {
                this.controlPanel.classList.remove('expanded');
            }
        } else {
            // デスクトップ：最小化/展開切替（自動非表示なし）
            this.isControlPanelMinimized = !this.isControlPanelMinimized;
            if (this.isControlPanelMinimized) {
                this.controlPanel.classList.add('minimized');
            } else {
                this.controlPanel.classList.remove('minimized');
            }
            this.saveSettings();
        }
    }
    
    displayPage(direction = null) {
        // アニメーションクラスを削除
        this.pageContainer.className = `page-container ${this.viewMode}-mode`;
        
        // ズームとパンのリセット
        if (this.zoom === 1.0) {
            this.pageContainer.style.transform = '';
        } else {
            this.pageContainer.style.transform = `scale(${this.zoom}) translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
        }
        
        this.pageContainer.innerHTML = '';
        
        // スライドアニメーション（方向が指定されている場合）
        // ブラウザに強制的にリフローさせてからアニメーションを開始
        if (direction) {
            // リフローを強制
            void this.pageContainer.offsetWidth;
            // 次のフレームでアニメーションクラスを追加
            requestAnimationFrame(() => {
                this.pageContainer.classList.add(direction);
            });
        }
        
        if (this.viewMode === 'single') {
            // 単ページ表示
            const img = document.createElement('img');
            img.src = this.images[this.currentPage];
            img.alt = `ページ ${this.currentPage + 1}`;
            this.pageContainer.appendChild(img);
        } else {
            // 見開き表示（日本式：右から左へ読む）
            const isMobile = window.innerWidth < 768;
            
            if (isMobile) {
                // モバイルでは単ページ表示
                const img = document.createElement('img');
                img.src = this.images[this.currentPage];
                img.alt = `ページ ${this.currentPage + 1}`;
                this.pageContainer.appendChild(img);
            } else {
                // 右側（日本式：先に読むページ = currentPage）
                if (this.currentPage < this.images.length) {
                    const rightImg = document.createElement('img');
                    rightImg.src = this.images[this.currentPage];
                    rightImg.alt = `ページ ${this.currentPage + 1}`;
                    this.pageContainer.appendChild(rightImg);
                }
                
                // 左側（日本式：後に読むページ = currentPage + 1）
                if (this.currentPage + 1 < this.images.length) {
                    const leftImg = document.createElement('img');
                    leftImg.src = this.images[this.currentPage + 1];
                    leftImg.alt = `ページ ${this.currentPage + 2}`;
                    this.pageContainer.appendChild(leftImg);
                }
            }
        }
        
        this.updateProgress();
        this.updateThumbnailHighlight();
        this.updateButtonStates();
    }
    
    updateProgress() {
        const progress = ((this.currentPage + 1) / this.images.length) * 100;
        this.progressBar.style.width = `${progress}%`;
        this.pageInfo.textContent = `${this.currentPage + 1}/${this.images.length}`;
    }
    
    canGoNext() {
        if (this.viewMode === 'spread' && window.innerWidth >= 768) {
            // 見開き表示：次のページペアが存在するか
            return this.currentPage + 2 < this.images.length;
        } else {
            // 単ページ表示：次のページが存在するか
            return this.currentPage + 1 < this.images.length;
        }
    }
    
    canGoPrev() {
        return this.currentPage > 0;
    }
    
    nextPage() {
        if (!this.canGoNext()) {
            return;
        }
        
        // スライドアウトアニメーション（右へ）
        this.pageContainer.classList.add('slide-out-right');
        
        setTimeout(() => {
            if (this.viewMode === 'spread' && window.innerWidth >= 768) {
                // 見開き表示では2ページ進む
                this.currentPage = Math.min(this.currentPage + 2, this.images.length - 1);
            } else {
                this.currentPage = Math.min(this.currentPage + 1, this.images.length - 1);
            }
            // スライドインアニメーション（左から）
            this.displayPage('slide-in-left');
            this.saveBookmark();
        }, this.animationSpeed * 1000);
    }
    
    prevPage() {
        if (!this.canGoPrev()) {
            return;
        }
        
        // スライドアウトアニメーション（左へ）
        this.pageContainer.classList.add('slide-out-left');
        
        setTimeout(() => {
            if (this.viewMode === 'spread' && window.innerWidth >= 768) {
                // 見開き表示では2ページ戻る
                this.currentPage = Math.max(this.currentPage - 2, 0);
            } else {
                this.currentPage = Math.max(this.currentPage - 1, 0);
            }
            // スライドインアニメーション（右から）
            this.displayPage('slide-in-right');
            this.saveBookmark();
        }, this.animationSpeed * 1000);
    }
    
    updateButtonStates() {
        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');
        
        if (this.canGoNext()) {
            nextBtn.classList.remove('disabled');
            nextBtn.disabled = false;
        } else {
            nextBtn.classList.add('disabled');
            nextBtn.disabled = true;
        }
        
        if (this.canGoPrev()) {
            prevBtn.classList.remove('disabled');
            prevBtn.disabled = false;
        } else {
            prevBtn.classList.add('disabled');
            prevBtn.disabled = true;
        }
    }
    
    goToPage(pageIndex, withAnimation = false) {
        const targetPage = Math.max(0, Math.min(pageIndex, this.images.length - 1));
        
        if (withAnimation) {
            // ジャンプ時の方向を決定
            const direction = targetPage > this.currentPage ? 'slide-out-right' : 'slide-out-left';
            const inDirection = targetPage > this.currentPage ? 'slide-in-left' : 'slide-in-right';
            
            this.pageContainer.classList.add(direction);
            
            setTimeout(() => {
                this.currentPage = targetPage;
                this.displayPage(inDirection);
                this.saveBookmark();
            }, this.animationSpeed * 1000);
        } else {
            this.currentPage = targetPage;
            this.displayPage();
            this.saveBookmark();
        }
    }
    
    toggleViewMode() {
        this.viewMode = this.viewMode === 'single' ? 'spread' : 'single';
        this.displayPage();
        this.saveSettings();
    }
    
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-mode');
        this.saveSettings();
    }
    
    toggleThumbnailPanel() {
        const panel = document.getElementById('thumbnail-panel');
        panel.classList.toggle('hidden');
    }
    
    toggleSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        panel.classList.toggle('hidden');
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('全画面表示エラー:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    handleKeyboard(e) {
        // パネルが開いている場合はキーボード操作を無効化
        const thumbnailPanel = document.getElementById('thumbnail-panel');
        const settingsPanel = document.getElementById('settings-panel');
        if (!thumbnailPanel.classList.contains('hidden') || !settingsPanel.classList.contains('hidden')) {
            return;
        }
        
        switch(e.key) {
            case 'ArrowLeft':
            case ' ':
            case 'Spacebar': // 古いブラウザ対応
                e.preventDefault();
                this.nextPage(); // 日本式：左が次
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.prevPage(); // 日本式：右が前
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 's':
            case 'S':
                e.preventDefault();
                this.toggleViewMode();
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                this.toggleControlPanel();
                break;
            case 'Home':
                e.preventDefault();
                this.goToPage(0);
                break;
            case 'End':
                e.preventDefault();
                this.goToPage(this.images.length - 1);
                break;
        }
    }
    
    handleViewerClick(e) {
        // タッチイベントが処理された直後はクリックを無視
        if (this.touchHandled) {
            this.touchHandled = false;
            return;
        }
        
        // ズーム中はクリックでページ遷移しない
        if (this.zoom > 1.0) {
            return;
        }
        
        const rect = this.viewer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const centerX = rect.width / 2;
        
        if (clickX < centerX) {
            this.nextPage(); // 左半分クリック→次ページ（日本式）
        } else {
            this.prevPage(); // 右半分クリック→前ページ（日本式）
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(this.zoomMin, Math.min(this.zoomMax, this.zoom + delta));
        
        if (newZoom !== this.zoom) {
            this.zoom = newZoom;
            this.applyZoom();
            this.showZoomInfo();
            
            // ズーム状態によってカーソルを変更
            if (this.zoom > 1.0) {
                this.viewer.classList.add('zoomed');
            } else {
                this.viewer.classList.remove('zoomed');
                this.panOffset = { x: 0, y: 0 };
            }
        }
    }
    
    applyZoom() {
        const images = this.pageContainer.querySelectorAll('img');
        if (this.zoom === 1.0) {
            images.forEach(img => {
                img.style.transform = '';
            });
        } else {
            images.forEach(img => {
                img.style.transform = `scale(${this.zoom}) translate(${this.panOffset.x / this.zoom}px, ${this.panOffset.y / this.zoom}px)`;
                img.style.transformOrigin = 'center center';
            });
        }
    }
    
    showZoomInfo() {
        const zoomInfo = document.getElementById('zoom-info');
        zoomInfo.textContent = `${Math.round(this.zoom * 100)}%`;
        zoomInfo.classList.remove('hidden');
        
        clearTimeout(this.zoomInfoTimeout);
        this.zoomInfoTimeout = setTimeout(() => {
            zoomInfo.classList.add('hidden');
        }, 1000);
    }
    
    handlePanStart(e) {
        if (this.zoom > 1.0) {
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
        }
    }
    
    handlePanMove(e) {
        if (this.isPanning) {
            this.panOffset = {
                x: e.clientX - this.panStart.x,
                y: e.clientY - this.panStart.y
            };
            this.applyZoom();
        }
    }
    
    handlePanEnd() {
        this.isPanning = false;
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            // シングルタッチ（スワイプ）
            this.touchStart = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        } else if (e.touches.length === 2) {
            // ピンチズーム
            e.preventDefault();
            const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
            this.touchStartDistance = distance;
            this.initialZoom = this.zoom;
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 2) {
            // ピンチズーム
            e.preventDefault();
            const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
            const scale = distance / this.touchStartDistance;
            const newZoom = Math.max(this.zoomMin, Math.min(this.zoomMax, this.initialZoom * scale));
            
            if (newZoom !== this.zoom) {
                this.zoom = newZoom;
                this.applyZoom();
                this.showZoomInfo();
                
                if (this.zoom > 1.0) {
                    this.viewer.classList.add('zoomed');
                } else {
                    this.viewer.classList.remove('zoomed');
                    this.panOffset = { x: 0, y: 0 };
                }
            }
        }
    }
    
    handleTouchEnd(e) {
        if (e.changedTouches.length === 1 && this.touchStart.x !== 0) {
            const touchEnd = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY
            };
            
            const deltaX = touchEnd.x - this.touchStart.x;
            const deltaY = touchEnd.y - this.touchStart.y;
            
            // 横スワイプが縦スワイプより大きい場合のみページ遷移
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                // スワイプが検出されたらフラグを立てる
                this.touchHandled = true;
                
                if (deltaX > 0) {
                    this.nextPage(); // 左から右へスワイプ→次ページ
                } else {
                    this.prevPage(); // 右から左へスワイプ→前ページ
                }
            }
            
            this.touchStart = { x: 0, y: 0 };
        }
    }
    
    getTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    handleProgressBarClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        // 日本式：右端=最初のページ、左端=最後のページ
        const clickRatio = 1 - (clickX / rect.width);
        const pageIndex = Math.floor(clickRatio * this.images.length);
        this.goToPage(pageIndex, true); // アニメーション付きでジャンプ
    }
    
    generateThumbnails() {
        const grid = document.getElementById('thumbnail-grid');
        grid.innerHTML = '';
        
        this.images.forEach((imageSrc, index) => {
            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            if (index === this.currentPage) {
                item.classList.add('active');
            }
            
            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = `ページ ${index + 1}`;
            
            const label = document.createElement('div');
            label.className = 'thumbnail-label';
            label.textContent = `${index + 1}`;
            
            item.appendChild(img);
            item.appendChild(label);
            
            item.addEventListener('click', () => {
                this.goToPage(index, true); // アニメーション付きでジャンプ
                this.toggleThumbnailPanel();
            });
            
            grid.appendChild(item);
        });
    }
    
    updateThumbnailHighlight() {
        const items = document.querySelectorAll('.thumbnail-item');
        items.forEach((item, index) => {
            if (index === this.currentPage) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    updateAnimationSpeed(value) {
        this.animationSpeed = parseFloat(value);
        document.documentElement.style.setProperty('--animation-speed', `${this.animationSpeed}s`);
        document.getElementById('animation-speed-value').textContent = `${this.animationSpeed}s`;
        this.saveSettings();
    }
    
    updateBackgroundColor(color) {
        document.body.style.backgroundColor = color;
        this.saveSettings();
    }
    
    toggleAutoPlay(enabled) {
        const intervalInput = document.getElementById('auto-play-interval');
        intervalInput.disabled = !enabled;
        
        if (enabled) {
            this.startAutoPlay();
        } else {
            this.stopAutoPlay();
        }
    }
    
    updateAutoPlayInterval(value) {
        this.autoPlayDelay = parseInt(value) * 1000;
        if (this.autoPlayInterval) {
            this.stopAutoPlay();
            this.startAutoPlay();
        }
    }
    
    startAutoPlay() {
        this.stopAutoPlay();
        this.autoPlayInterval = setInterval(() => {
            if (!this.canGoNext()) {
                this.goToPage(0); // 最後まで行ったら最初に戻る
            } else {
                this.nextPage();
            }
        }, this.autoPlayDelay);
    }
    
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
    
    resetBookmark() {
        localStorage.removeItem('mangaViewer_bookmark');
        alert('しおりをリセットしました');
    }
    
    saveBookmark() {
        localStorage.setItem('mangaViewer_bookmark', this.currentPage);
    }
    
    loadBookmark() {
        const bookmark = localStorage.getItem('mangaViewer_bookmark');
        if (bookmark !== null) {
            this.currentPage = parseInt(bookmark);
        }
    }
    
    saveSettings() {
        const settings = {
            isDarkMode: this.isDarkMode,
            viewMode: this.viewMode,
            animationSpeed: this.animationSpeed,
            backgroundColor: document.body.style.backgroundColor || '',
            isControlPanelMinimized: this.isControlPanelMinimized
        };
        localStorage.setItem('mangaViewer_settings', JSON.stringify(settings));
    }
    
    loadSettings() {
        const settingsJson = localStorage.getItem('mangaViewer_settings');
        if (settingsJson) {
            try {
                const settings = JSON.parse(settingsJson);
                this.isDarkMode = settings.isDarkMode || false;
                this.viewMode = settings.viewMode || 'single';
                this.animationSpeed = settings.animationSpeed || 0.3;
                this.isControlPanelMinimized = settings.isControlPanelMinimized || false;
                
                if (settings.backgroundColor) {
                    document.body.style.backgroundColor = settings.backgroundColor;
                    document.getElementById('bg-color').value = settings.backgroundColor;
                }
                
                // デスクトップでは常に最小化状態からスタート（設定は無視）
                
                // UI要素の更新
                document.getElementById('animation-speed').value = this.animationSpeed;
                document.getElementById('animation-speed-value').textContent = `${this.animationSpeed}s`;
            } catch (e) {
                console.error('設定の読み込みエラー:', e);
            }
        }
    }
    
    handleResize() {
        // リサイズ時にページ表示を更新
        this.displayPage();
        
        // モバイル⇔デスクトップ切替時にコントロールパネルの状態をリセット
        if (this.isMobile()) {
            this.controlPanel.classList.remove('minimized');
            this.isControlPanelExpanded = false;
        } else {
            this.controlPanel.classList.remove('expanded');
            // デスクトップでは常に最小化状態からスタート
            this.controlPanel.classList.add('minimized');
            this.isControlPanelMinimized = true;
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    const viewer = new MangaViewer();
});

