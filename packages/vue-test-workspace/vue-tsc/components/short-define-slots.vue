<script setup lang="ts">
defineSlots<{
  foo?: { id: string }
  bar: { id: number }
}>();
</script>

<script lang="ts">
declare function defineSlots<T>(): void;
</script>
