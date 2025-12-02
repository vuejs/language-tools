<script lang="ts">
export const useOne = async () => {
  return { one: 'one' }
}

export default {}

export const useTwo = async () => ({ two: 'two' })
</script>

<script lang="ts" setup>
useOne()
useTwo()
</script>
