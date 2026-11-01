<script setup lang="ts">
declare function useFoo<T = unknown>(): { value: T };
const n: number = useFoo().value;
</script>
