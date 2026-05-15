<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import SimpleTrendChart from '../components/SimpleTrendChart.vue'
import StatCard from '../components/StatCard.vue'
import { adminApi, formatApiError, unwrap } from '../services/api'

interface PaymentMethodDistribution {
  payment_method: string
  count: number
}

interface RecentOrderRow {
  id: string
  order_no: string
  foodie_nickname: string
  chef_nickname: string
  status: string
  total_price: number
  payment_method: string
  wallet_paid_amount: number
}

interface RecentReviewRow {
  id: string
  rating: number
  content: string | null
  foodie_nickname: string
  dish_name: string
}

interface RecentWalletTransactionRow {
  id: string
  transaction_type: string
  change_amount: number
  balance_after: number
  nickname: string
  role: string
  note: string | null
  created_at: string | null
}

interface RecentOperationLogRow {
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

interface OverviewPayload {
  headline: Record<string, number>
  role_distribution: Array<{ role: string; count: number }>
  order_status_distribution: Array<{ status: string; count: number }>
  payment_method_distribution: PaymentMethodDistribution[]
  recent_orders: RecentOrderRow[]
  recent_reviews: RecentReviewRow[]
  recent_wallet_transactions: RecentWalletTransactionRow[]
  recent_operation_logs: RecentOperationLogRow[]
}

interface TrendPayload {
  labels: string[]
  series: {
    order_count: number[]
    gmv: number[]
    user_count: number[]
    review_count: number[]
    refund_count: number[]
    refund_amount: number[]
    broadcast_count: number[]
    wallet_topup_amount: number[]
    wallet_payment_amount: number[]
  }
}

const loading = ref(false)
const errorMessage = ref('')
const overview = ref<OverviewPayload | null>(null)
const trends = ref<TrendPayload | null>(null)

const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 2
})

const numberFormatter = new Intl.NumberFormat('zh-CN')
const coinFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function formatCoinAmount(value: number) {
  return `${coinFormatter.format(value || 0)} 餐币`
}

const headlineCards = computed(() => {
  if (!overview.value) return []
  const headline = overview.value.headline
  return [
    {
      title: '总用户数',
      value: numberFormatter.format(headline.total_users || 0),
      hint: `${headline.total_chefs || 0} 位大厨正在系统内`,
      tone: 'sand'
    },
    {
      title: '订单总量',
      value: numberFormatter.format(headline.total_orders || 0),
      hint: `今日新增 ${headline.today_orders || 0} 单`,
      tone: 'forest'
    },
    {
      title: '累计 GMV',
      value: currency.format(headline.total_gmv || 0),
      hint: `今日成交 ${currency.format(headline.today_gmv || 0)}`,
      tone: 'coral'
    },
    {
      title: '待处理订单',
      value: numberFormatter.format(headline.pending_orders || 0),
      hint: `${headline.unread_notifications || 0} 条未读通知待跟进`,
      tone: 'ink'
    },
    {
      title: '用户总餐币',
      value: formatCoinAmount(headline.total_wallet_balance || 0),
      hint: `全平台用户当前余额存量`,
      tone: 'sand'
    },
    {
      title: '累计餐币充值',
      value: formatCoinAmount(headline.total_wallet_topup || 0),
      hint: `今日充值 ${formatCoinAmount(headline.today_wallet_topup || 0)}`,
      tone: 'coral'
    },
    {
      title: '餐币支付订单',
      value: numberFormatter.format(headline.virtual_coin_order_count || 0),
      hint: `累计消耗 ${formatCoinAmount(headline.total_wallet_payment || 0)}`,
      tone: 'forest'
    },
    {
      title: '累计退款',
      value: currency.format(headline.total_refunded_amount || 0),
      hint: `${headline.refunded_orders || 0} 个订单存在退款记录`,
      tone: 'ink'
    }
  ]
})

