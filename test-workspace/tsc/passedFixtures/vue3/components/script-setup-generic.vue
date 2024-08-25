<script setup lang="ts" generic="T">
import { Ref } from 'vue';

defineProps<{ foo: T }>();
defineEmits<{ (e: 'bar', data: T): void }>();
defineExpose({ baz: {} as T, buz: {} as Ref<1> });
defineSlots<{ default?(data: T): any }>();
</script>
