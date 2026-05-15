<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { adminApi, formatApiError, unwrap, unwrapPage } from '../services/api'

interface RefundRow {
  id: string
  amount: number
  status: string
  method: string
  reason: string
  note: string | null
  operator_name: string
  created_at: string | null
}

interface OrderRow {
  id: string
  order_no: string
  foodie_nickname: string
  chef_nickname: string
  status: string
  payment_method: string
  wallet_paid_amount: number
  refund_status: string
  refund_amount: number
  total_price: number
  delivery_time: string | null
  remarks: string | null
}

interface OrderDetail {
  id: string
  order_no: string
  status: string
  payment_method: string
  wallet_paid_amount: number
  refund_status: string
  refund_amount: number
  refund_reason: string | null
  total_price: number
  delivery_time: string | null
  remarks: string | null
  cancel_reason: string | null
  refunded_at: string | null
  payment_id: string | null
  address_snapshot: Record<string, string> | null
  items: Array<{
    id: string
    dish_name: string
    price: number
    quantity: number
  }>
  refunds: RefundRow[]
  foodie: {
    id: string
    nickname: string | null
    phone: string | null
  }
  chef: {
    id: string
    nickname: string | null
    phone: string | null
  }
}

const statuses = ['unpaid', 'pending', 'accepted', 'cooking', 'delivering', 'completed', 'cancelled']
const paymentMethods = ['', 'virtual_coin', 'free']
const refundStatuses = ['', 'none', 'partial', 'refunded']

const rows = ref<OrderRow[]>([])
const orderDetail = ref<OrderDetail | null>(null)
const page = ref(1)
const totalPages = ref(1)
const search = ref('')
const status = ref('')
const paymentMethod = ref('')
const refundStatus = ref('')
const loading = ref(false)
const detailLoading = ref(false)
const refunding = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const actionLoadingId = ref('')
const statusDrafts = reactive<Record<string, string>>({})
const refundDraft = reactive({
  amount: '',
  reason: '',
  note: '',
  mark_manual_processed: false
})

const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY'
})

function formatPaymentMethod(method: string) {
  switch (method) {
    case 'virtual_coin':
      return '餐币支付'
    case 'wechat':
      return '历史微信支付'
    case 'free':
      return '免费单'
    case 'manual':
      return '后台处理'
    case 'wechat_manual':
      return '历史微信退款登记'
    default:
      return method || '未知'
  }
}

function refundRemaining(detail: OrderDetail) {
  return Math.max(detail.total_price - detail.refund_amount, 0)
}

function refundBlockedReason(detail: OrderDetail | null) {
  if (!detail) return '请先选择订单'
  if (detail.total_price <= 0) return '零金额订单无需退款'
  if (detail.payment_method === 'free') return '免费单无需退款'
  if (refundRemaining(detail) <= 0) return '当前订单已无可退金额'
  if (detail.payment_method === 'wechat' && detail.status === 'unpaid') {
    return '历史微信未支付订单不能登记退款'
  }
  if (detail.payment_method === 'wechat' && !refundDraft.mark_manual_processed) {
    return '请先勾选“已完成历史微信退款”'
  }
  return ''
}

function refundActionLabel(detail: OrderDetail | null) {
  if (!detail) return '创建退款记录'
  return detail.payment_method === 'wechat' ? '登记历史退款' : '创建退款记录'
}

function availableStatusOptions(order: OrderRow) {
  switch (order.status) {
    case 'unpaid':
      return ['cancelled']
    case 'pending':
      return ['pending', 'accepted', 'cancelled']
    case 'accepted':
      return ['accepted', 'cooking', 'cancelled']
    case 'cooking':
      return ['cooking', 'delivering', 'cancelled']
    case 'delivering':
      return ['delivering', 'completed']
    case 'completed':
      return ['completed']
    case 'cancelled':
      return ['cancelled']
    default:
      return [order.status]
  }
}

async function loadOrders() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/orders', {
      params: {
        search: search.value || undefined,
        status: status.value || undefined,
        payment_method: paymentMethod.value || undefined,
        refund_status: refundStatus.value || undefined,
        page: page.value,
        page_size: 10
      }
    })
    const payload = unwrapPage<OrderRow>(data)
    rows.value = payload.items
    totalPages.value = payload.pageInfo.total_pages || 1
    payload.items.forEach((item) => {
      statusDrafts[item.id] = item.status
    })
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function openDetail(orderId: string) {
  detailLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.get(`/admin/orders/${orderId}`)
    const detail = unwrap<OrderDetail>(data)
    orderDetail.value = detail
    const remaining = refundRemaining(detail)
    refundDraft.amount = remaining > 0 ? String(remaining) : ''
    refundDraft.reason = ''
    refundDraft.note = ''
    refundDraft.mark_manual_processed = false
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    detailLoading.value = false
  }
}

