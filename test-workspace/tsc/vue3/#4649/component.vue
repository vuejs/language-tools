<script lang="ts" setup>
const modelAlias = defineModel({
    type: Number
});
const fooAlias = defineModel('foo', {
    type: Number,
    default: 1
});
const barAlias = defineModel('bar', {
    default: 1
});
</script>