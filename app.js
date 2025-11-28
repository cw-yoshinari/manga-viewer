// 漫画ビューワ - メインアプリケーション v4.0 (複数ブック対応)

// ========================================
// BookLibrary クラス - ブック選択画面の管理
// ========================================
class BookLibrary {
    constructor() {
        this.books = [];
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.isDarkMode = false;
        
        this.init();
    }
    
    async init() {
        this.loadSettings();
        this.setupDOM();
        this.setupEventListeners();
        await this.discoverBooks();
        this.hideLoading();
    }
    
    setupDOM() {
        this.libraryScreen = document.getElementById('library-screen');
        this.viewerScreen = document.getElementById('viewer-screen');
        this.bookGrid = document.getElementById('book-grid');
        this.loadingElement = document.getElementById('library-loading');
        
        // ダークモードの適用
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
        }
    }
    
    setupEventListeners() {
        // 表示切替ボタン
        document.getElementById('view-toggle-btn').addEventListener('click', () => this.toggleViewMode());
        
        // ライブラリ画面のダークモードボタン
        document.getElementById('library-darkmode-btn').addEventListener('click', () => this.toggleDarkMode());
        
        // 戻るボタン
        document.getElementById('back-to-library-btn').addEventListener('click', () => this.showLibrary());
    }
    
    async discoverBooks() {
        this.books = [];
        let bookNumber = 1;
        
        while (true) {
            const bookId = String(bookNumber).padStart(3, '0');
            const exists = await this.checkBookExists(bookId);
            
            if (!exists) {
                break;
            }
            
            const bookData = await this.loadBookData(bookId);
            this.books.push(bookData);
            bookNumber++;
        }
        
        this.renderBooks();
    }
    
    async checkBookExists(bookId) {
        try {
            const response = await fetch(`${bookId}/001.png`, { method: 'HEAD' });
            return response.ok;
        } catch (e) {
            return false;
        }
    }
    
    async loadBookData(bookId) {
        const bookData = {
            id: bookId,
            title: bookId,
            cover: `${bookId}/001.png`,
            pageCount: 0
        };
        
        // book.json の読み込み（任意）
        try {
            const response = await fetch(`${bookId}/book.json`);
            if (response.ok) {
                const metadata = await response.json();
                if (metadata.title) {
                    bookData.title = metadata.title;
                }
                // pageCount が定義されていれば使用（高速化）
                if (metadata.pageCount && typeof metadata.pageCount === 'number') {
                    bookData.pageCount = metadata.pageCount;
                }
            }
        } catch (e) {
            // book.json がなくても問題なし
        }
        
        // cover.png の存在チェック
        try {
            const coverResponse = await fetch(`${bookId}/cover.png`, { method: 'HEAD' });
            if (coverResponse.ok) {
                bookData.cover = `${bookId}/cover.png`;
            }
        } catch (e) {
            // cover.png がなければ 001.png を使用
        }
        
        // pageCount が未設定の場合のみ、連番チェックでカウント（フォールバック）
        if (bookData.pageCount === 0) {
            bookData.pageCount = await this.countPages(bookId);
        }
        
        // 読了状況の取得
        bookData.progress = this.getBookProgress(bookId);
        
        return bookData;
    }
    
    async countPages(bookId) {
        let pageNumber = 1;
        
        while (true) {
            const pageId = String(pageNumber).padStart(3, '0');
            try {
                const response = await fetch(`${bookId}/${pageId}.png`, { method: 'HEAD' });
                if (!response.ok) {
                    break;
                }
                pageNumber++;
            } catch (e) {
                break;
            }
        }
        
        return pageNumber - 1;
    }
    
    getBookProgress(bookId) {
        const bookmark = localStorage.getItem(`mangaViewer_bookmark_${bookId}`);
        if (bookmark !== null) {
            return parseInt(bookmark) + 1; // 0-indexed to 1-indexed
        }
        return 0;
    }
    
    renderBooks() {
        this.bookGrid.innerHTML = '';
        this.bookGrid.className = `book-grid ${this.viewMode}-view`;
        
        if (this.books.length === 0) {
            this.bookGrid.innerHTML = '<p class="no-books">ブックが見つかりません。001/, 002/ などのフォルダに画像を配置してください。</p>';
            return;
        }
        
        this.books.forEach(book => {
            const card = this.createBookCard(book);
            this.bookGrid.appendChild(card);
        });
    }
    
    createBookCard(book) {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.bookId = book.id;
        
        const coverContainer = document.createElement('div');
        coverContainer.className = 'book-cover-container';
        
        const cover = document.createElement('img');
        cover.src = book.cover;
        cover.alt = book.title;
        cover.className = 'book-cover';
        cover.loading = 'lazy';
        
        coverContainer.appendChild(cover);
        
        // 読了バッジ
        if (book.progress > 0 && book.progress >= book.pageCount) {
            const badge = document.createElement('div');
            badge.className = 'book-badge completed';
            badge.textContent = '読了';
            coverContainer.appendChild(badge);
        } else if (book.progress > 0) {
            const badge = document.createElement('div');
            badge.className = 'book-badge reading';
            badge.textContent = `${book.progress}/${book.pageCount}`;
            coverContainer.appendChild(badge);
        }
        
        const info = document.createElement('div');
        info.className = 'book-info';
        
        const title = document.createElement('h3');
        title.className = 'book-title';
        title.textContent = book.title;
        
        const meta = document.createElement('p');
        meta.className = 'book-meta';
        meta.textContent = `${book.pageCount}ページ`;
        
        info.appendChild(title);
        info.appendChild(meta);
        
        card.appendChild(coverContainer);
        card.appendChild(info);
        
        card.addEventListener('click', () => this.openBook(book.id));
        
        return card;
    }
    
    openBook(bookId) {
        // 該当ブックのページ数を取得
        const book = this.books.find(b => b.id === bookId);
        const pageCount = book ? book.pageCount : 0;
        
        this.libraryScreen.classList.add('hidden');
        this.viewerScreen.classList.remove('hidden');
        
        // MangaViewer を初期化（pageCount を渡して高速化）
        window.mangaViewer = new MangaViewer(bookId, pageCount);
    }
    
    showLibrary() {
        // 現在のビューワをクリーンアップ
        if (window.mangaViewer) {
            window.mangaViewer.cleanup();
            window.mangaViewer = null;
        }
        
        this.viewerScreen.classList.add('hidden');
        this.libraryScreen.classList.remove('hidden');
        
        // 読了状況を更新して再表示
        this.refreshBookProgress();
    }
    
    async refreshBookProgress() {
        for (const book of this.books) {
            book.progress = this.getBookProgress(book.id);
        }
        this.renderBooks();
    }
    
    toggleViewMode() {
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        this.renderBooks();
        this.saveSettings();
        
        // アイコンを更新
        const btn = document.getElementById('view-toggle-btn');
        if (this.viewMode === 'list') {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                </svg>
            `;
        } else {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>
                </svg>
            `;
        }
    }
    
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-mode');
        this.saveSettings();
    }
    
    hideLoading() {
        this.loadingElement.classList.add('hidden');
    }
    
    saveSettings() {
        const settings = {
            isDarkMode: this.isDarkMode,
            viewMode: this.viewMode
        };
        localStorage.setItem('mangaLibrary_settings', JSON.stringify(settings));
    }
    
    loadSettings() {
        const settingsJson = localStorage.getItem('mangaLibrary_settings');
        if (settingsJson) {
            try {
                const settings = JSON.parse(settingsJson);
                this.isDarkMode = settings.isDarkMode || false;
                this.viewMode = settings.viewMode || 'grid';
            } catch (e) {
                console.error('ライブラリ設定の読み込みエラー:', e);
            }
        }
    }
}

