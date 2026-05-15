import { createRouter, createWebHistory } from 'vue-router'

import { getAdminToken } from './services/api'
import AdminShell from './layouts/AdminShell.vue'
import BroadcastsView from './views/BroadcastsView.vue'
import CouplesView from './views/CouplesView.vue'
import DashboardView from './views/DashboardView.vue'
import DishesView from './views/DishesView.vue'
import LoginView from './views/LoginView.vue'
import OperationLogsView from './views/OperationLogsView.vue'
import OrdersView from './views/OrdersView.vue'
import ReviewsView from './views/ReviewsView.vue'
import UsersView from './views/UsersView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      component: AdminShell,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard'
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView
        },
        {
          path: 'dishes',
          name: 'dishes',
          component: DishesView
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersView
        },
        {
          path: 'couples',
          name: 'couples',
          component: CouplesView
        },
        {
          path: 'reviews',
          name: 'reviews',
          component: ReviewsView
        },
        {
          path: 'broadcasts',
          name: 'broadcasts',
          component: BroadcastsView
        },
        {
          path: 'operation-logs',
          name: 'operation-logs',
          component: OperationLogsView
        }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const hasToken = Boolean(getAdminToken())

  if (to.meta.requiresAuth && !hasToken) {
    return '/login'
  }
  if (to.path === '/login' && hasToken) {
    return '/dashboard'
  }
  return true
})

export default router
