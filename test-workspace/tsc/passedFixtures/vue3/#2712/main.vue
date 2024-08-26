<script lang="ts">
export default {
	inheritAttrs: true,
};
</script>

<script setup lang="ts">
async function foo() {
	return "bar";
}
await foo();
</script>
