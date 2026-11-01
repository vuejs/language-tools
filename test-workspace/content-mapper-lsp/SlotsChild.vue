<script setup lang="ts">
defineProps<{ fooBar?: string }>();
defineSlots<{ default(props: { item: number }): any; named(): any }>();
</script>
