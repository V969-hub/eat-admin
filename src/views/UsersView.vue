<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { adminApi, formatApiError, unwrap, unwrapPage } from '../services/api'

interface UserRow {
  id: string
  nickname: string
  phone: string | null
  role: string
  binding_code: string
  couple_code: string | null
  is_open: boolean
  is_deleted: boolean
  rest_notice: string | null
  rating: number | null
  total_orders: number
  wallet_balance: number
  metrics: {
    dish_count: number
    chef_order_count: number
    foodie_order_count: number
    bound_foodies_count: number
  }
  created_at: string | null
  updated_at: string | null
}

interface WalletTransactionRow {
  id: string
  transaction_type: string
  change_amount: number
  balance_after: number
  related_order_id: string | null
  note: string | null
  created_at: string | null
}

const rows = ref<UserRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const search = ref('')
const role = ref('')
const deletedFilter = ref('active')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const actionLoadingId = ref('')
const creating = ref(false)
const walletTarget = ref<UserRow | null>(null)
const walletTransactions = ref<WalletTransactionRow[]>([])
const walletLoading = ref(false)
const walletSubmitting = ref(false)

const createForm = reactive({
  account: '',
  nickname: '',
  role: 'foodie',
  phone: ''
})

const walletForm = reactive({
  amount: '',
  note: ''
})

const balanceFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function formatBalance(value: number) {
  return `${balanceFormatter.format(value || 0)} 餐币`
}

function mapTransactionType(type: string) {
  switch (type) {
    case 'admin_topup':
      return '后台加钱'
    case 'topup':
      return '用户充值'
    case 'order_payment':
      return '订单支付'
    case 'tip_payment':
      return '打赏扣币'
    case 'order_refund':
      return '订单退款'
    default:
      return type
  }
}

function syncUserRow(payload: Partial<UserRow> & { id: string }) {
  rows.value = rows.value.map((item) => (item.id === payload.id ? { ...item, ...payload } : item))
  if (walletTarget.value?.id === payload.id) {
    walletTarget.value = { ...walletTarget.value, ...payload }
  }
}

async function loadUsers() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/users', {
      params: {
        search: search.value || undefined,
        role: role.value || undefined,
        is_deleted: deletedFilter.value === 'all' ? undefined : deletedFilter.value === 'disabled',
        page: page.value,
        page_size: 10
      }
    })
    const payload = unwrapPage<UserRow>(data)
    rows.value = payload.items
    totalPages.value = payload.pageInfo.total_pages || 1
    if (walletTarget.value) {
      const latest = payload.items.find((item) => item.id === walletTarget.value?.id)
      if (latest) {
        walletTarget.value = latest
      }
    }
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function updateUser(user: UserRow, payload: Record<string, unknown>) {
  actionLoadingId.value = user.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.put(`/admin/users/${user.id}`, payload)
    const updated = unwrap<UserRow>(data)
    syncUserRow(updated)
    successMessage.value = '用户状态已更新'
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    actionLoadingId.value = ''
  }
}

async function createUser() {
  creating.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.post('/admin/users', {
      account: createForm.account,
      nickname: createForm.nickname,
      role: createForm.role,
      phone: createForm.phone || undefined
    })
    const payload = unwrap<{ account: string }>(data)
    successMessage.value = `已创建账号 ${payload.account}`
    createForm.account = ''
    createForm.nickname = ''
    createForm.role = 'foodie'
    createForm.phone = ''
    page.value = 1
    await loadUsers()
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    creating.value = false
  }
}

async function loadWalletTransactions(userId: string) {
  walletLoading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get(`/admin/users/${userId}/wallet/transactions`, {
      params: {
        page: 1,
        page_size: 8
      }
    })
    const payload = unwrapPage<WalletTransactionRow>(data)
    walletTransactions.value = payload.items
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    walletLoading.value = false
  }
}

function openWalletPanel(user: UserRow) {
  walletTarget.value = user
  walletTransactions.value = []
  walletForm.amount = ''
  walletForm.note = ''
  errorMessage.value = ''
  successMessage.value = ''
  void loadWalletTransactions(user.id)
}

