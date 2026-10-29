# AI Coach Phase 1 Implementation Plan

> **Goal:** 球员完成挥棒分析后，AI Coach 自动生成训练总结 + 本周作业，并在 Home 页展示"AI Coach 卡片"和"本周任务列表"。所有 Premium 用户自动享有，无需任何配置。

**Architecture:**
- 后端：分析完成后新增 `/api/ai-coach/generate` 接口，调用 LLM 生成教练总结和作业；作业存入新建的 `assignments` 表。
- 前端（Mobile）：Home 页加 AI Coach 卡片 + 任务列表；新增 AssignmentsScreen 查看详情。
- 触发方式：`AnalysisResultScreen` 展示结果的同时，后台静默调用 generate 接口。

**Tech Stack:** Next.js API Routes, Supabase (PostgreSQL), OpenAI GPT-4o, React Native / Expo

**Repos:**
- 后端：`/home/agents/claire/workspace/nextsport/`
- 移动端：`/home/agents/claire/workspace/nextsport-mobile/`

**分支：** 所有改动在 `feat/ai-coach-phase1` 分支上进行，禁止直接推 main。

---

## Task 1: 数据库 — 创建 `assignments` 表 migration

**Objective:** 在 Supabase 创建 `assignments` 表，存储 AI Coach 生成的训练作业。

**Files:**
- Create: `nextsport/supabase/migrations/20261019000000_add_assignments.sql`

**Step 1: 写 migration 文件**

```sql
-- supabase/migrations/20261019000000_add_assignments.sql

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),  -- NULL = AI Coach
  source TEXT NOT NULL DEFAULT 'ai',          -- 'ai' | 'human'
  analysis_id UUID REFERENCES swing_analyses(id) ON DELETE SET NULL,
  drill_id TEXT,                              -- 对应 drills.ts 中的 drill id
  drill_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reps INTEGER,
  sets INTEGER,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'completed' | 'skipped'
  ai_summary TEXT,                            -- AI 教练总结（该次分析的 coach tone 总结）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- 球员只能看自己的作业
CREATE POLICY "player_select_own_assignments"
  ON assignments FOR SELECT
  USING (auth.uid() = player_id);

-- 球员只能更新自己作业的 status
CREATE POLICY "player_update_own_assignment_status"
  ON assignments FOR UPDATE
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- service role 可以 insert（AI Coach 后端用 service role 写入）
CREATE POLICY "service_insert_assignments"
  ON assignments FOR INSERT
  WITH CHECK (TRUE);  -- service role bypasses RLS anyway

-- index
CREATE INDEX idx_assignments_player_id ON assignments(player_id);
CREATE INDEX idx_assignments_analysis_id ON assignments(analysis_id);
CREATE INDEX idx_assignments_status ON assignments(player_id, status);
```

**Step 2: 应用到 Supabase**

```bash
cd /home/agents/claire/workspace/nextsport
# 使用 supabase CLI 推送（或直接在 Supabase Dashboard SQL Editor 执行）
cat supabase/migrations/20261019000000_add_assignments.sql
# 复制内容到 Supabase Dashboard > SQL Editor > 执行
```

**Step 3: 验证表创建成功**

在 Supabase Dashboard > Table Editor，确认 `assignments` 表存在，字段正确。

**Step 4: Commit**

```bash
cd /home/agents/claire/workspace/nextsport
git checkout -b feat/ai-coach-phase1
git add supabase/migrations/20261019000000_add_assignments.sql
git commit -m "feat(db): add assignments table for AI Coach phase 1"
```

---

## Task 2: 后端 — AI Coach 生成接口 `/api/ai-coach/generate`

**Objective:** 创建 POST 接口，接收 `analysis_id`，读取分析结果，调用 GPT-4o 生成教练总结 + 2 个训练作业，写入 `assignments` 表。

**Files:**
- Create: `nextsport/src/app/api/ai-coach/generate/route.ts`

**Step 1: 写接口文件**

