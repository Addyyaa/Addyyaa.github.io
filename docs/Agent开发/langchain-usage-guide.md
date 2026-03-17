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
8. [八、存储指南（精简版）：文档分块 → 向量化 → VectorStore → Retriever](#八存储指南精简版文档分块--向量化--vectorstore--retriever)
9. [九、运行状态持久化与人机循环（可选）](#九运行状态持久化与人机循环可选langgraph-persistence)
10. [十、用 LangSmith 调试](#十用-langsmith-调试)
11. [十一、与 Deep Agents / LangGraph 的关系](#十一与-deep-agents--langgraph-的关系)
12. [十二、延伸阅读](#十二延伸阅读)

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

官方推荐用 `**create_agent**` 创建 Agent：传入模型、工具列表和系统提示词即可。

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

### 静态模型与动态模型

| 类型 | 含义 | 解决的问题 | 典型场景 |
|------|------|------------|----------|
| **静态模型** | 在创建 Agent 时**写死**一个模型（如 `model="gpt-4o"`），所有请求都用同一模型。 | 实现简单、成本与表现可预期，无需在运行时做模型选择。 | 单场景客服机器人、内部助手、Demo；所有用户一视同仁。 |
| **动态模型** | 在**每次请求或每次会话**里按条件选用不同模型（如按用户等级、任务难度、合规要求选模型）。 | 多租户差异化（免费/付费用不同模型）、成本与质量按需权衡、合规（如某地区必须用本地化模型）。 | SaaS 中免费用户用小模型、付费用大模型；简单问题走小模型、复杂推理走大模型；或按语言/地区路由到不同厂商。 |

**为何需要动态模型？**  
当同一套 Agent 要服务不同用户、不同策略或不同合规要求时，若在代码里写死一个模型，要么所有人共用贵模型（成本高），要么共用小模型（高价值用户体验差），要么为每种策略各建一个 Agent（重复维护）。动态模型把「用哪个模型」推迟到**运行时**根据上下文决定，用一层路由逻辑即可兼顾成本、体验与合规。

**官方推荐：用 `@wrap_model_call` 中间件在请求中替换模型**

官方文档要求：要使用动态模型，请使用 **`@wrap_model_call` 装饰器**创建中间件，在每次模型调用前修改请求中的模型，再交给 `handler` 执行。这样只需**一个 Agent 实例**，模型选择逻辑集中在中间件里，便于维护。

```python
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from langchain.chat_models import init_chat_model
from typing import Callable

# 预建两个模型实例，供中间件按条件选用
complex_model = init_chat_model("openai:gpt-4o")
simple_model = init_chat_model("openai:gpt-4o-mini")

@wrap_model_call
def dynamic_model(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    # 按对话长度选模型：消息多时用大模型，否则用小模型（也可改为从 runtime/state 取 user_tier）
    if len(request.messages) > 10:
        model = complex_model
    else:
        model = simple_model
    return handler(request.override(model=model))

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"Weather in {city}: sunny."

# 只创建一个 Agent，默认模型会被中间件按请求覆盖
agent = create_agent(
    model=simple_model,  # 默认值，实际每次由 dynamic_model 覆盖
    tools=[get_weather],
    system_prompt="You are a helpful assistant.",
    middleware=[dynamic_model],
)

# 同一 agent.invoke：前几轮可能走小模型，对话变长后中间件自动切大模型
agent.invoke({"messages": [{"role": "user", "content": "北京天气怎么样？"}]})
```

若要根据**当前用户身份**（如 user_tier）选模型，可在中间件内通过 `request` 关联的 **runtime / state** 拿到当前请求的上下文（如传入的 config 或自定义 state 字段），再决定 `model`。具体可查官方 [Custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom) 中 “Dynamic model selection” 与 state 用法。

**替代方案：按请求创建不同模型的 Agent**

若暂时不用中间件，也可以每次请求前根据 user_tier 选模型字符串，再 `create_agent(model=..., tools=...)` 并 `invoke`。同一 tier 可缓存一个 Agent 以减少重复创建。适合快速试跑或与现有「无中间件」流水线兼容。

**@wrap_model_call 的效果**

`@wrap_model_call` 是一种 **wrap 式**中间件钩子：在 Agent 的每一轮「要调用 LLM」时，**先进入你的函数，再决定是否/如何调用真正的模型**。

| 要点 | 说明 |
|------|------|
| **何时执行** | 每次即将执行一次模型调用（发 messages 给 LLM）前，都会先执行被 `@wrap_model_call` 装饰的函数。 |
| **入参** | `request: ModelRequest`（当次调用的消息、state、runtime、当前 model/tools 等）和 `handler: Callable`（真正执行这次模型调用的回调）。 |
| **你的职责** | 可以修改请求（如 `request.override(model=..., tools=...)`），然后**调用一次或多次** `handler(修改后的 request)`，或**不调用**（短路）。最终把 `handler` 的返回值（`ModelResponse`）返回给框架。 |
| **效果** | 框架拿到的就是你对「这次模型调用」的**整体结果**。若你调用了 `handler(request.override(model=new_model))`，则这一轮实际用的是 `new_model`；若你调用了 `handler(request.override(tools=subset))`，则这一轮模型只能看到 `subset` 工具。多轮对话中每一轮都会重新走中间件，因此可以按当前 state/runtime 每轮换模型或换工具。 |

**典型用法**：**修改请求再交给下游**（动态模型、动态工具）、**重试**（多次调用 `handler` 直到成功）、**短路**（不调 `handler` 直接返回自定义结果）、**记录/统计**（调完 `handler` 后对返回值做处理再返回）。多个中间件时，列表里**第一个**是最外层，调用顺序类似：`middleware1 → middleware2 → … → 真实模型`，内层 `handler` 即下一层中间件或模型。

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

### 4. 静态工具与动态工具

| 类型 | 含义 | 解决的问题 | 典型场景 |
|------|------|------------|----------|
| **静态工具** | 在创建 Agent 时**写死**工具列表（如 `tools=[get_weather, search_docs]`），所有会话看到的工具集相同。 | 实现简单、权限清晰，不会把不该暴露的能力误暴露给当前用户。 | 单职责 Agent（如只做查单+回复的客服）、内部固定流程、Demo。 |
| **动态工具** | 在**每次请求或每次会话**里按用户、权限或上下文**注入不同工具集合**（如 A 用户有日历，B 用户有邮件，或按会话主题加载不同插件）。 | 多租户/多角色下「每人只看到自己有权用的工具」、插件/扩展按需加载、避免无关工具干扰模型选择。 | 企业内按角色开放不同系统（HR 有考勤、研发有代码库）；IDE Agent 按项目加载不同扩展；插件市场里用户勾选能力后只注入已选工具。 |

**为何需要动态工具？**  
若所有用户共用一个「大而全」的静态工具列表，会带来：权限难控（模型可能调用了当前用户无权用的工具）、描述过长导致模型选错工具、以及无法做「按需扩展」。动态工具把「这次给模型哪些工具」推迟到**运行时**，根据当前用户身份、会话上下文或产品配置决定，从而兼顾安全、体验与可扩展性。

**官方按「工具是否提前已知」分为两种方式**

| 方式 | 英文 | 含义 | 典型场景 |
|------|------|------|----------|
| **过滤预先注册的工具** | Filtering pre-registered tools | 所有可能用到的工具**一开始就全部注册**到 Agent，每轮在中间件里按用户/上下文**筛出子集**给模型。 | 权限控制（按用户/租户暴露不同工具）、减少选项提升准确率、缩短 prompt。 |
| **运行时工具注册** | Runtime tool registration | 工具集合**在运行中才出现或变化**，需要在执行过程中把新工具**注册进** Agent（如来自 MCP、用户临时连接的插件、按上传资源动态生成的工具）。 | MCP/远程服务动态工具、用户会话中安装/卸载插件、按文档或资源生成检索工具等。 |

下面给出**方法一**的示例（方法二需查阅官方 [Runtime tool registration](https://docs.langchain.com/oss/python/langchain/agents#dynamic-tools)）。

**方法一：过滤预先注册的工具（Filtering pre-registered tools）**

与动态模型一致，用 **`@wrap_model_call`** 在每次模型调用前修改请求中的 `tools`：用 `request.override(tools=relevant_tools)` 传入本请求可见的工具子集。需要**事先把所有可能用到的工具都注册到 Agent**（`tools=all_tools`），中间件里根据「从哪里读筛选依据」可再细分为三种数据来源，**应用场景不同**：

| 数据来源 | 英文 | 含义 | 应用场景 |
|----------|------|------|----------|
| **State** | State | **本次会话**内的短期数据：当前消息列表、已执行工具结果、上传文件、自定义 state 字段等。作用域为当前一次 run。 | 按**对话阶段或内容**动态收窄/扩展工具：例如先只暴露查询类工具，用户明确要执行写操作再开放写工具；或根据本轮工具执行结果决定下一步暴露哪些工具（引导式流程）。 |
| **Store** | Store | **跨会话**持久化存储：用户偏好、权限配置、记忆、历史数据等。通过 `request.runtime.store` 读写。 | 按**用户/租户的持久化权限或配置**过滤：从 Store 查出该用户有权限的工具列表、多租户下按租户订阅的工具包过滤、根据用户历史偏好只暴露常用工具。 |
| **Runtime Context** | Runtime Context | **本次调用**传入的静态配置：如 `invoke(..., config={"configurable": {"user_id", "user_role", "tenant_id"}})` 或 context_schema 注入的字段。作用域为当前一次 invoke。 | 按**本次请求身份或环境**过滤：多租户在 invoke 时传 `user_id`/`tenant_id`，中间件从 `request.runtime.context` 或 `request.runtime.config` 读取后筛工具；AB 测试按 feature_flag 暴露不同工具；按部署环境（如 production 隐藏高危工具）。 |

实现时可在 `select_relevant_tools(request.state, request.runtime)` 内同时使用其中一种或多种来源（例如先读 Runtime Context 拿 user_id，再查 Store 拿该用户权限，最后结合 State 做阶段化收缩）。下面示例仅用 **Runtime Context**（configurable）做按用户过滤。

```python
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from typing import Callable

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"Weather in {city}: sunny."

def search_docs(query: str) -> str:
    """Search internal documentation. Use when the user asks about product or policy."""
    return "Retrieved: ..."

def get_calendar_events(date: str) -> str:
    """Get calendar events for the given date. Only for users with calendar access."""
    return f"Events on {date}: ..."

# 所有工具预先注册，供中间件按需筛选
all_tools = [get_weather, search_docs, get_calendar_events]

def select_relevant_tools(state, runtime):  # 示例：从 state/config 取 user_id 或权限
    # 可从 state、runtime.config 等拿到当前用户/会话信息，再决定返回哪些工具
    user_id = runtime.config.get("configurable", {}).get("user_id", "user_basic")
    base = [get_weather, search_docs]
    if user_id in ("user_premium", "user_hr"):
        base.append(get_calendar_events)
    return base

@wrap_model_call
def select_tools(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    relevant_tools = select_relevant_tools(request.state, request.runtime)
    return handler(request.override(tools=relevant_tools))

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=all_tools,  # 全部注册，实际每次由中间件覆盖为子集
    system_prompt="You are a helpful assistant. Only use the tools you are given.",
    middleware=[select_tools],
)

# 调用时通过 config 传入 user_id，中间件据此过滤工具
agent.invoke(
    {"messages": [{"role": "user", "content": "明天我有哪些日程？"}]},
    config={"configurable": {"user_id": "user_premium"}},
)
```

官方说明：动态选择工具可带来权限控制、更高准确率（从更少选项中选）和更短 prompt。上述 State / Store / Runtime Context 的划分与 [Context engineering in agents](https://docs.langchain.com/oss/python/langchain/context-engineering) 一致；中间件用法详见 [Custom middleware - Dynamically selecting tools](https://docs.langchain.com/oss/python/langchain/middleware/custom)。

**方法二：运行时工具注册（Runtime tool registration）**

当工具**在启动时无法穷举**、而是在运行中才出现或变化时，需要用运行时注册：在会话/请求过程中把新工具**挂载进** Agent 的工具空间（例如从 MCP 服务器拉取工具列表、用户连接新数据源后生成检索工具、插件市场里安装/卸载能力）。做法与 API 以官方文档为准，详见 [Runtime tool registration](https://docs.langchain.com/oss/python/langchain/agents#dynamic-tools)（如从 MCP 发现并注册工具等）。

**替代方案：按请求创建带不同 tools 的 Agent**

若暂不引入中间件，也可在每次请求前根据 user_id 调用 `resolve_tools_for_user(user_id)` 得到工具列表，再 `create_agent(..., tools=tools)` 并 `invoke`。同一用户可复用同一 Agent 或同一份 tools 列表。仅适用于「工具全集已知、只是按请求选子集」的场景；若工具在运行中才出现，需用上面的运行时工具注册。

### 5. 工具错误处理

工具在执行时可能失败：**网络超时**、**参数不合法**、**第三方 API 限流/报错**、**权限不足**等。若不处理，异常会向上抛出，轻则整轮 Agent 报错，重则把堆栈信息塞进 ToolMessage，模型难以理解。

**官方推荐**：要**自定义工具错误的处理方式**，请使用 **`@wrap_tool_call` 装饰器**创建中间件，在工具执行外层统一捕获异常、打日志，并返回一个内容为友好错误说明的 `ToolMessage`，这样模型看到的是可读文案而非堆栈。与 `@wrap_model_call` 类似，每次执行工具前都会先进入该中间件，你可在其中决定是否调用 `handler(request)`、调用几次（重试），或在异常时直接返回自定义的 `ToolMessage`。

```python
from langchain.agents.middleware import wrap_tool_call
from langchain.tools.tool_node import ToolCallRequest
from langchain.messages import ToolMessage
from typing import Callable
import logging

logger = logging.getLogger(__name__)

@wrap_tool_call
def handle_tool_errors(
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage],
) -> ToolMessage:
    try:
        return handler(request)
    except Exception as e:
        logger.exception("Tool %s failed", request.tool_call.get("name"))
        # 返回友好错误文案给模型，避免堆栈进入 ToolMessage
        return ToolMessage(
            content=f"Error: 工具执行失败（{type(e).__name__}），请稍后重试或换一种方式。",
            tool_call_id=request.tool_call.get("id", ""),
        )

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[get_weather, search_docs],
    middleware=[handle_tool_errors],
)
```

**可选：工具内 try/except**  
若希望每个工具自己决定错误文案，也可在工具**内部**用 `try/except` 返回字符串形式的错误说明（不抛异常），框架会将该字符串作为 ToolMessage 的 content。与中间件方式可二选一或同时使用（中间件作为最后一道防线）。示例（工具内处理）：

```python
import logging

logger = logging.getLogger(__name__)

def get_weather(city: str) -> str:
    """Get weather for a given city. Input should be a city name."""
    try:
        # 实际调用天气 API，可能超时、限流或返回 5xx
        # result = weather_api.fetch(city)
        if not city or not city.strip():
            return "Error: 城市名不能为空，请提供有效城市名称。"
        return f"Weather in {city}: sunny."
    except TimeoutError:
        logger.exception("Weather API timeout for city=%s", city)
        return "Error: 天气服务暂时无响应，请稍后再试。"
    except Exception as e:
        logger.exception("Weather API failed for city=%s", city)
        # 给模型看的文案要简短、可理解，不要堆栈
        return f"Error: 天气查询失败（{type(e).__name__}），请稍后重试或换一个城市。"
```

**模型侧表现**：当工具返回 `"Error: ..."` 时，模型会在下一轮看到这条 ToolMessage，从而用自然语言向用户说明「当前无法获取天气，请稍后再试」或尝试换参数再调一次，而不是直接崩溃或输出原始异常。

**可选增强**：对可重试的临时错误（如网络抖动），可在工具内做有限次重试；对耗时长的外部调用，建议设 `timeout` 并在超时时返回明确错误文案，便于模型给出合理回复。

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

- `**stream_mode="updates"**`：按步骤流式输出状态更新（例如每执行完一次 LLM 或工具节点推一次）。  
- `**stream_mode="messages"**`：流式输出消息（如 LLM 的 token 流）。  
- `**stream_mode="custom"**`：按自定义逻辑流式输出。

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

## 八、存储指南（精简版）：文档分块 → 向量化 → VectorStore → Retriever

> 这里的“存储”指 **RAG/向量检索体系**：把文档分块后转为向量，存入向量库，再通过检索器（retriever）按 query 召回相关片段。  \n> 参考官方：  \n> - VectorStore Retriever：`https://python.langchain.com/docs/how_to/vectorstore_retriever`  \n> - Text splitters 概念：`https://python.langchain.com/docs/concepts/text_splitters`  \n> - Knowledge base（语义搜索/知识库）：`https://docs.langchain.com/oss/python/langchain/knowledge-base`

### 1. 你要存的是什么？

存的是一组 `Document` 分块（chunk），每个 chunk 带：内容（`page_content`）+ 元数据（`metadata`）+ 向量（embedding）。

### 2. 最小闭环（够用版）

流程：**文档 → 分块 → Embedding → VectorStore → Retriever**。

```python
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Embeddings（示例：OpenAI；也可以换成其他 provider 的 embeddings）
from langchain_openai import OpenAIEmbeddings

# VectorStore（示例：FAISS；也可以换成 Chroma / pgvector / Milvus 等）
from langchain_community.vectorstores import FAISS

docs = [
    Document(page_content="智能家居管家支持离家/回家模式。", metadata={"source": "handbook"}),
    Document(page_content="门锁属于风险设备，解锁需要二次确认。", metadata={"source": "security"}),
]

splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=80)
chunks = splitter.split_documents(docs)

embeddings = OpenAIEmbeddings()
vectorstore = FAISS.from_documents(chunks, embedding=embeddings)

# as_retriever 会把向量库封装成“检索器”；k=4 表示每次查询返回 Top-4 个最相似的文档片段
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# 最常用的查询方式：单条查询（同步）
results = retriever.invoke("门锁有哪些风险操作？")

# 其他查询方式（了解即可）：
# - await retriever.ainvoke("...")  # 异步查询
# - retriever.batch([...])          # 批量查询，多条 query 一起召回
# - retriever.stream("...")         # 流式返回检索结果（适合前端边到边显）
```

### 2.0 存储中有哪些接口？

| 层级 | 接口 | 说明 |
|------|------|------|
| **VectorStore**（向量库） | `from_documents` / `from_texts` | 从文档或文本列表构建向量库（含分块、向量化、写入）。 |
| | `add_documents` / `add_texts` | 向已有向量库追加文档或文本（会做 embedding 后写入）。 |
| | `delete(ids)` | 按文档 id 列表删除（需写入时保留 `id`；部分实现支持 `adelete` 异步删除）。 |
| | `similarity_search` | 按字符串 query 检索，返回 `list[Document]`。 |
| | `similarity_search_with_score` | 同上，返回 `list[tuple[Document, float]]`。 |
| | `similarity_search_by_vector` | 按已算好的向量检索。 |
| | `max_marginal_relevance_search` | MMR 检索，兼顾相似度与多样性。 |
| | `asimilarity_search` 等 | 上述方法的异步版本（视具体实现而定）。 |
| | `as_retriever(search_type=..., search_kwargs=...)` | 把当前向量库封装成标准化 **Retriever**。 |
| **Retriever**（检索器） | `invoke(query)` | 同步：字符串 query → `list[Document]`。 |
| | `ainvoke(query)` | 异步查询。 |
| | `batch(queries)` | 批量查询。 |
| | `stream(query)` | 流式返回（部分实现支持）。 |

> 写入/构建用 **VectorStore**；日常 RAG/链式调用优先用 **Retriever**；要按向量查、带分数或 MMR 细粒度控制时直接用 **VectorStore** 的查询方法。

### 2.1 查询方式总览：两类入口

LangChain 里和“向量检索”相关的查询，可以按**入口**分成两大类：

| 类别 | 含义 | 典型用法 |
|------|------|----------|
| **VectorStore 原生查询** | 直接对向量库调用方法，方法名和参数因实现而异（如 FAISS、Chroma、pgvector）。 | 需要**按向量查、带分数、MMR**等细粒度控制时用。 |
| **Retriever 标准化查询** | 通过 `vectorstore.as_retriever(...)` 得到**统一接口**：入参是字符串 query，出参是 `list[Document]`，便于接入 LCEL、RAG 链、Agent 工具。 | 做 RAG、Agent Tool、链式调用时优先用。 |

下面分别说明这两类下常见的“查法”（同步/异步、字符串/向量、带不带分数、相似度/MMR）。

---

#### 一、VectorStore 原生查询

直接调用 `vectorstore` 上的方法，不同向量库实现可能略有差异，但概念一致。

- **同步 / 异步**  
  - 同步：`vectorstore.similarity_search(query, k=4)`  
  - 异步：`await vectorstore.asimilarity_search(query, k=4)`

- **字符串 query / 向量 query**  
  - 字符串：内部会对 query 做 embedding 再检索，例如 `similarity_search("...")`。  
  - 向量：自己先算 embedding，再查，例如 `similarity_search_by_vector(embedding)`。

- **带分数 / 不带分数**  
  - 不带分数：返回 `list[Document]`，如 `similarity_search(...)`。  
  - 带分数：返回 `list[tuple[Document, float]]`，如 `similarity_search_with_score(...)`，便于做阈值或调试。

- **相似度 / MMR**  
  - 相似度：只按与 query 的相似度取 Top-K。  
  - MMR（Maximum Marginal Relevance）：在相似度与多样性之间折中，减少重复片段，适合长文档知识库；例如 `max_marginal_relevance_search(query, k=4, fetch_k=20, lambda_mult=0.5)`。

```python
# 原生查询示例（均在 vectorstore 上调用）
docs = vectorstore.similarity_search("门锁有哪些风险操作？", k=4)
docs_with_score = vectorstore.similarity_search_with_score("门锁有哪些风险操作？", k=4)

query_vector = embeddings.embed_query("门锁有哪些风险操作？")
docs_by_vec = vectorstore.similarity_search_by_vector(query_vector, k=4)

docs_mmr = vectorstore.max_marginal_relevance_search(
    "门锁有哪些风险操作？", k=4, fetch_k=20, lambda_mult=0.5
)
```

---

#### 二、Retriever 标准化查询

`retriever = vectorstore.as_retriever(...)` 把某一种“查法”固化成**统一接口**：**输入字符串 query，输出 `list[Document]`**，方便接入 `invoke`、LCEL、RAG 链、Agent 的 Tool 等。

- **检索策略**在**创建 retriever 时**通过 `search_type`、`search_kwargs` 指定（例如 similarity vs MMR、k、fetch_k、lambda_mult），之后每次调用只需传 query 字符串。

- **调用方式**：  
  - 同步：`retriever.invoke(query)`  
  - 异步：`await retriever.ainvoke(query)`  
  - 批量：`retriever.batch([query1, query2, ...])`  
  - 流式：`retriever.stream(query)`（部分实现支持）

Retriever 不暴露“按向量查”或“带分数”的细粒度接口；若需要这些，请用 **VectorStore 原生查询**。

```python
# 标准化查询：先配置“怎么查”，再统一用 invoke/ainvoke
retriever_sim = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 4},
)
retriever_mmr = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 4, "fetch_k": 20, "lambda_mult": 0.5},
)

results = retriever_sim.invoke("门锁有哪些风险操作？")  # list[Document]
```

---

### 2.2 拓展了解：相似度指标与索引（仅作了解）

以下概念在调参或选型时可能遇到，不必深究即可上手 RAG。

**相似度指标**  
向量库用某种“距离/相似度”决定谁更接近 query，常见几种：

| 指标 | 含义 | 备注 |
|------|------|------|
| **余弦相似度（Cosine）** | 看向量夹角，与长度无关 | 文本 embedding 最常用；值域 [-1, 1]，越大越相似。 |
| **欧氏距离（L2 / Euclidean）** | 向量差的模长 | 越小越相似；有的实现会返回平方或归一化形式。 |
| **内积（Dot Product）** | 向量点积 | 若向量已归一化，等价于余弦；未归一化时受长度影响。 |

不同 VectorStore 默认可能不同（如 FAISS 常用 L2，Chroma 可配）。`similarity_search_with_score` 返回的分数含义以该后端文档为准。

**索引（Index）**  
“索引”指向量在库里的组织结构，用来加速检索，而不是逐条算距离：

- **Flat / 暴力**：逐个比较，精确但数据量大时慢。  
- **IVF**（倒排）：先粗聚类，只在部分桶里搜，近似检索、更快。  
- **HNSW** 等图索引：多层图结构，适合高维、大规模近似最近邻。

选型时通常用默认即可；数据量或延迟有要求时再查具体向量库的索引与距离参数。

---

### 2.3 元数据过滤

在向量检索时只从**满足条件的文档**里找相似片段，即“先按 metadata 筛一遍，再做相似度排序”。写入时务必把要筛的字段放进 `Document.metadata`（如 `source`、`type`、`date`），否则过滤无效。

**常见场景**

| 场景 | 说明 | 示例 |
|------|------|------|
| 按来源/知识库 | 只从某本手册、某类文档里搜 | 用户选“仅查安全手册”时只查 `source="security"`。 |
| 按类型或版本 | 区分草稿/正式、多语言、版本 | 只查 `lang="zh"` 或 `version="v2"`。 |
| 按时间范围 | 只查某段时间更新的内容 | 过滤 `updated_at` 在某个区间（需后端支持范围查询）。 |

**注意**：并非所有 VectorStore 都支持服务端过滤（如 FAISS 内存版通常不支持）。支持 filter 的常见有 Chroma、pgvector、Pinecone、Weaviate 等，用法以各后端文档为准；若不支持，可在召回后在应用层按 `doc.metadata` 再筛一遍。

#### 场景一：只从指定来源里检索（VectorStore 层）

适合“只查某本书/某类文档”的需求：在 `similarity_search` 时传入 `filter`，只在这些文档的向量里做相似度检索。

```python
from langchain_community.vectorstores import Chroma

# 假设写入时每个 Document 的 metadata 里都有 "source"
vectorstore = Chroma(collection_name="kb", embedding_function=embeddings, persist_directory="./chroma_db")

# 只从 source="security" 的文档中取 Top-4
docs = vectorstore.similarity_search(
    "门锁有哪些风险操作？",
    k=4,
    filter={"source": "security"},
)
```

#### 场景二：Retriever 固定过滤条件

若每次调用都要带同一批过滤条件，可在创建 Retriever 时把 `filter` 放进 `search_kwargs`，之后 `invoke` 只需传 query。

```python
# 检索器固定为“只查安全相关文档”，适合挂在 RAG 链或 Agent 工具里
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 4, "filter": {"source": "security"}},
)
results = retriever.invoke("门锁有哪些风险操作？")
```

#### 场景三：多条件组合（与/或）

部分后端支持复杂条件（如 Chroma 的 `$and` / `$or`），可在同一请求里组合多个 metadata 条件。

```python
# 仅作示例：Chroma 风格的多条件（具体语法以当前版本文档为准）
filter_cond = {
    "$and": [
        {"source": "security"},
        {"lang": "zh"},
    ]
}
docs = vectorstore.similarity_search("门锁风险操作", k=4, filter=filter_cond)
```

若后端不支持服务端过滤，可在召回后在 Python 里按 metadata 再筛：

```python
docs = vectorstore.similarity_search("门锁有哪些风险操作？", k=20)
# 在应用层只保留来源为 security 的文档
docs = [d for d in docs if d.metadata.get("source") == "security"][:4]
```

---

### 3. 连接到 RAG（检索增强生成）

当你能拿到 `results: list[Document]`，就可以把这些片段作为上下文交给 LLM，这就是 [RAG](../agent-rag) 的核心。

### 4. 常见坑（精简版）

- **召回不准**：优先调分块策略（chunk_size/overlap），再考虑 Top-K、过滤、重排。  
- **无法追溯来源**：metadata 没存好（至少要有 source/URL/文件名）。  
- **回答编造**：Prompt 没要求“只根据检索内容回答”，或检索结果未拼进上下文。

---

## 九、运行状态持久化与人机循环（可选）：LangGraph Persistence

> 如果你关心的是“Agent 运行过程的断点续跑/人工确认/时间旅行调试”，那是保存**运行状态**而不是保存文档向量。  \n> 参考：`https://docs.langchain.com/oss/python/langgraph/persistence`

LangChain 的 Agent 基于 **LangGraph** 实现，因此支持：

- **持久化（Persistence）**：将对话状态存入存储（如内存、Redis、数据库），便于多轮会话或断点续跑。  
- **人机循环（Human-in-the-loop）**：在图中插入「等待人工确认」节点，再根据用户输入决定下一步。

这类能力通常在「图」层面配置（如 LangGraph 的 `checkpointer`、`interrupt_before` 等）。若你只用 `create_agent` 的默认配置，可先不关心；需要时再查阅官方 [LangGraph](https://python.langchain.com/oss/python/langgraph/overview) 与 [Persistence / Human-in-the-loop](https://python.langchain.com/oss/python/langgraph) 相关章节。

---

## 十、用 LangSmith 调试

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

## 十一、与 Deep Agents / LangGraph 的关系


| 层级                  | 说明                                                                    |
| ------------------- | --------------------------------------------------------------------- |
| **Deep Agents**     | 在 LangChain Agent 之上，提供「开箱即用」的长对话压缩、虚拟文件系统、子 Agent 等；适合快速做复杂多步 Agent。 |
| **LangChain Agent** | 用 `create_agent` 等构建「模型 + 工具」的 Agent，底层由 LangGraph 执行；适合快速上手又需一定定制。   |
| **LangGraph**       | 底层图编排与运行时，支持确定性流程 + 智能体混合、持久化、人机循环等；适合强定制与复杂流程。                       |


若你「只想先把一个会调工具的 Agent 跑起来」，按本指南用 **LangChain + create_agent** 即可；需要更复杂编排时再考虑直接使用 LangGraph 或 Deep Agents。

---

## 十二、延伸阅读

- **本系列**：[Agent 总览](../agent)、[五大核心模块](../agent-core-modules)、[ReAct 架构](../agent-react-arch)、[LangChain 与同类框架详解](../agent-langchain-and-frameworks)。  
- **官方**：[LangChain 介绍](https://python.langchain.com/docs/introduction/)、[安装](https://python.langchain.com/oss/python/langchain/install)、[Quickstart](https://python.langchain.com/oss/python/langchain/quickstart)、[Agents](https://python.langchain.com/oss/python/langchain/agents)、[Streaming](https://docs.langchain.com/oss/python/langchain/streaming)。

