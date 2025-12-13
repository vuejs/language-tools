<script setup lang="ts">
import { ref } from 'vue';
import type { MyExposed } from './my-exposed';

const counter = ref('foo')
const oldCounter = ref('bar')

defineExpose<MyExposed>({
	counter,
  oldCounter,
});
</script>