```typescript
// src/app/api/ai-coach/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 从 drills.ts 里挑选最相关的 drill（简化版：根据 AI 推荐匹配）
function pickDrills(recommendedDrills: string[], count = 2) {
  // recommendedDrills 来自 swing_analyses.recommended_drills (jsonb)
  // 直接用前 N 个，若不足则用默认
  const defaults = [
    { drill_id: 'tee-work-basics', drill_name: 'Tee Work Basics' },
    { drill_id: 'hip-rotation-drill', drill_name: 'Hip Rotation Drill' },
  ]
  const picks = (recommendedDrills || []).slice(0, count).map((name: string) => ({
    drill_id: name.toLowerCase().replace(/\s+/g, '-'),
    drill_name: name,
  }))
  while (picks.length < count) picks.push(defaults[picks.length])
  return picks.slice(0, count)
}

export async function POST(req: NextRequest) {
  try {
    const { analysis_id, player_id } = await req.json()
    if (!analysis_id || !player_id) {
      return NextResponse.json({ error: 'Missing analysis_id or player_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. 读取分析结果
    const { data: analysis, error: analysisErr } = await supabase
      .from('swing_analyses')
      .select('raw_analysis, strengths, improvements, recommended_drills, training_priorities, scores')
      .eq('id', analysis_id)
      .eq('user_id', player_id)
      .single()

    if (analysisErr || !analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    // 2. 检查 Premium（非 Premium 不生成，静默返回）
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', player_id)
      .single()

    const isPremium = sub?.plan === 'premium' && sub?.status === 'active'
    if (!isPremium) {
      return NextResponse.json({ skipped: true, reason: 'free_user' })
    }

    // 3. 检查今天是否已经为这个 analysis 生成过（防重复）
    const { data: existing } = await supabase
      .from('assignments')
      .select('id')
      .eq('analysis_id', analysis_id)
      .eq('source', 'ai')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ skipped: true, reason: 'already_generated' })
    }

    // 4. 调用 GPT-4o 生成教练总结
    const prompt = `
You are an experienced baseball/softball hitting coach. A player just completed a swing analysis.
Based on the analysis results below, write:
1. A short coach summary (2-3 sentences, encouraging but honest, like a real coach talking to a youth player)
2. Two specific training assignments for this week

Analysis results:
- Strengths: ${JSON.stringify(analysis.strengths)}
- Areas to improve: ${JSON.stringify(analysis.improvements)}
- Recommended drills: ${JSON.stringify(analysis.recommended_drills)}
- Training priorities: ${analysis.training_priorities || 'Not specified'}

Respond in JSON format:
{
  "coach_summary": "...",
  "assignments": [
    {
      "title": "...",
      "description": "...(1-2 sentences with specific focus)",
      "reps": 20,
      "sets": 3
    },
    {
      "title": "...",
      "description": "...",
      "reps": 15,
      "sets": 3
    }
  ]
}

Keep language simple and age-appropriate for youth players (ages 7-17). Be specific and actionable.
`.trim()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 600,
    })

    const generated = JSON.parse(completion.choices[0].message.content || '{}')
    const { coach_summary, assignments: aiAssignments } = generated

    if (!coach_summary || !Array.isArray(aiAssignments)) {
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    // 5. 匹配 drill
    const drills = pickDrills(analysis.recommended_drills || [])

    // 6. 写入 assignments 表
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7) // 一周后截止

    const rows = aiAssignments.slice(0, 2).map((a: any, i: number) => ({
      player_id,
      assigned_by: null,
      source: 'ai',
      analysis_id,
      drill_id: drills[i]?.drill_id || null,
      drill_name: drills[i]?.drill_name || a.title,
      title: a.title,
      description: a.description,
      reps: a.reps || 15,
      sets: a.sets || 3,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'pending',
      ai_summary: i === 0 ? coach_summary : null, // 总结只存在第一条
    }))

    const { error: insertErr } = await supabase.from('assignments').insert(rows)
    if (insertErr) {
      console.error('assignments insert error:', insertErr)
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, summary: coach_summary, count: rows.length })
  } catch (err: any) {
    console.error('ai-coach/generate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

**Step 2: 确认 `OPENAI_API_KEY` 已在 Vercel 环境变量中配置**

```bash
# 检查本地 .env.local 是否有
grep OPENAI_API_KEY /home/agents/claire/workspace/nextsport/.env.local
```

如果没有，在 Vercel Dashboard > Settings > Environment Variables 添加。

**Step 3: 验证接口**

```bash
# 本地测试（需要有效的 analysis_id 和 player_id）
curl -X POST http://localhost:3000/api/ai-coach/generate \
  -H "Content-Type: application/json" \
  -d '{"analysis_id": "<uuid>", "player_id": "<uuid>"}'
