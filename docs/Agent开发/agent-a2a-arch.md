## A2A 架构：Agent-to-Agent 协作实现指南

> 目标：帮助你实现「多个 Agent 分工协作」的基础框架，用于复杂任务拆分与角色协作。

---

## 一、A2A 架构的核心思想

**A2A（Agent-to-Agent）= 多个具备不同能力/角色的 Agent，通过消息进行协作完成一个更复杂的任务。**

典型角色划分示例：

- **PlannerAgent**：负责把总目标拆解为子任务。  
- **WorkerAgent**：执行具体子任务（如检索、分析、撰写、编码等）。  
- **CriticAgent / ReviewerAgent**：审阅结果，给出修改建议或打分。  
- **Coordinator / Orchestrator**：负责任务分发和 Agent 之间的消息路由。

---

## 二、基础组件设计

### 1. Agent 抽象接口

```ts
export interface AgentMessage {
  from: string;         // 发送方 Agent 名字
  to: string;           // 接收方 Agent 名字或频道
  content: string;      // 自然语言 or 结构化 JSON
  metadata?: any;       // traceId、任务 id 等
}

export interface Agent {
  name: string;
  handleMessage(message: AgentMessage): Promise<AgentMessage[]>;
}
```

每个 Agent 接受一条消息，返回 0~N 条新消息（发给其他 Agent 或用户）。

### 2. Orchestrator / Router

```ts
export class AgentOrchestrator {
  constructor(private agents: Record<string, Agent>) {}

  async dispatch(initial: AgentMessage): Promise<void> {
    const queue: AgentMessage[] = [initial];

    while (queue.length > 0) {
      const msg = queue.shift()!;
      const agent = this.agents[msg.to];
      if (!agent) {
        console.warn(`No agent found for ${msg.to}`);
        continue;
      }
      const newMessages = await agent.handleMessage(msg);
      queue.push(...newMessages);
    }
  }
}
```

> 在真实系统中，`queue` 往往会用消息队列/任务队列实现（如 Redis、Kafka、数据库轮询等），以应对长耗时与高并发。

---

## 三、典型三 Agent 协作示例

我们实现一个「报告生成」的三 Agent 流程：

- `planner`：拆分任务（例如「调研 A + 调研 B + 汇总写报告」）。  
- `researcher`：负责查资料、读网页、提取要点。  
- `writer`：负责整合内容、撰写结构化报告。  

### 1. PlannerAgent 示例

```ts
export class PlannerAgent implements Agent {
  name = 'planner';

  async handleMessage(message: AgentMessage): Promise<AgentMessage[]> {
    const goal = message.content; // 用户目标

    const planText = await callLLM(`
      用户目标：${goal}
      请把任务拆成 2~5 个子任务，只用中文列出步骤。
    `);

    // 简化：直接把整体目标转发给 researcher
    return [{
      from: this.name,
      to: 'researcher',
      content: JSON.stringify({ goal, plan: planText }),
      metadata: message.metadata,
    }];
  }
}
```

### 2. ResearcherAgent 示例

```ts
export class ResearcherAgent implements Agent {
  name = 'researcher';

  async handleMessage(message: AgentMessage): Promise<AgentMessage[]> {
    const { goal, plan } = JSON.parse(message.content);

    const webNotes = await doWebResearch(goal); // 可用 ReAct/MCP 内部再做一层

    return [{
      from: this.name,
      to: 'writer',
      content: JSON.stringify({ goal, plan, webNotes }),
      metadata: message.metadata,
    }];
  }
}
```

### 3. WriterAgent 示例

```ts
export class WriterAgent implements Agent {
  name = 'writer';

  async handleMessage(message: AgentMessage): Promise<AgentMessage[]> {
    const { goal, plan, webNotes } = JSON.parse(message.content);

    const report = await callLLM(`
      目标：${goal}
      任务拆分：${plan}
      调研笔记：${webNotes}

      请按「背景-现状-分析-建议」结构写一份中文报告。
    `);

    return [{
      from: this.name,
      to: 'user',   // 约定：发给 user 即输出到前端
      content: report,
      metadata: message.metadata,
    }];
  }
}
```

