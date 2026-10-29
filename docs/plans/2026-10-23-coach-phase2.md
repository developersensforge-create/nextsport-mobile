# Coach Phase 2 — 教练端基础 实现计划 v2
_Created: 2026-10-23（全面审查版）_

## 目标
让 Premium 用户可以开启"教练模式"，通过分享链接或邀请码绑定学员，查看学员分析历史，并手动布置作业。

---

## 审查发现的额外问题（v1 计划遗漏项）

1. **`profiles.roles` 字段缺失** — DB 和 `/api/profile` 都没有 roles，`isCoach` 判断无从实现
2. **`/api/profile` 返回值不包含 roles** — 移动端 `Profile` interface 也没有该字段，需要同步扩展
3. **`useAuth` 不包含 profile 数据** — coach 状态判断需要 profile，目前只有 session/user，需要新增或扩展
4. **Deep Link 未配置** — `app.json` scheme 已有（`nextsport`），但 `intentFilters`（Android）和 `associatedDomains`（iOS Universal Links）为空，邀请链接无法被 App 捕获
5. **`AppNavigator` 无法动态增删 Tab** — 当前 `MainTabParamList` 静态定义，需要条件渲染 Athletes Tab 并解决 TypeScript 类型问题
6. **学员端接受邀请入口** — 需要同时处理 Deep Link 冷启动（App 未打开时点链接）和热启动（App 已打开时点链接）两种情况
7. **教练查学员分析需要权限验证** — 现有 `/api/analyses` 用 `user_id = auth.uid()` 过滤，教练无法直接查球员数据，需要新增 coach 专用 endpoint
8. **`AssignmentsScreen` 已有 source 区分（`'🤖 AI Coach'` vs `'👨‍🏫 Coach'`）** — 说明 Phase 1 已预留了人工作业展示，Phase 2 的人工作业会自动显示教练名（需要 assigned_by 关联查名字）
9. **邀请码安全性** — 6 位码需要加过期时间（24h）+ 单次使用后失效，防止被滥用
10. **教练解绑/球员退出** — 需要双向权限（教练可移除学员，球员可退出教练）
11. **`swing_analyses` 表已有 `athlete_id` 字段** — 已有 athlete 多人分析的预设，教练查看学员分析可以直接利用

---

## 数据库变更（Task 1-4）

### Task 1 — `profiles` 加 `roles` 字段
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{player}';
-- 索引（教练列表查询用）
CREATE INDEX IF NOT EXISTS idx_profiles_roles ON profiles USING GIN(roles);
```

### Task 2 — 新建 `coach_relationships` 表
```sql
CREATE TABLE coach_relationships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'active' | 'declined' | 'removed'
  invite_code  TEXT UNIQUE NOT NULL,           -- 6 位大写字母数字，单次有效
  invite_expires_at TIMESTAMPTZ NOT NULL,      -- 创建后 24h 过期
  invited_at   TIMESTAMPTZ DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, player_id)                  -- 防止重复邀请
);

-- RLS
ALTER TABLE coach_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_full_access" ON coach_relationships
  USING (coach_id = auth.uid());
CREATE POLICY "player_read_and_update" ON coach_relationships
  FOR ALL USING (player_id = auth.uid());
```

### Task 3 — `assignments` 加 `coach_note`（教练布置时的附言）
```sql
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS coach_note TEXT;
```

### Task 4 — `swing_analyses.athlete_id` 确认已存在
（已发现该字段存在，无需新增。教练查看学员分析时用此字段做关联验证。）

---

## 后端 API（Task 5-11）

### Task 5 — 扩展 `/api/profile` 返回 `roles`
文件：`src/app/api/profile/route.ts`

在返回对象中加入：
```ts
roles: profile.roles ?? ['player'],
is_coach: (profile.roles ?? ['player']).includes('coach'),
```

同步更新移动端 `Profile` interface（`src/lib/api.ts`）：
```ts
roles: string[];
is_coach: boolean;
```

### Task 6 — `PATCH /api/profile/coach-mode`（开启/关闭教练模式）
文件：`src/app/api/profile/coach-mode/route.ts`

```
权限：Premium 用户
Body: { enabled: boolean }
逻辑：
  enabled=true  → roles = array_append(roles, 'coach')（去重）
  enabled=false → roles = array_remove(roles, 'coach')
幂等：已经是 coach 再开启 → 返回成功，不报错
```

### Task 7 — `POST /api/coach/invite`（生成邀请）
文件：`src/app/api/coach/invite/route.ts`

```
权限：is_coach = true
逻辑：
  1. 生成 6 位邀请码（A-Z0-9，排除易混淆字符 O/0/I/1）
  2. 写入 coach_relationships（status=pending，expires_at=NOW+24h）
  3. 生成分享链接：https://nextsport-six.vercel.app/invite/{code}
  4. 返回 { invite_code, share_url, expires_at }