// ========================================
// MangaViewer クラス - 漫画ビューワ本体
// ========================================
class MangaViewer {
    constructor(bookId, pageCount = 0) {
        this.bookId = bookId;
        this.pageCount = pageCount; // ライブラリから渡されたページ数（高速化用）
        this.images = [];
        this.currentPage = 0;
        this.viewMode = 'single'; // 'single' or 'spread'
        this.isDarkMode = document.body.classList.contains('dark-mode');
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
        this.touchHandled = false;
        
        // コントロールパネル状態管理
        this.isControlPanelMinimized = false;
        this.isControlPanelExpanded = false;
        
        // イベントリスナーの参照を保持（クリーンアップ用）
        this.boundHandlers = {};
        
        this.init();
    }
    
    async init() {
        this.detectBrowser();
        this.loadSettings();
        await this.loadPages();
        this.setupDOM();
        this.setViewportHeight();
        this.loadBookmark();
        this.displayPage();
        this.setupEventListeners();
        this.generateThumbnails();
    }
    
    async loadPages() {
        this.images = [];
        
        // pageCount が渡されている場合は、連番チェックをスキップして即座に配列を構築（高速化）
        if (this.pageCount > 0) {
            for (let i = 1; i <= this.pageCount; i++) {
                const pageId = String(i).padStart(3, '0');
                this.images.push(`${this.bookId}/${pageId}.png`);
            }
            return;
        }
        
        // フォールバック: pageCount が未設定の場合は連番でチェック
        let pageNumber = 1;
        while (true) {
            const pageId = String(pageNumber).padStart(3, '0');
            const imagePath = `${this.bookId}/${pageId}.png`;
            
            try {
                const response = await fetch(imagePath, { method: 'HEAD' });
                if (!response.ok) {
                    break;
                }
                this.images.push(imagePath);
                pageNumber++;
            } catch (e) {
                break;
            }
        }
    }
    