---

## 四、消息格式与对话协议设计

多 Agent 系统要「不乱」，关键是：**约定好清晰的消息格式和协议**。

建议：

- 用 JSON 包装自然语言内容，保留结构：  
  `{"goal": "...", "plan": "...", "webNotes": "..."}`。  
- 给每个任务一个 `traceId` / `taskId`，写在 `metadata` 里，方便日志归集。  
- 约定好接收方名称：`planner` / `researcher` / `writer` / `critic` / `user` 等。

在更复杂系统里，可以设计「频道」（channel）或「主题」（topic）概念，让多个 Agent 订阅同一个主题。下面给出具体实现案例。

---

## 五、频道（Channel）与主题（Topic）实现案例

当需要「一条消息被多个 Agent 同时处理」或「按主题路由、而不是按 Agent 名字点对点」时，可以引入 **Topic（主题）** 与 **订阅关系**：消息发到某个 topic，所有订阅了该 topic 的 Agent 都会收到并各自处理，适合委员会评审、广播通知、多专家并行等场景。

### 1. 接口与类型定义

```ts
// 主题名：用字符串标识一个逻辑频道
export type TopicName = string;

// 消息的接收方可以是「单个 Agent」或「一个主题」
export type MessageTarget = string; // agent 名字 或 topic 名字，由路由层区分

export interface AgentMessage {
  from: string;
  to: MessageTarget;    // 如 'writer' 或 'topic:report-draft'
  content: string;
  metadata?: { traceId?: string; taskId?: string };
}

// 订阅表：topic -> 订阅了该 topic 的 Agent 名字列表
export type TopicSubscriptions = Record<TopicName, string[]>;
```

约定：`to` 以 `topic:` 前缀表示发往主题，否则表示发往指定 Agent。例如 `to: 'topic:report-draft'` 表示发往主题 `report-draft`。

### 2. 带主题的路由器（Topic-Aware Router）

```ts
export class TopicAwareOrchestrator {
  private agents: Record<string, Agent>;
  private subscriptions: TopicSubscriptions;

  constructor(
    agents: Record<string, Agent>,
    subscriptions: TopicSubscriptions,
  ) {
    this.agents = agents;
    this.subscriptions = subscriptions;
  }

  /** 解析 to 字段：若为 topic:xxx 则返回该 topic 下所有订阅者；否则返回 [to] */
  private resolveTargets(to: MessageTarget): string[] {
    if (to.startsWith('topic:')) {
      const topic = to.slice(6); // 'topic:report-draft' -> 'report-draft'
      return this.subscriptions[topic] ?? [];
    }
    return [to];
  }

  async dispatch(initial: AgentMessage): Promise<void> {
    const queue: AgentMessage[] = [initial];

    while (queue.length > 0) {
      const msg = queue.shift()!;
      const targets = this.resolveTargets(msg.to);

      for (const agentName of targets) {
        const agent = this.agents[agentName];
        if (!agent) continue;

        // 每条消息克隆一份，避免多个 Agent 改同一引用；可带上 topic 信息供 Agent 区分
        const agentMsg: AgentMessage = {
          ...msg,
          to: agentName,
          metadata: { ...msg.metadata, originalTo: msg.to },
        };
        const replies = await agent.handleMessage(agentMsg);
        queue.push(...replies);
      }
    }
  }
}
```

这样，当某条消息的 `to` 为 `topic:report-draft` 时，`resolveTargets` 会返回所有订阅了 `report-draft` 的 Agent，Orchestrator 会**依次**（也可改为并行）把消息交给每个订阅者处理，每个订阅者返回的新消息再进入队列继续路由。

### 3. 订阅表示例与注册方式

