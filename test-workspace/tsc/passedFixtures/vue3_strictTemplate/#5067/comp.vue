<script setup lang="ts" generic="T">
defineProps<{
    foo?: T;
}>();
defineEmits<{
    foo: [value: T]
}>();
</script>
