<script setup lang="ts">
defineProps<{ foo: number; }>();

defineModel<number>({ required: true });
</script>