```ts
// 例如：报告草稿完成后，需要「技术评审 + 法务评审 + 产品评审」三个 Agent 都看到
const subscriptions: TopicSubscriptions = {
  'report-draft': ['critic-tech', 'critic-legal', 'critic-product'],
  'research-result': ['writer', 'critic-tech'],  // 调研结果同时给写手和技术评审
};

const agents: Record<string, Agent> = {
  planner: new PlannerAgent(),
  researcher: new ResearcherAgent(),
  writer: new WriterAgent(),
  'critic-tech': new CriticAgent('技术'),
  'critic-legal': new CriticAgent('法务'),
  'critic-product': new CriticAgent('产品'),
};

const orchestrator = new TopicAwareOrchestrator(agents, subscriptions);
```

Writer 在完成草稿后，不再点对点发给某一个 Agent，而是发到主题，由路由层投递给所有订阅者：

```ts
// 在 WriterAgent.handleMessage 里
return [{
  from: this.name,
  to: 'topic:report-draft',  // 发往主题，所有订阅者都会收到
  content: JSON.stringify({ reportId, draft: report }),
  metadata: message.metadata,
}];
```

### 4. 可选：并行投递与结果聚合

若希望「同一主题的多个订阅者并行执行」，再对结果做聚合（例如委员会投票），可以在 Orchestrator 里对同一消息的多个 target 先并行调用，再统一入队：

```ts
// 在 dispatch 循环中，对同一 msg 的多个 targets 并行处理
const targets = this.resolveTargets(msg.to);
const results = await Promise.all(
  targets.map(async (agentName) => {
    const agent = this.agents[agentName];
    if (!agent) return [];
    const agentMsg = { ...msg, to: agentName, metadata: { ...msg.metadata, originalTo: msg.to } };
    return agent.handleMessage(agentMsg);
  }),
);
results.flat().forEach((m) => queue.push(m));
```

这样「报告草稿」会同时发给技术/法务/产品三个 Critic，三人并行产出评审意见，后续可再由 `aggregator` Agent 订阅这些回复或由 Coordinator 收集后做汇总。

### 5. 小结

| 能力 | 说明 |
|------|------|
| **主题即频道** | `to: 'topic:xxx'` 表示发往主题，路由层根据订阅表解析出多个接收者。 |
| **一对多** | 一条消息可被多个订阅同一主题的 Agent 处理，适合评审、广播、多专家并行。 |
| **扩展** | 可增加并行投递、结果聚合、按条件订阅（如只订阅带某 tag 的消息）等，在现有接口上扩展即可。 |

---

## 六、多 Agent 协作中的常见模式

1. **流水线模式（Pipeline）**  
   - 数据沿着固定顺序在 Agent 间流动，如 `planner → researcher → writer → user`。  

2. **主持人模式（Moderator/Coordinator）**  
   - 由一个 `coordinator` 决定下一个应该由谁来处理当前消息。  

3. **委员会模式（Committee）**  
   - 多个「专家 Agent」并行给出意见，再由 `judge` 或 `aggregator` 做最终汇总/投票。  

---

## 七、A2A 与 MCP / ReAct 的关系

- **MCP**：偏「系统分层 + 控制流」，关注「一个 Agent 内部如何运行」。  
- **ReAct**：偏「单 Agent 的推理 + 工具调用循环」。  
- **A2A**：在此之上，把多个 Agent（各自内部可以是 MCP 或 ReAct）串起来协作。

一个典型组合是：

- `planner` 内部用 ReAct/MCP 做规划。  
- `researcher` 内部用 ReAct 做「查网页 + 总结」。  
- `writer` 内部只是一个简单 LLM 调用。  
- 外层用 A2A 把这几类能力组合成一个完整系统。

---

## 八、最小落地 Checklist

- [ ] 抽象出 `Agent` + `AgentMessage` 接口。  
- [ ] 实现一个最简单的 `AgentOrchestrator`（内存队列即可）。  
- [ ] 至少实现三个 Agent：`planner` / `worker` / `writer`，跑通「多 Agent 串联」。  
- [ ] 给每条消息加上 `taskId`，并写日志，方便调试。  
- [ ] 逐步引入更复杂的角色（如 `critic`）与更复杂的路由策略。  

当你有了一个可运行的 A2A 框架，就可以开始尝试「多角色写文案」「多角色做代码审查」「多角色做产品设计讨论」等更复杂应用场景。

