<script setup lang="ts">
defineProps<{ foo: string }>();
defineSlots<{ default?: (props: { n: number }) => any }>();
</script>
