# E2E 测试范围重新定义（修正版）

## 关键观点

**E2E 测试应该测试的是**：
- VS Code IDE 环境中的实际行为
- LSP (Language Server Protocol) 与 IDE 的集成
- 用户在编辑器中看到的现象

**NOT E2E 测试应该测试的是**：
- 编译器层面的类型推断逻辑（这是单元测试的职责）
- 类型约束规则的验证（这是单元测试的职责）
- 纯粹的编译器行为（这应该由 @vue/language-core 的单元测试覆盖）

---

## 错误分析：我之前的文档问题

### ❌ 不应该在 E2E 中的内容

#### 1. Props 类型推断本身
```
❌ E2E 测试不应该包含：
- "验证 type-based declaration 的类型推断是否正确"
- "验证 withDefaults 后类型是否移除 | undefined"
- "验证 Props 类型约束是否生效"

✅ 这些应该在单元测试中：
- @vue/language-core 的 Props 推断逻辑
- test-workspace/component-meta 中已有类似测试
```

**区别示例**：
```typescript
// ❌ 错：属于单元测试范畴
test('withDefaults 移除 | undefined') {
  const props = withDefaults(defineProps<Props>(), { count: 0 })
  // props.count 的类型应为 number (不是 number | undefined)
}

// ✅ 对：属于 E2E 范畴
test('在 template 中访问 withDefaults 的 props 时能否显示正确诊断') {
  // 在 IDE 中访问 props.count
  // 验证 IDE 显示的类型信息是否正确（通过 Hover）
  // 验证诊断信息是否准确
}
```

#### 2. Emits 参数类型约束
```
❌ E2E 测试不应该包含：
- "emit() 调用的参数类型是否被正确约束"
- "事件参数的 TypeScript 编译检查"

✅ 这些应该在单元测试中：
- 编译器的 emit 类型检查逻辑
```

**区别示例**：
```typescript
// ❌ 错：属于单元测试范畴
test('emit() 参数类型检查') {
  const emit = defineEmits<{
    (e: 'submit', value: string): void
  }>()
  
  emit('submit', 123) // 应该在编译时报错
}

// ✅ 对：属于 E2E 范畴
test('emit() 错误时 IDE 是否显示诊断') {
  // 在真实 IDE 中打开文件
  // 调用 IDE 的诊断接口
  // 验证是否收到类型错误的诊断信息
  // 验证诊断的位置是否正确
}
```

#### 3. Ref/Reactive 类型推断
```
❌ E2E 测试不应该包含：
- "ref<T> 的类型是否被推断为 Ref<T>"
- "reactive() 的深层属性类型推断"
- "computed 的返回值类型推断"

✅ 这些应该在单元测试中：
- @vue/language-core 的 reactivity 类型系统
```

---

## 正确的 E2E 测试范围

### 核心原则
E2E 测试 = **语言服务（LS）功能 + IDE 集成**

测试项应该通过 LSP 接口：
- `textDocument/hover` → 验证 IDE 显示的 Hover 信息
- `textDocument/completion` → 验证 IDE 的自动补全列表
- `textDocument/diagnostic` → 验证 IDE 的错误诊断显示
- `textDocument/definition` → 验证 IDE 的"转到定义"功能
- `textDocument/references` → 验证 IDE 的"查找引用"功能

---

## E2E 测试的 3 大类别

### 1️⃣ 类别 A: IDE 显示准确性（最核心）

这是 E2E 的主要职责——验证 IDE 显示的内容是否准确。

#### A1. Hover 信息准确性

```vue
<!-- test.vue -->
<script setup lang="ts">
const count = ref(0)
const message = ref('hello')
</script>

<template>
  <div>{{ count }}</div>
  <!-- 在 IDE 中 Hover 在 'count' 上，应该显示什么类型？ -->
</template>
```

