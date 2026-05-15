<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { adminApi, formatApiError, unwrapPage } from '../services/api'

interface OperationLogRow {
  id: string
  operator_username: string
  operator_name: string
  action_type: string
  target_type: string
  target_id: string | null
  summary: string
  detail: Record<string, unknown> | null
  created_at: string | null
}

const actionTypes = [
  '',
  'create_user',
  'update_user',
  'wallet_topup',
  'update_dish',
  'update_order_status',
  'create_order_refund',
  'create_broadcast',
  'bind_couple',
  'unbind_couple',
  'create_couple_menu_category',
  'update_couple_menu_category',
  'delete_couple_menu_category',
  'create_couple_menu_item',
  'update_couple_menu_item',
  'delete_couple_menu_item'
]

const targetTypes = [
  '',
  'user',
  'user_wallet',
  'dish',
  'order',
  'broadcast',
  'couple_relationship',
  'couple_menu_category',
  'couple_menu_item'
]

const rows = ref<OperationLogRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const search = ref('')
const actionType = ref('')
const targetType = ref('')
const loading = ref(false)
const errorMessage = ref('')
const expandedIds = ref<string[]>([])

function formatActionType(value: string) {
  switch (value) {
    case 'create_user':
      return '创建账号'
    case 'update_user':
      return '更新用户'
    case 'wallet_topup':
      return '后台加钱'
    case 'update_dish':
      return '更新菜品'
    case 'update_order_status':
      return '更新订单状态'
    case 'create_order_refund':
      return '创建退款记录'
    case 'create_broadcast':
      return '发送广播'
    case 'bind_couple':
      return '手动绑定情侣'
    case 'unbind_couple':
      return '手动解绑情侣'
    case 'create_couple_menu_category':
      return '新增菜单分类'
    case 'update_couple_menu_category':
      return '更新菜单分类'
    case 'delete_couple_menu_category':
      return '删除菜单分类'
    case 'create_couple_menu_item':
      return '新增菜单'
    case 'update_couple_menu_item':
      return '更新菜单'
    case 'delete_couple_menu_item':
      return '删除菜单'
    default:
      return value || '未知操作'
  }
}

function formatTargetType(value: string) {
  switch (value) {
    case 'user':
      return '用户'
    case 'user_wallet':
      return '用户钱包'
    case 'dish':
      return '菜品'
    case 'order':
      return '订单'
    case 'broadcast':
      return '广播'
    case 'couple_relationship':
      return '情侣关系'
    case 'couple_menu_category':
      return '情侣菜单分类'
    case 'couple_menu_item':
      return '情侣菜单'
    default:
      return value || '未知对象'
  }
}

function hasDetail(detail: Record<string, unknown> | null) {
  return Boolean(detail && Object.keys(detail).length)
}

function formatDetail(detail: Record<string, unknown> | null) {
  if (!detail || !Object.keys(detail).length) {
    return '这条记录没有附加详情。'
  }
  return JSON.stringify(detail, null, 2)
}

function isExpanded(id: string) {
  return expandedIds.value.includes(id)
}

function toggleExpanded(id: string) {
  if (isExpanded(id)) {
    expandedIds.value = expandedIds.value.filter((item) => item !== id)
    return
  }
  expandedIds.value = [...expandedIds.value, id]
}

async function loadOperationLogs() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/operation-logs', {
      params: {
        search: search.value || undefined,
        action_type: actionType.value || undefined,
        target_type: targetType.value || undefined,
        page: page.value,
        page_size: 12
      }
    })
    const payload = unwrapPage<OperationLogRow>(data)
    rows.value = payload.items
    totalPages.value = payload.pageInfo.total_pages || 1
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

function submitFilters() {
  page.value = 1
  expandedIds.value = []
  void loadOperationLogs()
}

function prevPage() {
  if (page.value === 1) return
  page.value -= 1
  expandedIds.value = []
  void loadOperationLogs()
}

function nextPage() {
  if (page.value >= totalPages.value) return
  page.value += 1
  expandedIds.value = []
  void loadOperationLogs()
}

