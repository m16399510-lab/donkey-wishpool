// ============================================
// 本杰驴的许愿王八池 - 管理后台逻辑
// ============================================

(function () {
    'use strict';

    const { createClient } = supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // State
    let adminUsername = '';
    let adminPassword = '';
    let allData = [];
    let deletingId = null;

    // DOM
    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginSpinner = document.getElementById('loginSpinner');
    const dataArea = document.getElementById('dataArea');
    const searchInput = document.getElementById('searchInput');
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');
    const refreshBtn = document.getElementById('refreshBtn');
    const toast = document.getElementById('toast');

    // Delete Modal DOM
    const deleteModal = document.getElementById('deleteModal');
    const deleteModalClose = document.getElementById('deleteModalClose');
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    const deleteText = document.getElementById('deleteText');
    const deleteSpinner = document.getElementById('deleteSpinner');

    // === Login ===
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        adminUsername = document.getElementById('adminUsername').value.trim();
        adminPassword = document.getElementById('adminPassword').value;

        if (!adminUsername || !adminPassword) {
            showToast('请输入用户名和密码', 'error');
            return;
        }

        setLoginLoading(true);
        const success = await fetchData();
        setLoginLoading(false);

        if (success) {
            loginView.style.display = 'none';
            dashboardView.style.display = 'block';
        }
    });

    // === Refresh ===
    refreshBtn.addEventListener('click', () => fetchData());

    // === Search & Filter ===
    searchInput.addEventListener('input', () => renderTable(getFilteredData()));
    filterType.addEventListener('change', () => renderTable(getFilteredData()));
    filterStatus.addEventListener('change', () => renderTable(getFilteredData()));

    // === Fetch Data ===
    async function fetchData() {
        dataArea.innerHTML = `
            <div class="loading-overlay">
                <span class="spinner"></span>
                <span>正在加载数据...</span>
            </div>
        `;

        try {
            const { data, error } = await db.rpc('admin_get_wishes', {
                p_username: adminUsername,
                p_password: adminPassword
            });

            if (error) {
                showToast('查询失败：' + error.message, 'error');
                return false;
            }

            if (!data.success) {
                showToast(data.message || '登录失败', 'error');
                return false;
            }

            allData = data.data || [];
            updateStats();
            renderTable(getFilteredData());
            return true;

        } catch (err) {
            console.error('Network error:', err);
            showToast('网络错误，请重试', 'error');
            return false;
        }
    }

    // === Stats ===
    function updateStats() {
        document.getElementById('statTotal').textContent = allData.length;
        document.getElementById('statBug').textContent = allData.filter(w => w.type === 'bug').length;
        document.getElementById('statWish').textContent = allData.filter(w => w.type === 'wish').length;
        document.getElementById('statPending').textContent = allData.filter(w => w.status === 'pending').length;
    }

    // === Filter ===
    function getFilteredData() {
        const query = searchInput.value.trim().toLowerCase();
        const typeVal = filterType.value;
        const statusVal = filterStatus.value;

        return allData.filter(w => {
            const matchQuery = !query ||
                w.description.toLowerCase().includes(query) ||
                w.qq.includes(query);
            const matchType = typeVal === 'all' || w.type === typeVal;
            const matchStatus = statusVal === 'all' || w.status === statusVal;
            return matchQuery && matchType && matchStatus;
        });
    }

    // === Render Table ===
    function renderTable(data) {
        if (!data || data.length === 0) {
            dataArea.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🫏</div>
                    <p>暂无数据</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>类型</th>
                            <th>内容</th>
                            <th>QQ</th>
                            <th>👍</th>
                            <th>时间</th>
                            <th>状态操作</th>
                            <th>删除</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach((wish, index) => {
            const createdAt = new Date(wish.created_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            // Type badge
            let typeBadge = '';
            if (wish.type === 'bug') {
                typeBadge = '<span class="wish-type-badge bug">🐛 BUG</span>';
            } else {
                const wishTypeMap = {
                    'feature': '✨ 新功能',
                    'scene': '🏰 新场景',
                    'character': '🧙 新角色',
                };
                typeBadge = `<span class="wish-type-badge feature">⭐ ${wishTypeMap[wish.wish_type] || '许愿'}</span>`;
            }

            // Description cell
            let descHtml = escapeHtml(wish.description);
            if (wish.type === 'bug') {
                descHtml += `<div style="margin-top:6px;font-size:0.72rem;color:rgba(245,230,200,0.4);">
                    操作: ${escapeHtml(wish.operations)} | 设备: ${escapeHtml(wish.device)}
                </div>`;
            }
            if (wish.attachment_url) {
                descHtml += `<div style="margin-top:4px;">
                    <a href="${escapeHtml(wish.attachment_url)}" target="_blank" style="color:var(--gold);font-size:0.75rem;">📎 查看附件</a>
                </div>`;
            }

            // Status action buttons
            const statuses = [
                { key: 'processed', label: '✅ 已处理', cls: 'green' },
                { key: 'observing', label: '👀 搁置', cls: 'yellow' },
                { key: 'rejected', label: '🚫 不处理', cls: 'red' },
                { key: 'pending', label: '⏳ 待处理', cls: 'gray' },
            ];

            let statusHtml = '<div class="status-actions">';
            statuses.forEach(s => {
                const isActive = wish.status === s.key ? 'active' : '';
                statusHtml += `<button class="status-btn ${s.cls} ${isActive}"
                    onclick="setStatus(${wish.id}, '${s.key}', this)">${s.label}</button>`;
            });
            statusHtml += '</div>';

            html += `
                <tr data-id="${wish.id}">
                    <td>${index + 1}</td>
                    <td>${typeBadge}</td>
                    <td class="desc-cell">${descHtml}</td>
                    <td>${escapeHtml(wish.qq)}</td>
                    <td>${wish.upvotes}</td>
                    <td style="white-space:nowrap;font-size:0.75rem;color:rgba(245,230,200,0.4);">${createdAt}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn-action btn-delete" onclick="openDelete(${wish.id})" title="删除">🗑️</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        dataArea.innerHTML = html;
    }

    // === Set Status ===
    window.setStatus = async function (id, status, btn) {
        // Disable all sibling buttons temporarily
        const row = btn.closest('.status-actions');
        const buttons = row.querySelectorAll('.status-btn');
        buttons.forEach(b => b.disabled = true);

        try {
            const { data, error } = await db.rpc('admin_update_wish_status', {
                p_username: adminUsername,
                p_password: adminPassword,
                p_id: id,
                p_status: status
            });

            if (error) {
                showToast('更新失败: ' + error.message, 'error');
                buttons.forEach(b => b.disabled = false);
                return;
            }

            if (data && !data.success) {
                showToast(data.message || '更新失败', 'error');
                buttons.forEach(b => b.disabled = false);
                return;
            }

            showToast('状态已更新 ✨', 'success');

            // Update local data
            const wish = allData.find(w => w.id === id);
            if (wish) wish.status = status;
            updateStats();
            renderTable(getFilteredData());

        } catch (err) {
            showToast('网络错误', 'error');
            buttons.forEach(b => b.disabled = false);
        }
    };

    // === Delete ===
    window.openDelete = function (id) {
        deletingId = id;
        deleteModal.classList.add('show');
    };

    function closeDeleteModal() {
        deleteModal.classList.remove('show');
        deletingId = null;
    }

    deleteModalClose.addEventListener('click', closeDeleteModal);
    deleteCancelBtn.addEventListener('click', closeDeleteModal);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    deleteConfirmBtn.addEventListener('click', async () => {
        if (!deletingId) return;

        setDeleteLoading(true);

        try {
            const { data, error } = await db.rpc('admin_delete_wish', {
                p_username: adminUsername,
                p_password: adminPassword,
                p_id: deletingId
            });

            if (error) {
                showToast('删除失败: ' + error.message, 'error');
                setDeleteLoading(false);
                return;
            }

            if (data && !data.success) {
                showToast(data.message || '删除失败', 'error');
                setDeleteLoading(false);
                return;
            }

            showToast('已删除 🗑️', 'success');
            closeDeleteModal();
            setDeleteLoading(false);
            await fetchData();

        } catch (err) {
            showToast('网络错误', 'error');
            setDeleteLoading(false);
        }
    });

    // === Helpers ===
    function setLoginLoading(loading) {
        loginBtn.disabled = loading;
        loginText.style.display = loading ? 'none' : 'inline';
        loginSpinner.style.display = loading ? 'inline-block' : 'none';
    }

    function setDeleteLoading(loading) {
        deleteConfirmBtn.disabled = loading;
        deleteText.style.display = loading ? 'none' : 'inline';
        deleteSpinner.style.display = loading ? 'inline-block' : 'none';
    }

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.offsetHeight;
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

})();
