<script setup lang="ts">
defineProps<{ msg: string | ((count: number) => string) }>();
</script>
