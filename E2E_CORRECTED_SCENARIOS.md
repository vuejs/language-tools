# E2E 回归测试场景（修正版）

## 核心原则

**E2E 测试 = IDE + LSP 交互层，NOT 编译器层**

| 维度 | ❌ 不测试 | ✅ 要测试 |
|------|----------|---------|
| **Props** | Props 类型推断是否为 string | template 中 Hover Props 时 IDE 显示是否正确 |
| **Emits** | emit() 参数约束逻辑 | IDE 显示的诊断信息和位置是否准确 |
| **ref/computed** | 类型推断是否为 Ref<number> | Hover 显示的解包类型是否正确 |
| **template 表达式** | 编译器是否检测到错误 | IDE 诊断消息、位置、清晰度是否准确 |
| **补全** | 补全列表生成算法 | IDE 显示的补全列表是否完整、排序是否准确 |

---

## E2E 核心测试范畴（只有这些）

### 1. 🔍 Hover 信息准确性

#### 场景 1.1: 在 template 中 Hover refs 显示正确的解包类型

```vue
<script setup lang="ts">
const count = ref(0)
const message = ref('hello')
</script>

<template>
  <div>{{ count }}</div>     <!-- Hover 应该显示 number -->
  <div>{{ message }}</div>   <!-- Hover 应该显示 string -->
</template>
```

**E2E 测试**：
```typescript
test('ref 在 template 中 hover 显示解包类型而非 Ref<T>', async () => {
  const hover = await getHover(doc => 
    doc.positionAt(doc.getText().indexOf('{{ count }}') + 3)
  )
  
  // 应该显示 number，而不是 Ref<number>
  assert.ok(hover.includes('number'))
  assert.ok(!hover.includes('Ref'))
})
```

**为什么测试**：
- ✅ 关乎用户在 IDE 中看到的类型信息
- ✅ LSP 需要正确处理 template 中的 ref 解包
- ❌ 不是测试 ref 类型推断本身（单元测试已覆盖）

#### 场景 1.2: 在 template 中 Hover props 显示正确类型

```vue
<script setup lang="ts">
interface Props {
  title: string
  disabled?: boolean
}
defineProps<Props>()
</script>

<template>
  <h1>{{ title }}</h1>          <!-- Hover 应显示 string -->
  <input :disabled="disabled" /> <!-- Hover 应显示 boolean -->
</template>
```

**E2E 测试**：
```typescript
test('props 在 template 中 hover 显示正确类型', async () => {
  const hover = await getHover(doc => 
    doc.positionAt(doc.getText().indexOf('{{ title }}') + 3)
  )
  
  assert.ok(hover.includes('string'))
})

test('可选 props 的 hover 显示 | undefined', async () => {
  const hover = await getHover(doc =>
    doc.positionAt(doc.getText().indexOf('disabled'))
  )
  
  assert.ok(hover.includes('boolean | undefined'))
})
```

**为什么测试**：
- ✅ IDE 显示的 Props 类型信息准确性
- ✅ LSP Hover 接口是否正确返回类型
- ❌ 不是测试 Props 类型推断逻辑（单元测试）

#### 场景 1.3: computed 的 Hover 显示返回值类型（非 computed<T>）

```vue
<script setup lang="ts">
const count = ref(1)
const double = computed(() => count.value * 2)
</script>

<template>
  <div>{{ double }}</div>  <!-- Hover 应该显示 number，不是 Computed<number> -->
</template>
```

**E2E 测试**：
```typescript
test('computed 在 template 中 hover 显示返回值类型而非 Computed<T>', async () => {
  const hover = await getHover(doc =>
    doc.positionAt(doc.getText().indexOf('{{ double }}') + 3)
  )
  
  assert.ok(hover.includes('number'))
  assert.ok(!hover.includes('Computed'))
})
```

#### 场景 1.4: template ref 的 Hover 显示 DOM 或组件类型

```vue
<script setup lang="ts">
const inputRef = useTemplateRef<HTMLInputElement>('input')
const modalRef = useTemplateRef<InstanceType<typeof Modal>>('modal')
</script>

<template>
  <input ref="input" />
  <Modal ref="modal" />
</template>
```

**E2E 测试**：
```typescript
test('template ref 的 hover 显示正确的 DOM 类型', async () => {
  const hover = await getHover(inputRef_position)
  
  assert.ok(hover.includes('HTMLInputElement'))
  // 用户在 IDE 中能清楚地看到这是什么类型
})

test('template ref 的 hover 显示正确的组件类型', async () => {
  const hover = await getHover(modalRef_position)
  
  assert.ok(hover.includes('Modal'))
  // 应该显示组件的导出实例类型
})
```

---

### 2. ⚠️ 诊断准确性（最关键）

