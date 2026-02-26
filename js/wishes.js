// ============================================
// 本杰驴的许愿王八池 - 用户端逻辑
// ============================================

(function () {
    'use strict';

    const { createClient } = supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // === DOM ===
    const tabBtns = document.querySelectorAll('.tab-btn');
    const bugFormEl = document.getElementById('bugForm');
    const wishFormEl = document.getElementById('wishForm');
    const bugSubmitForm = document.getElementById('bugSubmitForm');
    const wishSubmitForm = document.getElementById('wishSubmitForm');
    const listArea = document.getElementById('listArea');
    const toast = document.getElementById('toast');
    const successOverlay = document.getElementById('successOverlay');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // File inputs
    const bugFile = document.getElementById('bugFile');
    const bugFileName = document.getElementById('bugFileName');
    const bugFileArea = document.getElementById('bugFileArea');
    const wishFile = document.getElementById('wishFile');
    const wishFileName = document.getElementById('wishFileName');
    const wishFileArea = document.getElementById('wishFileArea');

    // State
    let allWishes = [];
    let currentFilter = 'all';

    // === Tab Switching ===
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            if (tab === 'bug') {
                bugFormEl.classList.add('active');
                wishFormEl.classList.remove('active');
            } else {
                wishFormEl.classList.add('active');
                bugFormEl.classList.remove('active');
            }
        });
    });

    // === File Input Display ===
    bugFile.addEventListener('change', () => {
        if (bugFile.files.length > 0) {
            bugFileName.textContent = '✅ ' + bugFile.files[0].name;
            bugFileArea.classList.add('has-file');
        } else {
            bugFileName.textContent = '';
            bugFileArea.classList.remove('has-file');
        }
    });

    wishFile.addEventListener('change', () => {
        if (wishFile.files.length > 0) {
            wishFileName.textContent = '✅ ' + wishFile.files[0].name;
            wishFileArea.classList.add('has-file');
        } else {
            wishFileName.textContent = '';
            wishFileArea.classList.remove('has-file');
        }
    });

    // === Filter Buttons ===
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderList();
        });
    });

    // === Upload File to Supabase Storage ===
    async function uploadFile(file) {
        if (!file) return '';

        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const filePath = `uploads/${fileName}`;

        const { data, error } = await db.storage
            .from('wish-attachments')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            throw new Error('文件上传失败: ' + error.message);
        }

        // Get public URL
        const { data: urlData } = db.storage
            .from('wish-attachments')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    }

    // === Submit Bug ===
    bugSubmitForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const desc = document.getElementById('bugDesc').value.trim();
        const ops = document.getElementById('bugOps').value.trim();
        const device = document.getElementById('bugDevice').value.trim();
        const qq = document.getElementById('bugQQ').value.trim();
        const file = bugFile.files[0];

        if (!desc || !ops || !device || !qq) {
            showToast('请填写所有必填项', 'error');
            return;
        }

        setSubmitLoading('bug', true);

        try {
            let attachmentUrl = '';
            if (file) {
                attachmentUrl = await uploadFile(file);
            }

            const { error } = await db.from('wishes').insert({
                type: 'bug',
                description: desc,
                operations: ops,
                device: device,
                qq: qq,
                attachment_url: attachmentUrl,
                wish_type: ''
            });

            if (error) {
                showToast('提交失败: ' + error.message, 'error');
                setSubmitLoading('bug', false);
                return;
            }

            bugSubmitForm.reset();
            bugFileName.textContent = '';
            bugFileArea.classList.remove('has-file');
            showSuccess();
            await loadList();

        } catch (err) {
            showToast(err.message || '提交失败，请重试', 'error');
        }

        setSubmitLoading('bug', false);
    });

    // === Submit Wish ===
    wishSubmitForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const wishType = document.getElementById('wishType').value;
        const desc = document.getElementById('wishDesc').value.trim();
        const qq = document.getElementById('wishQQ').value.trim();
        const file = wishFile.files[0];

        if (!wishType || !desc || !qq) {
            showToast('请填写所有必填项', 'error');
            return;
        }

        setSubmitLoading('wish', true);

        try {
            let attachmentUrl = '';
            if (file) {
                attachmentUrl = await uploadFile(file);
            }

            const { error } = await db.from('wishes').insert({
                type: 'wish',
                description: desc,
                operations: '',
                device: '',
                qq: qq,
                attachment_url: attachmentUrl,
                wish_type: wishType
            });

            if (error) {
                showToast('提交失败: ' + error.message, 'error');
                setSubmitLoading('wish', false);
                return;
            }

            wishSubmitForm.reset();
            wishFileName.textContent = '';
            wishFileArea.classList.remove('has-file');
            showSuccess();
            await loadList();

        } catch (err) {
            showToast(err.message || '提交失败，请重试', 'error');
        }

        setSubmitLoading('wish', false);
    });

    // === Load Public List ===
    async function loadList() {
        listArea.innerHTML = `
            <div class="loading-overlay">
                <span class="spinner"></span>
                <span>正在加载...</span>
            </div>
        `;

        try {
            const { data, error } = await db
                .from('wishes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                listArea.innerHTML = `<div class="empty-state"><p>加载失败，请刷新重试</p></div>`;
                return;
            }

            allWishes = data || [];
            renderList();

        } catch (err) {
            listArea.innerHTML = `<div class="empty-state"><p>网络错误，请刷新重试</p></div>`;
        }
    }

    // === Render List ===
    function renderList() {
        const filtered = currentFilter === 'all'
            ? allWishes
            : allWishes.filter(w => w.type === currentFilter);

        if (filtered.length === 0) {
            listArea.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🫏</div>
                    <p>本杰驴还在等你的第一个请求...</p>
                </div>
            `;
            return;
        }

        const votedIds = getVotedIds();
        let html = '<div class="wish-list">';

        filtered.forEach(wish => {
            const typeBadge = getTypeBadge(wish);
            const statusBadge = getStatusBadge(wish.status);
            const isVoted = votedIds.has(wish.id);
            const timeStr = new Date(wish.created_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            let detailsHtml = '';
            if (wish.type === 'bug') {
                detailsHtml = `
                    <div class="wish-card-details">
                        <strong>相关操作：</strong>${escapeHtml(wish.operations)}<br>
                        <strong>设备型号：</strong>${escapeHtml(wish.device)}
                    </div>
                `;
            }

            let attachmentHtml = '';
            if (wish.attachment_url) {
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(wish.attachment_url);
                if (isImage) {
                    attachmentHtml = `
                        <div class="wish-attachment">
                            <img src="${escapeHtml(wish.attachment_url)}" alt="附件" onclick="showLightbox('${escapeHtml(wish.attachment_url)}')">
                        </div>
                    `;
                } else {
                    attachmentHtml = `
                        <div class="wish-attachment">
                            <a href="${escapeHtml(wish.attachment_url)}" target="_blank">📎 查看附件</a>
                        </div>
                    `;
                }
            }

            html += `
                <div class="wish-card" data-status="${wish.status}">
                    <div class="wish-card-header">
                        <div>
                            ${typeBadge}
                            ${statusBadge}
                        </div>
                    </div>
                    <div class="wish-card-body">${escapeHtml(wish.description)}</div>
                    ${detailsHtml}
                    ${attachmentHtml}
                    <div class="wish-card-meta">
                        <div class="wish-meta-info">
                            <span>🕐 ${timeStr}</span>
                            <span>QQ: ${escapeHtml(wish.qq)}</span>
                        </div>
                        <button class="upvote-btn ${isVoted ? 'voted' : ''}"
                                onclick="handleUpvote(${wish.id}, this)"
                                ${isVoted ? 'disabled' : ''}>
                            👍 +1 <span class="upvote-count">${wish.upvotes}</span>
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        listArea.innerHTML = html;
    }

    // === Upvote ===
    window.handleUpvote = async function (id, btn) {
        if (btn.classList.contains('voted')) return;

        btn.classList.add('voted');
        btn.disabled = true;

        // Optimistic update
        const countEl = btn.querySelector('.upvote-count');
        const currentCount = parseInt(countEl.textContent) || 0;
        countEl.textContent = currentCount + 1;

        try {
            const { data, error } = await db.rpc('upvote_wish', { p_id: id });

            if (error || (data && !data.success)) {
                // Revert
                countEl.textContent = currentCount;
                btn.classList.remove('voted');
                btn.disabled = false;
                showToast('点赞失败，请重试', 'error');
                return;
            }

            // Save to localStorage
            saveVotedId(id);

        } catch (err) {
            countEl.textContent = currentCount;
            btn.classList.remove('voted');
            btn.disabled = false;
            showToast('网络错误', 'error');
        }
    };

    // === Lightbox ===
    window.showLightbox = function (url) {
        lightboxImg.src = url;
        lightbox.classList.add('show');
    };

    lightbox.addEventListener('click', () => {
        lightbox.classList.remove('show');
        lightboxImg.src = '';
    });

    // === Type Badge ===
    function getTypeBadge(wish) {
        if (wish.type === 'bug') {
            return '<span class="wish-type-badge bug">🐛 BUG</span>';
        }
        const map = {
            'feature': { label: '新功能', icon: '✨', cls: 'feature' },
            'scene': { label: '新场景', icon: '🏰', cls: 'scene' },
            'character': { label: '新角色', icon: '🧙', cls: 'character' },
        };
        const info = map[wish.wish_type] || { label: '许愿', icon: '⭐', cls: 'feature' };
        return `<span class="wish-type-badge ${info.cls}">${info.icon} ${info.label}</span>`;
    }

    // === Status Badge ===
    function getStatusBadge(status) {
        const map = {
            'pending': { label: '待处理', icon: '⏳' },
            'processed': { label: '已处理', icon: '✅' },
            'observing': { label: '搁置观察', icon: '👀' },
            'rejected': { label: '不拉这个磨', icon: '🚫' },
        };
        const info = map[status] || map['pending'];
        return `<span class="wish-status-badge ${status}">${info.icon} ${info.label}</span>`;
    }

    // === LocalStorage Helpers (prevent duplicate upvote) ===
    function getVotedIds() {
        try {
            const data = JSON.parse(localStorage.getItem('donkey_voted') || '[]');
            return new Set(data);
        } catch {
            return new Set();
        }
    }

    function saveVotedId(id) {
        try {
            const data = JSON.parse(localStorage.getItem('donkey_voted') || '[]');
            data.push(id);
            localStorage.setItem('donkey_voted', JSON.stringify(data));
        } catch {
            // ignore
        }
    }

    // === Helpers ===
    function setSubmitLoading(type, loading) {
        const btn = document.getElementById(`${type}SubmitBtn`);
        const text = document.getElementById(`${type}SubmitText`);
        const spinner = document.getElementById(`${type}SubmitSpinner`);
        btn.disabled = loading;
        text.style.display = loading ? 'none' : 'inline';
        spinner.style.display = loading ? 'inline-block' : 'none';
    }

    function showSuccess() {
        successOverlay.classList.add('show');
        setTimeout(() => {
            successOverlay.classList.remove('show');
        }, 2500);
    }

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.offsetHeight; // force reflow
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // === Init ===
    loadList();

})();
