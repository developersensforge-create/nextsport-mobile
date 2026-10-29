# Plan: Drills 视频 URL 迁移到后端 + 定期校验

**日期：** 2026-07-16  
**作者：** Soren  
**状态：** 待执行  
**关联 Confluence：** https://sensforge.atlassian.net/wiki/x/AQD_E (Alpha Test Feedback)

---

## 背景 & 根因

当前 drill 视频 URL 硬编码在 `nextsport-mobile/src/data/drills.ts`。存在两个问题：

1. **YouTube Shorts 无法内嵌播放**（error 152）：`batpath-02`、`pitch-02`、`pitch-04` 三个 drill 使用了 `youtube.com/shorts/` 链接，YouTube 平台策略禁止 Shorts iframe embed，与地区/VPN 无关
2. **普通视频可能随时失效**：视频 owner 可关闭 embed 权限、视频可被删除，硬编码 URL 失效后只能发版修复

**问题性质：** 这是一个需求/设计变更（视频数据从客户端静态文件迁移到后端数据库），不只是 bug 修复。

---

## 目标

1. 将 drill 的 `referenceVideo` 数据从移动端代码迁移到 Supabase 数据库
2. 移动端通过 API 获取视频 URL，无需发版即可修改
3. 加入定期视频链接健康检查 cron job，失效视频自动告警
4. 更新相关文档（Confluence、skill）

---

## 不影响其他功能的边界

- **只新增** `drill_videos` 表，不修改现有任何表
- **只新增** `/api/drills/videos` API 路由，不动现有 API
- 移动端 `drills.ts` 保留所有 drill 元数据（title、steps、duration 等），**只移出** `referenceVideo` 字段
- 移动端启动时拉取视频 URL，网络失败时降级为无视频（不崩溃）
- 后端 `nextsport/src/data/drills.ts` 不动（web 端用不同数据结构）

---

## 实施步骤

### Step 1 — Supabase 建表

```sql
CREATE TABLE drill_videos (
  drill_id      TEXT PRIMARY KEY,           -- 对应 drills.ts 里的 id，如 'field-02'
  youtube_url   TEXT NOT NULL,              -- 完整 YouTube URL
  title         TEXT NOT NULL,              -- 视频标题
  creator       TEXT NOT NULL,              -- 频道名
  note          TEXT,                       -- 可选说明，如 'Watch 0:20 – 1:41'
  is_embeddable BOOLEAN DEFAULT true,       -- false = Shorts 或禁止 embed，降级为外链
  is_active     BOOLEAN DEFAULT true,       -- false = 视频失效，不展示
  last_checked  TIMESTAMPTZ,                -- 上次健康检查时间
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 允许匿名读取（app 不需要登录就能看 drills）
ALTER TABLE drill_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON drill_videos FOR SELECT USING (true);
```

**初始数据（12 条）：**

| drill_id | is_embeddable | 备注 |
|----------|--------------|------|
| hip-03 | true | youtu.be 普通视频 |
| batpath-01 | true | youtu.be 普通视频 |
| batpath-02 | **false** | Shorts，禁止 embed |
| batpath-03 | true | youtu.be 普通视频 |
| contact-01 | true | watch?v= 普通视频 |
| field-01 | true | watch?v= 普通视频 |
| field-02 | true | watch?v= 普通视频 |
| field-03 | true | watch?v= 普通视频 |
| field-04 | true | watch?v= 普通视频 |
| pitch-01 | true | youtu.be 普通视频 |
| pitch-02 | **false** | Shorts，禁止 embed |
| pitch-03 | true | youtu.be 普通视频 |
| pitch-04 | **false** | Shorts，禁止 embed |

---

### Step 2 — 后端 API 路由

新增 `nextsport/src/app/api/drills/videos/route.ts`：

```typescript
// GET /api/drills/videos
// 返回所有 is_active=true 的视频记录
// 无需鉴权（public read）
// 响应：{ videos: DrillVideo[] }
```

- 只返回 `is_active = true` 的记录
- 缓存头：`Cache-Control: public, max-age=3600`（1小时，减少请求）
- 部署在 nextsport-sensforge.vercel.app

---

### Step 3 — 移动端改造

**`src/data/drills.ts`（移动端）：**
- 删除所有 `referenceVideo` 字段
- `ReferenceVideo` interface 和 `referenceVideo?: ReferenceVideo` 字段保留类型定义，但数据从 API 来

