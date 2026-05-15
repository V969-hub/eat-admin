<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { adminApi, formatApiError, unwrap, unwrapPage } from '../services/api'

interface DishRow {
  id: string
  name: string
  chef_nickname: string
  price: number
  category: string | null
  rating: number | null
  review_count: number
  max_quantity: number
  is_on_shelf: boolean
  is_deleted: boolean
  images: string[]
}

const rows = ref<DishRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const search = ref('')
const shelfFilter = ref('')
const loading = ref(false)
const errorMessage = ref('')
const actionLoadingId = ref('')

const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY'
})

async function loadDishes() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/dishes', {
      params: {
        search: search.value || undefined,
        is_on_shelf:
          shelfFilter.value === ''
            ? undefined
            : shelfFilter.value === 'true',
        page: page.value,
        page_size: 10
      }
    })
    const payload = unwrapPage<DishRow>(data)
    rows.value = payload.items
    totalPages.value = payload.pageInfo.total_pages || 1
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function updateDish(dish: DishRow, payload: Record<string, unknown>) {
  actionLoadingId.value = dish.id
  try {
    const { data } = await adminApi.put(`/admin/dishes/${dish.id}`, payload)
    const updated = unwrap<DishRow>(data)
    rows.value = rows.value.map((item) => (item.id === dish.id ? { ...item, ...updated } : item))
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    actionLoadingId.value = ''
  }
}

function submitFilters() {
  page.value = 1
  void loadDishes()
}

function prevPage() {
  if (page.value === 1) return
  page.value -= 1
  void loadDishes()
}

function nextPage() {
  if (page.value >= totalPages.value) return
  page.value += 1
  void loadDishes()
}

onMounted(() => {
  void loadDishes()
})
</script>

<template>
  <div class="page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Dishes</p>
        <h1>菜品上架与库存控制</h1>
        <p>后台更适合处理大盘菜品质量，尤其是上下架、分类和异常菜品清理。</p>
      </div>
    </section>

    <article class="panel-card">
      <div class="toolbar">
        <input v-model="search" type="text" placeholder="搜索菜品名称、分类、大厨昵称" />
        <select v-model="shelfFilter">
          <option value="">全部上架状态</option>
          <option value="true">已上架</option>
          <option value="false">已下架</option>
        </select>
        <button class="primary-button compact" @click="submitFilters" :disabled="loading">
          {{ loading ? '查询中...' : '应用筛选' }}
        </button>
      </div>

      <p v-if="errorMessage" class="banner-error">{{ errorMessage }}</p>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>菜品</th>
              <th>归属大厨</th>
              <th>价格 / 分类</th>
              <th>评分</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dish in rows" :key="dish.id">
              <td>
                <div class="table-identity">
                  <strong>{{ dish.name }}</strong>
                  <span>日供 {{ dish.max_quantity }} 份</span>
                </div>
              </td>
              <td>{{ dish.chef_nickname }}</td>
              <td>
                <div class="table-meta">
                  <span>{{ currency.format(dish.price) }}</span>
                  <span>{{ dish.category || '未分类' }}</span>
                </div>
              </td>
              <td>
                <span class="metric-pill">评分 {{ dish.rating ?? '-' }}</span>
                <span class="metric-pill">评价 {{ dish.review_count }}</span>
              </td>
              <td>
                <div class="metric-row">
                  <span class="status-chip subtle">{{ dish.is_on_shelf ? '已上架' : '已下架' }}</span>
                  <span class="status-chip subtle">{{ dish.is_deleted ? '已删除' : '正常' }}</span>
                </div>
              </td>
              <td>
                <div class="table-actions">
                  <button
                    class="ghost-button compact"
                    :disabled="actionLoadingId === dish.id"
                    @click="updateDish(dish, { is_on_shelf: !dish.is_on_shelf })"
                  >
                    {{ dish.is_on_shelf ? '下架' : '上架' }}
                  </button>
                  <button
                    class="ghost-button compact danger"
                    :disabled="actionLoadingId === dish.id"
                    @click="updateDish(dish, { is_deleted: !dish.is_deleted })"
                  >
                    {{ dish.is_deleted ? '恢复' : '删除' }}
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
  </div>
</template>
