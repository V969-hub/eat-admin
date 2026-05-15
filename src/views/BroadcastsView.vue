<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { adminApi, formatApiError, unwrap, unwrapPage } from '../services/api'

interface BroadcastFilters {
  target_role?: string | null
  user_ids?: string[]
  has_min_wallet_balance?: boolean | null
  has_max_wallet_balance?: boolean | null
  min_wallet_balance?: number
  max_wallet_balance?: number
  reward_amount?: number
}

interface BroadcastRow {
  id: string
  title: string
  content: string
  target_role: string | null
  recipient_count: number
  created_by: string
  filters: BroadcastFilters | null
  note: string | null
  created_at: string | null
}

const rows = ref<BroadcastRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  title: '',
  content: '',
  target_role: '',
  min_wallet_balance: '',
  max_wallet_balance: '',
  reward_amount: '',
  user_ids_text: '',
  note: ''
})

const coinFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const normalizedUserIds = computed(() =>
  form.user_ids_text
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
)

function formatRole(role: string | null | undefined) {
  if (role === 'chef') return '仅大厨'
  if (role === 'foodie') return '仅吃货'
  return '全部用户'
}

function formatCoinAmount(value: number | undefined) {
  return `${coinFormatter.format(value || 0)} 餐币`
}

function formatBalanceRange(filters: BroadcastFilters | null) {
  if (!filters) return '不限余额'
  const min = filters.min_wallet_balance
  const max = filters.max_wallet_balance
  const hasMin = filters.has_min_wallet_balance ?? min != null
  const hasMax = filters.has_max_wallet_balance ?? max != null
  if (hasMin && hasMax) return `${formatCoinAmount(min || 0)} - ${formatCoinAmount(max || 0)}`
  if (hasMin) return `不少于 ${formatCoinAmount(min || 0)}`
  if (hasMax) return `不高于 ${formatCoinAmount(max || 0)}`
  return '不限余额'
}

async function loadBroadcasts() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/notifications/broadcasts', {
      params: {
        page: page.value,
        page_size: 10
      }
    })
    const payload = unwrapPage<BroadcastRow>(data)
    rows.value = payload.items
    totalPages.value = payload.pageInfo.total_pages || 1
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function sendBroadcast() {
  sending.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.post('/admin/notifications/broadcast', {
      title: form.title,
      content: form.content,
      target_role: form.target_role || undefined,
      min_wallet_balance: form.min_wallet_balance ? Number(form.min_wallet_balance) : undefined,
      max_wallet_balance: form.max_wallet_balance ? Number(form.max_wallet_balance) : undefined,
      reward_amount: form.reward_amount ? Number(form.reward_amount) : undefined,
      user_ids: normalizedUserIds.value.length ? normalizedUserIds.value : undefined,
      note: form.note || undefined
    })
    const payload = unwrap<{ recipient_count: number; reward_amount?: number }>(data)
    const rewardText =
      payload.reward_amount && payload.reward_amount > 0
        ? `，并发放 ${formatCoinAmount(payload.reward_amount)} / 人`
        : ''
    successMessage.value = `广播已发送给 ${payload.recipient_count} 位用户${rewardText}`
    form.title = ''
    form.content = ''
    form.target_role = ''
    form.min_wallet_balance = ''
    form.max_wallet_balance = ''
    form.reward_amount = ''
    form.user_ids_text = ''
    form.note = ''
    page.value = 1
    await loadBroadcasts()
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    sending.value = false
  }
}

function prevPage() {
  if (page.value === 1) return
  page.value -= 1
  void loadBroadcasts()
}

function nextPage() {
  if (page.value >= totalPages.value) return
  page.value += 1
  void loadBroadcasts()
}

onMounted(() => {
  void loadBroadcasts()
})
</script>

