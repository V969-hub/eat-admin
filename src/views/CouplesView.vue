<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { adminApi, formatApiError, unwrap, unwrapPage } from '../services/api'

interface CoupleRow {
  id: string
  status: string
  created_at: string | null
  updated_at: string | null
  anniversary_date: string | null
  user_a: {
    id: string
    nickname: string | null
    phone: string | null
  }
  user_b: {
    id: string
    nickname: string | null
    phone: string | null
  }
  metrics: {
    memo_count: number
    anniversary_count: number
    date_plan_count: number
    restaurant_wish_count: number
    restaurant_item_count: number
    date_draw_count: number
  }
}

interface CoupleMenuCategory {
  id: string
  relationship_id: string
  name: string
  image: string | null
  sort_order: number
  item_count: number
  created_at: string | null
  updated_at: string | null
}

interface CoupleMenuItem {
  id: string
  relationship_id: string
  category_id: string
  category_name: string | null
  name: string
  price: number
  images: string[]
  cover_image: string | null
  tags: string[]
  description: string | null
  created_at: string | null
  updated_at: string | null
}

interface CoupleRestaurantPayload {
  relationship: Pick<CoupleRow, 'id' | 'status' | 'anniversary_date' | 'created_at' | 'updated_at' | 'user_a' | 'user_b'>
  categories: CoupleMenuCategory[]
  items: CoupleMenuItem[]
  total_categories: number
  total_items: number
  wish_count: number
}

interface CoupleCandidateRow {
  id: string
  nickname: string | null
  phone: string | null
  role: string
  couple_code: string | null
  created_at: string | null
  has_active_couple: boolean
  active_couple_relationship_id: string | null
  active_partner: {
    id: string
    nickname: string | null
    phone: string | null
  } | null
}

const rows = ref<CoupleRow[]>([])
const page = ref(1)
const totalPages = ref(1)
const search = ref('')
const status = ref('')
const menuKeyword = ref('')
const loading = ref(false)
const detailLoading = ref(false)
const candidateLoading = ref(false)
const bindSubmitting = ref(false)
const unbindingId = ref('')
const savingCategory = ref(false)
const savingItem = ref(false)
const deletingCategoryId = ref('')
const deletingItemId = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const selectedCouple = ref<CoupleRow | null>(null)
const restaurantPayload = ref<CoupleRestaurantPayload | null>(null)
const editingCategoryId = ref('')
const editingItemId = ref('')
const candidateSearch = ref('')
const candidateRows = ref<CoupleCandidateRow[]>([])
const selectedBindUserA = ref<CoupleCandidateRow | null>(null)
const selectedBindUserB = ref<CoupleCandidateRow | null>(null)

const categoryForm = reactive({
  name: '',
  image: '',
  sort_order: '0'
})

const itemForm = reactive({
  category_id: '',
  name: '',
  price: '',
  images_text: '',
  tags_text: '',
  description: ''
})

const bindForm = reactive({
  anniversary_date: ''
})

const currency = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const normalizedImages = computed(() =>
  itemForm.images_text
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
)

const normalizedTags = computed(() =>
  itemForm.tags_text
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
)

function formatCurrency(value: number) {
  return `¥ ${currency.format(value || 0)}`
}

function formatRole(value: string) {
  return value === 'chef' ? '大厨' : '吃货'
}

function formatCandidateStatus(user: CoupleCandidateRow) {
  if (!user.has_active_couple) return '当前可绑定'
  return `已与 ${user.active_partner?.nickname || '其他用户'} 绑定`
}

function syncCoupleStatus(payload: { id: string; status: string; updated_at?: string | null }) {
  rows.value = rows.value.map((item) => (item.id === payload.id ? { ...item, ...payload } : item))
  if (selectedCouple.value?.id === payload.id) {
    selectedCouple.value = { ...selectedCouple.value, ...payload }
  }
  if (restaurantPayload.value?.relationship.id === payload.id) {
    restaurantPayload.value = {
      ...restaurantPayload.value,
      relationship: {
        ...restaurantPayload.value.relationship,
        ...payload
      }
    }
  }
}

async function loadCandidates() {
  candidateLoading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/couples/candidates', {
      params: {
        search: candidateSearch.value || undefined,
        page: 1,
        page_size: 8
      }
    })
    const payload = unwrapPage<CoupleCandidateRow>(data)
    candidateRows.value = payload.items
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    candidateLoading.value = false
  }
}

