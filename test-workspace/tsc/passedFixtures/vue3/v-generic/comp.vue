<script setup lang="ts" generic="T extends string | number">
defineEmits<{
    foo: [val: T]
}>();
</script>