function formatPaymentMethod(method: string) {
  switch (method) {
    case 'virtual_coin':
      return '餐币支付'
    case 'wechat':
      return '历史微信支付'
    case 'free':
      return '免费单'
    default:
      return method || '未知'
  }
}

function formatTransactionType(type: string) {
  switch (type) {
    case 'admin_topup':
      return '后台加钱'
    case 'topup':
      return '用户充值'
    case 'order_payment':
      return '订单扣币'
    case 'tip_payment':
      return '打赏扣币'
    case 'order_refund':
      return '订单退币'
    default:
      return type
  }
}

function formatActionType(type: string) {
  switch (type) {
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
      return type || '未知操作'
  }
}

function formatTargetType(type: string) {
  switch (type) {
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
      return type || '未知对象'
  }
}

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [overviewResponse, trendResponse] = await Promise.all([
      adminApi.get('/admin/dashboard/overview'),
      adminApi.get('/admin/dashboard/trends', { params: { days: 14 } })
    ])
    overview.value = unwrap<OverviewPayload>(overviewResponse.data)
    trends.value = unwrap<TrendPayload>(trendResponse.data)
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadDashboard()
})
</script>

<template>
  <div class="page">
    <section class="hero-banner">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h1>今天的后台重点，一眼看清楚</h1>
        <p class="hero-copy">
          现在这块面板更偏向“交易运营 + 餐币经营”双视角，方便同时看订单、退款、充值和余额变化。
        </p>
      </div>
      <button class="ghost-button" @click="loadDashboard" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新数据' }}
      </button>
    </section>

    <p v-if="errorMessage" class="banner-error">{{ errorMessage }}</p>

    <section class="stats-grid">
      <StatCard
        v-for="card in headlineCards"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :hint="card.hint"
        :tone="card.tone as 'sand' | 'forest' | 'coral' | 'ink'"
      />
    </section>

    <section class="content-grid two-columns">
      <SimpleTrendChart
        :labels="trends?.labels || []"
        :values="trends?.series.order_count || []"
        title="14 日订单趋势"
        description="观察订单量是否稳定抬升，尤其适合活动期和节假日前后。"
      />
      <SimpleTrendChart
        :labels="trends?.labels || []"
        :values="trends?.series.gmv || []"
        title="14 日 GMV 趋势"
        description="用成交额判断业务质量，而不是只盯着下单数。"
        mode="currency"
      />
    </section>

    <section class="content-grid two-columns">
      <SimpleTrendChart
        :labels="trends?.labels || []"
        :values="trends?.series.user_count || []"
        title="14 日新增用户"
        description="结合传播和活动动作，看新增用户是否真正进来。"
      />
      <SimpleTrendChart
        :labels="trends?.labels || []"
        :values="trends?.series.refund_amount || []"
        title="14 日退款金额"
        description="把退款波动单独拉出来看，方便排查菜品、履约或运营问题。"
        mode="currency"
      />
    </section>

    <section class="content-grid two-columns">
      <SimpleTrendChart
        :labels="trends?.labels || []"
        :values="trends?.series.wallet_topup_amount || []"
        title="14 日餐币充值"
        description="观察后台加钱和用户充值的总量变化，确认活动补贴或运营动作是否生效。"
        mode="currency"
      />
      <SimpleTrendChart
        :labels="trends?.labels || []"
        :values="trends?.series.wallet_payment_amount || []"
        title="14 日餐币消耗"
        description="看餐币在订单中的实际消耗节奏，判断虚拟币支付是否正在成为主路径。"
        mode="currency"
      />
    </section>

    <section class="content-grid two-columns">
      <article class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Role Mix</p>
            <h2>角色分布</h2>
          </div>
        </div>
        <div class="distribution-list">
          <div
            v-for="item in overview?.role_distribution || []"
            :key="item.role"
            class="distribution-item"
          >
            <span>{{ item.role === 'chef' ? '大厨' : '吃货' }}</span>
            <strong>{{ item.count }}</strong>
          </div>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Payment Mix</p>
            <h2>支付方式分布</h2>
          </div>
        </div>
        <div class="distribution-list">
          <div
            v-for="item in overview?.payment_method_distribution || []"
            :key="item.payment_method"
            class="distribution-item"
          >
            <span>{{ formatPaymentMethod(item.payment_method) }}</span>
            <strong>{{ item.count }}</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="content-grid two-columns">
      <article class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Order Rhythm</p>
            <h2>订单状态节奏</h2>
          </div>
        </div>
        <div class="status-flow">
          <span
            v-for="item in overview?.order_status_distribution || []"
            :key="item.status"
            class="status-chip"
          >
            {{ item.status }} · {{ item.count }}
          </span>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Admin Trace</p>
            <h2>最近后台操作</h2>
          </div>
        </div>
        <div v-if="!(overview?.recent_operation_logs || []).length" class="empty-state">
          暂时还没有后台操作记录。
        </div>
        <div v-else class="detail-stack">
          <div
            v-for="item in overview?.recent_operation_logs || []"
            :key="item.id"
            class="detail-item detail-item--column"
          >
            <div class="detail-row">
              <strong>{{ item.summary }}</strong>
              <span>{{ item.created_at || '-' }}</span>
            </div>
            <span>{{ item.operator_name || '系统管理员' }} / {{ item.operator_username }}</span>
            <div class="metric-row">
              <span class="status-chip subtle">{{ formatActionType(item.action_type) }}</span>
              <span class="status-chip subtle">{{ formatTargetType(item.target_type) }}</span>
              <span v-if="item.target_id" class="status-chip subtle">目标 {{ item.target_id }}</span>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section class="content-grid two-columns">
      <article class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Wallet Feed</p>
            <h2>最近余额流水</h2>
          </div>
        </div>
        <div v-if="!(overview?.recent_wallet_transactions || []).length" class="empty-state">
          暂时还没有餐币流水数据。
        </div>
        <div v-else class="detail-stack">
          <div
            v-for="transaction in overview?.recent_wallet_transactions || []"
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
                {{ transaction.change_amount >= 0 ? '+' : '' }}{{ formatCoinAmount(transaction.change_amount) }}
              </strong>
              <span>{{ transaction.created_at || '-' }}</span>
            </div>
            <span>{{ transaction.nickname }} / {{ transaction.role === 'chef' ? '大厨' : '吃货' }}</span>
            <span>{{ formatTransactionType(transaction.transaction_type) }}</span>
            <span>变动后余额 {{ formatCoinAmount(transaction.balance_after) }}</span>
            <span v-if="transaction.note">{{ transaction.note }}</span>
          </div>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Recent Orders</p>
            <h2>最近订单</h2>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>买家 / 大厨</th>
                <th>状态</th>
                <th>支付方式</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in overview?.recent_orders || []" :key="order.id">
                <td>{{ order.order_no }}</td>
                <td>{{ order.foodie_nickname }} / {{ order.chef_nickname }}</td>
                <td>
                  <span class="status-chip subtle">{{ order.status }}</span>
                </td>
                <td>
                  <div class="table-meta">
                    <span>{{ formatPaymentMethod(order.payment_method) }}</span>
                    <span v-if="order.wallet_paid_amount > 0">
                      餐币实付 {{ currency.format(order.wallet_paid_amount) }}
                    </span>
                  </div>
                </td>
                <td>{{ currency.format(order.total_price || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Voice of Customer</p>
            <h2>最近评价</h2>
          </div>
        </div>
        <div class="review-stack">
          <div
            v-for="review in overview?.recent_reviews || []"
            :key="review.id"
            class="review-item"
          >
            <div class="review-item__top">
              <strong>{{ review.dish_name }}</strong>
              <span>{{ review.foodie_nickname }}</span>
            </div>
            <p>{{ review.content || '用户未填写文字评价' }}</p>
            <span class="metric-pill">评分 {{ review.rating }}</span>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
