## MCP 架构：Memory–Controller–Planner 实现指南（实战版）

> 目标：给新手一个可以动手实现的 MCP 风格 Agent 思路，用于「稳定、可控、可扩展」的长流程任务。

---

## 一、整体设计思路

**MCP = Memory + Controller + Planner**，可以类比成：

- **Planner**：项目经理，负责拆任务、排顺序。
- **Controller**：调度中心，管流程、管状态、处理异常。
- **Memory**：公司知识库 + 项目文档，用来记住发生过什么。

实际代码实现时，推荐拆成以下几个模块（以伪代码/TypeScript 为例）：

- `Memory`：统一的读写接口，内部可以封装「会话缓冲 + 向量库」。
- `Planner`：根据「当前目标 + 当前状态」输出「下一步计划/Action」。
- `Controller`：有限状态机（State Machine）或流程引擎，驱动整个循环。
- `Tools`：若干工具函数（HTTP、数据库、文件、三方 API 等）。
- `LLMClient`：对大模型的统一封装（含 Function Calling / Tool Calling）。

---

## 二、模块拆分与接口设计

### 1. Memory 接口设计

面向 Agent 的记忆系统要保持**统一接口**，底层可以随时换实现：

```ts
// TypeScript 示例
export interface Memory {
  // 写入事件（对话、工具结果、系统状态变更等）
  appendEvent(event: MemoryEvent): Promise<void>;

  // 读取「短期记忆」：按时间顺序返回最近 N 条
  getRecentEvents(limit: number): Promise<MemoryEvent[]>;

  // 语义检索「长期记忆」
  search(query: string, limit: number): Promise<MemoryEvent[]>;
}
```

推荐最小实现：

- 短期记忆：直接用数据库/文件/Redis + 时间排序。
- 长期记忆：向量库可先用简单开源（Chroma / pgvector），新手阶段也可以先不做长期记忆，只做「会话缓冲」。

### 2. Planner 接口设计

Planner 要做的事情：**在当前上下文下，决定下一步要干什么**。

```ts
// 一个「动作」的抽象
export type AgentActionType = 'CALL_TOOL' | 'ASK_USER' | 'FINISH' | 'THINK';

export interface AgentAction {
  type: AgentActionType;
  toolName?: string;     // CALL_TOOL 时使用
  toolInput?: any;
  messageToUser?: string; // ASK_USER / FINISH 时给用户看的内容
}

export interface Planner {
  decideNextAction(input: {
    goal: string;
    memory: Memory;
    lastToolResult?: any;
  }): Promise<AgentAction>;
}
```

一个常见模式是：Planner 内部用 LLM，根据「目标 + 最近对话 + 最近工具结果」产出下一步 Action（可以使用 Function Calling 让 LLM 直接产出 `AgentAction` JSON）。

### 3. Controller（控制器）接口与状态机

Controller 是 Agent 的「主循环」，负责：

- 初始化上下文（目标、初始状态）。
- 调用 Planner 决定下一步要做什么。
- 负责任务生命周期（Running / WaitingUser / Finished / Failed）。

伪代码：

```ts
export class AgentController {
  constructor(
    private memory: Memory,
    private planner: Planner,
    private tools: Record<string, ToolFunction>,
  ) {}

  async run(goal: string): Promise<string> {
    let lastToolResult: any = null;

    while (true) {
      const action = await this.planner.decideNextAction({
        goal,
        memory: this.memory,
        lastToolResult,
      });

      if (action.type === 'FINISH') {
        await this.memory.appendEvent({ type: 'FINISH', content: action.messageToUser });
        return action.messageToUser ?? '';
      }

      if (action.type === 'ASK_USER') {
        await this.memory.appendEvent({ type: 'ASK_USER', content: action.messageToUser });
        // 实际产品中这里会把问题返回给前端，等待用户输入
        throw new Error('ASK_USER 逻辑需接入前端/调用方');
      }

      if (action.type === 'CALL_TOOL') {
        const toolFn = this.tools[action.toolName!];
        const result = await toolFn(action.toolInput);
        lastToolResult = result;

        await this.memory.appendEvent({
          type: 'TOOL_RESULT',
          toolName: action.toolName,
          content: result,
        });
      }

      // THINK 类型通常不用调用外部工具，只是让 Planner/LLM 多思考一轮
    }
  }
}
```