async function loadCouples() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await adminApi.get('/admin/couples', {
      params: {
        search: search.value || undefined,
        status: status.value || undefined,
        page: page.value,
        page_size: 8
      }
    })
    const payload = unwrapPage<CoupleRow>(data)
    rows.value = payload.items
    totalPages.value = payload.pageInfo.total_pages || 1
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

function resetCategoryForm() {
  editingCategoryId.value = ''
  categoryForm.name = ''
  categoryForm.image = ''
  categoryForm.sort_order = '0'
}

function resetItemForm() {
  editingItemId.value = ''
  itemForm.category_id = restaurantPayload.value?.categories[0]?.id || ''
  itemForm.name = ''
  itemForm.price = ''
  itemForm.images_text = ''
  itemForm.tags_text = ''
  itemForm.description = ''
}

function resetBindForm() {
  selectedBindUserA.value = null
  selectedBindUserB.value = null
  bindForm.anniversary_date = ''
}

function pickBindCandidate(slot: 'a' | 'b', user: CoupleCandidateRow) {
  if (user.has_active_couple) {
    errorMessage.value = `${user.nickname || '该用户'} 当前已有情侣关系，请先解绑`
    successMessage.value = ''
    return
  }

  if (slot === 'a' && selectedBindUserB.value?.id === user.id) {
    errorMessage.value = '用户A和用户B不能选择同一个人'
    successMessage.value = ''
    return
  }

  if (slot === 'b' && selectedBindUserA.value?.id === user.id) {
    errorMessage.value = '用户A和用户B不能选择同一个人'
    successMessage.value = ''
    return
  }

  errorMessage.value = ''
  if (slot === 'a') {
    selectedBindUserA.value = user
    return
  }
  selectedBindUserB.value = user
}

function clearBindCandidate(slot: 'a' | 'b') {
  if (slot === 'a') {
    selectedBindUserA.value = null
    return
  }
  selectedBindUserB.value = null
}

async function submitManualBind() {
  if (!selectedBindUserA.value || !selectedBindUserB.value) {
    errorMessage.value = '请先选择两位要绑定的用户'
    successMessage.value = ''
    return
  }

  bindSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.post('/admin/couples/bind', {
      user_a_id: selectedBindUserA.value.id,
      user_b_id: selectedBindUserB.value.id,
      anniversary_date: bindForm.anniversary_date || undefined
    })
    const payload = unwrap<{ id: string }>(data)
    successMessage.value = '情侣关系已手动绑定'
    resetBindForm()
    page.value = 1
    await Promise.all([loadCouples(), loadCandidates()])
    void payload
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    bindSubmitting.value = false
  }
}

async function loadRestaurantWorkspace(couple: CoupleRow, keyword?: string) {
  detailLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.get(`/admin/couples/${couple.id}/restaurant`, {
      params: {
        keyword: keyword || undefined
      }
    })
    const payload = unwrap<CoupleRestaurantPayload>(data)
    selectedCouple.value = couple
    restaurantPayload.value = payload
    if (!editingCategoryId.value) {
      resetCategoryForm()
    }
    if (!editingItemId.value) {
      resetItemForm()
    } else if (!payload.categories.some((item) => item.id === itemForm.category_id)) {
      itemForm.category_id = payload.categories[0]?.id || ''
    }
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    detailLoading.value = false
  }
}

function openWorkspace(couple: CoupleRow) {
  if (selectedCouple.value?.id !== couple.id) {
    resetCategoryForm()
    resetItemForm()
  }
  menuKeyword.value = ''
  void loadRestaurantWorkspace(couple)
}

function closeWorkspace() {
  selectedCouple.value = null
  restaurantPayload.value = null
  menuKeyword.value = ''
  resetCategoryForm()
  resetItemForm()
}

async function submitMenuSearch() {
  if (!selectedCouple.value) return
  await loadRestaurantWorkspace(selectedCouple.value, menuKeyword.value)
}

function editCategory(category: CoupleMenuCategory) {
  editingCategoryId.value = category.id
  categoryForm.name = category.name
  categoryForm.image = category.image || ''
  categoryForm.sort_order = String(category.sort_order ?? 0)
}

