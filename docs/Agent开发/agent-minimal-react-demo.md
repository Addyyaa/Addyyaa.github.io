## 最小可运行 ReAct Agent 示例：从 0 到 1 写完一个 Demo

> 目标：基于主笔记中的 ReAct 思路，给出一个「真正能跑」的极简 Demo，帮助你完整走一遍实现流程。

---

## 一、功能目标与约束

**目标功能**：  
用户输入一个问题，Agent 可以：

1. 视情况调用一个 `http_get` 工具抓取网页；  
2. 把抓到的内容总结给用户；  
3. 整个过程使用 ReAct 循环（思考 → 调工具 → 观察 → 再思考）。  

**约束**：

- 用伪代码/TypeScript 描述，重点看「结构」而不是某个 SDK 细节。  
- LLM 调用部分可换成你自己的模型/SDK，只要接口类似即可。  

---

## 二、项目结构建议

```text
agent-minimal-react-demo/
  ├─ llm.ts          // LLMClient 封装
  ├─ tools.ts        // 工具定义与调用
  ├─ react-agent.ts  // ReAct 主循环
  └─ index.ts        // 入口：读取用户输入，调用 Agent
```

---

## 三、LLMClient 封装（llm.ts）

```ts
// llm.ts

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

export class DummyLLMClient implements LLMClient {
  async chat(messages: LLMMessage[]): Promise<string> {
    // 这里仅作示例，实际要换成调用真实大模型的代码
    console.log('调用 LLM：', messages);
    return '{"type":"FINISH","thought":"暂时用 DummyLLM 返回。","finalAnswer":"这里应该是模型生成的答案。"}';
  }
}
```

在真实项目中，把 `DummyLLMClient` 换成对 DeepSeek / GPT / Claude / 通义等的封装即可。

---

## 四、工具层实现（tools.ts）

```ts
// tools.ts

export type ToolFn = (input: any) => Promise<any>;

export interface Tool {
  name: string;
  description: string;
  fn: ToolFn;
}

export const httpGetTool: Tool = {
  name: 'http_get',
  description: '通过 HTTP GET 抓取指定 URL 文本内容',
  fn: async ({ url }: { url: string }) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP_ERROR_${res.status}`);
    }
    return await res.text();
  },
};

export const toolRegistry: Record<string, Tool> = {
  [httpGetTool.name]: httpGetTool,
};

export async function callTool(name: string, input: any) {
  const tool = toolRegistry[name];
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return await tool.fn(input);
}
```

---

## 五、ReAct Agent 主循环（react-agent.ts）

### 1. 决策结构定义

```ts
// react-agent.ts

import type { LLMClient, LLMMessage } from './llm';
import { callTool } from './tools';

type DecisionType = 'THOUGHT' | 'CALL_TOOL' | 'FINISH';

interface ReactDecision {
  type: DecisionType;
  thought: string;
  toolName?: string;
  toolInput?: any;
  finalAnswer?: string;
}
```

### 2. 构造 ReAct Prompt 并解析决策

```ts
function buildReactPrompt(goal: string, history: string): string {
  return `
你是一个使用 ReAct 策略的智能 Agent。
用户目标：${goal}

【历史记录】
${history}

你每一步要先思考（thought），再决定是否调用工具（action），或者直接给出最终答案。

请只输出一个 JSON，如：
{
  "type": "THOUGHT" | "CALL_TOOL" | "FINISH",
  "thought": "你的思考",
  "toolName": "当 type=CALL_TOOL 时填写，如 http_get",
  "toolInput": { "url": "https://..." },
  "finalAnswer": "当 type=FINISH 时填写"
}
`;
}

function parseDecision(raw: string): ReactDecision {
  try {
    return JSON.parse(raw) as ReactDecision;
  } catch (e) {
    // 简化处理：解析失败时直接结束
    return {
      type: 'FINISH',
      thought: '解析决策失败，直接结束。',
      finalAnswer: raw,
    };
  }
}
```

### 3. ReAct 主循环实现

```ts
export class ReactAgent {
  constructor(private llm: LLMClient) {}

  async run(goal: string): Promise<string> {
    let historyText = '';
    let step = 0;

    while (step < 8) { // 简单防御：最多 8 步
      step++;

      const prompt = buildReactPrompt(goal, historyText);
      const messages: LLMMessage[] = [
        { role: 'system', content: '你是一个善于分步解决问题的智能 Agent。' },
        { role: 'user', content: prompt },
      ];

      const raw = await this.llm.chat(messages);
      const decision = parseDecision(raw);

      historyText += `\n[LLM_THOUGHT_${step}] ${decision.thought}`;

      if (decision.type === 'FINISH') {
        return decision.finalAnswer ?? '（无最终回答）';
      }

      if (decision.type === 'CALL_TOOL' && decision.toolName) {
        try {
          const result = await callTool(decision.toolName, decision.toolInput);
          historyText += `\n[TOOL_RESULT_${step}] ${JSON.stringify(result).slice(0, 500)}...`;
        } catch (e: any) {
          historyText += `\n[TOOL_ERROR_${step}] ${e?.message ?? e}`;
        }
      }
    }

    return '达到最大步数限制，任务未完全完成。';
  }
}
```

---

## 六、入口文件：跑通一个完整 Demo（index.ts）

```ts
// index.ts

import { DummyLLMClient } from './llm';
import { ReactAgent } from './react-agent';

async function main() {
  const llm = new DummyLLMClient();
  const agent = new ReactAgent(llm);

  const goal = '帮我查看 https://example.com 的内容，并用中文简要总结要点。';
  const answer = await agent.run(goal);

  console.log('最终回答：', answer);
}

main().catch(console.error);
```

> 在真实项目中，把 `DummyLLMClient` 替换为实际 LLM 接口，并在 Prompt 中详细列出 `http_get` 工具描述，模型就可以真正完成「先拉网页 → 再总结」的 ReAct 任务。

---

## 七、，你可以如何在这个 Demo 上继续进化？

建议按以下顺序迭代：

1. 替换 LLM 实现为真实模型，调试 ReAct 循环是否按预期调用工具。  
2. 增加一个 `summarize_text` 工具：长网页先裁剪/分块再总结，避免上下文超长。  
3. 引入 Memory 模块：把每一步的 thought / observation 写入 Memory，方便后续分析与可视化。  
4. 在 Agent 完成后，加一层 Reflection，对最终答案做一次「质量审查和改写」。  

做到这一步，你就完成了一个从 0 到 1 的 ReAct Agent 实战路径，为后续 MCP / A2A 等更复杂架构打下基础。

