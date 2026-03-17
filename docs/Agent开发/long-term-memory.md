# 长期记忆实现原理

> 本文说明 Agent 中「长期记忆」的常见实现方式：向量化存储、检索流程、与短期记忆的配合，以及工程上的取舍。  
> 与 [五大核心模块](../agent-core-modules) 中的 Memory 小节对应，可作为其扩展阅读。  
> **与 RAG 的区别**：长期记忆检索的是「过去交互/经验」；若要从**固定文档/知识库**中取知识并增强回答，见 [RAG 技术（检索增强生成）](../agent-rag)。

---

## 一、长期记忆要解决什么问题？

**短期记忆**（会话缓冲）只能保留「当前对话」或「最近 N 条事件」，会话结束或超出窗口后，Agent 就无法再「回忆」之前发生的事。

**长期记忆**的目标是：

- **跨会话**：用户隔几天再来，Agent 仍能利用过去的交互或知识。  
- **按需召回**：在大量历史中，只取出与「当前问题」最相关的那一部分，而不是把全部历史塞进上下文。  
- **可更新、可遗忘**：支持写入新经验、对旧信息降权或删除，避免噪音堆积。

因此，长期记忆的实现通常围绕「**存储 + 检索**」两条线：用什么结构存、用什么方式查。

---

## 二、核心思路：向量化 + 语义检索

### 1. 为什么用「向量」？

自然语言若只按关键词或时间存储，很难做到「和当前问题语义相近就召回」。  
把文本变成**向量（embedding）**后，语义相近的句子在向量空间里距离更近，用「最近邻检索」就能实现「按意思找相关记忆」，而不是死记关键词。

流程可以概括为：

1. **写入**：每当产生值得长期保留的内容（如一次对话摘要、一次任务结果、用户偏好），用 **Embedding 模型**把文本转成向量，和原文一起存入**向量库**。  
2. **读取**：用户或 Agent 提出当前问题/目标时，同样把问题转成向量，在向量库中做 **相似度检索**（如 Top-K 最近邻），取回最相关的若干条记忆，再拼进当前上下文给 LLM 使用。

因此，长期记忆 = **Embedding 模型 + 向量存储 + 检索策略** 的组合。

---

## 三、实现组件拆解

### 1. Embedding 模型

把一段文本映射为固定长度的数值向量（例如 768 维、1536 维）。

- **可选方案**：  
  - 各云厂商的 embedding API（如 OpenAI `text-embedding-3-small`、通义、文心等）。  
  - 开源模型本地部署（如 `sentence-transformers`、BGE、M3E 等）。  
- **重要**：<span style="color:red;">**写入和读取必须用同一套 Embedding 模型**</span>（或同一系列的兼容模型），否则向量空间不一致，检索会失效。  
- **与 LLM 的关系**：<span style="color:red;">**向量模型与当前使用的 LLM 不需要兼容或同源**</span>——检索得到的是文本，直接拼进上下文给 LLM 读即可；只要写入与检索时用同一套向量模型即可。

接口可抽象为：

```ts
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>; // 可选，批量更省调用
}
```

### 2. 向量库（Vector Store）

存储「向量 + 元数据」，并支持按向量做相似度搜索。

| 类型 | 代表 | 特点 |
|------|------|------|
| 纯内存 / 单机 | 自维护数组 + 暴力 KNN、Chroma（本地） | 实现简单，适合 Demo 或小规模 |
| 数据库扩展 | pgvector（PostgreSQL）、MySQL 向量扩展 | 与现有 DB 统一，易做持久化与权限 |
| 专用向量库 | Milvus、Qdrant、Weaviate、Pinecone | 大规模、高并发、带过滤与混合检索 |

最小可用接口示例：

```ts
export interface VectorStore {
  add(id: string, vector: number[], metadata: { content: string; [k: string]: any }): Promise<void>;
  search(queryVector: number[], topK: number, filter?: Record<string, any>): Promise<SearchResult[]>;
}

export interface SearchResult {
  id: string;
  score: number;       // 相似度分数
  metadata: { content: string; [k: string]: any };
}
```

