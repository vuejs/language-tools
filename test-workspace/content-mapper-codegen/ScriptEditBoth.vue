<script lang="ts">
declare function useFoo<T = unknown>(): { value: T };
export const fromScript: number = useFoo().value;
</script>

<script setup lang="ts">
const fromSetup: number = useFoo().value;
</script>