**E2E 应该验证**：
```typescript
test('ref in template hover 显示正确的解包类型', async () => {
  const hover = await getHover(doc => 
    doc.positionAt(doc.getText().indexOf('{{ count }}') + 3)
  )
  
  // 应该显示 number (而非 Ref<number>)
  // 因为 template 中 ref 会自动解包
  assert.ok(hover.includes('number'))
  assert.ok(!hover.includes('Ref<'))
})

test('props in template hover 显示正确类型', async () => {
  // Props 在 template 中的 hover 显示
  const hover = await getHover(doc => 
    doc.positionAt(doc.getText().indexOf('{{ props.title }}'))
  )
  
  assert.ok(hover.includes('string'))
})

test('computed 在 template hover 显示返回值类型', async () => {
  // computed 的返回值类型（非 computed<T>）
  const hover = await getHover(doc =>
    doc.positionAt(doc.getText().indexOf('{{ double }}'))
  )
  
  assert.ok(hover.includes('number'))
})
```

**为什么这是 E2E**：
- 不是验证类型推断的正确性（单元测试职责）
- 而是验证**通过 LSP Hover 接口返回给 IDE 的信息是否正确**
- 关键是用户在 IDE 中看到的内容

#### A2. 错误诊断的显示与位置

```vue
<!-- test.vue -->
<script setup lang="ts">
const count = ref<number>(0)
</script>

<template>
  <div>{{ count.toUpperCase() }}</div>
  <!-- ^^^^^^^^^^^^^^^^^ 应该有诊断：number 没有 toUpperCase 方法 -->
</template>
```

**E2E 应该验证**：
```typescript
test('template 中的类型错误诊断准确', async () => {
  const diagnostics = await getDiagnostics()
  
  const error = diagnostics.find(d => 
    d.message.includes('toUpperCase') &&
    d.severity === DiagnosticSeverity.Error
  )
  
  assert.ok(error, '应该有诊断信息')
  assert.strictEqual(error.range.start.line, 4)  // template 所在行
  assert.ok(error.range.start.character >= 10)    // 位置在 toUpperCase 附近
})

test('template 中错误诊断的清晰性', async () => {
  const diagnostics = await getDiagnostics()
  
  const error = diagnostics[0]
  // 诊断消息应该清晰，比如：
  // "Property 'toUpperCase' does not exist on type 'number'"
  assert.ok(error.message.length > 0)
  assert.ok(error.message.includes('toUpperCase') || 
            error.message.includes('number'))
})
```

**为什么这是 E2E**：
- 不是验证编译器能否检测到错误（单元测试）
- 而是验证**LSP 的诊断接口是否正确返回诊断信息给 IDE**
- 以及**诊断消息和位置的准确性**

#### A3. 自动补全的准确性

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
  <input :di[CTRL+SPACE] />
  <!-- 在 IDE 中按 Ctrl+Space，应该看到什么？ -->
</template>
```

**E2E 应该验证**：
```typescript
test('props 的属性补全列表正确', async () => {
  const completions = await getCompletions(
    doc => doc.positionAt(doc.getText().indexOf(':di') + 3)
  )
  
  const items = completions.map(c => c.label)
  
  // 应该包含所有 Props
  assert.ok(items.includes('disabled'))
  assert.ok(items.includes('title'))
  assert.ok(items.includes('size'))
  
  // 检查补全信息的完整性
  const disabledItem = completions.find(c => c.label === 'disabled')
  assert.ok(disabledItem.detail?.includes('boolean'))
})

test('template 中的事件补全', async () => {
  const completions = await getCompletions(
    doc => doc.positionAt(doc.getText().indexOf('@cl') + 3)
  )
  
  const items = completions.map(c => c.label)
  assert.ok(items.includes('click'))
  assert.ok(items.includes('close'))
})

test('补全排序准确性', async () => {
  const completions = await getCompletions(position)
  
  // 最相关的补全应该排在前面
  const firstItem = completions[0]
  // (具体排序规则取决于 LSP 实现)
})
```

**为什么这是 E2E**：
- 不是验证补全列表的生成逻辑（单元测试）
- 而是验证**LSP 的 completion 接口返回的列表是否完整和准确**

---

### 2️⃣ 类别 B: LSP 与 IDE 交互（集成行为）

#### B1. 多文件场景的交互

```
src/
├── Parent.vue
├── Child.vue
└── types.ts
```

**E2E 应该验证**：
```typescript
test('跨文件导入：Child.vue props 在 Parent.vue template 中补全', async () => {
  // 1. 打开 Parent.vue
  // 2. 在 <Child :title 处请求补全
  // 3. 补全列表应该包含 Child.vue 的 Props
  
  const completions = await getCompletions(position)
  assert.ok(completions.some(c => c.label === 'title'))
})

