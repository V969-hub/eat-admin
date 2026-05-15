<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { adminApi, formatApiError, unwrapPage } from '../services/api'

interface ReviewRow {
  id: string
  order_id: string
  rating: number
  content: string | null
  images: string[]
  dish_name: string
  foodie_nickname: string
  chef_nickname: string
  created_at: string | null
}

const rows = ref<ReviewRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const search = ref('')
const loading = ref(false)
const errorMessage = ref('')

function ratingText(value: number) {
  return `${value}/5`
}

async function loadReviews() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/reviews', {
      params: {
        search: search.value || undefined,
        page: page.value,
        page_size: 10
      }
    })
    const payload = unwrapPage<ReviewRow>(data)
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
  void loadReviews()
}

function prevPage() {
  if (page.value === 1) return
  page.value -= 1
  void loadReviews()
}

function nextPage() {
  if (page.value >= totalPages.value) return
  page.value += 1
  void loadReviews()
}

onMounted(() => {
  void loadReviews()
})
</script>

<template>
  <div class="page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Reviews</p>
        <h1>评价巡检台</h1>
        <p>把订单评价集中起来看，方便运营排查低分、异常文案和图片反馈。</p>
      </div>
    </section>

    <article class="panel-card">
      <div class="toolbar">
        <input v-model="search" type="text" placeholder="搜索评价内容、菜品名、吃货昵称、大厨昵称" />
        <button class="primary-button compact" @click="submitFilters" :disabled="loading">
          {{ loading ? '查询中...' : '应用筛选' }}
        </button>
      </div>

      <p v-if="errorMessage" class="banner-error">{{ errorMessage }}</p>

      <div class="review-grid">
        <article v-for="review in rows" :key="review.id" class="review-card">
          <div class="review-card__top">
            <div>
              <strong>{{ review.dish_name || '未知菜品' }}</strong>
              <span>{{ review.foodie_nickname || '匿名吃货' }} → {{ review.chef_nickname || '未命名大厨' }}</span>
            </div>
            <span class="status-chip">{{ ratingText(review.rating) }}</span>
          </div>

          <p class="review-card__meta">
            订单 {{ review.order_id }} · {{ review.created_at || '未知时间' }}
          </p>

          <p class="review-card__content">{{ review.content || '用户未填写文字评价' }}</p>

          <div v-if="review.images?.length" class="review-images">
            <img
              v-for="(image, index) in review.images.slice(0, 4)"
              :key="`${review.id}-${index}`"
              :src="image"
              :alt="`${review.dish_name}-评价图-${index + 1}`"
              class="review-image"
            />
          </div>
        </article>
      </div>

      <div v-if="!loading && !rows.length" class="empty-state">当前没有匹配到评价记录。</div>

      <div class="pagination">
        <button class="ghost-button compact" @click="prevPage" :disabled="page === 1">上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button class="ghost-button compact" @click="nextPage" :disabled="page >= totalPages">下一页</button>
      </div>
    </article>
  </div>
</template>
