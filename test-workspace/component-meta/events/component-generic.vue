<script setup lang="ts" generic="T">
const emit = defineEmits<{
  /** Emitted when foo... */
  (evt: "foo", value: string): void
}>();
</script>