#### 场景 2.1: template 表达式中的类型错误诊断

```vue
<script setup lang="ts">
const count = ref<number>(0)
const name = ref<string>('')
</script>

<template>
  <!-- ❌ number 没有 toUpperCase 方法 -->
  <div>{{ count.toUpperCase() }}</div>
  
  <!-- ❌ string 没有 toFixed 方法 -->
  <div>{{ name.toFixed(2) }}</div>
</template>
```

**E2E 测试**：
```typescript
test('template 中的类型错误诊断消息准确', async () => {
  const diagnostics = await getDiagnostics()
  
  const error = diagnostics.find(d => 
    d.message.includes('toUpperCase')
  )
  
  assert.ok(error, '应该有诊断')
  assert.ok(error.message.includes('Property') || 
            error.message.includes('does not exist'),
            '消息应该清晰')
})

test('template 诊断的位置准确', async () => {
  const diagnostics = await getDiagnostics()
  const error = diagnostics[0]
  
  // 诊断位置应该在 "toUpperCase" 处
  const line = doc.getText().split('\n')[error.range.start.line]
  assert.ok(line.includes('toUpperCase'))
  
  // 列位置应该在 toUpperCase 的起始处
  const offset = error.range.start.character
  assert.ok(line[offset] === 't' || line[offset] === 'T')
})
```

**为什么测试**：
- ✅ IDE 诊断显示的准确性直接影响开发体验
- ✅ 用户看到的诊断消息是否清晰、位置是否准确
- ✅ LSP diagnostic 接口的正确性
- ❌ 不是测试编译器能否检测到错误（单元测试）

#### 场景 2.2: props 类型不匹配的诊断

```vue
<!-- Child.vue -->
<script setup lang="ts">
interface Props {
  count: number
  title: string
}
defineProps<Props>()
</script>

<!-- Parent.vue -->
<template>
  <!-- ❌ 应该有诊断：title 缺失 -->
  <Child :count="123" />
  
  <!-- ❌ 应该有诊断：count 类型错误（string 而非 number） -->
  <Child :count="'hello'" :title="'world'" />
</template>
```

**E2E 测试**：
```typescript
test('props 缺失的诊断显示', async () => {
  const diagnostics = await getDiagnostics('Parent.vue')
  
  const error = diagnostics.find(d =>
    d.message.includes('title')
  )
  
  assert.ok(error, '应该诊断缺失的 required prop')
})

test('props 类型错误的诊断显示', async () => {
  const diagnostics = await getDiagnostics('Parent.vue')
  
  const error = diagnostics.find(d =>
    d.message.includes('count') && 
    (d.message.includes('string') || d.message.includes('number'))
  )
  
  assert.ok(error, '应该诊断类型不匹配')
})

test('诊断位置指向 props 属性名', async () => {
  const diagnostics = await getDiagnostics('Parent.vue')
  const error = diagnostics[0]
  
  // 位置应该在 :count 或 :title 处
  const line = doc.getText().split('\n')[error.range.start.line]
  assert.ok(line.includes(':count') || line.includes(':title'))
})
```

#### 场景 2.3: 属性/方法不存在的诊断

```vue
<script setup lang="ts">
const user = ref<{ id: number; name: string }>({ id: 1, name: 'John' })
</script>

<template>
  <!-- ❌ user 对象没有 age 属性 -->
  <div>{{ user.age }}</div>
</template>
```

**E2E 测试**：
```typescript
test('不存在的属性诊断', async () => {
  const diagnostics = await getDiagnostics()
  
  const error = diagnostics.find(d =>
    d.message.includes('age')
  )
  
  assert.ok(error)
  assert.ok(error.message.includes('Property') || 
            error.message.includes('does not exist'))
})
```

#### 场景 2.4: 可选值的类型精化诊断

```vue
<script setup lang="ts">
const user = ref<{ name: string } | null>(null)
</script>

<template>
  <!-- ❌ user 可能为 null，不能直接访问 .name -->
  <div>{{ user.name }}</div>
  
  <!-- ✅ 用 v-if 后没有错误 -->
  <div v-if="user">{{ user.name }}</div>
  
  <!-- ✅ 用可选链也没有错误 -->
  <div>{{ user?.name }}</div>
</template>
```

**E2E 测试**：
```typescript
test('nullable 类型的诊断', async () => {
  const diagnostics = await getDiagnostics()
  
  const error = diagnostics.find(d =>
    d.message.includes('null') || 
    d.message.includes('undefined')
  )
  
  assert.ok(error, '应该诊断 null 的访问')
})

test('v-if 后的类型精化不显示诊断', async () => {
  // 修改模板，在 v-if 中访问
  const diagnostics = await getDiagnostics()
  
  // 应该没有诊断（因为已经类型精化）
  const errors = diagnostics.filter(d =>
    d.message.includes('null')
  )
  
  assert.strictEqual(errors.length, 0)
})

test('可选链后的类型精化不显示诊断', async () => {
  // user?.name 应该没有诊断
})
```