test('修改 Child.vue 后，Parent.vue 的诊断增量更新', async () => {
  // 1. 打开 Parent.vue，此时没有错误
  // 2. 修改 Child.vue，删除 title prop
  // 3. Parent.vue 的诊断应该增量更新，显示新的错误
  
  await modifyFile('Child.vue', content => 
    content.replace('title: string', '')
  )
  
  await waitForServerUpdate()
  
  const diagnostics = await getDiagnostics('Parent.vue')
  assert.ok(diagnostics.some(d => 
    d.message.includes('title') && d.message.includes('unknown')
  ))
})

test('路径别名在 IDE 中可以 Go to Definition', async () => {
  // 验证 LSP 的 definition 接口是否支持 @ alias
  
  const definition = await goToDefinition(
    'Parent.vue',
    doc.getText().indexOf('@/types')
  )
  
  assert.ok(definition.uri.endsWith('types.ts'))
})
```

**为什么这是 E2E**：
- 涉及多文件场景下 LSP 的交互
- 验证服务器的增量更新是否工作
- 验证 LSP 接口的正确集成

#### B2. 工作区范围诊断

```typescript
test('保存文件后，整个工作区的诊断是否一致', async () => {
  // 比如：修改一个 type 定义后
  // 所有使用该 type 的文件都应该更新诊断
})

test('删除导入的文件后，使用方的诊断是否更新', async () => {
  // 删除 utils.ts
  // 在使用 utils 的文件中应该看到错误诊断
})
```

---

### 3️⃣ 类别 C: 特殊场景的 IDE 行为

#### C1. 模板引用的类型显示

```vue
<script setup lang="ts">
const inputRef = useTemplateRef<HTMLInputElement>('input')
</script>

<template>
  <input ref="input" />
</template>
```

**E2E 应该验证**：
```typescript
test('template ref 的 hover 显示正确的 DOM 类型', async () => {
  // Hover 在 inputRef 上
  const hover = await getHover(inputRef_position)
  
  // 应该显示类型信息，能看到是 HTMLInputElement
  assert.ok(hover.includes('HTMLInputElement'))
})

test('通过 ref 访问 DOM 属性时的补全准确', async () => {
  // inputRef.value.[补全]
  // 应该显示 HTMLInputElement 的方法和属性
})
```

**为什么这是 E2E**：
- 验证 LSP 是否正确返回 template ref 的类型信息

#### C2. 诊断的增量更新

```typescript
test('修改 script，template 诊断立即更新', async () => {
  // 修改 script 中的变量类型
  // template 中的相关诊断应该立即更新
  
  // 这涉及 LSP 的增量更新机制
})

