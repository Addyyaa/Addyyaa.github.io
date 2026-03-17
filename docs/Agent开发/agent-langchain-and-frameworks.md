# LangChain 与同类框架详解

> 本文讲解 **LangChain** 及其核心概念，并对比 **LangGraph、LlamaIndex、AutoGen、CrewAI** 等同类框架的定位与适用场景，帮助你在做 [Agent](../agent) 或 RAG 时选型与上手。

---

## 一、LangChain 是什么？

**LangChain** 是一个用于构建「大模型应用」的**编排框架**（orchestration framework），而不是某个具体的大模型或某个固定形态的 Agent。

它提供：

- **统一抽象**：把 LLM 调用、Prompt 管理、工具、记忆、链式调用等拆成可组合的组件。  
- **现成集成**：对接 OpenAI、Anthropic、通义、DeepSeek、本地模型等，以及向量库、文档加载器、检索器等。  
- **可编程流水线**：用「链（Chain）」或「图（LangGraph）」把多步逻辑串起来，方便实现 ReAct、RAG、多 Agent 等模式。

因此，[Agent 总览](../agent) 里提到的「大脑、记忆、规划、工具、反思」在 LangChain 里都有对应组件，你可以用 LangChain **实现**这些模块，而不是「LangChain = Agent」。

---

## 二、LangChain 核心概念

### 1. 模型封装（Models）

把不同厂商/开源模型统一成同一套接口，方便切换。

- **LLM**：纯文本进、文本出（如 `ChatOpenAI`、`ChatAnthropic`）。  
- **Chat Model**：支持 `system / user / assistant` 消息列表，是当前做 Agent 和对话的主流。  
- **Embeddings**：文本 → 向量，用于 [长期记忆](../long-term-memory) 或 [RAG](../agent-rag)。

```python
# 概念示例（非完整可运行）
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
```

### 2. Prompt 与模板（Prompts）

把「系统说明 + 用户输入 + 占位符」做成可复用模板，避免在代码里拼字符串。

- **PromptTemplate**：`"你是一个{role}，用户说：{input}"`，运行时填入变量。  
- **ChatPromptTemplate**：多消息角色（system / user / assistant），与 Chat Model 配套。  
- **Few-shot**：在模板里塞进示例，做小样本引导。

### 3. 输出解析（Output Parsers）

把 LLM 的自由文本输出转成结构化数据（JSON、列表、自定义类），方便后续逻辑和 [ReAct](../agent-react-arch) 的「下一步动作」解析。

- **PydanticOutputParser**：要求 LLM 按指定 JSON Schema 输出，再反序列化成 Pydantic 模型。  
- **StructuredOutputParser**、**JsonOutputParser** 等：不同格式与校验方式。

### 4. 链（Chains）

把「多个步骤」串成一条流水线：例如「Prompt → LLM → Parser」或「检索 → Prompt → LLM」。

- **LCEL（LangChain Expression Language）**：用 `|` 管道符组合组件，例如 `prompt | llm | parser`，支持流式、批量、异步。  
- **Chain** 的旧式写法：`LLMChain`、`SequentialChain` 等，逐渐被 LCEL 取代。

链适合**步骤固定**的流程；若需要「根据结果再决定下一步」（即 [ReAct](../agent-react-arch) 循环），一般用 **Agent** 或 **LangGraph**。

### 5. 记忆（Memory）

对应 [五大核心模块](../agent-core-modules) 里的 Memory。

- **短期**：`ConversationBufferMemory`、`ConversationBufferWindowMemory`（只保留最近 N 轮）。  
- **摘要**：`ConversationSummaryBufferMemory`，用 LLM 把历史压成摘要以省上下文。  
- **与向量库结合**：可用 `VectorStoreRetriever` 做长期记忆或 RAG，和 [长期记忆实现原理](../long-term-memory) 一致。

### 6. 工具（Tools）

对应 [五大核心模块](../agent-core-modules) 里的 Tool-use：给 Agent「手脚」。

