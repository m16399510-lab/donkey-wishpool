-- ============================================
-- 本杰驴的许愿王八池 - 数据库 Schema
-- 复用 Owlpost 的 Supabase 项目 & admin_credentials 表
-- ============================================

-- 1. 创建 wishes 表
CREATE TABLE IF NOT EXISTS wishes (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('bug', 'wish')),       -- bug=提交BUG, wish=许愿
    description TEXT NOT NULL,                                 -- 问题描述 / 许愿内容
    operations TEXT DEFAULT '',                                -- 相关操作（Bug专用）
    device TEXT DEFAULT '',                                    -- 设备型号（Bug专用）
    qq TEXT NOT NULL,                                          -- 联系方式（QQ号）
    attachment_url TEXT DEFAULT '',                             -- 附件URL（图片/视频）
    wish_type TEXT DEFAULT '',                                  -- 许愿分类: feature/scene/character
    admin_reply TEXT DEFAULT '',                                -- 管理员批注（驴的碎碎念）
    status TEXT NOT NULL DEFAULT 'pending'                      -- pending/processed/observing/rejected
        CHECK (status IN ('pending', 'processed', 'observing', 'rejected')),
    upvotes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 启用 RLS
ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;

-- 3. RLS 策略：允许匿名用户 INSERT（公开提交）
CREATE POLICY "Anyone can insert wishes" ON wishes
    FOR INSERT
    WITH CHECK (true);

-- 4. RLS 策略：允许匿名用户 SELECT（公开查看列表）
CREATE POLICY "Anyone can read wishes" ON wishes
    FOR SELECT
    USING (true);

-- 5. RPC 函数：点赞 +1（安全自增，防止并发问题）
CREATE OR REPLACE FUNCTION upvote_wish(p_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE wishes SET upvotes = upvotes + 1 WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', '未找到该条目');
    END IF;

    RETURN json_build_object('success', true);
END;
$$;

-- 6. RPC 函数：管理员获取所有 wishes（需要管理员登录）
CREATE OR REPLACE FUNCTION admin_get_wishes(
    p_username TEXT,
    p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_valid BOOLEAN;
    v_result JSON;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM admin_credentials
        WHERE username = p_username AND password_hash = p_password
    ) INTO v_valid;

    IF NOT v_valid THEN
        RETURN json_build_object('success', false, 'message', '用户名或密码错误');
    END IF;

    SELECT json_build_object(
        'success', true,
        'data', COALESCE(json_agg(row_to_json(t)), '[]'::json)
    )
    FROM (
        SELECT * FROM wishes ORDER BY created_at DESC
    ) t
    INTO v_result;

    RETURN v_result;
END;
$$;

-- 7. RPC 函数：管理员更新状态
CREATE OR REPLACE FUNCTION admin_update_wish_status(
    p_username TEXT,
    p_password TEXT,
    p_id INTEGER,
    p_status TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_valid BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM admin_credentials
        WHERE username = p_username AND password_hash = p_password
    ) INTO v_valid;

    IF NOT v_valid THEN
        RETURN json_build_object('success', false, 'message', '管理员验证失败');
    END IF;

    IF p_status NOT IN ('pending', 'processed', 'observing', 'rejected') THEN
        RETURN json_build_object('success', false, 'message', '无效的状态值');
    END IF;

    UPDATE wishes SET status = p_status WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', '未找到该条目');
    END IF;

    RETURN json_build_object('success', true, 'message', '状态已更新');
END;
$$;

-- 8. RPC 函数：管理员更新批注（"驴的碎碎念"）
CREATE OR REPLACE FUNCTION admin_update_wish_reply(
    p_username TEXT,
    p_password TEXT,
    p_id INTEGER,
    p_reply TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_valid BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM admin_credentials
        WHERE username = p_username AND password_hash = p_password
    ) INTO v_valid;

    IF NOT v_valid THEN
        RETURN json_build_object('success', false, 'message', '管理员验证失败');
    END IF;

    UPDATE wishes SET admin_reply = p_reply WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', '未找到该条目');
    END IF;

    RETURN json_build_object('success', true, 'message', '批注已更新');
END;
$$;

-- 8. RPC 函数：管理员删除条目
CREATE OR REPLACE FUNCTION admin_delete_wish(
    p_username TEXT,
    p_password TEXT,
    p_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_valid BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM admin_credentials
        WHERE username = p_username AND password_hash = p_password
    ) INTO v_valid;

    IF NOT v_valid THEN
        RETURN json_build_object('success', false, 'message', '管理员验证失败');
    END IF;

    DELETE FROM wishes WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', '未找到该条目');
    END IF;

    RETURN json_build_object('success', true, 'message', '已删除');
END;
$$;

-- ============================================
-- Supabase Storage 配置（需要在 Dashboard 中手动创建）
-- ============================================
-- 1. 在 Supabase Dashboard > Storage 中创建名为 "wish-attachments" 的存储桶
-- 2. 将存储桶设置为 Public（允许匿名读取）
-- 3. 在 Storage > Policies 中添加以下策略：
--    - INSERT: 允许匿名用户上传文件
--    - SELECT: 允许匿名用户读取文件