async function saveCategory() {
  if (!selectedCouple.value) return

  savingCategory.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    if (editingCategoryId.value) {
      await adminApi.put(
        `/admin/couples/${selectedCouple.value.id}/restaurant/categories/${editingCategoryId.value}`,
        {
          name: categoryForm.name,
          image: categoryForm.image ? categoryForm.image : null,
          sort_order: Number(categoryForm.sort_order || 0)
        }
      )
      successMessage.value = '菜单分类已更新'
    } else {
      await adminApi.post(`/admin/couples/${selectedCouple.value.id}/restaurant/categories`, {
        name: categoryForm.name,
        image: categoryForm.image ? categoryForm.image : null,
        sort_order: Number(categoryForm.sort_order || 0)
      })
      successMessage.value = '菜单分类已新增'
    }
    resetCategoryForm()
    await loadRestaurantWorkspace(selectedCouple.value, menuKeyword.value)
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    savingCategory.value = false
  }
}

async function removeCategory(category: CoupleMenuCategory) {
  if (!selectedCouple.value) return
  if (!window.confirm(`确认删除分类「${category.name}」吗？分类下仍有菜单时不能删除。`)) return

  deletingCategoryId.value = category.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await adminApi.delete(`/admin/couples/${selectedCouple.value.id}/restaurant/categories/${category.id}`)
    successMessage.value = '菜单分类已删除'
    if (editingCategoryId.value === category.id) {
      resetCategoryForm()
    }
    await loadRestaurantWorkspace(selectedCouple.value, menuKeyword.value)
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    deletingCategoryId.value = ''
  }
}

function editItem(item: CoupleMenuItem) {
  editingItemId.value = item.id
  itemForm.category_id = item.category_id
  itemForm.name = item.name
  itemForm.price = String(item.price)
  itemForm.images_text = (item.images || []).join('\n')
  itemForm.tags_text = (item.tags || []).join('，')
  itemForm.description = item.description || ''
}

async function saveItem() {
  if (!selectedCouple.value) return
  if (!itemForm.category_id) {
    errorMessage.value = '请先创建菜单分类，再新增菜单'
    successMessage.value = ''
    return
  }
  if (!normalizedImages.value.length) {
    errorMessage.value = '请至少填写一张菜单图片'
    successMessage.value = ''
    return
  }

  savingItem.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payload = {
      category_id: itemForm.category_id,
      name: itemForm.name,
      price: Number(itemForm.price || 0),
      images: normalizedImages.value,
      tags: normalizedTags.value,
      description: itemForm.description ? itemForm.description : null
    }

    if (editingItemId.value) {
      await adminApi.put(`/admin/couples/${selectedCouple.value.id}/restaurant/items/${editingItemId.value}`, payload)
      successMessage.value = '菜单已更新'
    } else {
      await adminApi.post(`/admin/couples/${selectedCouple.value.id}/restaurant/items`, payload)
      successMessage.value = '菜单已新增'
    }
    resetItemForm()
    await loadRestaurantWorkspace(selectedCouple.value, menuKeyword.value)
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    savingItem.value = false
  }
}

async function removeItem(item: CoupleMenuItem) {
  if (!selectedCouple.value) return
  if (!window.confirm(`确认删除菜单「${item.name}」吗？`)) return

  deletingItemId.value = item.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await adminApi.delete(`/admin/couples/${selectedCouple.value.id}/restaurant/items/${item.id}`)
    successMessage.value = '菜单已删除'
    if (editingItemId.value === item.id) {
      resetItemForm()
    }
    await loadRestaurantWorkspace(selectedCouple.value, menuKeyword.value)
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    deletingItemId.value = ''
  }
}

async function unbindCouple(couple: CoupleRow) {
  if (couple.status !== 'active') return
  if (!window.confirm(`确认手动解绑「${couple.user_a.nickname || '用户A'} / ${couple.user_b.nickname || '用户B'}」吗？`)) return

  unbindingId.value = couple.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data } = await adminApi.post(`/admin/couples/${couple.id}/unbind`)
    const payload = unwrap<{ id: string; status: string; updated_at: string | null }>(data)
    syncCoupleStatus(payload)
    successMessage.value = '情侣关系已手动解绑'
    await loadCandidates()
    if (selectedCouple.value?.id === couple.id) {
      await loadRestaurantWorkspace({ ...couple, ...payload })
    }
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    unbindingId.value = ''
  }
}

function submitFilters() {
  page.value = 1
  void loadCouples()
}

function prevPage() {
  if (page.value === 1) return
  page.value -= 1
  void loadCouples()
}

function nextPage() {
  if (page.value >= totalPages.value) return
  page.value += 1
  void loadCouples()
}

onMounted(() => {
  void loadCandidates()
  void loadCouples()
})
</script>