    detectBrowser() {
        const isChrome = (/Chrome|CriOS/.test(navigator.userAgent)) && !/Line/.test(navigator.userAgent);
        const isLine = /Line/.test(navigator.userAgent);
        
        if (isChrome) {
            document.body.classList.add('is-chrome');
            
            setTimeout(() => {
                const viewer = document.getElementById('viewer');
                if (viewer && this.isMobile()) {
                    viewer.style.setProperty('align-items', 'flex-start', 'important');
                    viewer.style.setProperty('padding-top', '110px', 'important');
                }
            }, 100);
        }
        
        if (isLine) {
            document.body.classList.add('is-line');
        }
    }
    
    setViewportHeight() {
        const updateViewport = () => {
            if (window.visualViewport) {
                const vh = window.visualViewport.height * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                const isChrome = /Chrome/.test(navigator.userAgent) && !/Line/.test(navigator.userAgent);
                
                if (isChrome && window.visualViewport.offsetTop > 0) {
                    const adjustedHeight = window.visualViewport.height - window.visualViewport.offsetTop;
                    const adjustedVh = adjustedHeight * 0.01;
                    document.documentElement.style.setProperty('--vh', `${adjustedVh}px`);
                }
            } else {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
            }
        };
        
        updateViewport();
        
        this.boundHandlers.updateViewport = updateViewport;
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
        
        // アニメーション速度の適用
        document.documentElement.style.setProperty('--animation-speed', `${this.animationSpeed}s`);
        
        // デスクトップでは初期状態で最小化
        if (!this.isMobile()) {
            this.controlPanel.classList.add('minimized');
            this.isControlPanelMinimized = true;
        } else {
            this.controlPanel.classList.remove('expanded');
            this.isControlPanelExpanded = false;
        }
    }
    
