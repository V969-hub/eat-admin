<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { adminApi, formatApiError, setAdminSession, unwrap } from '../services/api'

const router = useRouter()
const username = ref('admin')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function submit() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data } = await adminApi.post('/admin/auth/login', {
      username: username.value,
      password: password.value
    })
    const payload = unwrap<{ token: string; profile: Record<string, unknown> }>(data)
    setAdminSession(payload.token, payload.profile)
    await router.replace('/dashboard')
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-hero">
      <p class="eyebrow">Private Chef Ops</p>
      <h1>为私厨业务准备的一套后台管理工作台</h1>
      <p class="hero-copy">
        这个后台围绕“运营节奏”来设计：先看今日状态，再处理用户、订单、菜品和情侣小餐厅的日常动作。
      </p>

      <div class="hero-panel">
        <div>
          <span class="hero-number">01</span>
          <p>总览指标把订单、GMV、打赏和通知压缩到一个入口。</p>
        </div>
        <div>
          <span class="hero-number">02</span>
          <p>列表页保留筛选、分页和基础操作，适合运营同学直接处理问题。</p>
        </div>
        <div>
          <span class="hero-number">03</span>
          <p>后台认证与小程序用户隔离，不会混用现有用户登录体系。</p>
        </div>
      </div>
    </section>

    <section class="login-card">
      <div class="login-card__header">
        <p class="eyebrow">Admin Sign In</p>
        <h2>登录后台</h2>
        <p>账号密码来自后端环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD`。</p>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label>
          <span>后台账号</span>
          <input v-model="username" type="text" placeholder="请输入后台账号" />
        </label>

        <label>
          <span>后台密码</span>
          <input v-model="password" type="password" placeholder="请输入后台密码" />
        </label>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? '正在登录...' : '进入后台' }}
        </button>
      </form>
    </section>
  </div>
</template>