# 期望返回: {"success": true, "summary": "...", "count": 2}
```

**Step 4: Commit**

```bash
cd /home/agents/claire/workspace/nextsport
git add src/app/api/ai-coach/generate/route.ts
git commit -m "feat(api): add /api/ai-coach/generate endpoint"
```

---

## Task 3: 后端 — 作业查询接口 `/api/ai-coach/assignments`

**Objective:** 提供 GET 接口让移动端拉取当前用户的待完成作业列表；提供 PATCH 接口更新作业状态。

**Files:**
- Create: `nextsport/src/app/api/ai-coach/assignments/route.ts`
- Create: `nextsport/src/app/api/ai-coach/assignments/[id]/route.ts`

**Step 1: 写列表接口**

```typescript
// src/app/api/ai-coach/assignments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending' // pending | completed | all
    const limit = parseInt(searchParams.get('limit') || '10')

    const service = createServiceClient()
    let query = service
      .from('assignments')
      .select('id, drill_id, drill_name, title, description, reps, sets, due_date, status, ai_summary, source, created_at, analysis_id')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ assignments: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

**Step 2: 写状态更新接口**

```typescript
// src/app/api/ai-coach/assignments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { status } = await req.json()
    if (!['completed', 'skipped', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const service = createServiceClient()
    const { error } = await service
      .from('assignments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('player_id', user.id)  // 确保只能更新自己的

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/ai-coach/assignments/route.ts \
        src/app/api/ai-coach/assignments/\[id\]/route.ts
git commit -m "feat(api): add assignments GET and PATCH endpoints"
```

---

## Task 4: 移动端 — API 层封装

**Objective:** 在 `lib/api.ts` 里加入 AI Coach 相关的 API 调用函数，供 UI 层使用。

**Files:**
- Modify: `nextsport-mobile/src/lib/api.ts`

**Step 1: 在 `api.ts` 末尾追加以下函数**

```typescript
// ─── AI Coach ───────────────────────────────────────────

export interface Assignment {
  id: string
  drill_id: string | null
  drill_name: string
  title: string
  description: string | null
  reps: number | null
  sets: number | null
  due_date: string | null
  status: 'pending' | 'completed' | 'skipped'
  ai_summary: string | null
  source: 'ai' | 'human'
  created_at: string
  analysis_id: string | null
}

/** 触发 AI Coach 为某次分析生成作业（静默，失败不影响主流程）*/
export async function triggerAiCoachGenerate(
  analysisId: string,
  playerId: string,
  token: string
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/ai-coach/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ analysis_id: analysisId, player_id: playerId }),
    })
    // 静默：不 throw，不阻塞调用方
  } catch (e) {
    console.warn('[AI Coach] generate failed (silent):', e)
  }
}

/** 获取当前用户的作业列表 */
export async function getAssignments(
  token: string,
  status: 'pending' | 'completed' | 'all' = 'pending'
): Promise<Assignment[]> {
  const res = await fetch(`${API_BASE}/api/ai-coach/assignments?status=${status}&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch assignments')
  const data = await res.json()
  return data.assignments || []
}

