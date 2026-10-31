<script setup lang="ts">
withDefaults(defineProps<{ a?: number; b?: number[]; d?: number }>(), { a: 1, b: () => [2] });
</script>
