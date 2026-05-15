<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { adminApi, clearAdminSession, formatApiError, getAdminProfile, unwrap } from '../services/api'

const router = useRouter()
const route = useRoute()
const adminName = ref<string>((getAdminProfile()?.display_name as string) || '系统管理员')
const meLoading = ref(false)

const navItems = [
  { label: '总览', to: '/dashboard', badge: '01' },
  { label: '用户管理', to: '/users', badge: '02' },
  { label: '菜品管理', to: '/dishes', badge: '03' },
  { label: '订单管理', to: '/orders', badge: '04' },
  { label: '情侣关系', to: '/couples', badge: '05' },
  { label: '评价管理', to: '/reviews', badge: '06' },
  { label: '消息广播', to: '/broadcasts', badge: '07' },
  { label: '操作日志', to: '/operation-logs', badge: '08' }
]

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full'
  }).format(new Date())
)

async function loadMe() {
  meLoading.value = true
  try {
    const { data } = await adminApi.get('/admin/auth/me')
    const profile = unwrap<{ username: string; display_name: string }>(data)
    adminName.value = profile.display_name
  } catch (error) {
    clearAdminSession()
    router.replace('/login')
    console.error(formatApiError(error))
  } finally {
    meLoading.value = false
  }
}

function logout() {
  clearAdminSession()
  router.replace('/login')
}

onMounted(() => {
  void loadMe()
})
</script>

<template>
  <div class="shell">
    <aside class="shell__sidebar">
      <div class="brand-card">
        <p class="eyebrow">EatPy Admin</p>
        <h1>私厨运营中台</h1>
        <p class="brand-copy">
          把用户、订单、菜品和情侣关系放到一个节奏稳定的后台工作台里。
        </p>
      </div>

      <nav class="nav-list">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'is-active': route.path === item.to }"
        >
          <span class="nav-item__badge">{{ item.badge }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <section class="shell__main">
      <header class="shell__header">
        <div>
          <p class="eyebrow">运营视图</p>
          <h2>{{ todayLabel }}</h2>
        </div>
        <div class="header-actions">
          <div class="admin-pill">
            <span class="dot"></span>
            <span>{{ meLoading ? '正在校验身份...' : adminName }}</span>
          </div>
          <button class="ghost-button" @click="logout">退出登录</button>
        </div>
      </header>

      <main class="shell__content">
        <RouterView v-slot="{ Component }">
          <Transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </section>
  </div>
</template>