- **Tool**：一个「名称 + 描述 + 函数」，描述会进 Prompt，让 LLM 决定是否调用。  
- **Toolkit**：一组相关 Tool 的集合。  
- **绑定到模型**：通过 `bind_tools()` 或 `with_structured_output()` 让 Chat Model 支持 Function Calling / Tool Calling。

Agent 在每轮推理时选择要调用的 Tool，执行后把结果塞回上下文，形成 [ReAct](../agent-react-arch) 式的「推理 → 行动 → 观察」循环。

### 7. Agent 与 AgentExecutor

- **Agent**：负责根据当前上下文**决定下一步**（调用哪个工具、传什么参数，或直接回答）。  
- **AgentExecutor**：负责**循环**：调用 Agent → 若选工具则执行 → 把结果写回 → 再调 Agent，直到 Agent 输出最终答案或达到步数上限。

内置 Agent 类型包括 **ReAct**、**Tool Calling**、**OpenAI Functions** 等，本质都是「LLM + 工具列表 + 解析下一步」的组合，对应 [ReAct 架构](../agent-react-arch) 的工程实现。

---

## 三、LangGraph：有状态、可循环的图

**LangGraph** 是 LangChain 生态里专门做「**有状态、多步、可分支/循环**」的扩展，适合复杂流程和 [MCP](../agent-mcp-arch) 式的控制流。

与「链」的区别：

| 维度 | Chain（LCEL） | LangGraph |
|------|----------------|-----------|
| **结构** | 线性管道 A→B→C | 图：节点 + 边，可分支、循环 |
| **状态** | 每步输入输出，无全局状态 | 有**状态对象**在节点间传递、可更新 |
| **适用** | 固定步骤的 RAG、简单问答 | 多步推理、ReAct、多 Agent、人工介入节点 |

核心概念：

- **State**：在图里流转的数据结构（如当前消息列表、已调用的工具结果、当前节点名）。  
- **Node**：一个函数，接收状态、返回状态更新（或下一跳）。  
- **Edge**：节点之间的转移；可以是固定边，也可以是**由节点返回值决定的动态边**（例如「若需要调工具则跳到 tool 节点，否则跳到 end」）。

这样就能显式实现「规划 → 执行工具 → 观察 → 再规划」的循环，以及 [A2A](../agent-a2a-arch) 中的多 Agent 路由。
在 [总览](../agent) 里提到的「LangGraph 的调度器」就是指用图来驱动 Planner / Controller 的调度逻辑。

---

## 四、同类框架与概念对比

### 1. LlamaIndex（原 GPT Index）

- **侧重**：**数据层 + 检索**，主打「把私有数据接到 LLM」：文档加载、解析、分块、建索引、检索、与 LLM 的查询流程。  
- **与 LangChain 的关系**：LangChain 偏「编排与 Agent」；LlamaIndex 偏「数据管道与 RAG」。两者可一起用：用 LlamaIndex 做索引与检索，用 LangChain 做链/Agent 和工具。  
- **适用**：文档问答、知识库 RAG、多数据源索引。对应本系列中的 [RAG 技术](../agent-rag) 与 [长期记忆](../long-term-memory) 的数据侧。

### 2. AutoGen（Microsoft）

- **侧重**：**多 Agent 对话与协作**，Agent 之间通过对话（消息）完成任务。  
- **特点**：支持人类参与（Human-in-the-loop）、代码执行、群聊式多 Agent。  
- **与 LangChain 的关系**：LangChain 单 Agent 或需自己用 LangGraph 拼多 Agent；AutoGen 直接提供多 Agent 会话抽象。  
- **适用**：需要多个角色（如分析师 + 写手 + 审核）协作的场景，对应 [A2A 架构](../agent-a2a-arch)。

### 3. CrewAI