/** 标记作业为完成或跳过 */
export async function updateAssignmentStatus(
  id: string,
  status: 'completed' | 'skipped',
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai-coach/assignments/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('Failed to update assignment')
}
```

**Step 2: 确认 `API_BASE` 变量已在 `api.ts` 顶部定义**

```typescript
// 确认已有这行（通常是 EXPO_PUBLIC_API_URL 或固定 URL）
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://nextsport-six.vercel.app'
```

**Step 3: Commit**

```bash
cd /home/agents/claire/workspace/nextsport-mobile
git checkout -b feat/ai-coach-phase1
git add src/lib/api.ts
git commit -m "feat(api): add AI Coach API functions to api.ts"
```

---

## Task 5: 移动端 — 分析完成后触发 AI Coach

**Objective:** 在 `AnalysisResultScreen` 分析结果加载完成后，静默触发 AI Coach 生成作业。

**Files:**
- Modify: `nextsport-mobile/src/screens/AnalysisResultScreen.tsx`

**Step 1: 在文件顶部 import 新函数**

找到现有 import 区块，加入：

```typescript
import { triggerAiCoachGenerate, /* ...existing imports */ } from '@/lib/api'
```

**Step 2: 找到分析结果加载完成的地方**

在 `AnalysisResultScreen` 里找到 `status === 'completed'` 或 `poll` 结束后的回调（即分析结果成功拿到的地方），加入触发调用：

```typescript
// 在分析结果成功加载后，静默触发 AI Coach（不 await，不 block UI）
if (analysis?.status === 'completed' && session?.access_token && profile?.id) {
  triggerAiCoachGenerate(analysis.id, profile.id, session.access_token)
}
```

> ⚠️ 注意：`triggerAiCoachGenerate` 内部已处理异常，不会 throw，直接调用即可，无需 try/catch。

**Step 3: 确认不影响现有流程**

运行 app，完成一次分析，观察控制台是否有 `[AI Coach] generate` 相关日志（成功则无日志，失败则有 warn）。

**Step 4: Commit**

```bash
git add src/screens/AnalysisResultScreen.tsx
git commit -m "feat(screen): trigger AI Coach generate after analysis completes"
```

---

## Task 6: 移动端 — AI Coach 卡片组件

**Objective:** 创建独立的 `AiCoachCard` 组件，展示 AI Coach 最新总结和待完成任务数。

**Files:**
- Create: `nextsport-mobile/src/components/AiCoachCard.tsx`

**Step 1: 写组件**

```typescript
// src/components/AiCoachCard.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/theme'
import type { Assignment } from '@/lib/api'

interface Props {
  assignments: Assignment[]
  loading: boolean
  onViewAll: () => void
}

export default function AiCoachCard({ assignments, loading, onViewAll }: Props) {
  const pending = assignments.filter(a => a.status === 'pending')
  const latestSummary = assignments.find(a => a.ai_summary)?.ai_summary

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>🤖</Text>
          </View>
          <View>
            <Text style={styles.title}>AI Coach</Text>
            <Text style={styles.subtitle}>NextSport Intelligence</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryBox}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : latestSummary ? (
          <Text style={styles.summaryText}>"{latestSummary}"</Text>
        ) : (
          <Text style={styles.emptyText}>
            Complete a swing analysis to get personalized coaching feedback.
          </Text>
        )}
      </View>

      {/* Task count + CTA */}
      <TouchableOpacity style={styles.footer} onPress={onViewAll} activeOpacity={0.7}>
        <View style={styles.taskRow}>
          <Ionicons name="clipboard-outline" size={16} color={COLORS.accent} />
          <Text style={styles.taskText}>
            {loading
              ? 'Loading tasks...'
              : pending.length > 0
              ? `${pending.length} task${pending.length > 1 ? 's' : ''} this week`
              : 'No pending tasks'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 20 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15 },
  subtitle: { color: '#6b7280', fontSize: 12, marginTop: 1 },
  badge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  summaryBox: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  summaryText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
})
```

**Step 2: Commit**

```bash
git add src/components/AiCoachCard.tsx
git commit -m "feat(component): add AiCoachCard component"
```

---

## Task 7: 移动端 — Home 页集成 AI Coach 卡片

**Objective:** 在 `HomeScreen` 里加载作业数据，并在"最近分析"上方渲染 `AiCoachCard`。

**Files:**
- Modify: `nextsport-mobile/src/screens/HomeScreen.tsx`

**Step 1: 添加 import**

```typescript
import AiCoachCard from '@/components/AiCoachCard'
import { getAssignments, Assignment } from '@/lib/api'
```

**Step 2: 添加状态**

在现有 `const [profile, setProfile] = useState(...)` 附近加：

```typescript
const [assignments, setAssignments] = useState<Assignment[]>([])
const [assignmentsLoading, setAssignmentsLoading] = useState(false)
```

**Step 3: 加载作业数据**

在现有 `loadData` 函数（或 `useFocusEffect` 里的数据加载）中追加：

```typescript
// 只对 premium 用户加载（非 premium 跳过）
if (profile?.subscription_status === 'premium') {
  setAssignmentsLoading(true)
  try {
    const token = session?.access_token || ''
    const data = await getAssignments(token, 'pending')
    setAssignments(data)
  } catch (e) {
    console.warn('Failed to load assignments:', e)
  } finally {
    setAssignmentsLoading(false)
  }
}
```

**Step 4: 在 JSX 里插入 AiCoachCard**

找到"Recent Analyses"标题上方，插入：

```tsx
{/* AI Coach Card — Premium only */}
{profile?.subscription_status === 'premium' && (
  <AiCoachCard
    assignments={assignments}
    loading={assignmentsLoading}
    onViewAll={() => navigation.navigate('Assignments')}  // Task 8 会加这个 screen
  />
)}
```

**Step 5: 验证**

- Premium 账号登录 → Home 页显示 AI Coach 卡片
- Free 账号登录 → 不显示（不渲染）
- 完成一次分析后返回 Home → 卡片有总结文字和任务数

**Step 6: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat(screen): integrate AiCoachCard into HomeScreen"
```