**新增 `src/lib/drillVideos.ts`：**
- `fetchDrillVideos()` — 拉取 `/api/drills/videos`，返回 `Map<drillId, DrillVideo>`
- 失败时返回空 Map（降级，drill 照常显示，只是没有视频）
- 结果缓存在内存，app 生命周期内只请求一次

**`DrillsScreen.tsx`：**
- `useEffect` 启动时调用 `fetchDrillVideos()`，存入 state
- 列表卡片缩略图：`videoMap.get(drill.id)` 有值才显示，无值显示 icon
- 详情 Modal：同上，有视频才渲染 `YouTubePlayer`，`is_embeddable=false` 直接走外链模式

---

### Step 4 — 定期视频健康检查 Cron Job

**Hermes cron job，每周一 09:00 UTC 运行：**

检查逻辑：
1. 查 Supabase `drill_videos` 表，获取所有 `is_active=true` 的记录
2. 对每条记录，用 YouTube oEmbed API 检查视频是否存活：
   `GET https://www.youtube.com/oembed?url={youtube_url}&format=json`
   - 200 = 视频存活
   - 404/401 = 视频已删除或私有
3. 检查 embed 是否被禁用：请求 `https://www.youtube.com/embed/{video_id}` 看响应头中是否含 `X-Frame-Options: DENY`
4. 发现问题 → 发 Feishu 告警（列出失效的 drill_id + URL）
5. 更新 `last_checked` 字段

**告警格式：**
```
⚠️ NextSport Drill 视频健康检查
发现 N 个问题：
- field-02 (sGkiOMijWg4): 视频已删除
- batpath-01 (CPzMopFu95M): embed 被禁用
请登录 Supabase 更新 drill_videos 表
```

---

### Step 5 — 文档更新

1. **Confluence Alpha Test Feedback** — 标记 Drills 视频问题为已修复，注明设计变更
2. **nextsport-mobile skill** — 更新视频播放章节，说明视频 URL 来自后端
3. **本 plan 文件** — 执行完成后更新状态为 Done

---

## 文件变动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| Supabase `drill_videos` 表 | 新增 | 存储视频元数据 |
| `nextsport/src/app/api/drills/videos/route.ts` | 新增 | 公开 GET API |
| `nextsport-mobile/src/data/drills.ts` | 修改 | 移除 referenceVideo 字段数据 |
| `nextsport-mobile/src/lib/drillVideos.ts` | 新增 | 拉取+缓存视频数据 |
| `nextsport-mobile/src/screens/DrillsScreen.tsx` | 修改 | 从 API 读取视频，降级处理 |
| Hermes cron job | 新增 | 每周视频健康检查 |
| Confluence 文档 | 更新 | 记录设计变更 |
| nextsport-mobile skill | 更新 | 视频来源说明 |

**不动的文件：**
- `nextsport-mobile/src/components/YouTubePlayer.tsx` — 不变
- `nextsport/src/data/drills.ts` — web 端数据，不动
- 所有现有 API 路由 — 不动
- 所有现有 Supabase 表 — 不动

---

## 测试验证

1. API 返回正确 JSON，包含所有 12 条视频
2. 移动端 Drills 列表正确显示缩略图（有视频的 drill）
3. 详情页普通视频能 iframe 播放
4. 详情页 Shorts（is_embeddable=false）直接显示外链按钮
5. 网络断开时，drills 正常显示（无视频），不崩溃
6. 在 Supabase 手动修改一条 URL → 不发版 → app 重启后生效

---

## 风险

| 风险 | 概率 | 应对 |
|------|------|------|
| API 请求失败（网络差）| 中 | 降级为无视频，不影响 drill 内容 |
| Vercel 冷启动延迟 | 低 | 缓存 1h，启动后只请求一次 |
| Shorts 3 条无缩略图 | - | 已知，显示 icon fallback |

---

## 执行顺序

1. Step 1 建表 + 插入初始数据（~15 min）
2. Step 2 后端 API + 部署（~20 min）
3. Step 3 移动端改造（~30 min）
4. tsc 检查 + 本地验证
5. commit + push + 重新打包两端
6. Step 4 cron job（~15 min）
7. Step 5 文档更新（~10 min）

**预计总耗时：约 1.5 小时**