async function updateStatus(order: OrderRow) {
  actionLoadingId.value = order.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const nextStatus = statusDrafts[order.id]
    const cancelReason =
      nextStatus === 'cancelled'
        ? window.prompt('请输入取消原因', orderDetail.value?.cancel_reason || '后台取消')
        : undefined
    const { data } = await adminApi.put(`/admin/orders/${order.id}/status`, {
      status: nextStatus,
      cancel_reason: cancelReason || undefined
    })
    const updated = unwrap<{ status: string }>(data)
    rows.value = rows.value.map((item) =>
      item.id === order.id ? { ...item, status: updated.status } : item
    )
    successMessage.value = '订单状态已更新'
    if (orderDetail.value?.id === order.id) {
      await openDetail(order.id)
    }
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    actionLoadingId.value = ''
  }
}

async function createRefund() {
  if (!orderDetail.value) return
  if (refundBlockedReason(orderDetail.value)) {
    errorMessage.value = refundBlockedReason(orderDetail.value)
    return
  }
  refunding.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await adminApi.post(`/admin/orders/${orderDetail.value.id}/refund`, {
      amount: refundDraft.amount ? Number(refundDraft.amount) : undefined,
      reason: refundDraft.reason,
      note: refundDraft.note || undefined,
      mark_manual_processed: refundDraft.mark_manual_processed
    })
    successMessage.value =
      orderDetail.value.payment_method === 'wechat' ? '历史退款记录已登记' : '退款记录已创建'
    await Promise.all([openDetail(orderDetail.value.id), loadOrders()])
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    refunding.value = false
  }
}

function submitFilters() {
  page.value = 1
  void loadOrders()
}

function prevPage() {
  if (page.value === 1) return
  page.value -= 1
  void loadOrders()
}

function nextPage() {
  if (page.value >= totalPages.value) return
  page.value += 1
  void loadOrders()
}

onMounted(() => {
  void loadOrders()
})
</script>