---

### 3. ✨ 自动补全准确性

#### 场景 3.1: Props 属性补全

```vue
<script setup lang="ts">
interface Props {
  title: string
  disabled?: boolean
  size: 'small' | 'large'
}
defineProps<Props>()
</script>

<template>
  <!-- 在 :ti 处，Ctrl+Space 应该显示补全 -->
  <input :ti[CTRL+SPACE] />
</template>
```

**E2E 测试**：
```typescript
test('props 属性补全列表完整', async () => {
  const completions = await getCompletions(
    doc => doc.positionAt(doc.getText().indexOf(':ti') + 3)
  )
  
  const labels = completions.map(c => c.label)
  
  assert.ok(labels.includes('title'), '应该有 title 补全')
  assert.ok(labels.includes('disabled'))
  assert.ok(labels.includes('size'))
})

test('props 补全项包含类型信息', async () => {
  const completions = await getCompletions(position)
  
  const titleCompletion = completions.find(c => c.label === 'title')
  assert.ok(titleCompletion.detail?.includes('string'),
            '补全应该显示属性类型')
})

test('补全列表的相关性排序', async () => {
  const completions = await getCompletions(position)
  
  // "title" 应该排在前面（因为最匹配 "ti"）
  assert.strictEqual(completions[0].label, 'title')
})
```

**为什么测试**：
- ✅ IDE 补全的准确性和完整性影响开发速度
- ✅ LSP completion 接口返回的列表
- ❌ 不是测试补全生成算法（单元测试）

#### 场景 3.2: 事件补全

```vue
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'submit', value: string): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <!-- 在 @su 处，应该补全为 @submit -->
  <button @su[CTRL+SPACE] />
</template>
```

**E2E 测试**：
```typescript
test('事件名补全', async () => {
  const completions = await getCompletions(
    doc => doc.positionAt(doc.getText().indexOf('@su') + 3)
  )
  
  const labels = completions.map(c => c.label)
  assert.ok(labels.includes('submit'))
  assert.ok(labels.includes('cancel'))
})

test('事件补全显示参数类型', async () => {
  const completions = await getCompletions(position)
  
  const submitCompletion = completions.find(c => c.label === 'submit')
  assert.ok(submitCompletion.detail?.includes('string'),
            '应该显示事件参数类型')
})
```

#### 场景 3.3: 方法和属性补全

```vue
<script setup lang="ts">
const text = ref('hello')
</script>

<template>
  <!-- 在 text. 处应该补全 toUpperCase 等方法 -->
  <div>{{ text.[CTRL+SPACE] }}</div>
</template>
```

**E2E 测试**：
```typescript
test('string 方法补全', async () => {
  const completions = await getCompletions(
    doc => doc.positionAt(doc.getText().indexOf('text.') + 5)
  )
  
  const labels = completions.map(c => c.label)
  assert.ok(labels.includes('toUpperCase'))
  assert.ok(labels.includes('toLowerCase'))
})
```

---

### 4. 🔗 代码导航

#### 场景 4.1: Go to Definition - 跨文件导入

```vue
<!-- Parent.vue -->
<script setup lang="ts">
import { Child } from '@/components/Child.vue'
</script>

<template>
  <!-- 点击 Child，应该跳转到 Child.vue -->
  <Child />
</template>
```

**E2E 测试**：
```typescript
test('组件导入能 Go to Definition', async () => {
  const definition = await goToDefinition(
    'Parent.vue',
    doc.getText().indexOf('Child')
  )
  
  assert.ok(definition.uri.endsWith('Child.vue'))
})
```

#### 场景 4.2: Go to Definition - 路径别名

```vue
<script setup lang="ts">
import type { User } from '@/types'  <!-- @ 别名 -->
</script>
```

**E2E 测试**：
```typescript
test('路径别名的 Go to Definition', async () => {
  const definition = await goToDefinition(
    'test.vue',
    doc.getText().indexOf('@/types')
  )
  
  assert.ok(definition.uri.includes('src/types'))
})
```

---

### 5. 🔄 多文件交互

#### 场景 5.1: 跨文件 Props 补全

```
src/
├── Parent.vue
└── Child.vue
```

```vue
<!-- Child.vue -->
<script setup lang="ts">
interface Props {
  title: string
  count: number
}
defineProps<Props>()
</script>

<!-- Parent.vue -->
<template>
  <!-- 补全列表应该包含 Child 的 Props -->
  <Child :ti[CTRL+SPACE] />
</template>
```

