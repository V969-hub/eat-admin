import axios, { AxiosError } from 'axios'

const STORAGE_KEY = 'eat-admin-token'
const PROFILE_KEY = 'eat-admin-profile'

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export interface PageInfo {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface PaginatedEnvelope<T> {
  code: number
  message: string
  data: T[]
  page_info: PageInfo
}

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')

export const adminApi = axios.create({
  baseURL,
  timeout: 15000
})

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

adminApi.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data.code === 'number' && response.data.code !== 200) {
      return Promise.reject(new Error(response.data.message || '请求失败'))
    }
    return response
  },
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      clearAdminSession()
    }
    const message = error.response?.data?.message || error.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

export function setAdminSession(token: string, profile: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, token)
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearAdminSession() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

export function getAdminToken() {
  return localStorage.getItem(STORAGE_KEY)
}

export function getAdminProfile() {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export function unwrap<T>(payload: ApiEnvelope<T>) {
  return payload.data
}

export function unwrapPage<T>(payload: PaginatedEnvelope<T>) {
  return {
    items: payload.data,
    pageInfo: payload.page_info
  }
}

export function formatApiError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return '请求失败，请稍后重试'
}