function closeWalletPanel() {
  walletTarget.value = null
  walletTransactions.value = []
  walletForm.amount = ''
  walletForm.note = ''
}

async function submitWalletTopUp() {
  if (!walletTarget.value) return

  const amount = Number(walletForm.amount)
  if (!(amount > 0)) {
    errorMessage.value = '请输入大于 0 的加钱金额'
    successMessage.value = ''
    return
  }

  walletSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.post(`/admin/users/${walletTarget.value.id}/wallet/topup`, {
      amount,
      note: walletForm.note || undefined
    })
    const payload = unwrap<{
      user: Pick<UserRow, 'id' | 'nickname' | 'role' | 'wallet_balance' | 'updated_at'>
      transaction: WalletTransactionRow
    }>(data)
    syncUserRow(payload.user)
    walletTransactions.value = [payload.transaction, ...walletTransactions.value].slice(0, 8)
    walletForm.amount = ''
    walletForm.note = ''
    successMessage.value = `已为 ${payload.user.nickname || '该用户'} 增加 ${formatBalance(payload.transaction.change_amount)}`
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    walletSubmitting.value = false
  }
}

function submitFilters() {
  page.value = 1
  void loadUsers()
}

function prevPage() {
  if (page.value === 1) return
  page.value -= 1
  void loadUsers()
}

function nextPage() {
  if (page.value >= totalPages.value) return
  page.value += 1
  void loadUsers()
}

onMounted(() => {
  void loadUsers()
})
</script>