<template>
  <div class="page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Orders</p>
        <h1>订单处理台</h1>
        <p>把订单推进状态、退款处理和详情追踪放到一个双栏工作区里。</p>
      </div>
    </section>

    <div class="content-grid order-layout">
      <article class="panel-card">
        <div class="toolbar">
          <input v-model="search" type="text" placeholder="搜索订单号、买家昵称、大厨昵称" />
          <select v-model="status">
            <option value="">全部订单状态</option>
            <option v-for="item in statuses" :key="item" :value="item">{{ item }}</option>
          </select>
          <select v-model="paymentMethod">
            <option value="">全部支付方式</option>
            <option v-for="item in paymentMethods.filter(Boolean)" :key="item" :value="item">
              {{ formatPaymentMethod(item) }}
            </option>
          </select>
          <select v-model="refundStatus">
            <option value="">全部退款状态</option>
            <option v-for="item in refundStatuses.filter(Boolean)" :key="item" :value="item">
              {{ item }}
            </option>
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
                <th>订单号</th>
                <th>买家 / 大厨</th>
                <th>金额</th>
                <th>支付 / 状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in rows" :key="order.id">
                <td>{{ order.order_no }}</td>
                <td>{{ order.foodie_nickname }} / {{ order.chef_nickname }}</td>
                <td>
                  <div class="table-meta">
                    <span>{{ currency.format(order.total_price) }}</span>
                    <span>{{ formatPaymentMethod(order.payment_method) }}</span>
                    <span v-if="order.wallet_paid_amount > 0">
                      餐币实付 {{ currency.format(order.wallet_paid_amount) }}
                    </span>
                    <span v-if="order.refund_status !== 'none'">
                      已退 {{ currency.format(order.refund_amount) }}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="table-meta">
                    <select v-model="statusDrafts[order.id]" class="table-select">
                      <option v-for="item in availableStatusOptions(order)" :key="item" :value="item">{{ item }}</option>
                    </select>
                    <span class="status-chip subtle">{{ formatPaymentMethod(order.payment_method) }}</span>
                    <span class="status-chip subtle">退款 {{ order.refund_status }}</span>
                  </div>
                </td>
                <td>
                  <div class="table-actions">
                    <button class="ghost-button compact" @click="openDetail(order.id)">
                      查看详情
                    </button>
                    <button
                      class="primary-button compact"
                      :disabled="actionLoadingId === order.id"
                      @click="updateStatus(order)"
                    >
                      更新状态
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

      <article class="panel-card detail-panel">
        <div class="panel-card__header">
          <div>
            <p class="eyebrow">Detail</p>
            <h2>订单详情</h2>
          </div>
        </div>

        <div v-if="detailLoading" class="empty-state">正在加载订单详情...</div>
        <div v-else-if="!orderDetail" class="empty-state">点击左侧“查看详情”后，在这里查看订单完整信息。</div>
        <div v-else class="detail-stack">
          <div class="detail-row">
            <strong>{{ orderDetail.order_no }}</strong>
            <div class="metric-row">
              <span class="status-chip">{{ orderDetail.status }}</span>
              <span class="status-chip subtle">{{ formatPaymentMethod(orderDetail.payment_method) }}</span>
              <span class="status-chip subtle">退款 {{ orderDetail.refund_status }}</span>
            </div>
          </div>
          <div class="detail-row">
            <span>买家：{{ orderDetail.foodie.nickname || orderDetail.foodie.id }}</span>
            <span>大厨：{{ orderDetail.chef.nickname || orderDetail.chef.id }}</span>
          </div>
          <div class="detail-row">
            <span>金额：{{ currency.format(orderDetail.total_price) }}</span>
            <span>已退款：{{ currency.format(orderDetail.refund_amount) }}</span>
          </div>
          <div class="detail-row">
            <span>支付方式：{{ formatPaymentMethod(orderDetail.payment_method) }}</span>
            <span>餐币实付：{{ currency.format(orderDetail.wallet_paid_amount || 0) }}</span>
          </div>
          <div class="detail-row">
            <span>送达：{{ orderDetail.delivery_time || '未设置' }}</span>
            <span>退款时间：{{ orderDetail.refunded_at || '暂无' }}</span>
          </div>

          <div class="sub-panel">
            <h3>退款处理</h3>
            <p v-if="refundBlockedReason(orderDetail)" class="field-note">
              {{ refundBlockedReason(orderDetail) }}
            </p>
            <p v-else-if="orderDetail.payment_method === 'wechat'" class="field-note">
              这是历史微信支付订单，当前后台只保留退款登记能力，不再提供新的微信支付流程。
            </p>
            <div class="form-grid form-grid--wide">
              <input v-model="refundDraft.amount" type="number" min="0" step="0.01" placeholder="退款金额" />
              <input v-model="refundDraft.reason" type="text" placeholder="退款原因" />
              <label v-if="orderDetail.payment_method === 'wechat'" class="checkbox-line">
                <input v-model="refundDraft.mark_manual_processed" type="checkbox" />
                <span>我已完成这笔历史微信订单的线下退款，现在只登记记录并同步站内通知</span>
              </label>
              <textarea v-model="refundDraft.note" rows="3" placeholder="退款备注（可选）"></textarea>
              <button
                class="primary-button"
                :disabled="refunding || Boolean(refundBlockedReason(orderDetail))"
                @click="createRefund"
              >
                {{ refunding ? '提交中...' : refundActionLabel(orderDetail) }}
              </button>
            </div>

            <div class="detail-stack">
              <div v-for="refund in orderDetail.refunds" :key="refund.id" class="detail-item detail-item--column">
                <div class="detail-row">
                  <strong>{{ currency.format(refund.amount) }}</strong>
                  <span>{{ refund.created_at || '-' }}</span>
                </div>
                <span>{{ refund.reason }}</span>
                <span>{{ refund.operator_name }} / {{ formatPaymentMethod(refund.method) }}</span>
              </div>
            </div>
          </div>

          <div class="sub-panel">
            <h3>菜品清单</h3>
            <div v-for="item in orderDetail.items" :key="item.id" class="detail-item">
              <span>{{ item.dish_name }}</span>
              <span>{{ currency.format(item.price) }} × {{ item.quantity }}</span>
            </div>
          </div>

          <div class="sub-panel">
            <h3>配送地址</h3>
            <pre>{{ orderDetail.address_snapshot ? JSON.stringify(orderDetail.address_snapshot, null, 2) : '暂无地址快照' }}</pre>
          </div>

          <div class="sub-panel">
            <h3>备注信息</h3>
            <p>{{ orderDetail.remarks || '无备注' }}</p>
            <p>支付流水：{{ orderDetail.payment_id || '暂无' }}</p>
            <p v-if="orderDetail.cancel_reason">取消原因：{{ orderDetail.cancel_reason }}</p>
            <p v-if="orderDetail.refund_reason">最近退款原因：{{ orderDetail.refund_reason }}</p>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
