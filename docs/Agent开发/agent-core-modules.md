## 五大核心模块实现拆解：LLM / Memory / Planner / Tool-use / Reflection

> 目标：把总笔记中提到的「大脑、记忆、规划、手脚、反思」五个模块拆开，分别讲实现要点与代码骨架。

---

## 一、LLM（大脑）——统一封装，便于替换

### 1. 为什么要封装一层 LLMClient？

直接到处调用 `fetch("https://api.llm.com/...")` 会非常难维护，推荐抽象出一个 `LLMClient`：

```ts
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[], options?: { tools?: any[] }): Promise<string>;
  // 可以扩展：支持 Function Calling、流式输出等
}
```

好处：

- 随时可以在不改业务代码的前提下切换模型（GPT、Claude、通义、DeepSeek…）。  
- 统一做日志、重试、限流、埋点等。  

### 2. 基础实现示例（伪代码）

```ts
export class HttpLLMClient implements LLMClient {
  constructor(private apiKey: string, private baseUrl: string) {}

  async chat(messages: LLMMessage[], options?: { tools?: any[] }): Promise<string> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        tools: options?.tools,
        // 其他模型参数，如 temperature、top_p 等
      }),
    });

    const data = await res.json();
    return data.choices[0].message.content;
  }
}
```

---

## 二、Memory（记忆）——会话缓冲 + 语义检索

短期记忆用会话缓冲即可；长期记忆需要向量化与语义检索，实现原理见 **[长期记忆实现原理](./long-term-memory)**。若要从**文档/知识库**中检索内容并增强 LLM 回答，可配合 **[RAG 技术](./agent-rag)**（与长期记忆共用向量检索，但数据来源为事先建好的知识库）。

### 1. 会话缓冲（短期记忆）

最简单的 Memory，可以只做「按时间排序的事件列表」：

```ts
export interface MemoryEvent {
  type: 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM';
  content: string;
  createdAt: number;
}

export interface Memory {
  append(event: MemoryEvent): Promise<void>;
  getRecent(limit: number): Promise<MemoryEvent[]>;
}
```

初学阶段可以直接用数组或数据库表存：

```ts
export class InMemoryMemory implements Memory {
  private events: MemoryEvent[] = [];

  async append(event: MemoryEvent) {
    this.events.push({ ...event, createdAt: Date.now() });
  }

  async getRecent(limit: number) {
    return this.events.slice(-limit);
  }
}
```

### 2. 语义检索（长期记忆，选做）

当需要让 Agent 记住更多历史知识时，可以：

- 把事件内容送入向量库（embedding）。  
- 用「问题」做向量检索，找到最相关的过往事件。  

接口不变，只是在 Memory 内部增加一个 `vectorStore`。  
**实现细节（Embedding、向量库选型、检索策略、与 Memory 的衔接）见 [长期记忆实现原理](./long-term-memory)。**

---

## 三、Planner（规划器）——让 LLM 负责「下一步干啥」

### 1. 核心职责

- 读取当前 Memory / 工具结果 / 用户目标。  
- 输出一个「下一步计划」，通常是：
  - 要不要调用工具；  
  - 调哪个工具；  
  - 用什么参数；  
  - 还是直接给用户答案。  

### 2. 接口示例

```ts
export type PlanActionType = 'CALL_TOOL' | 'REPLY_USER' | 'NO_OP';

export interface PlanAction {
  type: PlanActionType;
  toolName?: string;
  toolInput?: any;
  reply?: string;
}

export interface Planner {
  plan(input: {
    goal: string;
    memory: Memory;
    lastToolResult?: any;
  }): Promise<PlanAction>;
}
```

### 3. LLM 驱动的 Planner 实例

使用 LLM + Function Calling 让 Planner 变得「可学习」：

```ts
export class LLMPlanner implements Planner {
  constructor(private llm: LLMClient) {}

  async plan(input: { goal: string; memory: Memory; lastToolResult?: any; }): Promise<PlanAction> {
    const recent = await input.memory.getRecent(10);
    const prompt = `
      用户目标：${input.goal}
      最近事件：${JSON.stringify(recent)}
      最近一次工具结果：${JSON.stringify(input.lastToolResult)}

      请决定下一步动作：调用工具 / 回复用户 / 暂时不做（NO_OP）。
    `;

    const res = await this.llm.chat([
      { role: 'system', content: '你是一个任务规划器，只输出 JSON。' },
      { role: 'user', content: prompt },
    ]);

    return JSON.parse(res) as PlanAction;
  }
}
```

---

## 四、Tool-use（工具调用）——把「手脚」标准化

### 1. 工具注册中心