    setupEventListeners() {
        // コントロールボタン
        this.boundHandlers.prevPage = () => this.prevPage();
        this.boundHandlers.nextPage = () => this.nextPage();
        this.boundHandlers.toggleViewMode = () => this.toggleViewMode();
        this.boundHandlers.toggleThumbnailPanel = () => this.toggleThumbnailPanel();
        this.boundHandlers.toggleFullscreen = () => this.toggleFullscreen();
        this.boundHandlers.toggleSettingsPanel = () => this.toggleSettingsPanel();
        this.boundHandlers.toggleDarkMode = () => this.toggleDarkMode();
        this.boundHandlers.toggleControlPanel = () => this.toggleControlPanel();
        
        document.getElementById('prev-btn').addEventListener('click', this.boundHandlers.prevPage);
        document.getElementById('next-btn').addEventListener('click', this.boundHandlers.nextPage);
        document.getElementById('view-mode-btn').addEventListener('click', this.boundHandlers.toggleViewMode);
        document.getElementById('thumbnail-btn').addEventListener('click', this.boundHandlers.toggleThumbnailPanel);
        document.getElementById('fullscreen-btn').addEventListener('click', this.boundHandlers.toggleFullscreen);
        document.getElementById('settings-btn').addEventListener('click', this.boundHandlers.toggleSettingsPanel);
        document.getElementById('darkmode-btn').addEventListener('click', this.boundHandlers.toggleDarkMode);
        document.getElementById('expand-btn').addEventListener('click', this.boundHandlers.toggleControlPanel);
        
        // パネル閉じるボタン
        this.boundHandlers.closeThumbnail = () => this.toggleThumbnailPanel();
        this.boundHandlers.closeSettings = () => this.toggleSettingsPanel();
        document.getElementById('thumbnail-close-btn').addEventListener('click', this.boundHandlers.closeThumbnail);
        document.getElementById('settings-close-btn').addEventListener('click', this.boundHandlers.closeSettings);
        
        // 設定項目
        this.boundHandlers.animationSpeed = (e) => this.updateAnimationSpeed(e.target.value);
        this.boundHandlers.bgColor = (e) => this.updateBackgroundColor(e.target.value);
        this.boundHandlers.autoPlay = (e) => this.toggleAutoPlay(e.target.checked);
        this.boundHandlers.autoPlayInterval = (e) => this.updateAutoPlayInterval(e.target.value);
        this.boundHandlers.resetBookmark = () => this.resetBookmark();
        
        document.getElementById('animation-speed').addEventListener('input', this.boundHandlers.animationSpeed);
        document.getElementById('bg-color').addEventListener('input', this.boundHandlers.bgColor);
        document.getElementById('auto-play').addEventListener('change', this.boundHandlers.autoPlay);
        document.getElementById('auto-play-interval').addEventListener('input', this.boundHandlers.autoPlayInterval);
        document.getElementById('reset-bookmark').addEventListener('click', this.boundHandlers.resetBookmark);
        
        // キーボード操作
        this.boundHandlers.keyboard = (e) => this.handleKeyboard(e);
        document.addEventListener('keydown', this.boundHandlers.keyboard);
        
        // マウス操作（ページクリック）
        this.boundHandlers.viewerClick = (e) => this.handleViewerClick(e);
        this.viewer.addEventListener('click', this.boundHandlers.viewerClick);
        
        // マウスホイール（ズーム）
        this.boundHandlers.wheel = (e) => this.handleWheel(e);
        this.viewer.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        
        // ドラッグ操作（パン）
        this.boundHandlers.panStart = (e) => this.handlePanStart(e);
        this.boundHandlers.panMove = (e) => this.handlePanMove(e);
        this.boundHandlers.panEnd = () => this.handlePanEnd();
        this.viewer.addEventListener('mousedown', this.boundHandlers.panStart);
        document.addEventListener('mousemove', this.boundHandlers.panMove);
        document.addEventListener('mouseup', this.boundHandlers.panEnd);
        
        // タッチ操作
        this.boundHandlers.touchStart = (e) => this.handleTouchStart(e);
        this.boundHandlers.touchMove = (e) => this.handleTouchMove(e);
        this.boundHandlers.touchEnd = (e) => this.handleTouchEnd(e);
        this.viewer.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
        this.viewer.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false });
        this.viewer.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: false });
        
        // 進捗バークリック
        this.boundHandlers.progressBarClick = (e) => this.handleProgressBarClick(e);
        document.getElementById('progress-container').addEventListener('click', this.boundHandlers.progressBarClick);
        
        // ページ遷移前にブックマーク保存
        this.boundHandlers.beforeUnload = () => this.saveBookmark();
        window.addEventListener('beforeunload', this.boundHandlers.beforeUnload);
        
        // ウィンドウリサイズ
        this.boundHandlers.resize = () => this.handleResize();
        window.addEventListener('resize', this.boundHandlers.resize);
    }
    
    cleanup() {
        // イベントリスナーを削除
        document.getElementById('prev-btn').removeEventListener('click', this.boundHandlers.prevPage);
        document.getElementById('next-btn').removeEventListener('click', this.boundHandlers.nextPage);
        document.getElementById('view-mode-btn').removeEventListener('click', this.boundHandlers.toggleViewMode);
        document.getElementById('thumbnail-btn').removeEventListener('click', this.boundHandlers.toggleThumbnailPanel);
        document.getElementById('fullscreen-btn').removeEventListener('click', this.boundHandlers.toggleFullscreen);
        document.getElementById('settings-btn').removeEventListener('click', this.boundHandlers.toggleSettingsPanel);
        document.getElementById('darkmode-btn').removeEventListener('click', this.boundHandlers.toggleDarkMode);
        document.getElementById('expand-btn').removeEventListener('click', this.boundHandlers.toggleControlPanel);
        
        document.getElementById('thumbnail-close-btn').removeEventListener('click', this.boundHandlers.closeThumbnail);
        document.getElementById('settings-close-btn').removeEventListener('click', this.boundHandlers.closeSettings);
        
        document.getElementById('animation-speed').removeEventListener('input', this.boundHandlers.animationSpeed);
        document.getElementById('bg-color').removeEventListener('input', this.boundHandlers.bgColor);
        document.getElementById('auto-play').removeEventListener('change', this.boundHandlers.autoPlay);
        document.getElementById('auto-play-interval').removeEventListener('input', this.boundHandlers.autoPlayInterval);
        document.getElementById('reset-bookmark').removeEventListener('click', this.boundHandlers.resetBookmark);
        
        document.removeEventListener('keydown', this.boundHandlers.keyboard);
        
        this.viewer.removeEventListener('click', this.boundHandlers.viewerClick);
        this.viewer.removeEventListener('wheel', this.boundHandlers.wheel);
        this.viewer.removeEventListener('mousedown', this.boundHandlers.panStart);
        document.removeEventListener('mousemove', this.boundHandlers.panMove);
        document.removeEventListener('mouseup', this.boundHandlers.panEnd);
        
        this.viewer.removeEventListener('touchstart', this.boundHandlers.touchStart);
        this.viewer.removeEventListener('touchmove', this.boundHandlers.touchMove);
        this.viewer.removeEventListener('touchend', this.boundHandlers.touchEnd);
        
        document.getElementById('progress-container').removeEventListener('click', this.boundHandlers.progressBarClick);
        
        window.removeEventListener('beforeunload', this.boundHandlers.beforeUnload);
        window.removeEventListener('resize', this.boundHandlers.resize);
        window.removeEventListener('resize', this.boundHandlers.updateViewport);
        
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this.boundHandlers.updateViewport);
            window.visualViewport.removeEventListener('scroll', this.boundHandlers.updateViewport);
        }
        
        // 自動再生を停止
        this.stopAutoPlay();
        
        // しおりを保存
        this.saveBookmark();
        
        // パネルを閉じる
        document.getElementById('thumbnail-panel').classList.add('hidden');
        document.getElementById('settings-panel').classList.add('hidden');
    }
    
    isMobile() {
        return window.innerWidth < 768;
    }
    
    toggleControlPanel() {
        if (this.isMobile()) {
            this.isControlPanelExpanded = !this.isControlPanelExpanded;
            if (this.isControlPanelExpanded) {
                this.controlPanel.classList.add('expanded');
            } else {
                this.controlPanel.classList.remove('expanded');
            }
        } else {
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
        this.pageContainer.className = `page-container ${this.viewMode}-mode`;
        
        if (this.zoom === 1.0) {
            this.pageContainer.style.transform = '';
        } else {
            this.pageContainer.style.transform = `scale(${this.zoom}) translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
        }
        
        this.pageContainer.innerHTML = '';
        
        if (direction) {
            void this.pageContainer.offsetWidth;
            requestAnimationFrame(() => {
                this.pageContainer.classList.add(direction);
            });
        }
        
        if (this.viewMode === 'single') {
            const img = document.createElement('img');
            img.src = this.images[this.currentPage];
            img.alt = `ページ ${this.currentPage + 1}`;
            this.pageContainer.appendChild(img);
        } else {
            const isMobile = window.innerWidth < 768;
            
            if (isMobile) {
                const img = document.createElement('img');
                img.src = this.images[this.currentPage];
                img.alt = `ページ ${this.currentPage + 1}`;
                this.pageContainer.appendChild(img);
            } else {
                if (this.currentPage < this.images.length) {
                    const rightImg = document.createElement('img');
                    rightImg.src = this.images[this.currentPage];
                    rightImg.alt = `ページ ${this.currentPage + 1}`;
                    this.pageContainer.appendChild(rightImg);
                }
                
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
            return this.currentPage + 2 < this.images.length;
        } else {
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
        
        this.pageContainer.classList.add('slide-out-right');
        
        setTimeout(() => {
            if (this.viewMode === 'spread' && window.innerWidth >= 768) {
                this.currentPage = Math.min(this.currentPage + 2, this.images.length - 1);
            } else {
                this.currentPage = Math.min(this.currentPage + 1, this.images.length - 1);
            }
            this.displayPage('slide-in-left');
            this.saveBookmark();
        }, this.animationSpeed * 1000);
    }
    
    prevPage() {
        if (!this.canGoPrev()) {
            return;
        }
        
        this.pageContainer.classList.add('slide-out-left');
        
        setTimeout(() => {
            if (this.viewMode === 'spread' && window.innerWidth >= 768) {
                this.currentPage = Math.max(this.currentPage - 2, 0);
            } else {
                this.currentPage = Math.max(this.currentPage - 1, 0);
            }
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
        
        // ライブラリ設定も更新
        const librarySettings = JSON.parse(localStorage.getItem('mangaLibrary_settings') || '{}');
        librarySettings.isDarkMode = this.isDarkMode;
        localStorage.setItem('mangaLibrary_settings', JSON.stringify(librarySettings));
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
        // ビューワ画面が非表示の場合は無視
        if (document.getElementById('viewer-screen').classList.contains('hidden')) {
            return;
        }
        
        const thumbnailPanel = document.getElementById('thumbnail-panel');
        const settingsPanel = document.getElementById('settings-panel');
        if (!thumbnailPanel.classList.contains('hidden') || !settingsPanel.classList.contains('hidden')) {
            return;
        }
        
        switch(e.key) {
            case 'ArrowLeft':
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                this.nextPage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.prevPage();
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
            case 'Escape':
                e.preventDefault();
                // ライブラリに戻る
                if (window.bookLibrary) {
                    window.bookLibrary.showLibrary();
                }
                break;
        }
    }
    
    handleViewerClick(e) {
        if (this.touchHandled) {
            this.touchHandled = false;
            return;
        }
        
        if (this.zoom > 1.0) {
            return;
        }
        
        const rect = this.viewer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const centerX = rect.width / 2;
        
        if (clickX < centerX) {
            this.nextPage();
        } else {
            this.prevPage();
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
            this.touchStart = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
            this.touchStartDistance = distance;
            this.initialZoom = this.zoom;
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 2) {
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
            
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                this.touchHandled = true;
                
                if (deltaX > 0) {
                    this.nextPage();
                } else {
                    this.prevPage();
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
        const clickRatio = 1 - (clickX / rect.width);
        const pageIndex = Math.floor(clickRatio * this.images.length);
        this.goToPage(pageIndex, true);
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
                this.goToPage(index, true);
                this.toggleThumbnailPanel();
            });
            
            grid.appendChild(item);
        });
    }
    
    updateThumbnailHighlight() {
        const items = document.querySelectorAll('#thumbnail-grid .thumbnail-item');
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
                this.goToPage(0);
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
        localStorage.removeItem(`mangaViewer_bookmark_${this.bookId}`);
        alert('しおりをリセットしました');
    }
    
    saveBookmark() {
        localStorage.setItem(`mangaViewer_bookmark_${this.bookId}`, this.currentPage);
    }
    
    loadBookmark() {
        const bookmark = localStorage.getItem(`mangaViewer_bookmark_${this.bookId}`);
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
                this.viewMode = settings.viewMode || 'single';
                this.animationSpeed = settings.animationSpeed || 0.3;
                this.isControlPanelMinimized = settings.isControlPanelMinimized || false;
                
                if (settings.backgroundColor) {
                    document.body.style.backgroundColor = settings.backgroundColor;
                    document.getElementById('bg-color').value = settings.backgroundColor;
                }
                
                document.getElementById('animation-speed').value = this.animationSpeed;
                document.getElementById('animation-speed-value').textContent = `${this.animationSpeed}s`;
            } catch (e) {
                console.error('設定の読み込みエラー:', e);
            }
        }
    }
    
    handleResize() {
        this.displayPage();
        
        if (this.isMobile()) {
            this.controlPanel.classList.remove('minimized');
            this.isControlPanelExpanded = false;
        } else {
            this.controlPanel.classList.remove('expanded');
            this.controlPanel.classList.add('minimized');
            this.isControlPanelMinimized = true;
        }
    }
}

// ========================================
// アプリケーション初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    window.bookLibrary = new BookLibrary();
});
