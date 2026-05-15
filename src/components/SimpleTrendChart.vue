<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  description: string
  labels: string[]
  values: number[]
  mode?: 'count' | 'currency'
}>()

const maxValue = computed(() => Math.max(...props.values, 0))
const minValue = computed(() => Math.min(...props.values, 0))
const latestValue = computed(() => props.values[props.values.length - 1] || 0)
const gradientId = `trend-fill-${Math.random().toString(36).slice(2, 8)}`

const formatter = new Intl.NumberFormat('zh-CN', {
  style: props.mode === 'currency' ? 'currency' : 'decimal',
  currency: props.mode === 'currency' ? 'CNY' : undefined,
  maximumFractionDigits: props.mode === 'currency' ? 2 : 0
})

const points = computed(() => {
  if (!props.values.length) return ''
  const width = 520
  const height = 180
  const paddingX = 18
  const paddingY = 18
  const usableWidth = width - paddingX * 2
  const usableHeight = height - paddingY * 2
  const max = Math.max(...props.values, 1)
  const min = Math.min(...props.values, 0)
  const range = Math.max(max - min, 1)

  return props.values
    .map((value, index) => {
      const x =
        props.values.length === 1
          ? width / 2
          : paddingX + (usableWidth * index) / (props.values.length - 1)
      const y = height - paddingY - ((value - min) / range) * usableHeight
      return `${x},${y}`
    })
    .join(' ')
})

const areaPoints = computed(() => {
  if (!points.value) return ''
  return `18,162 ${points.value} 502,162`
})

function formatValue(value: number) {
  return formatter.format(value)
}

function formatLabel(label: string) {
  return label.slice(5)
}
</script>

<template>
  <article class="panel-card trend-card">
    <div class="panel-card__header">
      <div>
        <p class="eyebrow">Trend</p>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <div class="chart-card__summary">
        <strong>{{ formatValue(latestValue) }}</strong>
        <span>最新值</span>
      </div>
    </div>

    <div class="chart-shell">
      <svg class="chart-svg" viewBox="0 0 520 180" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="gradientId" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(197,91,61,0.28)" />
            <stop offset="100%" stop-color="rgba(197,91,61,0.02)" />
          </linearGradient>
        </defs>
        <line x1="18" y1="162" x2="502" y2="162" class="chart-axis" />
        <line x1="18" y1="18" x2="18" y2="162" class="chart-axis" />
        <polygon :points="areaPoints" class="chart-area" :style="{ fill: `url(#${gradientId})` }" />
        <polyline :points="points" class="chart-line" />
      </svg>

      <div class="chart-meta">
        <span>最低 {{ formatValue(minValue) }}</span>
        <span>最高 {{ formatValue(maxValue) }}</span>
      </div>

      <div class="chart-labels">
        <span v-for="label in labels" :key="label">{{ formatLabel(label) }}</span>
      </div>
    </div>
  </article>
</template>