<template>
  <div class="page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Users</p>
        <h1>用户与大厨管理</h1>
        <p>这里聚焦账号状态、餐币余额、营业状态和绑定码体系，适合处理日常运营排查。</p>
      </div>
    </section>

    <article class="panel-card">
      <div class="panel-card__header">
        <div>
          <p class="eyebrow">Create User</p>
          <h2>快速创建测试账号</h2>
          <p>新建账号可直接走 `/api/auth/login/account`，当前仍是“任意密码”模式。</p>
        </div>
      </div>

      <div class="form-grid">
        <input v-model="createForm.account" type="text" placeholder="账号 / open_id" />
        <input v-model="createForm.nickname" type="text" placeholder="昵称" />
        <select v-model="createForm.role">
          <option value="foodie">吃货</option>
          <option value="chef">大厨</option>
        </select>
        <input v-model="createForm.phone" type="text" placeholder="手机号（可选）" />
        <button class="primary-button" :disabled="creating" @click="createUser">
          {{ creating ? '创建中...' : '创建账号' }}
        </button>
      </div>
    </article>

    <article class="panel-card">
      <div class="toolbar">
        <input v-model="search" type="text" placeholder="搜索昵称、手机号、open_id、邀请码" />
        <select v-model="role">
          <option value="">全部角色</option>
          <option value="foodie">吃货</option>
          <option value="chef">大厨</option>
        </select>
        <select v-model="deletedFilter">
          <option value="active">仅正常账号</option>
          <option value="disabled">仅禁用账号</option>
          <option value="all">全部账号</option>
        </select>
        <button class="primary-button compact" @click="submitFilters" :disabled="loading">
          {{ loading ? '查询中...' : '应用筛选' }}
        </button>
      </div>

      <p v-if="errorMessage" class="banner-error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="banner-success">{{ successMessage }}</p>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>邀请码</th>
              <th>餐币余额</th>
              <th>运营指标</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in rows" :key="user.id">
              <td>
                <div class="table-identity">
                  <strong>{{ user.nickname || '未命名用户' }}</strong>
                  <span>{{ user.phone || '未绑定手机号' }}</span>
                </div>
              </td>
              <td>
                <span class="metric-pill">{{ user.role === 'chef' ? '大厨' : '吃货' }}</span>
              </td>
              <td>
                <div class="table-meta">
                  <span>绑定码 {{ user.binding_code }}</span>
                  <span v-if="user.couple_code">情侣码 {{ user.couple_code }}</span>
                </div>
              </td>
              <td>
                <div class="table-meta">
                  <strong class="wallet-balance">{{ formatBalance(user.wallet_balance) }}</strong>
                  <span>可由后台直接加钱</span>
                </div>
              </td>
              <td>
                <div class="metric-row">
                  <span class="metric-pill">菜品 {{ user.metrics.dish_count }}</span>
                  <span class="metric-pill">厨师单 {{ user.metrics.chef_order_count }}</span>
                  <span class="metric-pill">吃货单 {{ user.metrics.foodie_order_count }}</span>
                </div>
              </td>
              <td>
                <div class="metric-row">
                  <span class="status-chip subtle">{{ user.is_deleted ? '已禁用' : '正常' }}</span>
                  <span v-if="user.role === 'chef'" class="status-chip subtle">
                    {{ user.is_open ? '营业中' : '休息中' }}
                  </span>
                </div>
              </td>
              <td>
                <div class="table-actions">
                  <button class="primary-button compact" @click="openWalletPanel(user)">
                    加钱
                  </button>
                  <button
                    class="ghost-button compact"
                    :disabled="actionLoadingId === user.id || user.role !== 'chef'"
                    @click="updateUser(user, { is_open: !user.is_open })"
                  >
                    {{ user.is_open ? '暂停营业' : '恢复营业' }}
                  </button>
                  <button
                    class="ghost-button compact danger"
                    :disabled="actionLoadingId === user.id"
                    @click="updateUser(user, { is_deleted: !user.is_deleted })"
                  >
                    {{ user.is_deleted ? '恢复账号' : '禁用账号' }}
                  </button>
                </div>
              </td>
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

    <Transition name="fade-slide">
      <article v-if="walletTarget" class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Wallet</p>
            <h2>给用户增加餐币</h2>
            <p>直接给账号补充虚拟币，并查看最近的余额流水。</p>
          </div>
          <button class="ghost-button compact" @click="closeWalletPanel">收起面板</button>
        </div>

        <div class="content-grid two-columns">
          <div class="detail-stack">
            <div class="detail-item">
              <span>当前用户</span>
              <strong>{{ walletTarget.nickname || '未命名用户' }}</strong>
            </div>
            <div class="detail-item">
              <span>角色</span>
              <strong>{{ walletTarget.role === 'chef' ? '大厨' : '吃货' }}</strong>
            </div>
            <div class="detail-item">
              <span>绑定码</span>
              <strong>{{ walletTarget.binding_code }}</strong>
            </div>
            <div class="detail-item">
              <span>当前余额</span>
              <strong class="wallet-balance">{{ formatBalance(walletTarget.wallet_balance) }}</strong>
            </div>

            <div class="sub-panel">
              <h3>后台加钱</h3>
              <div class="form-grid form-grid--wide">
                <input
                  v-model="walletForm.amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="输入要增加的餐币数量"
                />
                <input v-model="walletForm.note" type="text" placeholder="备注（可选）" />
                <button class="primary-button" :disabled="walletSubmitting" @click="submitWalletTopUp">
                  {{ walletSubmitting ? '提交中...' : '确认加钱' }}
                </button>
              </div>
            </div>
          </div>

          <div class="sub-panel">
            <h3>最近流水</h3>
            <div v-if="walletLoading" class="empty-state">正在加载余额流水...</div>
            <div v-else-if="!walletTransactions.length" class="empty-state">
              这个账号暂时还没有余额流水。
            </div>
            <div v-else class="detail-stack">
              <div
                v-for="transaction in walletTransactions"
                :key="transaction.id"
                class="detail-item detail-item--column"
              >
                <div class="detail-row">
                  <strong
                    :class="[
                      'wallet-change',
                      transaction.change_amount >= 0 ? 'wallet-change--positive' : 'wallet-change--negative'
                    ]"
                  >
                    {{ transaction.change_amount >= 0 ? '+' : '' }}{{ formatBalance(transaction.change_amount) }}
                  </strong>
                  <span>{{ transaction.created_at || '-' }}</span>
                </div>
                <span>{{ mapTransactionType(transaction.transaction_type) }}</span>
                <span>变动后余额 {{ formatBalance(transaction.balance_after) }}</span>
                <span v-if="transaction.note">{{ transaction.note }}</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </Transition>
  </div>
</template>