**E2E 测试**：
```typescript
test('跨文件 props 补全', async () => {
  const completions = await getCompletions(
    'Parent.vue',
    doc => doc.positionAt(doc.getText().indexOf(':ti') + 3)
  )
  
  const labels = completions.map(c => c.label)
  assert.ok(labels.includes('title'))
})
```

#### 场景 5.2: 修改后的增量诊断更新

```typescript
test('修改 Child.vue 的 props，Parent.vue 诊断立即更新', async () => {
  // 初始状态：Parent.vue 无错误
  let diagnostics = await getDiagnostics('Parent.vue')
  assert.strictEqual(diagnostics.length, 0)
  
  // 修改 Child.vue，删除 title prop
  await modifyFile('Child.vue', content =>
    content.replace('title: string', '')
  )
  
  // 等待服务器更新
  await waitForServerUpdate()
  
  // Parent.vue 的诊断应该更新，显示新的错误
  diagnostics = await getDiagnostics('Parent.vue')
  const error = diagnostics.find(d => d.message.includes('title'))
  assert.ok(error, 'Parent.vue 应该有新的诊断')
})
```

**为什么测试**：
- ✅ 验证 LSP 的增量更新机制是否工作
- ✅ 多文件项目中的诊断一致性
- ❌ 不是测试类型推断的跨文件传播逻辑

#### 场景 5.3: 删除导入的文件

```typescript
test('删除导入的文件，使用方显示诊断', async () => {
  // 删除 Child.vue
  await deleteFile('Child.vue')
  await waitForServerUpdate()
  
  const diagnostics = await getDiagnostics('Parent.vue')
  const error = diagnostics.find(d =>
    d.message.includes('Child') || 
    d.message.includes('cannot find')
  )
  
  assert.ok(error, '应该有导入错误的诊断')
})
```

---

## 最终的 P1 优先级列表（只有这些）

### 🔴 P1: IDE 显示准确性（第一个月）

1. **Template 诊断准确性** ⭐⭐⭐
   - [ ] 类型错误诊断（消息清晰、位置准确）
   - [ ] 属性不存在诊断
   - [ ] nullable 类型诊断
   - [ ] v-if 后的类型精化（不显示误诊）

2. **Props 的 IDE 显示** ⭐⭐⭐
   - [ ] template 中 Props 的 Hover
   - [ ] Props 属性补全列表
   - [ ] Props 缺失/类型错误的诊断

3. **基础补全列表** ⭐⭐⭐
   - [ ] Props 属性补全
   - [ ] 事件名补全
   - [ ] 补全相关性排序

4. **Hover 类型显示** ⭐⭐
   - [ ] ref 的解包类型显示
   - [ ] props 的类型显示
   - [ ] computed 的返回值类型显示

### 🟠 P2: 多文件与导航（第二个月）

5. **跨文件补全与诊断**
   - [ ] 跨文件 Props 补全
   - [ ] 修改后的增量诊断更新
   - [ ] 路径别名支持

6. **代码导航**
   - [ ] Go to Definition
   - [ ] Find References

### 🟡 P3: 特殊场景（长期维护）

7. **高级特性**
   - [ ] Template Ref 的类型显示
   - [ ] Slots 作用域参数
   - [ ] 增量更新的边界情况

---

## 测试工作区结构

```
e2e/workspace/
├── template-diagnostics/
│   ├── type-errors.vue          # 类型错误诊断
│   ├── missing-properties.vue   # 属性不存在
│   └── nullable-types.vue       # nullable 类型
├── props-ui/
│   ├── basic-props.vue
│   ├── optional-props.vue
│   └── prop-errors.vue
├── completions/
│   ├── props-completion.vue
│   └── events-completion.vue
├── hover-display/
│   ├── ref-unwrap.vue
│   ├── props-hover.vue
│   └── computed-hover.vue
├── cross-file/
│   ├── parent.vue
│   ├── child.vue
│   └── types.ts
└── navigation/
    ├── import-test.vue
    └── component-lib.vue
```

---

## 总结：修正前后对比

| 维度 | ❌ 修正前 | ✅ 修正后 |
|------|---------|---------|
| **场景数量** | 50+ 混乱场景 | 20+ 聚焦场景 |
| **关键原则** | 混淆编译器和 IDE 层 | 清晰分离：E2E = IDE + LSP |
| **Props 测试** | 包含类型推断验证 | 仅测试 IDE 显示/诊断 |
| **P1 范围** | 过宽过多 | 聚焦到 3-4 个核心功能 |
| **实施清晰度** | 模糊 | 清晰可执行 |
| **避免重复** | 与单元测试大量重复 | 与单元测试完全分离 |