注意：
  - 同一 coach_id + player_id 若已有 active 关系 → 返回 409
  - 若存在 pending 未过期邀请 → 直接返回已有邀请码（不重复创建）
  - 邀请码生成需避免 O/0/I/1（防用户混淆）
```

### Task 8 — `POST /api/coach/invite/accept`（接受邀请）
文件：`src/app/api/coach/invite/accept/route.ts`

```
权限：任何已登录用户（球员）
Body: { invite_code: string }
逻辑：
  1. 查找 invite_code 对应记录（status=pending + expires_at > NOW）
  2. 验证：球员不能接受自己发出的邀请
  3. 若 coach_id + player_id 已有 active 关系 → 返回 409
  4. 更新 status=active，写 accepted_at=NOW
  5. 邀请码使用后单次失效（code 不可再用）
  6. 返回 { coach: { id, name, avatar_url } }
错误码：
  - 404: 邀请码不存在或已过期
  - 409: 已经是该教练的学员
  - 403: 不能接受自己的邀请
```

### Task 9 — Web 端邀请落地页（Deep Link 中间页）
文件：`src/app/invite/[code]/page.tsx`（Next.js web）

```
用途：球员在手机上点邀请链接时的过渡页
逻辑：
  1. 服务端读取 invite_code 对应的 coach 信息（名字）
  2. 展示邀请信息："Coach XX 邀请你加入 NextSport"
  3. 两个按钮：
     [在 App 中接受] → deep link: nextsport://invite/{code}
     [下载 App] → 跳 App Store / Google Play
  4. 如果 App 已安装，[在 App 中接受] 会直接拉起 App 并跳到确认页

注意：不需要登录校验，服务端只做 invite_code 有效性预检查（展示用）
```

### Task 10 — `GET /api/coach/athletes`（学员列表）
文件：`src/app/api/coach/athletes/route.ts`

```
权限：is_coach
返回：active 关系的所有学员
  - profiles(player_name, age_group, sport, level)
  - 最近一次 swing_analyses(id, status, created_at, scores)
  - 本周 pending assignments 数量
排序：最近有分析的排前面
```

### Task 11 — `GET /api/coach/athletes/[playerId]/analyses`（学员历史分析）
文件：`src/app/api/coach/athletes/[playerId]/analyses/route.ts`

```
权限：is_coach + 与该球员有 active coach_relationship
逻辑：同现有 /api/analyses 逻辑，但 user_id = playerId（不是 auth.uid()）
返回字段：同 /api/analyses，教练只读，不触发 AI Coach 生成
```

### Task 12 — `POST /api/coach/assignments`（教练布置作业）
文件：`src/app/api/coach/assignments/route.ts`

```
权限：is_coach + 与该 player_id 有 active 关系
Body: { player_id, title, description, drill_name, reps, sets, due_date, coach_note? }
写入：source='human', assigned_by=coach.id, drill_id=slugify(drill_name)
注意：assigned_by 要关联 coach 的 player_name，供学员端展示
```

### Task 13 — `DELETE /api/coach/relationships/[id]`（解除关系）
文件：`src/app/api/coach/relationships/[id]/route.ts`

```
权限：coach_id = auth.uid()（教练移除学员）
      OR player_id = auth.uid()（球员退出教练）
逻辑：status 改为 'removed'，不物理删除（保留历史记录）
      不删除已有 assignments（已布置的作业球员仍可看到）