- **侧重**：**角色化多 Agent + 任务编排**，每个 Agent 有角色、目标、背景，任务以 DAG 形式分解。  
- **特点**：强调「角色—任务」建模，适合剧本式的多角色协作（如研究员 + 写手 + 审稿人）。  
- **与 LangChain 的关系**：可底层用 LangChain 的 LLM/Tool；上层提供更高阶的 Crew/Task 抽象。  
- **适用**：内容生产、调研报告、需要明确分工的多 Agent 项目，也是 [A2A](../agent-a2a-arch) 的一种实现方式。

### 4. Haystack（deepset）

- **侧重**：**检索与 NLP 流水线**（检索、阅读、生成、路由等），偏「管道 + 组件」而非「Agent 循环」。  
- **与 LangChain 的关系**：更偏检索/RAG 流水线；Agent 与复杂控制流一般用 LangChain/LangGraph。  
- **适用**：搜索增强、文档 QA、需要精细控制检索与阅读器的场景。

### 5. Semantic Kernel（Microsoft）

- **侧重**：**插件（Plugins）、规划（Planner）、记忆**，与 LangChain 的 Tool / Agent / Memory 概念类似，但用 C# / Python 的「Kernel + Plugin」模型组织。  
- **适用**：微软技术栈、企业内已有 SK 投入的团队；与 LangChain 二选一或按生态选型。

---

## 五、框架选型简表

| 需求 | 更合适的框架/组合 |
|------|-------------------|
| 快速接 LLM + 简单链式调用 / RAG | **LangChain**（LCEL + 内置 RAG） |
| 单 Agent + 工具调用（ReAct） | **LangChain**（Agent + AgentExecutor）或 **LangGraph** |
| 复杂状态、循环、分支、人工介入 | **LangGraph** |
| 多 Agent 协作、角色对话 | **AutoGen**、**CrewAI**，或 **LangGraph** 自建 |
| 文档/知识库索引与检索为主 | **LlamaIndex**，或 LangChain + 向量库 |
| 企业级、微软技术栈 | **Semantic Kernel** 或 LangChain |

---

## 六、与本系列文档的对应关系

| 本系列文档 | 在 LangChain / 同类框架中的体现 |
|------------|----------------------------------|
| [Agent 总览](../agent) | LangChain Agent + Tool + Memory；LangGraph 图与状态 |
| [五大核心模块](../agent-core-modules) | Models、Memory、Tools、Output Parsers、可自建 Planner/Reflection |
| [ReAct 架构](../agent-react-arch) | LangChain ReAct Agent、Tool Calling Agent；LangGraph 的 ReAct 子图 |
| [MCP 架构](../agent-mcp-arch) | 可用 LangGraph 实现 Controller + Planner + Memory 的状态机 |
| [A2A 架构](../agent-a2a-arch) | LangGraph 多节点多 Agent；AutoGen / CrewAI 现成多 Agent |
| [长期记忆](../long-term-memory) | LangChain Memory + VectorStore Retriever；LlamaIndex 索引 |
| [RAG 技术](../agent-rag) | LangChain 的 RAG Chain、Retriever；LlamaIndex 的 Index + Query Engine |

---

## 七、小结

- **LangChain**：编排框架，提供 Models、Prompts、Chains、Memory、Tools、Agent/Executor 等组件，用于实现 [Agent](../agent) 与 RAG。  
- **LangGraph**：在 LangChain 生态内做有状态、可循环的图，适合复杂控制流与 [MCP](../agent-mcp-arch) / [ReAct](../agent-react-arch) 的显式实现。  
- **LlamaIndex**：偏数据与检索，适合 RAG 与长期记忆的数据侧；可与 LangChain 组合使用。  
- **AutoGen / CrewAI**：多 Agent 协作的现成方案，对应 [A2A](../agent-a2a-arch)；可按项目在「自建（LangGraph）」与「现成框架」之间选择。  

先理解 [Agent 架构](../agent) 与 [五大模块](../agent-core-modules)，再按需求选 LangChain / LangGraph 或其它框架，更容易对上概念、少走弯路。
