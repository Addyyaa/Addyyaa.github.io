## ReAct 架构：Reasoning + Acting 实现指南（实战版）

> 目标：教你从 0 实现一个 ReAct 风格的单 Agent，适合做「快速原型」「单任务多步执行」。

---

## 一、ReAct 的核心循环

ReAct 的思想很简单：**交替进行「思考（Reasoning）→ 行动（Acting）」**。

在实现上，通常分为三块：

1. **Reason**：LLM 思考当前应该做什么（包括要不要调用工具）。  
2. **Act**：在需要时调用工具（API / DB / 文件等）。  
3. **Observe**：把工具结果再喂回 LLM，让它继续 Reason 或输出最终答案。

简化成伪代码：

```ts
while (true) {
  const thought = await llm.reason(history, tools);
  if (thought.type === 'FINISH') return thought.answer;
  if (thought.type === 'CALL_TOOL') {
    const result = await callTool(thought.toolName, thought.toolInput);
    history.push({ type: 'TOOL_RESULT', result });
  }
}
```

---

## 二、Prompt 设计：让 LLM 学会「先想再做」

ReAct 成败很大程度取决于 Prompt 设计。一个典型 Prompt 结构如下：

```text
你是一个智能助手，解决用户的问题。

在每一步中，你需要：
1. 先用自然语言描述你的思考过程（Thought）。
2. 决定是否调用工具（Action）。
3. 如果调用工具，就等待工具结果（Observation）后再继续思考。

【可用工具列表】
{{tools_description}}

【对话与历史】
{{history}}

请按以下 JSON 格式输出你的决策（不要解释）：
{
  "type": "THOUGHT" | "CALL_TOOL" | "FINISH",
  "thought": "你的思考",
  "toolName": "当 type=CALL_TOOL 时填写",
  "toolInput": { "参数": "..." },
  "finalAnswer": "当 type=FINISH 时填写"
}
```

> 实战建议：可以用 Function Calling 让 LLM 输出结构化 JSON，避免字符串解析出错。

---

## 三、使用 Function Calling 实现 ReAct

### 1. 定义动作 Schema

```ts
const actionFunctionSchema = {
  name: 'react_decision',
  description: 'ReAct Agent 的下一步决策',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['THOUGHT', 'CALL_TOOL', 'FINISH'] },
      thought: { type: 'string' },
      toolName: { type: 'string' },
      toolInput: { type: 'object' },
      finalAnswer: { type: 'string' },
    },
    required: ['type', 'thought'],
  },
};
```

### 2. ReAct 主循环伪代码

```ts
async function runReactAgent(goal: string) {
  const history: any[] = [{ type: 'USER', content: goal }];

  while (true) {
    const decision = await callLLMWithFunction({
      history,
      functions: [actionFunctionSchema],
      functionName: 'react_decision',
    });

    history.push({ type: 'ASSISTANT_THOUGHT', content: decision.thought });

    if (decision.type === 'FINISH') {
      history.push({ type: 'ASSISTANT', content: decision.finalAnswer });
      return decision.finalAnswer;
    }

    if (decision.type === 'CALL_TOOL') {
      const toolFn = tools[decision.toolName!];
      const result = await toolFn(decision.toolInput);
      history.push({ type: 'TOOL_RESULT', toolName: decision.toolName, content: result });
    }

    // THOUGHT 类型只更新思考，不调用外部工具
  }
}
```

---

## 四、工具定义与注入

ReAct 的工具通常比 MCP 略轻量 —— 可以直接用一个简单的字典来管理：

```ts
type ToolFn = (input: any) => Promise<any>;

interface ToolDef {
  name: string;
  description: string;
  schema: any; // 参数校验 Schema，可选
  fn: ToolFn;
}

const tools: Record<string, ToolDef> = {
  'search_web': {
    name: 'search_web',
    description: '在互联网上搜索信息并返回摘要',
    schema: {/* ... */},
    fn: async ({ query }) => {
      // 这里可以接 Firecrawl / 自己的搜索服务
      return await searchWeb(query);
    },
  },
  // 更多工具...
};
```

在 Prompt 里，把 `tools` 的 name + description 以自然语言列出来，让 LLM 选择。

---

## 五、ReAct 与「链式调用」的区别

- **Chain（链式调用）**：开发者预先写好固定步骤，模型只是填空或生成中间结果。  
- **ReAct**：每一步的决策由 LLM 根据当前上下文动态决定，**具有更强的灵活性与自适应能力**。

适用场景：

- Chain：流程固定、规则清晰、可预测性要求高的业务（例如固定报表生成）。  
- ReAct：目标明确但路径不固定的任务（例如「帮我调研某个新技术并写总结」）。

---

## 六、典型坑与规避方式

1. **LLM 幻觉导致乱调工具**  
   - 对策：Prompt 中强调「不清楚就先问用户」，并在 Tool 层做参数校验，错误写入 history 再交给 LLM 反思。

2. **无限循环调用工具**  
   - 对策：设定最大循环次数/最大工具调用次数；在 history 中加入「已经尝试过 N 次仍失败」的标记。

3. **工具调用粒度过细**  
   - 对策：适当提高每个工具的抽象层级，例如「搜索并总结页面」而不是「请求 HTML → 再提取正文 → 再总结」三层细碎工具。

4. **上下文过长导致成本高**  
   - 对策：只保留和当前任务强相关的 history，或对旧的对话做摘要后再传给 LLM。

---

## 七、最小 ReAct Demo 建议

从以下最小 Demo 开始练手：

1. 只接入一个 `http_get` 工具，做「帮我看这个网页内容并总结」的 Agent。  
2. 再加一个 `search_web` 工具，支持「先搜索，再选一个网页去总结」。  
3. 在 history 中显式记录工具调用和结果，让你可以在日志里完整看到 ReAct 决策过程。  

当你能稳定跑通上述 Demo，就已经掌握了 ReAct 的主干实现，可以进一步与「记忆」「多 Agent」「工作流编排」等更复杂场景结合。若用现成框架实现 ReAct（如 LangChain Agent、LangGraph），可参考 [LangChain 与同类框架详解](./agent-langchain-and-frameworks)。