`metadata` 里通常至少存**原始文本**（content），还可存时间、类型、用户 ID、任务 ID 等，便于后续过滤（例如只查某用户、某时间段的记忆）。

### 3. 检索策略

- **仅向量检索**：用 query 的 embedding 在向量库里做 Top-K，简单直接。  
- **混合检索**：向量检索 + 关键词/过滤条件（如时间范围、标签），在 DB 里常用「向量 + where」一起用。  
- **重排序（Rerank）**：先召回较多候选（如 Top-20），再用一个更准的模型或规则做精排，只保留 Top-K（如 5 条）给 LLM，在质量要求高时很有用。

---

## 四、与 Memory 接口的衔接

在 [五大核心模块](../agent-core-modules) 里，Memory 已有 `append` 和 `getRecent`。长期记忆可以在此基础上扩展，而不破坏原有接口：

- **写入**：在 `append` 时（或单独在「需要沉淀为长期记忆」的时机），把内容交给 Embedding + VectorStore 写入。  
- **读取**：在 Planner 或 LLM 调用前，用当前「目标/问题」做一次向量检索，把得到的若干条记忆与 `getRecent` 的短期记忆**合并**，一起塞进 Prompt。

示例（扩展 Memory 接口）：

```ts
export interface Memory {
  append(event: MemoryEvent): Promise<void>;
  getRecent(limit: number): Promise<MemoryEvent[]>;
  // 长期记忆扩展
  searchRelevant?(query: string, limit: number): Promise<MemoryEvent[]>;
}
```

实现类内部持有一个 `VectorStore` + `EmbeddingProvider`，在 `searchRelevant` 里：  
`embed(query)` → `vectorStore.search(queryVector, limit)` → 把结果转成 `MemoryEvent[]` 返回。

---

## 五、写什么、何时写？

不是所有对话都要进长期记忆，否则会噪音过多、成本高。常见策略：

1. **按类型**：只把「用户明确要求记住的」、或「任务结果摘要」写入长期记忆；单轮闲聊可不写。  
2. **按重要性**：用规则或一个小模型对内容打分，超过阈值再写入。  
3. **摘要后写入**：对长对话先做摘要，只存摘要向量，减少条数和长度。  
4. **定期/按会话**：例如会话结束时，把本轮摘要写一条进长期记忆。

这些都可以在业务层或 Memory 的 `append` 上层做判断，再决定是否调用 VectorStore。

---

## 六、工程注意点

- **一致性**：<span style="color:red;">**写入和检索必须用同一 Embedding 模型**</span>与同一 VectorStore，否则结果不可预期；<span style="color:red;">**向量模型与 LLM 不必同源或兼容**</span>。  
- **元数据与过滤**：为每条记忆设计合理元数据（用户、时间、类型等），便于后续按人、按任务、按时间过滤，避免「串会话」「串用户」。  
- **成本与规模**：Embedding 调用和向量存储都有成本，可对写入做采样、摘要、去重，控制条数。  
- **更新与删除**：若支持「用户要求忘记某件事」，需在 VectorStore 层支持按 id 或条件删除/更新；若仅做追加，可考虑给每条记忆一个「权重」或 TTL，在检索时过滤掉过期或低权重的。

---

## 七、小结

| 环节 | 要点 |
|------|------|
| **目标** | 跨会话、按需召回、可更新，与短期记忆互补。 |
| **手段** | 文本 → Embedding → 向量库；查询时 query → Embedding → 相似度检索。 |
| **组件** | Embedding 模型 + VectorStore + 检索/重排策略。<span style="color:red;">**向量模型与 LLM 不需兼容；写入/检索须用同一向量模型。**</span> |
| **衔接** | 在 Memory 上扩展 `searchRelevant`，与 `getRecent` 合并后喂给 LLM。 |
| **写入策略** | 按类型/重要性/摘要写，避免全量写入造成噪音与成本过高。 |

实现并接好长期记忆后，Agent 就具备了「跨会话回忆」的能力；再结合 [五大核心模块](../agent-core-modules) 中的 Planner、Reflection，可以进一步做「从历史经验中学习」的迭代。
