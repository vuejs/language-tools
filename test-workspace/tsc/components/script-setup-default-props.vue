<script setup lang="ts">
export interface Props {
  msg?: string
  labels?: string[]
}

withDefaults(defineProps<Props>(), {
  msg: 'hello',
  labels: () => ['one', 'two']
})
</script>