**实战建议**：Controller 内部可以显式维护状态机（例如 `status = 'RUNNING' | 'WAITING_USER' | 'FINISHED' | 'ERROR'`），并把每次状态变化写入 Memory，方便追踪与可视化。

---

## 三、Planner 的 LLM 实现示例

一个简单的 LLM Planner，一般用「系统 Prompt + 工具列表 + 最近对话/工具结果」来驱动。

### 1. Prompt 结构示例

```text
你是一个任务规划器（Planner），负责根据用户目标和当前上下文，决定下一步动作。

【目标】
{{goal}}

【最近事件】
{{recent_events}}

请在以下几种动作中选择其一，并用 JSON 返回：
- CALL_TOOL：调用某个工具继续推进任务
- ASK_USER：向用户提问，补充关键信息
- FINISH：任务完成，向用户输出最终结果
- THINK：仅在内部思考，不与用户交互，也不调用工具
```

### 2. Function Calling Schema 示例

以 OpenAI/DeepSeek 风格为例，定义一个 `next_action` 函数：

```ts
const functionSchema = {
  name: 'next_action',
  description: 'Agent 下一步要执行的动作',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['CALL_TOOL', 'ASK_USER', 'FINISH', 'THINK'],
      },
      toolName: { type: 'string' },
      toolInput: { type: 'object' },
      messageToUser: { type: 'string' },
    },
    required: ['type'],
  },
};
```

Planner 的 `decideNextAction` 就是对这个函数调用结果的轻量封装。

---

## 四、工具（Tools）层的工程要点

在 MCP 架构里，工具层的设计对「稳定性」和「可控性」非常关键，建议：

- 每个工具函数**只做一件事**（符合单一职责原则）。
- 明确输入输出类型，必要时做参数校验（例如用 zod / yup）。
- 所有异常都要捕获并转成「结构化错误」，写入 Memory，交给 Planner 决定如何处理（重试 / 换工具 / 让用户介入）。

工具函数示例：

```ts
type ToolFunction = (input: any) => Promise<any>;

const tools: Record<string, ToolFunction> = {
  'http_get': async ({ url }) => {
    // TODO: 参数校验
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP_ERROR_${res.status}`);
    return await res.text();
  },
  // 更多工具...
};
```

---

## 五、错误处理与重试策略

MCP 架构的优势之一，是可以把「错误处理」显式纳入 Controller + Planner 流程中，而不是让 LLM「无脑重试」：

1. 工具层抛出的异常转成结构化结果写入 Memory（带错误码/错误原因）。  
2. Planner 在「最近事件」里能看到**是什么工具、什么参数失败、失败几次**。  
3. Planner 可以选择：
   - 修改参数后重试同一个工具；
   - 换另一个工具；
   - 询问用户修正输入；
   - 直接终止任务，给出失败原因。

这样做的好处：

- 故障模式可见、可追踪；
- 不会出现「无限重试同一错误」的问题；
- 方便做 SRE/运营层面的可观测性。

---

## 六、适合用 MCP 的典型场景

- **企业内部流程编排**：例如审批流、报表生成、工单流转，需要强可控与审计能力。
- **多步骤长任务**：如「从多个系统拉数 → 清洗 → 生成报告 → 发邮件」，时间跨度可能是分钟到小时级。
- **多 Agent 协作**：例如「分析 Agent + 撰写 Agent + 审核 Agent」，用 Controller 管统一调度。

---

## 七、最小落地 Checklist

- [ ] 抽象出 `Memory` 接口，并实现一个最简单版本（仅会话缓冲）。  
- [ ] 用 LLM + Function Calling 实现 `Planner.decideNextAction`。  
- [ ] 写一个 `AgentController.run(goal)`，跑通「Planner → 工具 → Memory」闭环。  
- [ ] 至少接一个 HTTP 工具（如 GET 请求），做一个「自动查网页并总结」的小 Demo。  
- [ ] 给所有工具加上基础异常处理，把错误写入 Memory。  

做到上述这一步，就已经拥有一个「工程化」的 MCP 风格 Agent 雏形，可以在此基础上继续扩展多 Agent、长期记忆、可视化监控等能力。

