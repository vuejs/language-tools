<script setup lang="ts">
defineProps<{
  foo: string
  bar?: number
}>()

defineEmits<{
  (e: 'change', id: number): void
  (e: 'update', value: string): void
}>()
</script>
