<script lang="ts">
/// <reference path="./globals.d.ts" />
export default {};
</script>

<script setup lang="ts">
defineProps<{ foo: string }>();
console.log(__GLOBAL__);
</script>