<template>
  <div class="page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Broadcasts</p>
        <h1>系统消息广播</h1>
        <p>用于群发运营通知、活动提示或系统维护说明，也可以随广播发放餐币奖励。</p>
      </div>
    </section>

    <article class="panel-card">
      <div class="panel-card__header">
        <div>
          <p class="eyebrow">Compose</p>
          <h2>新建广播 / 活动发币</h2>
          <p>可以按角色、余额区间或指定用户筛选，适合做补贴、召回和活动奖励。</p>
        </div>
      </div>

      <div class="form-grid form-grid--wide">
        <input v-model="form.title" type="text" placeholder="广播标题" />
        <select v-model="form.target_role">
          <option value="">全部用户</option>
          <option value="foodie">仅吃货</option>
          <option value="chef">仅大厨</option>
        </select>
        <input
          v-model="form.min_wallet_balance"
          type="number"
          min="0"
          step="0.01"
          placeholder="最低餐币余额（可选）"
        />
        <input
          v-model="form.max_wallet_balance"
          type="number"
          min="0"
          step="0.01"
          placeholder="最高餐币余额（可选）"
        />
        <input
          v-model="form.reward_amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="随广播发放餐币 / 人（可选）"
        />
        <textarea v-model="form.content" rows="4" placeholder="广播内容"></textarea>
        <textarea
          v-model="form.user_ids_text"
          rows="3"
          placeholder="指定用户ID（可选，支持换行、空格或逗号分隔）"
        ></textarea>
        <textarea v-model="form.note" rows="3" placeholder="补充说明（可选）"></textarea>

        <div class="sub-panel">
          <h3>发送预览</h3>
          <div class="detail-stack">
            <div class="detail-item">
              <span>目标角色</span>
              <strong>{{ formatRole(form.target_role) }}</strong>
            </div>
            <div class="detail-item">
              <span>余额筛选</span>
              <strong>
                {{
                  formatBalanceRange({
                    min_wallet_balance: form.min_wallet_balance ? Number(form.min_wallet_balance) : undefined,
                    max_wallet_balance: form.max_wallet_balance ? Number(form.max_wallet_balance) : undefined
                  })
                }}
              </strong>
            </div>
            <div class="detail-item">
              <span>指定用户</span>
              <strong>{{ normalizedUserIds.length ? `${normalizedUserIds.length} 个` : '不指定' }}</strong>
            </div>
            <div class="detail-item">
              <span>餐币奖励</span>
              <strong>
                {{ form.reward_amount ? `${formatCoinAmount(Number(form.reward_amount))} / 人` : '不发放' }}
              </strong>
            </div>
          </div>
        </div>

        <button class="primary-button" :disabled="sending" @click="sendBroadcast">
          {{ sending ? '发送中...' : '发送广播' }}
        </button>
      </div>
    </article>

    <article class="panel-card">
      <div class="panel-card__header">
        <div>
          <p class="eyebrow">History</p>
          <h2>发送记录</h2>
        </div>
      </div>

      <p v-if="errorMessage" class="banner-error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="banner-success">{{ successMessage }}</p>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>目标用户</th>
              <th>筛选条件</th>
              <th>接收人数</th>
              <th>创建人</th>
              <th>发送时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id">
              <td>
                <div class="table-identity">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.content }}</span>
                  <span v-if="item.note">备注：{{ item.note }}</span>
                </div>
              </td>
              <td>{{ formatRole(item.target_role) }}</td>
              <td>
                <div class="table-meta">
                  <span>{{ formatBalanceRange(item.filters) }}</span>
                  <span v-if="item.filters?.reward_amount && item.filters.reward_amount > 0">
                    奖励 {{ formatCoinAmount(item.filters.reward_amount) }} / 人
                  </span>
                  <span v-if="item.filters?.user_ids?.length">
                    指定 {{ item.filters.user_ids.length }} 个用户
                  </span>
                </div>
              </td>
              <td>{{ item.recipient_count }}</td>
              <td>{{ item.created_by }}</td>
              <td>{{ item.created_at || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="ghost-button compact" @click="prevPage" :disabled="page === 1">上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button class="ghost-button compact" @click="nextPage" :disabled="page >= totalPages">下一页</button>
      </div>
    </article>
  </div>
</template>