工具在工程上推荐用「注册中心」集中管理：

```ts
export type ToolFn = (input: any) => Promise<any>;

export interface Tool {
  name: string;
  description: string;
  schema?: any; // 用于参数校验，可选
  fn: ToolFn;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
}
```

### 2. 工具调用封装

```ts
export async function callTool(registry: ToolRegistry, name: string, input: any) {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  // TODO: 使用 schema 校验 input
  return await tool.fn(input);
}
```

> 注意：所有工具异常都要捕获并记录到 Memory，避免整个 Agent 崩溃。

---

## 五、Reflection（反思）——用一轮额外 LLM 调用做「质检」

### 1. 反思的两种常见用法

1. **结果级反思**：  
   - 完成一个任务后，让 LLM 扮演「审稿人」，评估答案质量。  
   - 如果不满意，给出修改意见，再让原 Agent 重新生成。  

2. **过程级反思**：  
   - 在长链路任务中，定期总结「哪些尝试无效、哪些有效」。  
   - 帮助 Planner 更新后续策略（例如不再重复同样失败的工具调用）。  

### 2. 结果级反思示例

```ts
export async function reflectOnce(llm: LLMClient, question: string, answer: string): Promise<string> {
  const critique = await llm.chat([
    { role: 'system', content: '你是严格的代码/内容审查员。' },
    {
      role: 'user',
      content: `
        问题：${question}
        回答：${answer}
        请指出回答中的问题，并给出一个改进后的版本。
      `,
    },
  ]);

  // 可以约定输出结构：{ issues: [...], improved: "..." }
  return critique;
}
```

在主流程中，当 Agent 认为「任务完成」时，多走一步 `reflectOnce`，再决定用原答案还是改进后的答案。

### 3. 过程级反思示例（简化）

```ts
export async function reflectProcess(llm: LLMClient, events: MemoryEvent[]): Promise<string> {
  const summary = await llm.chat([
    { role: 'system', content: '你负责总结 Agent 的执行过程。' },
    {
      role: 'user',
      content: `
        以下是本次任务的执行日志，请总结：
        1. 哪些步骤是无效/重复的？
        2. 下次同类任务可以跳过什么？
        日志：${JSON.stringify(events)}
      `,
    },
  ]);

  return summary;
}
```

可以把这个总结作为「长期记忆」写入 Memory，供下次相似任务检索使用（长期记忆的存储与检索机制见 [长期记忆实现原理](./long-term-memory)）。

---

## 六、如何把五大模块组合起来

一个最小的组合方式可以是：

1. `LLMClient`：统一所有大模型调用。  
2. `Memory`：会话缓冲，保存用户输入、Agent 输出、工具结果。  
3. `ToolRegistry`：集中注册工具。  
4. `Planner`：用 LLM 驱动的 Planner 决定每一步动作（是否调工具、调哪一个）。  
5. `Reflection`：在任务结束时走一轮「结果反思」，必要时重新生成。  

主循环（伪代码）：

```ts
async function runAgent(goal: string) {
  const memory = new InMemoryMemory();
  const llm = new HttpLLMClient('KEY', 'URL');
  const planner = new LLMPlanner(llm);
  const tools = new ToolRegistry();

  // 注册工具省略

  let lastToolResult = null;

  while (true) {
    const action = await planner.plan({ goal, memory, lastToolResult });

    if (action.type === 'REPLY_USER') {
      const finalAnswer = action.reply!;
      const reflected = await reflectOnce(llm, goal, finalAnswer);
      return reflected; // 可以选择返回改进版本
    }

    if (action.type === 'CALL_TOOL') {
      lastToolResult = await callTool(tools, action.toolName!, action.toolInput);
      await memory.append({
        type: 'TOOL',
        content: JSON.stringify({ tool: action.toolName, result: lastToolResult }),
        createdAt: Date.now(),
      });
    }

    if (action.type === 'NO_OP') {
      break;
    }
  }
}
```

---

## 七、实践建议与优先级

新手在落地五大模块时，可以按以下顺序逐步加复杂度：

1. **先实现 LLMClient + ToolRegistry + 最简单 Memory（数组）**。  
2. **再实现一个非常简单的 Planner（硬编码 if/else），不使用 LLM**，先验证「流程」而不是「智能」。  
3. **然后换成 LLMPlanner**，让 LLM 参与决策。  
4. **需要跨会话回忆时**，再为 Memory 增加长期记忆能力（见 [长期记忆实现原理](./long-term-memory)）。  
5. **最后再引入 Reflection**，做质量控制与经验沉淀。  

这样可以避免一上来就所有概念叠加导致调试困难，让你更清楚地看到每个模块带来的边际价值。

