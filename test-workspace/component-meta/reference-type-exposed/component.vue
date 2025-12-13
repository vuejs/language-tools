<script setup lang="ts">
import { ref, type VNode } from 'vue';
import type { MyExposed } from './my-exposed';

defineProps<{ label: string }>()
defineEmits<{ click: [event: Event] }>()
defineSlots<{ default: () => VNode[] }>()

const counter = ref('foo')
const oldCounter = ref('bar')

defineExpose<MyExposed>({
	counter,
  oldCounter,
});
</script>