---

## Task 8: 移动端 — Assignments 详情页

**Objective:** 创建 `AssignmentsScreen`，展示全部待完成作业，支持标记完成/跳过。

**Files:**
- Create: `nextsport-mobile/src/screens/AssignmentsScreen.tsx`
- Modify: `nextsport-mobile/src/navigation/AppNavigator.tsx`

**Step 1: 写 AssignmentsScreen**

```typescript
// src/screens/AssignmentsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/hooks/useAuth'
import { getAssignments, updateAssignmentStatus, Assignment } from '@/lib/api'
import { COLORS } from '@/theme'

export default function AssignmentsScreen() {
  const { session } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const data = await getAssignments(session.access_token, 'all')
      setAssignments(data)
    } catch (e) {
      console.warn('load assignments error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session?.access_token])

  useEffect(() => { load() }, [load])

  const handleMark = async (id: string, status: 'completed' | 'skipped') => {
    if (!session?.access_token) return
    try {
      await updateAssignmentStatus(id, status, session.access_token)
      setAssignments(prev =>
        prev.map(a => a.id === id ? { ...a, status } : a)
      )
    } catch {
      Alert.alert('Error', 'Failed to update task. Please try again.')
    }
  }

  const renderItem = ({ item }: { item: Assignment }) => {
    const isDone = item.status === 'completed'
    const isSkipped = item.status === 'skipped'
    return (
      <View style={[styles.card, (isDone || isSkipped) && styles.cardDone]}>
        {/* Source badge */}
        <View style={styles.cardHeader}>
          <Text style={styles.source}>{item.source === 'ai' ? '🤖 AI Coach' : '👨‍🏫 Coach'}</Text>
          {isDone && <Text style={styles.doneLabel}>✓ Done</Text>}
          {isSkipped && <Text style={styles.skipLabel}>Skipped</Text>}
        </View>

        <Text style={[styles.title, isDone && styles.titleDone]}>{item.title}</Text>

        {item.description ? (
          <Text style={styles.desc}>{item.description}</Text>
        ) : null}

        {/* Meta */}
        <View style={styles.meta}>
          {item.reps ? <Text style={styles.metaText}>🔁 {item.reps} reps × {item.sets || 3} sets</Text> : null}
          {item.due_date ? (
            <Text style={styles.metaText}>📅 Due {new Date(item.due_date).toLocaleDateString()}</Text>
          ) : null}
        </View>

        {/* Actions */}
        {!isDone && !isSkipped && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.btnDone}
              onPress={() => handleMark(item.id, 'completed')}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#0d1326" />
              <Text style={styles.btnDoneText}>Mark Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSkip}
              onPress={() => handleMark(item.id, 'skipped')}
            >
              <Text style={styles.btnSkipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.container}
      data={assignments}
      keyExtractor={i => i.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.accent} />}
      ListHeaderComponent={
        <Text style={styles.heading}>My Training Tasks</Text>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No tasks yet.</Text>
          <Text style={styles.emptyHint}>Complete a swing analysis to get your first AI Coach assignment.</Text>
        </View>
      }
      contentContainerStyle={assignments.length === 0 && styles.emptyContainer}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1326' },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', margin: 16, marginBottom: 8 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardDone: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  source: { color: '#6b7280', fontSize: 12 },
  doneLabel: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  skipLabel: { color: '#6b7280', fontSize: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  titleDone: { textDecorationLine: 'line-through', color: '#6b7280' },
  desc: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  meta: { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  metaText: { color: '#6b7280', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  btnDone: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDoneText: { color: '#0d1326', fontWeight: '700', fontSize: 14 },
  btnSkip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSkipText: { color: '#6b7280', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyContainer: { flex: 1 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyHint: { color: '#6b7280', fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
```

**Step 2: 在 AppNavigator 注册新 Screen**