onMounted(() => {
  void loadOperationLogs()
})
</script>

<template>
  <div class="page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Audit</p>
        <h1>后台操作日志</h1>
        <p>把关键写操作集中留痕，方便追查是谁改了用户、订单、餐币、菜品和广播。</p>
      </div>
    </section>

    <article class="panel-card">
      <div class="panel-card__header">
        <div>
          <p class="eyebrow">Coverage</p>
          <h2>当前已接入的自动审计</h2>
          <p>创建账号、更新用户、后台加钱、更新菜品、订单状态、退款、广播，以及情侣绑定解绑和情侣菜单维护都会自动留痕。</p>
        </div>
      </div>

      <div class="metric-row">
        <span class="metric-pill">创建用户</span>
        <span class="metric-pill">更新用户</span>
        <span class="metric-pill">用户加钱</span>
        <span class="metric-pill">菜品更新</span>
        <span class="metric-pill">订单状态</span>
        <span class="metric-pill">退款登记</span>
        <span class="metric-pill">广播发送</span>
        <span class="metric-pill">情侣绑定</span>
        <span class="metric-pill">情侣解绑</span>
        <span class="metric-pill">菜单维护</span>
      </div>
    </article>

    <article class="panel-card">
      <div class="toolbar">
        <input v-model="search" type="text" placeholder="搜索摘要、操作账号、操作人" />
        <select v-model="actionType">
          <option value="">全部操作类型</option>
          <option v-for="item in actionTypes.filter(Boolean)" :key="item" :value="item">
            {{ formatActionType(item) }}
          </option>
        </select>
        <select v-model="targetType">
          <option value="">全部目标类型</option>
          <option v-for="item in targetTypes.filter(Boolean)" :key="item" :value="item">
            {{ formatTargetType(item) }}
          </option>
        </select>
        <button class="primary-button compact" @click="submitFilters" :disabled="loading">
          {{ loading ? '查询中...' : '应用筛选' }}
        </button>
      </div>

      <p v-if="errorMessage" class="banner-error">{{ errorMessage }}</p>

      <div v-if="loading" class="empty-state">正在加载操作日志...</div>
      <div v-else-if="!rows.length" class="empty-state">当前没有匹配到操作日志。</div>
      <div v-else class="review-grid">
        <article v-for="log in rows" :key="log.id" class="review-card">
          <div class="review-card__top">
            <div>
              <strong>{{ log.summary }}</strong>
              <span>{{ log.created_at || '未知时间' }}</span>
            </div>
            <span class="status-chip">{{ formatActionType(log.action_type) }}</span>
          </div>

          <div class="metric-row">
            <span class="status-chip subtle">{{ formatTargetType(log.target_type) }}</span>
            <span v-if="log.target_id" class="status-chip subtle">目标 ID {{ log.target_id }}</span>
          </div>

          <p class="review-card__meta">
            操作人 {{ log.operator_name || '系统管理员' }} · 账号 {{ log.operator_username }}
          </p>

          <div class="detail-row">
            <span>{{ hasDetail(log.detail) ? '包含操作详情快照' : '没有附加详情' }}</span>
            <button
              class="ghost-button compact"
              :disabled="!hasDetail(log.detail)"
              @click="toggleExpanded(log.id)"
            >
              {{
                !hasDetail(log.detail)
                  ? '无详情'
                  : isExpanded(log.id)
                    ? '收起详情'
                    : '展开详情'
              }}
            </button>
          </div>

          <div v-if="isExpanded(log.id)" class="sub-panel">
            <h3>操作详情 JSON</h3>
            <pre>{{ formatDetail(log.detail) }}</pre>
          </div>
        </article>
      </div>

      <div class="pagination">
        <button class="ghost-button compact" @click="prevPage" :disabled="page === 1">上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button class="ghost-button compact" @click="nextPage" :disabled="page >= totalPages">下一页</button>
      </div>
    </article>
  </div>
</template>
