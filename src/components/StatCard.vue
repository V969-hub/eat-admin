<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  hint: string
  tone?: 'sand' | 'forest' | 'coral' | 'ink'
}>()
</script>

<template>
  <article class="stat-card" :data-tone="tone || 'sand'">
    <p class="stat-card__title">{{ title }}</p>
    <strong class="stat-card__value">{{ value }}</strong>
    <p class="stat-card__hint">{{ hint }}</p>
  </article>
</template>