找到 `AppStack` 的 Stack.Screen 列表，加入：

```typescript
import AssignmentsScreen from '@/screens/AssignmentsScreen'

// 在 AppStack 里加：
<Stack.Screen
  name="Assignments"
  component={AssignmentsScreen}
  options={{ title: 'My Tasks', headerStyle: { backgroundColor: '#0d1326' }, headerTintColor: '#fff' }}
/>
```

**Step 3: 验证**

- 点击 AI Coach 卡片的 chevron → 跳转到 Assignments 页
- 点"Mark Complete" → 任务变灰加删除线
- 下拉刷新 → 数据重新加载

**Step 4: Commit**

```bash
git add src/screens/AssignmentsScreen.tsx src/navigation/AppNavigator.tsx
git commit -m "feat(screen): add AssignmentsScreen with task list and mark complete"
```

---

## Task 9: 后端部署到 Vercel

**Objective:** 将后端改动部署到生产环境。

**Step 1: 切到 nextsport 目录，确认改动**

```bash
cd /home/agents/claire/workspace/nextsport
git log --oneline feat/ai-coach-phase1 | head -5
```

**Step 2: 创建 PR（不直接 push main）**

```bash
git push origin feat/ai-coach-phase1
# 在 GitHub 上创建 PR: feat/ai-coach-phase1 → main
```

**Step 3: PR 合并后部署**

```bash
# PR merge 后，Vercel 自动触发生产部署
# 或手动触发：
npx vercel --token VERCEL_TOKEN_REDACTED \
  --scope team_xlpcI3fORGQye1x9fcgzyFnf --yes --prod --force

# 部署完成后更新别名
DEPLOY_URL="<新部署URL>"
npx vercel alias set "$DEPLOY_URL" nextsport-sensforge.vercel.app \
  --token VERCEL_TOKEN_REDACTED \
  --scope team_xlpcI3fORGQye1x9fcgzyFnf
npx vercel alias set "$DEPLOY_URL" rt-sensforge.vercel.app \
  --token VERCEL_TOKEN_REDACTED \
  --scope team_xlpcI3fORGQye1x9fcgzyFnf
```

**Step 4: 冒烟测试**

```bash
curl -X POST https://nextsport-six.vercel.app/api/ai-coach/generate \
  -H "Content-Type: application/json" \
  -d '{"analysis_id": "invalid", "player_id": "invalid"}'
# 期望返回 404 Analysis not found（说明接口已上线）
```

---

## Task 10: 端到端验证

**Objective:** 完整走一遍用户流程，确认 Phase 1 正常工作。

**验证清单：**

```
[ ] Premium 账号登录 → Home 页显示 AI Coach 卡片
[ ] Free 账号登录 → Home 页不显示 AI Coach 卡片
[ ] Premium 账号完成一次挥棒分析
[ ] AnalysisResultScreen 加载完成后，后台静默调用 generate（可在 Vercel logs 确认）
[ ] 返回 Home → AI Coach 卡片显示总结文字
[ ] 卡片显示"N tasks this week"
[ ] 点击卡片 → 跳转 AssignmentsScreen
[ ] AssignmentsScreen 显示 2 个待完成作业（标题、描述、rep/set、截止日）
[ ] 点"Mark Complete" → 任务变灰
[ ] 点"Skip" → 任务变灰
[ ] 下拉刷新 → 状态持久化（刷新后仍是 completed/skipped）
[ ] Supabase assignments 表中有正确数据
```

---

## 总结

| Task | 工作量 | 文件 |
|------|--------|------|
| 1. DB Migration | 30 min | `supabase/migrations/...sql` |
| 2. generate API | 1h | `api/ai-coach/generate/route.ts` |
| 3. assignments API | 30 min | `api/ai-coach/assignments/...` |
| 4. 移动端 API 封装 | 20 min | `lib/api.ts` |
| 5. 触发 generate | 20 min | `AnalysisResultScreen.tsx` |
| 6. AiCoachCard 组件 | 45 min | `components/AiCoachCard.tsx` |
| 7. HomeScreen 集成 | 30 min | `HomeScreen.tsx` |
| 8. AssignmentsScreen | 1h | `screens/AssignmentsScreen.tsx` |
| 9. 部署 | 15 min | — |
| 10. 验证 | 30 min | — |

**预计总工时：约 5-6 小时**
