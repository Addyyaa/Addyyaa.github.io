# LangChain 使用指南

> 基于 [LangChain 官方文档](https://python.langchain.com/docs/introduction/) 整理，面向「用 LangChain 快速搭建 Agent 与应用」的实操指南。  
> 概念与选型可先看 [LangChain 与同类框架详解](../agent-langchain-and-frameworks)；本页侧重**安装、创建 Agent、工具、流式、调试**等使用步骤。

---

## 大纲

1. [一、概述与选型](#一概述与选型)  
2. [二、安装与环境](#二安装与环境)  
3. [三、快速创建第一个 Agent](#三快速创建第一个-agent)  
4. [四、模型（Model）](#四模型model)  
5. [五、工具（Tools）](#五工具tools)  
6. [六、系统提示词（System Prompt）](#六系统提示词system-prompt)  
7. [七、运行方式：invoke 与 stream](#七运行方式invoke-与-stream)  
8. [八、持久化与人机循环（可选）](#八持久化与人机循环可选)  
9. [九、用 LangSmith 调试](#九用-langsmith-调试)  
10. [十、与 Deep Agents / LangGraph 的关系](#十与-deep-agents--langgraph-的关系)  
11. [十一、延伸阅读](#十一延伸阅读)

---

## 一、概述与选型

**LangChain** 是开源框架，提供**预置的 Agent 架构**和与各类模型、工具的集成，用少量代码即可搭建「模型 + 工具」的智能体。

- **适合**：快速做 Agent、自主应用，且希望灵活定制上下文与流程。  
- **与 Deep Agents**：若需要「开箱即用」的长对话压缩、虚拟文件系统、子 Agent 等，可考虑 [Deep Agents](https://python.langchain.com/oss/python/deepagents/overview/)；LangChain Agent 是更底层、可完全自定义的构建方式。  
- **与 LangGraph**：LangChain 的 Agent 底层基于 LangGraph；需要**强定制**的确定性 + 智能体混合工作流时，可直接用 [LangGraph](https://python.langchain.com/oss/python/langgraph/overview)。

---

## 二、安装与环境

### 1. 安装核心包与模型集成

按使用的模型提供商安装对应 extra：

```bash
# 核心
pip install -qU langchain

# 按需选一个或多个（示例：Anthropic）
pip install -qU "langchain[anthropic]"
# 其他常见：langchain[openai]、langchain[google]、langchain[langsmith] 等
```

### 2. 环境变量（API Key）

在调用前设置对应环境的 API Key，例如：

```bash
export ANTHROPIC_API_KEY="your-key"
# 或 OPENAI_API_KEY、GOOGLE_API_KEY 等，视所用 provider 而定
```

---

## 三、快速创建第一个 Agent

官方推荐用 **`create_agent`** 创建 Agent：传入模型、工具列表和系统提示词即可。

```python
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="claude-sonnet-4-6",   # 或 openai:gpt-4o、google:gemini-2.0 等
    tools=[get_weather],
    system_prompt="You are a helpful assistant",
)

# 同步调用
result = agent.invoke(
    {"messages": [{"role": "user", "content": "what is the weather in sf"}]}
)
```

- **输入**：`invoke` 接收一个带 `messages` 键的字典，`messages` 为消息列表（含 `role` 与 `content`）。  
- **输出**：返回的 state 中会包含更新后的 `messages`（含模型的回复与工具调用结果）。  
- **流程**：模型若返回工具调用（tool_calls），LangChain 会执行对应工具、把结果以 `ToolMessage` 形式追加到消息中，再次调用模型，直到没有新的 tool_calls 为止（即 [ReAct](../agent-react-arch) 式循环）。

---

## 四、模型（Model）

`create_agent` 的 `model` 可以是：

- **字符串**：如 `"claude-sonnet-4-6"`、`"openai:gpt-4o-mini"`，LangChain 会按前缀选择对应 provider 并创建模型实例。  
- **已实例化的 Chat Model**：如 `ChatAnthropic(...)`、`ChatOpenAI(...)`，便于你自行配置 temperature、api_key 等。

不同 provider 的命名与可用模型见官方 [Integrations / Providers](https://python.langchain.com/oss/python/integrations/providers/overview)。  
统一用 LangChain 的模型接口，便于在**不改业务逻辑**的前提下更换厂商，避免锁死单一 API。

---

## 五、工具（Tools）

### 1. 用普通函数定义工具

将「可被模型调用的能力」写成函数，并加上**文档字符串**（模型会据此决定是否调用及传参）：

```python
def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"

def search_docs(query: str) -> str:
    """Search internal documentation. Use when the user asks about product or policy."""
    # 实际可接 RAG、向量检索等
    return "Retrieved: ..."
```

把函数直接放进 `tools=[get_weather, search_docs]` 即可。

### 2. 使用 @tool 装饰器（可选）

需要更细粒度控制名称、描述或参数时，可使用 `@tool`：

```python
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """Get weather for a given city. Input should be a city name."""
    return f"It's always sunny in {city}!"
```

### 3. 工具与 Agent 的配合

Agent 每轮会看到当前消息列表；若模型输出中包含 `tool_calls`，框架会执行对应工具并把结果追加为 `ToolMessage`，再继续调用模型，直到模型不再请求调用工具并给出最终回答。  
这与 [ReAct 架构](../agent-react-arch) 的「推理 → 行动 → 观察」一致。

---

## 六、系统提示词（System Prompt）

`system_prompt` 用于设定 Agent 的角色与行为规范，例如：

```python
agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[get_weather],
    system_prompt="""你是一个有帮助的助手。在回答前，若需要实时信息请优先使用天气工具。
回答请简洁，并使用用户使用的语言。""",
)
```

系统提示词会在每轮模型调用时与 `messages` 一起传入，影响模型是否调用工具以及回复风格。

---

## 七、运行方式：invoke 与 stream

### 1. 同步：invoke

一次性传入消息，拿回完整 state（含全部新消息）：

```python
result = agent.invoke({"messages": [{"role": "user", "content": "北京天气怎么样？"}]})
# result["messages"] 包含 user / assistant / tool 等消息
```

### 2. 流式：stream / astream

需要「边执行边输出」时使用 `stream`（或异步 `astream`），并指定 `stream_mode`：

- **`stream_mode="updates"`**：按步骤流式输出状态更新（例如每执行完一次 LLM 或工具节点推一次）。  
- **`stream_mode="messages"`**：流式输出消息（如 LLM 的 token 流）。  
- **`stream_mode="custom"`**：按自定义逻辑流式输出。

示例（按步骤更新）：

```python
for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "北京天气怎么样？"}]},
    stream_mode="updates",
):
    print(chunk)  # 每步的 state 增量
```

适合在前端或 CLI 中做「打字机效果」或进度展示。

---

## 八、持久化与人机循环（可选）

LangChain 的 Agent 基于 **LangGraph** 实现，因此支持：

- **持久化（Persistence）**：将对话状态存入存储（如内存、Redis、数据库），便于多轮会话或断点续跑。  
- **人机循环（Human-in-the-loop）**：在图中插入「等待人工确认」节点，再根据用户输入决定下一步。

这类能力通常在「图」层面配置（如 LangGraph 的 `checkpointer`、`interrupt_before` 等）。若你只用 `create_agent` 的默认配置，可先不关心；需要时再查阅官方 [LangGraph](https://python.langchain.com/oss/python/langgraph/overview) 与 [Persistence / Human-in-the-loop](https://python.langchain.com/oss/python/langgraph) 相关章节。

---

## 九、用 LangSmith 调试

[LangSmith](https://python.langchain.com/langsmith/home) 是 LangChain 官方的追踪与评估平台，可查看每次调用的链路、状态变化与耗时。

### 1. 开启追踪

设置环境变量后，`invoke` / `stream` 的请求会自动上报到 LangSmith：

```bash
export LANGSMITH_TRACING=true
export LANGCHAIN_API_KEY="your-langsmith-api-key"
```

### 2. 能做什么

- 查看每次 Agent 运行的**完整消息链**（含工具调用与结果）。  
- 查看**状态转换**与各节点耗时。  
- 做**评估与回归**（如用数据集跑一批输入，对比输出）。

适合排查「Agent 为什么调了错误工具」「某步特别慢」等问题。

---

## 十、与 Deep Agents / LangGraph 的关系

| 层级 | 说明 |
|------|------|
| **Deep Agents** | 在 LangChain Agent 之上，提供「开箱即用」的长对话压缩、虚拟文件系统、子 Agent 等；适合快速做复杂多步 Agent。 |
| **LangChain Agent** | 用 `create_agent` 等构建「模型 + 工具」的 Agent，底层由 LangGraph 执行；适合快速上手又需一定定制。 |
| **LangGraph** | 底层图编排与运行时，支持确定性流程 + 智能体混合、持久化、人机循环等；适合强定制与复杂流程。 |

若你「只想先把一个会调工具的 Agent 跑起来」，按本指南用 **LangChain + create_agent** 即可；需要更复杂编排时再考虑直接使用 LangGraph 或 Deep Agents。

---

## 十一、延伸阅读

- **本系列**：[Agent 总览](../agent)、[五大核心模块](../agent-core-modules)、[ReAct 架构](../agent-react-arch)、[LangChain 与同类框架详解](../agent-langchain-and-frameworks)。  
- **官方**：[LangChain 介绍](https://python.langchain.com/docs/introduction/)、[安装](https://python.langchain.com/oss/python/langchain/install)、[Quickstart](https://python.langchain.com/oss/python/langchain/quickstart)、[Agents](https://python.langchain.com/oss/python/langchain/agents)、[Streaming](https://docs.langchain.com/oss/python/langchain/streaming)。
