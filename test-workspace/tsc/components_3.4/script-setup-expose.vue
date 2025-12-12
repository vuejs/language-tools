<script setup>
import { ref } from 'vue3.4'

const a = 1
const b = ref(2)

defineExpose({
	a,
	b
})
</script>