```

---

## 移动端（Task 14-22）

### Task 14 — 扩展 `Profile` interface + `useAuth`
文件：`src/lib/api.ts`

```ts
export interface Profile {
  // 现有字段...
  roles: string[];
  is_coach: boolean;
}
```

文件：`src/hooks/useAuth.ts`

```ts
// 新增 profile 状态
const [profile, setProfile] = useState<Profile | null>(null);
// 登录后自动拉取 profile（getProfile()），挂到 useAuth 返回值
return { ...state, profile, isCoach: profile?.is_coach ?? false, ... };
```

**关键**：`isCoach` 从 `useAuth()` 全局读取，避免各屏幕重复拉取。

### Task 15 — Deep Link 配置
文件：`app.json`

```json
{
  "expo": {
    "scheme": "nextsport",
    "ios": {
      "associatedDomains": ["applinks:nextsport-six.vercel.app"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "nextsport-six.vercel.app", "pathPrefix": "/invite" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

文件：`src/navigation/AppNavigator.tsx`

```ts
// 在 NavigationContainer 上监听 Deep Link
<NavigationContainer linking={linkingConfig}>

const linkingConfig = {
  prefixes: ['nextsport://', 'https://nextsport-six.vercel.app'],
  config: {
    screens: {
      MainTabs: {
        screens: { Home: 'home' }
      },
      InviteAccept: 'invite/:code',  // 新增屏幕
    }
  }
};
```

**注意**：需要处理两种情况：
- **冷启动**（App 未打开）：`Linking.getInitialURL()` 在 AppNavigator 挂载时解析
- **热启动**（App 已打开）：`Linking.addEventListener('url', handler)` 监听

### Task 16 — `InviteAcceptScreen`（接受邀请确认页）
文件：`src/screens/InviteAcceptScreen.tsx`

```
┌─────────────────────────────┐
│         NextSport            │
│                              │
│  👨‍🏫  Coach Mike              │
│  邀请你加入他的训练计划       │
│                              │
│  [ 接受邀请 ]  ← 绿色大按钮  │
│  [ 拒绝 ]                    │
└─────────────────────────────┘
```

逻辑：
- 路由参数 `{ code: string }`
- 进入时调 `GET /api/coach/invite/preview?code=XX` 预查 coach 信息（只读）
- 点"接受"→ 调 `POST /api/coach/invite/accept`
- 成功 → 弹 Toast "已绑定 Coach Mike" → 返回 Home
- 未登录时 → 跳到 Auth 页，登录后自动回来（通过 navigation state）

（`RootStackParamList` 加 `InviteAccept: { code: string }`）

### Task 17 — Profile 页"教练模式"入口
文件：`src/screens/ProfileScreen.tsx`

Premium 用户新增两个入口：

```
┌─────────────────────────────┐
│  教练功能                    │
│  ─────────────────────────  │
│  [开启教练模式]  / [已开启✓]│  ← PATCH /api/profile/coach-mode
│  [绑定教练]                 │  ← 所有用户可见，输入邀请码
└─────────────────────────────┘
```

"绑定教练"：弹 Modal 输入 6 位邀请码（兜底方案，Deep Link 失败时用）

### Task 18 — 动态 Athletes Tab
文件：`src/navigation/AppNavigator.tsx`

```tsx
// MainTabParamList 加条件字段
export type MainTabParamList = {
  Home: undefined;
  Drills: undefined;
  Athletes?: undefined;  // 可选，isCoach 时才渲染
  Profile: undefined;
};

function MainTabs() {
  const { isCoach } = useAuth();
  return (
    <Tab.Navigator ...>
      <Tab.Screen name="Home" ... />
      <Tab.Screen name="Drills" ... />
      {isCoach && (
        <Tab.Screen
          name="Athletes"
          component={AthletesScreen}
          options={{
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen name="Profile" ... />
    </Tab.Navigator>
  );
}
```

**注意**：Tab 动态增删会导致 Tab index 变化，需要测试 Profile 始终在最后一位。

### Task 19 — `AthletesScreen`（学员列表）
文件：`src/screens/AthletesScreen.tsx`

```
┌─────────────────────────────┐
│ 我的学员              [邀请] │
├─────────────────────────────┤
│ 👤 小明   上次: 昨天  [>]   │
│ 👤 小红   上次: 3天前 [>]   │
│ 👤 Jack   上次: 1周前 [>]   │
├─────────────────────────────┤
│ 待接受邀请                   │
│ AB12CD  24h内过期  [复制]   │
└─────────────────────────────┘
```

- 拉取 `GET /api/coach/athletes`
- 点击学员行 → `AthleteDetailScreen`
- [邀请] 按钮 → 调 `POST /api/coach/invite`，弹出 ShareSheet（iOS `Share.share()`）+ 显示邀请码备用

**注意**：空状态文案 — "还没有学员，点击右上角邀请第一位学员"

### Task 20 — `AthleteDetailScreen`（学员详情）
文件：`src/screens/AthleteDetailScreen.tsx`

```
┌─────────────────────────────┐
│ ←  小明  U12 · 棒球          │
├─────────────────────────────┤
│ 历史分析 (8次)               │
│  10/23  scores: 2.8  [>]    │
│  10/21  scores: 2.4  [>]    │
│  ...                        │
├─────────────────────────────┤
│ 本周作业                     │
│  🤖 No-Stride Drill  待完成  │
│  👨‍🏫 Contact Ball Drill 待完成│
│  [+ 布置新作业]              │
└─────────────────────────────┘
```

- 历史分析：`GET /api/coach/athletes/[id]/analyses`
- 点分析 → 只读模式的 `AnalysisResultScreen`（pass `readOnly=true` prop，隐藏"再分析"按钮）
- 作业列表：`GET /api/ai-coach/assignments?player_id=XX`（需扩展现有 assignments endpoint 支持 coach 查询他人作业）
- [布置新作业] → `AssignDrillModal`

**注意**：需要扩展 `GET /api/ai-coach/assignments` 支持 `?player_id=` 参数，且验证 coach 与该 player 有 active 关系。

### Task 21 — `AssignDrillModal`（布置作业弹窗）
文件：`src/components/AssignDrillModal.tsx`

```
┌─────────────────────────────┐
│ 布置作业给 小明              │
│                              │
│ 作业名称  [_______________]  │
│ 说明      [_______________]  │
│ 次数  [20]     组数  [3]     │
│ 截止日期  [下周五 ▼]         │
│ 教练备注  [_______________]  │
│                              │
│ [取消]         [确认布置 ✓]  │
└─────────────────────────────┘
```

- 提交调 `POST /api/coach/assignments`
- 成功后刷新 AthleteDetailScreen 的作业列表
- 截止日期默认下周同一天（DatePicker）

### Task 22 — `AssignmentsScreen` 扩展显示教练名
文件：`src/screens/AssignmentsScreen.tsx`（已有，需微调）

现有代码：`source === 'ai' ? '🤖 AI Coach' : '👨‍🏫 Coach'`
需要改成：`source === 'ai' ? '🤖 AI Coach' : '👨‍🏫 Coach ${assignment.coach_name}'`

- `GET /api/ai-coach/assignments` 返回值加上 `coach_name`（join profiles on assigned_by）

---

## 工作量估算（修订版）

| # | 任务 | 估时 |
|---|------|------|
| 1-4 | DB 迁移 | 1h |
| 5 | `/api/profile` 扩展 roles | 30m |
| 6 | `/api/profile/coach-mode` | 30m |
| 7 | `/api/coach/invite` 生成邀请 | 45m |
| 8 | `/api/coach/invite/accept` 接受 | 45m |
| 9 | Web 落地页 `/invite/[code]` | 1h |
| 10 | `/api/coach/athletes` | 45m |
| 11 | `/api/coach/athletes/[id]/analyses` | 30m |
| 12 | `/api/coach/assignments` 布置 | 30m |
| 13 | `/api/coach/relationships/[id]` 解绑 | 30m |
| 14 | Profile interface + useAuth 扩展 | 30m |
| 15 | Deep Link 配置（app.json + Navigator） | 1.5h |
| 16 | `InviteAcceptScreen` | 1h |
| 17 | Profile 页教练入口 + 输入码 Modal | 45m |
| 18 | 动态 Athletes Tab | 45m |
| 19 | `AthletesScreen` | 1.5h |
| 20 | `AthleteDetailScreen` | 2h |
| 21 | `AssignDrillModal` | 1h |
| 22 | `AssignmentsScreen` 加教练名 | 20m |
| — | 部署 + E2E 验证 + APK 构建 | 1.5h |
| **总计** | | **~17h** |

（v1 估算 11.5h，修订后 17h，增量主要来自 Deep Link、InviteAcceptScreen、Web 落地页、useAuth 扩展、权限验证补全。）

---

## 执行顺序

```
阶段一（后端基础）:
  Task 1→2→3→4（DB）→ Task 5→6（Profile API）→ Task 7→8→9（邀请流程）

阶段二（后端数据）:
  Task 10→11→12→13（Athletes + 作业 API）

阶段三（移动端）:
  Task 14（接口扩展）→ Task 15（Deep Link）→ Task 16（InviteAcceptScreen）
  → Task 17（Profile 入口）→ Task 18（Tab）→ Task 19→20→21→22（屏幕）

阶段四:
  部署 Vercel → 构建 APK → E2E 验证
```

---

## 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 邀请方式 | Deep Link 为主 + 手动输码兜底 | 零摩擦体验，覆盖所有场景 |
| 邀请码有效期 | 24h + 单次使用后失效 | 安全，防滥用 |
| 邀请码字符集 | A-Z0-9 排除 O/0/I/1 | 防口头传递混淆 |
| coach 解绑 | status=removed，不删数据 | 保留历史记录 |
| 作业归属 | assignments.coach_note 而非新表 | 简单，Phase 2 够用 |
| 学员分析权限 | coach 专用 endpoint，验证关系 | 安全隔离 |
| AI Coach 显示 | 始终 🤖 + AI 标记 | 永不让 AI 假装是真人 |
| isCoach 状态 | 从 useAuth 全局读取 | 避免各屏幕重复拉取 profile |

---

## 不在 Phase 2 范围内（Phase 3）
- 视频时间戳批注
- 语音反馈录制/播放
- 球员上传执行视频 + AI 评估质量
- 团队/小组管理（多个教练，多个学员组）