<template>
  <div class="page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Couples</p>
        <h1>情侣关系与小餐厅活跃度</h1>
        <p>现在这页已经支持后台手动绑定、手动解绑，以及情侣共享菜单的直接维护。</p>
      </div>
    </section>

    <article class="panel-card">
      <div class="panel-card__header">
        <div>
          <p class="eyebrow">Manual Bind</p>
          <h2>后台手动绑定情侣</h2>
          <p>搜索用户后直接点选两个人建立关系。若用户当前已有情侣关系，系统会阻止误绑。</p>
        </div>
      </div>

      <div class="toolbar">
        <input v-model="candidateSearch" type="text" placeholder="搜索昵称、手机号、open_id 或情侣码" />
        <button class="primary-button compact" @click="loadCandidates" :disabled="candidateLoading">
          {{ candidateLoading ? '搜索中...' : '搜索候选人' }}
        </button>
        <button class="ghost-button compact" @click="resetBindForm" :disabled="bindSubmitting">清空选择</button>
      </div>

      <div class="content-grid two-columns">
        <section class="sub-panel">
          <h3>待绑定用户</h3>
          <div class="detail-stack">
            <div class="detail-item detail-item--column">
              <span>用户 A</span>
              <strong>{{ selectedBindUserA?.nickname || '暂未选择' }}</strong>
              <span>
                {{
                  selectedBindUserA
                    ? `${selectedBindUserA.phone || '未绑定手机号'} · ${formatRole(selectedBindUserA.role)}`
                    : '建议先选第一位用户'
                }}
              </span>
              <button
                v-if="selectedBindUserA"
                class="ghost-button compact"
                @click="clearBindCandidate('a')"
              >
                清除用户 A
              </button>
            </div>

            <div class="detail-item detail-item--column">
              <span>用户 B</span>
              <strong>{{ selectedBindUserB?.nickname || '暂未选择' }}</strong>
              <span>
                {{
                  selectedBindUserB
                    ? `${selectedBindUserB.phone || '未绑定手机号'} · ${formatRole(selectedBindUserB.role)}`
                    : '再选第二位用户'
                }}
              </span>
              <button
                v-if="selectedBindUserB"
                class="ghost-button compact"
                @click="clearBindCandidate('b')"
              >
                清除用户 B
              </button>
            </div>

            <div class="sub-panel">
              <h3>绑定参数</h3>
              <div class="form-grid form-grid--wide">
                <input v-model="bindForm.anniversary_date" type="date" placeholder="在一起日期（可选）" />
                <button
                  class="primary-button"
                  :disabled="bindSubmitting || !selectedBindUserA || !selectedBindUserB"
                  @click="submitManualBind"
                >
                  {{ bindSubmitting ? '绑定中...' : '确认绑定情侣' }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="sub-panel">
          <h3>候选用户</h3>
          <div v-if="candidateLoading" class="empty-state">正在加载候选用户...</div>
          <div v-else-if="!candidateRows.length" class="empty-state">没有匹配到可选用户，换个关键词试试。</div>
          <div v-else class="review-grid">
            <article v-for="user in candidateRows" :key="user.id" class="review-card">
              <div class="review-card__top">
                <div>
                  <strong>{{ user.nickname || '未命名用户' }}</strong>
                  <span>{{ user.phone || '未绑定手机号' }} · {{ formatRole(user.role) }}</span>
                </div>
                <span class="status-chip" :class="{ subtle: !user.has_active_couple }">
                  {{ user.has_active_couple ? '已绑定' : '可绑定' }}
                </span>
              </div>

              <div class="metric-row">
                <span class="metric-pill">情侣码 {{ user.couple_code || '未生成' }}</span>
              </div>

              <p class="review-card__meta">{{ formatCandidateStatus(user) }}</p>

              <div class="table-actions">
                <button class="ghost-button compact" :disabled="user.has_active_couple" @click="pickBindCandidate('a', user)">
                  设为用户 A
                </button>
                <button class="ghost-button compact" :disabled="user.has_active_couple" @click="pickBindCandidate('b', user)">
                  设为用户 B
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </article>

    <article class="panel-card">
      <div class="toolbar">
        <input v-model="search" type="text" placeholder="搜索情侣双方昵称或手机号" />
        <select v-model="status">
          <option value="">全部状态</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <button class="primary-button compact" @click="submitFilters" :disabled="loading">
          {{ loading ? '查询中...' : '应用筛选' }}
        </button>
      </div>

      <p v-if="errorMessage" class="banner-error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="banner-success">{{ successMessage }}</p>

      <div class="couple-grid">
        <article v-for="item in rows" :key="item.id" class="couple-card">
          <div class="couple-card__header">
            <div>
              <strong>{{ item.user_a.nickname || '未命名用户' }}</strong>
              <span>{{ item.user_a.phone || '未绑定手机号' }}</span>
            </div>
            <span class="status-chip">{{ item.status }}</span>
          </div>

          <div class="couple-link">♥</div>

          <div class="couple-card__header">
            <div>
              <strong>{{ item.user_b.nickname || '未命名用户' }}</strong>
              <span>{{ item.user_b.phone || '未绑定手机号' }}</span>
            </div>
            <span>{{ item.anniversary_date || '未填写纪念日' }}</span>
          </div>

          <div class="metric-row">
            <span class="metric-pill">备忘录 {{ item.metrics.memo_count }}</span>
            <span class="metric-pill">纪念日 {{ item.metrics.anniversary_count }}</span>
            <span class="metric-pill">约饭计划 {{ item.metrics.date_plan_count }}</span>
            <span class="metric-pill">想吃清单 {{ item.metrics.restaurant_wish_count }}</span>
            <span class="metric-pill">菜单 {{ item.metrics.restaurant_item_count }}</span>
            <span class="metric-pill">约会抽卡 {{ item.metrics.date_draw_count }}</span>
          </div>

          <div class="table-actions">
            <button class="ghost-button compact" @click="openWorkspace(item)" :disabled="detailLoading && selectedCouple?.id === item.id">
              {{ selectedCouple?.id === item.id ? '查看中...' : '管理菜单' }}
            </button>
            <button
              class="ghost-button compact danger"
              :disabled="item.status !== 'active' || unbindingId === item.id"
              @click="unbindCouple(item)"
            >
              {{ unbindingId === item.id ? '解绑中...' : '手动解绑' }}
            </button>
          </div>
        </article>
      </div>

      <div class="pagination">
        <button class="ghost-button compact" @click="prevPage" :disabled="page === 1">上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button class="ghost-button compact" @click="nextPage" :disabled="page >= totalPages">下一页</button>
      </div>
    </article>

    <article v-if="selectedCouple" class="panel-card">
      <div class="panel-card__header">
        <div>
          <p class="eyebrow">Workspace</p>
          <h2>
            {{ selectedCouple.user_a.nickname || '未命名用户A' }}
            /
            {{ selectedCouple.user_b.nickname || '未命名用户B' }}
            的情侣小餐厅
          </h2>
          <p>
            在这里直接维护共享菜单分类和菜单项。当前关系状态：
            <strong>{{ restaurantPayload?.relationship.status || selectedCouple.status }}</strong>
          </p>
        </div>
        <div class="table-actions">
          <button class="ghost-button compact" @click="submitMenuSearch" :disabled="detailLoading">
            {{ detailLoading ? '刷新中...' : '刷新菜单' }}
          </button>
          <button class="ghost-button compact" @click="closeWorkspace">收起面板</button>
        </div>
      </div>

      <div class="toolbar">
        <input v-model="menuKeyword" type="text" placeholder="搜索菜单名称、描述或标签" />
        <button class="primary-button compact" @click="submitMenuSearch" :disabled="detailLoading">
          {{ detailLoading ? '查询中...' : '搜索菜单' }}
        </button>
      </div>

      <div v-if="detailLoading && !restaurantPayload" class="empty-state">正在加载情侣菜单工作台...</div>

      <template v-else-if="restaurantPayload">
        <div class="metric-row">
          <span class="metric-pill">分类 {{ restaurantPayload.total_categories }}</span>
          <span class="metric-pill">菜单 {{ restaurantPayload.total_items }}</span>
          <span class="metric-pill">想吃清单 {{ restaurantPayload.wish_count }}</span>
          <span class="metric-pill">纪念日 {{ selectedCouple.metrics.anniversary_count }}</span>
        </div>

        <div class="content-grid two-columns">
          <section class="sub-panel">
            <div class="panel-card__header">
              <div>
                <h3>{{ editingCategoryId ? '编辑菜单分类' : '新增菜单分类' }}</h3>
                <p>适合维护情侣餐厅的分组，比如早餐、夜宵、纪念日菜单。</p>
              </div>
              <button v-if="editingCategoryId" class="ghost-button compact" @click="resetCategoryForm">取消编辑</button>
            </div>

            <div class="form-grid">
              <input v-model="categoryForm.name" type="text" placeholder="分类名称" />
              <input v-model="categoryForm.sort_order" type="number" min="0" step="1" placeholder="排序值" />
              <input v-model="categoryForm.image" type="text" placeholder="分类图片 URL（可选）" />
              <button class="primary-button" :disabled="savingCategory" @click="saveCategory">
                {{ savingCategory ? '保存中...' : editingCategoryId ? '保存分类' : '新增分类' }}
              </button>
            </div>

            <div v-if="restaurantPayload.categories.length" class="review-grid">
              <article v-for="category in restaurantPayload.categories" :key="category.id" class="review-card">
                <div class="review-card__top">
                  <div>
                    <strong>{{ category.name }}</strong>
                    <span>排序 {{ category.sort_order }} · 菜单 {{ category.item_count }} 个</span>
                  </div>
                  <span class="status-chip">{{ category.item_count }} 项</span>
                </div>
                <p class="review-card__meta">{{ category.image || '未设置分类图片' }}</p>
                <div class="table-actions">
                  <button class="ghost-button compact" @click="editCategory(category)">编辑</button>
                  <button
                    class="ghost-button compact danger"
                    :disabled="deletingCategoryId === category.id"
                    @click="removeCategory(category)"
                  >
                    {{ deletingCategoryId === category.id ? '删除中...' : '删除' }}
                  </button>
                </div>
              </article>
            </div>
            <div v-else class="empty-state">还没有菜单分类，先新增一个。</div>
          </section>

          <section class="sub-panel">
            <div class="panel-card__header">
              <div>
                <h3>{{ editingItemId ? '编辑菜单' : '新增菜单' }}</h3>
                <p>支持后台手动补菜、修价格、改标签，也能删除不再需要的菜单。</p>
              </div>
              <button v-if="editingItemId" class="ghost-button compact" @click="resetItemForm">取消编辑</button>
            </div>

            <div class="form-grid form-grid--wide">
              <select v-model="itemForm.category_id">
                <option value="">请选择菜单分类</option>
                <option v-for="category in restaurantPayload.categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
              <input v-model="itemForm.name" type="text" placeholder="菜单名称" />
              <input v-model="itemForm.price" type="number" min="0" step="0.01" placeholder="价格" />
              <textarea
                v-model="itemForm.images_text"
                rows="3"
                placeholder="菜单图片 URL，支持换行、空格或逗号分隔"
              ></textarea>
              <textarea
                v-model="itemForm.tags_text"
                rows="2"
                placeholder="标签（可选），支持中文逗号或换行分隔"
              ></textarea>
              <textarea v-model="itemForm.description" rows="3" placeholder="菜单描述（可选）"></textarea>
              <button class="primary-button" :disabled="savingItem || !restaurantPayload.categories.length" @click="saveItem">
                {{ savingItem ? '保存中...' : editingItemId ? '保存菜单' : '新增菜单' }}
              </button>
            </div>

            <div v-if="restaurantPayload.items.length" class="review-grid">
              <article v-for="menuItem in restaurantPayload.items" :key="menuItem.id" class="review-card">
                <div class="review-card__top">
                  <div>
                    <strong>{{ menuItem.name }}</strong>
                    <span>{{ menuItem.category_name || '未分类' }} · {{ formatCurrency(menuItem.price) }}</span>
                  </div>
                  <span class="status-chip">{{ menuItem.images.length }} 图</span>
                </div>

                <div class="metric-row">
                  <span v-if="menuItem.tags.length" class="metric-pill">
                    {{ menuItem.tags.join(' / ') }}
                  </span>
                  <span v-else class="metric-pill">无标签</span>
                </div>

                <p class="review-card__meta">{{ menuItem.description || '暂无描述' }}</p>
                <p class="review-card__meta">{{ menuItem.cover_image || '未填写图片地址' }}</p>

                <div class="table-actions">
                  <button class="ghost-button compact" @click="editItem(menuItem)">编辑</button>
                  <button
                    class="ghost-button compact danger"
                    :disabled="deletingItemId === menuItem.id"
                    @click="removeItem(menuItem)"
                  >
                    {{ deletingItemId === menuItem.id ? '删除中...' : '删除' }}
                  </button>
                </div>
              </article>
            </div>
            <div v-else class="empty-state">当前没有菜单，先从右上表单添加一道菜。</div>
          </section>
        </div>
      </template>
    </article>
  </div>
</template>