test('syntax error 不导致其他诊断消失', async () => {
  // 在 script 中引入 syntax error
  // template 的诊断仍然应该存在
})
```

---

## 重新分类：E2E 的真正范围

### ✅ E2E 应该测试的（真正的场景）

#### 1. Hover 信息准确性
- [ ] ref 在 template 中的 Hover 显示解包类型
- [ ] props 在 template 中的 Hover 显示正确类型
- [ ] computed 的 Hover 显示返回值类型
- [ ] template ref 的 Hover 显示 DOM 或组件类型
- [ ] 方法和属性的 Hover 显示签名信息

#### 2. 诊断准确性
- [ ] template 表达式中的类型错误诊断
- [ ] props 类型不匹配时的诊断
- [ ] 属性/方法不存在时的诊断
- [ ] 可选值类型错误的诊断
- [ ] 诊断位置的准确性
- [ ] 诊断消息的清晰性

#### 3. 补全准确性
- [ ] props 属性补全
- [ ] 事件名补全
- [ ] 方法和属性补全
- [ ] 补全列表的相关性排序
- [ ] 补全项的详细信息（类型、描述）

#### 4. 代码导航
- [ ] Go to Definition (跨文件导入)
- [ ] Find References
- [ ] 路径别名的导航支持

#### 5. 多文件交互
- [ ] 跨文件 Props/Events 类型推断
- [ ] 修改一个文件后，相关文件的诊断更新
- [ ] 路径别名支持的补全和导航

#### 6. 增量更新机制
- [ ] 修改 script 后，template 诊断增量更新
- [ ] 修改组件后，使用方的诊断增量更新
- [ ] 大型工作区的增量更新效率

### ❌ E2E 不应该测试的（属于单元测试）

- Props 类型推断本身的正确性
- Emits 参数类型约束的逻辑
- ref/reactive/computed 的类型系统
- 类型兼容性的判断
- 泛型约束的验证
- 模板中复杂的类型精化逻辑
- Options API 的 this 类型推断
- 函数签名的参数类型匹配

---

## 修正后的场景清单

### P1: IDE 显示与诊断准确性

#### P1.1 Props 相关（仅 IDE 交互层）
```
✅ template 中访问 props 时的 Hover 显示
✅ props 属性的补全列表
✅ props 类型错误的诊断显示
❌ props 类型推断本身（单元测试）
```

#### P1.2 Emits 相关（仅 IDE 交互层）
```
✅ emit() 错误时的诊断显示（位置、消息准确）
✅ 事件监听器的参数类型 Hover
✅ 事件名的补全列表
❌ emit 参数类型约束逻辑（单元测试）
```

#### P1.3 Template 表达式（仅 IDE 交互层）
```
✅ 类型错误的诊断显示（位置、消息）
✅ 方法/属性不存在的诊断
✅ 表达式的 Hover 类型信息
✅ 可选链后的类型精化 Hover 显示
❌ 类型推断逻辑本身（单元测试）
```

#### P1.4 基础补全与导航
```
✅ Props/Events/Methods 补全列表
✅ 补全项的类型和描述
✅ Go to Definition 跨文件导航
✅ Find References
❌ 补全生成算法（单元测试）
```

### P2: 多文件集成

```
✅ 跨文件 Props/Events 的 Hover 和补全
✅ 跨文件修改后的增量诊断更新
✅ 路径别名的补全和导航
✅ 大型工作区的响应时间
❌ 类型推断的跨文件传播逻辑（单元测试）
```

### P3: 特殊场景

```
✅ Template Ref 的类型 Hover
✅ 泛型组件的补全（IDE 显示层）
✅ Slots 作用域参数的 Hover
✅ 修改后的增量更新（syntax error 处理等）
❌ 泛型推断逻辑（单元测试）
```

---

## 新的推荐优先级

### 🔴 P1（核心，立即实施）

**1. Template 表达式诊断准确性** ← 最常见的错误
- 类型错误时的诊断显示（消息清晰、位置准确）
- 方法/属性不存在的诊断
- 可选链操作符的类型精化

**2. Props 的 IDE 交互** ← 最常用的功能
- template 中 props 的 Hover 显示
- props 属性补全列表
- props 错误时的诊断

**3. 基础补全列表** ← 直接影响体验
- Props/Events/Methods 补全
- 补全相关性排序
- 补全项的详细信息

### 🟠 P2（重要，第一个月）

**4. 多文件补全与诊断**
- 跨文件 Props/Events 补全
- 修改后的增量诊断更新
- 路径别名支持

**5. Hover 信息准确性**
- ref 的解包类型显示
- computed 的返回值类型
- template ref 的 DOM 类型

### 🟡 P3（可选，长期）

**6. 代码导航与引用**
- Go to Definition
- Find References
- Rename

**7. 特殊场景**
- Slots 作用域类型
- 泛型组件补全
- 增量更新的边界情况

---

## 反思与改进

### 之前的错误

我之前的文档混淆了两个层面：
1. **编译器层面**（type inference）- 属于单元测试
2. **IDE 交互层面**（user experience）- 属于 E2E 测试

导致了大量不必要的测试重复。

### 正确的划分原则

| 层级 | 测试类型 | 职责 | 例子 |
|------|---------|------|------|
| 编译器 | 单元测试 | 类型推断是否正确 | Props 类型是否为 string？ |
| LSP | E2E 测试 | 推断结果是否通过 LSP 返回 | IDE Hover 时是否显示正确类型？ |
| IDE UI | E2E 测试 | LSP 响应是否被正确显示 | IDE 中诊断消息位置是否准确？ |

### 适用范围

这个重新定义适用于：
- ✅ Volar 项目（IDE 扩展）
- ✅ 任何 LSP 实现的测试
- ✅ 需要验证 IDE 集成的项目

不适用于：
- ❌ 纯编译器项目
- ❌ 库项目（只关心类型推断正确性）
