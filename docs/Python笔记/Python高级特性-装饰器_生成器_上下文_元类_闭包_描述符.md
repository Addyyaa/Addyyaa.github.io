---
sidebar_position: 6
slug: /python/advanced-features
---

# 深入理解 Python 高级特性

本文系统深入讲解以下核心主题：装饰器、生成器与迭代协议、上下文管理器、元类、闭包与匿名函数、描述符。配合实用示例、常见坑与最佳实践，帮助你在工程中写出可维护、可扩展的高质量代码。

## 装饰器（Decorator）

### 概念（装饰器）

装饰器是一个可调用对象（函数或类），接收另一个函数/类并返回其“增强版”。常用于处理横切关注点（日志、缓存、鉴权、重试），帮助实现关注点分离与代码复用。

### 应用场景（装饰器）

- 日志与埋点：统一记录调用参数与耗时
- 缓存与去重：为纯函数结果加缓存（如 LRU）
- 鉴权与限流：进入函数前校验权限或频控
- 重试与超时：提高网络与 I/O 的健壮性
- 参数校验：在业务前置层做输入检查

### 入门示例（装饰器）

```python
def deco(func):
    def wrapper(*args, **kwargs):
        print("before")
        result = func(*args, **kwargs)
        print("after")
        return result
    return wrapper

@deco
def greet(name):
    return f"Hi, {name}"

print(greet("Ada"))
# before
# after
# Hi, Ada
```

### 基础函数装饰器

```python
from functools import wraps
from typing import Callable, Any

def log_call(func: Callable[..., Any]) -> Callable[..., Any]:
    """记录函数调用的简单装饰器。"""
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        print(f"[log_call] calling {func.__name__} args={args}, kwargs={kwargs}")
        result = func(*args, **kwargs)
        print(f"[log_call] {func.__name__} -> {result}")
        return result
    return wrapper

@log_call
def add(a: int, b: int) -> int:
    return a + b

add(2, 3)
# [log_call] calling add args=(2, 3), kwargs={}
# [log_call] add -> 5
```

说明：使用 `@wraps` 保留被装饰函数的元数据（名称、文档字符串、注解）。

### 带参数的装饰器

```python
from functools import wraps
from typing import Callable, Any


def retry(times: int = 3) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """带参数的重试装饰器。"""

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_error: Exception | None = None
            for _ in range(times):
                try:
                    print(f"第{_ + 1}次重试")
                    return func(*args, **kwargs)
                except Exception as exc:  # 生产中应捕获更具体的异常
                    last_error = exc
            raise last_error  # type: ignore[misc]

        return wrapper

    return decorator


@retry(times=2)
def fragile() -> str:
    raise RuntimeError("temporary failure")


fragile()
# 第1次重试
# 第2次重试
# Traceback (most recent call last):
#   File "f:\Project\tmp\demo.py", line 30, in <module>
#     fragile()
#   File "f:\Project\tmp\demo.py", line 18, in wrapper
#     raise last_error  # type: ignore[misc]
#     ^^^^^^^^^^^^^^^^
#   File "f:\Project\tmp\demo.py", line 15, in wrapper
#     return func(*args, **kwargs)
#            ^^^^^^^^^^^^^^^^^^^^^
#   File "f:\Project\tmp\demo.py", line 27, in fragile
#     raise RuntimeError("temporary failure")
# RuntimeError: temporary failure
```

### 类装饰器

```python
class register:
    """将函数注册到给定字典中。"""

    def __init__(self, registry: dict[str, callable], name: str):
        self.registry = registry
        self.name = name

    def __call__(self, func):
        self.registry[self.name] = func
        return func


REGISTRY: dict[str, callable] = {}


@register(REGISTRY, name="hello")
def hello() -> str:
    return "world"


print(hello())
print(REGISTRY)
# world
# {'hello': <function hello at 0x00000164A414A2A0>}
```

执行流程解释：

> 当你写：
>
> @register(REGISTRY, name="hello") def hello() -> str:    return "world"
>
> Python 实际上会执行以下两步：
>
> 1. **先创建装饰器对象**：
>
>    `decorator = register(REGISTRY, name="hello")`
>
>    这一步调用了 `__init__`，创建了一个 `register` 类的实例。
>
> 2. **再调用这个对象**，把 `hello` 函数作为参数传进去：
>
>    `hello = decorator(hello)`，就相当于register(REGISTRY, name="hello")()，这就会调用call()
>
> 3. 这一步就是自动调用了 `__call__` 方法！

### 常见坑与最佳实践（装饰器）

- 保留元数据：使用 `functools.wraps`。
- 谨慎捕获异常：尽量捕获具体异常类型。
- 装饰器可组合：堆叠顺序自下而上执行；注意顺序带来的副作用。
- 参数与返回值类型：为装饰器函数签名添加类型注解，利于静态检查。

### 练习与思考（装饰器）

- 编写计时装饰器，与日志装饰器叠加使用，观察执行顺序。
- 实现参数校验装饰器，限定某参数必须为正整数。
- 使用 `functools.lru_cache` 或自定义缓存装饰器优化递归斐波那契。

## 生成器与迭代（Generator & Iteration）

### 概念（生成器与迭代）

生成器通过 `yield` 惰性地产生序列元素，按需计算、节省内存；迭代协议由 `__iter__`（返回迭代器）与 `__next__`（返回下一个元素或抛出 `StopIteration`）组成。

- 生成器是一种特殊的函数，它用`yield`关键字来“逐个”返回值。
- 它不会一次性把所有结果都算出来，而是**每次调用时才算一个**，这就叫“惰性”。
- 因为只算当前需要的值，所以**非常节省内存**，适合处理超大数据集。

### 应用场景（生成器与迭代）

- 处理大文件/数据流：逐行/逐块读取，避免一次性载入
- 数据管道：过滤/映射/聚合的惰性链式处理
- 无限序列：计数器、时间流等

### 入门示例：基础生成器

```python
def count_up_to(limit: int):
    current = 1
    while current <= limit:
        yield current
        current += 1


print(count_up_to(3))

for n in count_up_to(3):
    print(n)
# <generator object count_up_to at 0x000002C6D0B14AC0>
# 1
# 2
# 3
```

```python
def gen_nums():
    for i in range(3):
        yield i

g = gen_nums()
print(next(g))  # 输出 0
print(next(g))  # 输出 1
```

<span style="color: red">也就是说yield返回的是一个迭代器对象。</span>

### 生成器表达式与惰性管道

```python
squares = (x * x for x in range(10))  # 生成器表达式，惰性计算平方
evens = (x for x in squares if x % 2 == 0)  # 再次过滤，只保留偶数
print(sum(evens))  # 触发整个管道，逐个取值并求和
```

<span style="color: red">用()括起来，里面再使用for，生成的是一个生成器对象，这在 Python 中叫做 **生成器表达式**</span>

>我们用 `sum(evens)` 来触发整个流程，来看看每一步是怎么“懒惰”的：
>
>第一次迭代：
>
>1. `sum()` 向 `evens` 请求一个值 → `evens` 向 `squares` 请求一个值
>2. `squares` 计算 `0 * 0 = 0`，返回给 `evens`
>3. `evens` 判断 `0 % 2 == 0` ✅ → 返回 `0` 给 `sum`
>4. `sum` 加入总和
>
>第二次迭代：
>
>1. `sum()` 再次请求 → `evens` 再次请求 → `squares` 计算 `1 * 1 = 1`
>2. `evens` 判断 `1 % 2 == 0` ❌ → 丢弃，继续请求下一个
>3. `squares` 计算 `2 * 2 = 4` → `evens` 判断 ✅ → 返回 `4` 给 `sum`
>
>...如此类推，直到 `squares` 耗尽。
>
><span style="color: red">也就是说，这种写法不是一次性计算所有的平方和一次性过滤所有的偶数。而一次性计算的代码如下：</span>
>
>```python
>squares = [x * x for x in range(10)]
>evens = [x for x in squares if x % 2 == 0]
>print(sum(evens))
>```

### `yield from` 委托

是用来 **委托子生成器** 的语法，它可以让一个生成器自动迭代另一个生成器或可迭代对象，**简化代码结构**，**实现嵌套生成器的协作**。

```python
def flatten(list_of_lists):
    for sub in list_of_lists:
        yield from sub

print(list(flatten([[1, 2], [3], [], [4, 5]])))
# [1, 2, 3, 4, 5]
```

为什么需要？

假设你有一个生成器 `gen_a()`，它内部需要调用另一个生成器 `gen_b()`，传统写法是：

```python
def gen_a():
    for value in gen_b():
        yield value
```

这很啰嗦。用 `yield from` 可以简化为：

```python
def gen_a():
    yield from gen_b()
```

### 迭代协议：自定义迭代器

```python
from typing import Iterator

class Countdown:
    def __init__(self, start: int):
        self.current = start

    def __iter__(self) -> Iterator[int]:
        return self

    def __next__(self) -> int:
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value

print(list(Countdown(3)))
```

### 生成器的高级用法：`send`、`throw`、`close`

```python
def accumulator():
    total = 0
    while True:
        value = yield total
        if value is None:
            break
        total += value

gen = accumulator()
print(next(gen))       # 启动生成器，得到初始 total
print(gen.send(10))    # 发送 10，得到新 total
print(gen.send(5))
gen.close()
# 0
# 10
# 15
```

### 常见坑与最佳实践（生成器）

- 生成器一旦耗尽不可复用；需要复用时封装为可重复创建的新生成器函数。
- 需要随机访问时使用列表或 `deque`，不要滥用生成器。
- 使用 `itertools` 提升可读性与性能（如 `islice`、`chain`、`groupby`）。

### 练习与思考（生成器）

- 编写生成器，读取大文件并仅返回包含关键词的行。
- 用生成器表达式与 `sum` 计算 1..N 的平方和，比较内存占用。
- 使用 `yield from` 将多层嵌套列表拍平。

## 上下文管理器（Context Manager）

### 概念（上下文管理器）

上下文管理器在进入/退出代码块时自动获取/释放资源，减少样板代码并避免资源泄漏。

### 应用场景（上下文管理器）

- 文件、网络连接与数据库事务的安全管理
- 线程/进程锁的成对获取与释放
- 临时修改全局状态（工作目录、环境变量）并在退出时恢复

### 入门示例：`__enter__` / `__exit__`

```python
class managed_file:
    def __init__(self, path: str, mode: str = "r", encoding: str = "utf-8"):
        self.path = path
        self.mode = mode
        self.encoding = encoding
        self._f = None

    def __enter__(self):
        self._f = open(self.path, self.mode, encoding=self.encoding)
        return self._f

    def __exit__(self, exc_type, exc, tb):
        if self._f:
            self._f.close()
        # 返回 False 让异常继续向外传播
        return False

with managed_file("/tmp/demo.txt", "w") as f:
    f.write("hello")
```

### `contextlib` 工具集

```python
from contextlib import contextmanager, suppress, ExitStack

@contextmanager
def open_file(path: str, mode: str = "r", encoding: str = "utf-8"):
    f = open(path, mode, encoding=encoding)
    try:
        yield f
    finally:
        f.close()

with suppress(FileNotFoundError):
    with open_file("missing.txt") as f:
        print(f.read())

with ExitStack() as stack:
    files = [stack.enter_context(open_file(p)) for p in ["a.txt", "b.txt"]]
```

### 常见坑与最佳实践（上下文管理器）

- 确保 `__exit__` 或 `finally` 中对资源的无条件释放。
- 异常处理策略要明确：吞掉还是向外传播（返回值决定）。
- 多资源管理优先考虑 `ExitStack`。

### 练习与思考（上下文管理器）

- 自定义一个计时上下文管理器，打印 with 代码块耗时。
- 使用 `contextmanager` 临时切换当前工作目录并在退出时恢复。
- 结合 `ExitStack` 同时管理多个文件资源。

## 元类（Metaclass）

### 概念（元类）

元类是“创建类的类”，用于定制类的创建过程（如注入属性、注册、接口校验）。Python 中默认元类为 `type`。

`对象（实例） ←—— 由 —— 类（class） ←—— 由 —— 元类（metaclass）`

**你可以通过继承 `type` 来创建自己的元类**

### 应用场景（元类）

- 接口约束：创建时强制存在特定方法/属性
- 自动注册：框架中自动收集派生类
- 自动注入：批量添加方法、绑定配置

### 自定义元类：强制类属性存在

```python
class RequireAttrs(type):
    required_attrs = {"execute"}

    def __new__(mcls, name, bases, namespace):
        cls = super().__new__(mcls, name, bases, namespace)
        if name != "Base" and not RequireAttrs.required_attrs.issubset(namespace):
            missing = RequireAttrs.required_attrs - set(namespace)
            raise TypeError(f"Class {name} missing required attrs: {missing}")
        return cls

class Base(metaclass=RequireAttrs):
    pass

class Job(Base):
    def execute(self) -> None:
        print("run")
```

### 单例作为元类实现

```python
class Singleton(type):
    _instances: dict[type, object] = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Config(metaclass=Singleton):
    def __init__(self):
        self.values: dict[str, str] = {}
```

### 修改类的属性或方法

```python
class AutoPatchMeta(type):
    def __new__(cls, name, bases, attrs):
        # 添加统一属性
        attrs['version'] = '1.0'

        # 包装所有方法，加日志
        for key, val in attrs.items():
            if callable(val):
                def wrapper(func):
                    def inner(*args, **kwargs):
                        print(f"[LOG] 调用方法：{func.__name__}")
                        return func(*args, **kwargs)
                    return inner    # 调用者将参数传递给inner
                attrs[key] = wrapper(val)

        return super().__new__(cls, name, bases, attrs)

class MyService(metaclass=AutoPatchMeta):
    def run(self):
        print("服务运行中")

print(MyService.version)  # 输出：1.0
MyService().run()
```

### 自动注册

```python
CLASS_REGISTRY = {}

class AutoRegisterMeta(type):
    def __new__(cls, name, bases, attrs):
        new_cls = super().__new__(cls, name, bases, attrs)
        CLASS_REGISTRY[name] = new_cls
        return new_cls

class PluginBase(metaclass=AutoRegisterMeta):
    pass

class MarkdownParser(PluginBase):
    pass

class VideoProcessor(PluginBase):
    pass

print(CLASS_REGISTRY)
```



### 常见坑与最佳实践（元类）

- 优先使用类装饰器；只有在需要控制“类创建阶段”时才使用元类。
- 避免过度魔法；保持 API 显式，降低团队心智负担。

## 闭包与匿名函数（Closure & Lambda）

### 概念（闭包与匿名函数）

闭包是一个函数，它“记住”了它定义时所在的作用域中的变量，即使这个作用域已经结束。换句话说，**闭包 = 函数 + 外部变量的绑定环境**。

`nonlocal`用来在**嵌套函数**中声明变量属于外层函数作用域，而不是当前函数或全局作用域。它的作用是：**允许内部函数修改外部函数的局部变量**。 

**创建闭包的三个条件**

1. **嵌套函数**：函数内部定义另一个函数
2. **引用外部变量**：内层函数使用了外层函数的变量
3. **返回内层函数**：外层函数返回内层函数对象

### 应用场景（闭包与匿名函数）

- 计数器、限流器等携带私有状态的函数
- 作为回调、排序 key、分组 key 的简短表达式
- 高阶函数：按需“预配”部分参数

```python
def make_counter(start=0):
    count = start

    def counter():
        nonlocal count
        count += 1
        return count

    return counter

c1 = make_counter(10)
print(c1())  # 11
print(c1())  # 12

c2 = make_counter(100)
print(c2())  # 101
```

- `counter()`是闭包，它“记住”了`count`的值
- 即使 `make_counter()` 已经执行完毕，`count` 仍然存在于 `counter()` 的环境中
- 每个闭包实例都有自己的私有状态

### 闭包与 `nonlocal`

```python
from typing import Callable

def make_counter(start: int = 0) -> Callable[[], int]:
    current = start
    def inc() -> int:
        nonlocal current
        current += 1
        return current
    return inc

c = make_counter(10)
print(c())  # 11
print(c())  # 12
```

### 闭包的延迟绑定陷阱与修复

闭包中的变量不是在定义时绑定的，而是在**调用时**才查找其值。这意味着：如果你在循环中创建多个闭包函数，它们**共享同一个外部变量引用**，而不是各自“冻结”当时的值。

```python
funcs = []
for i in range(3):
    funcs.append(lambda x: x * i)

print([f(2) for f in funcs])  # ❌ 输出：[4, 4, 4]，而不是 [0, 2, 4]
```

🔍 为什么错了？

- 所有 `lambda` 都引用了同一个 `i`
- 循环结束时 `i = 2`
- 所以每个函数都变成了 `lambda x: x * 2`

**修复：**

方法一：默认参数绑定（推荐）

```python
funcs = []
for i in range(3):
    funcs.append(lambda x, i=i: x * i)

print([f(2) for f in funcs])  # ✅ 输出：[0, 2, 4]
```

解释：

- `i=i` 把当前的 `i` 值作为默认参数绑定到函数中
- 每个闭包都拥有自己的 `i` 值副本

方法二：使用函数工厂

```python
def make_func(i):
    return lambda x: x * i

funcs = [make_func(i) for i in range(3)]
print([f(2) for f in funcs])  # ✅ 输出：[0, 2, 4]
```

解释：

- 每次调用 `make_func(i)` 都创建一个新的作用域
- `i` 被固定在该作用域中，不受后续影响

### 匿名函数与 `functools.partial`

partial的作用是固定函数的某个参数

```python
from functools import partial

def power(base: int, exp: int) -> int:
    return base ** exp

square = partial(power, exp=2) # 第一个参数表示需要固定的函数，第二个参数要用关键词参数，表述需要固定的那个参数，固定值为xx
print(square(5))  # 25
```

### 常见坑与最佳实践（闭包与匿名函数）

### 练习与思考（闭包与匿名函数）

- 使用闭包实现递增计数器，并支持重置。
- 使用 `lambda` 与 `sorted`，按字符串长度排序；再用命名函数重写对比。
- 使用 `functools.partial` 预配置 HTTP 客户端的公共参数（如超时）。

- 避免在复杂逻辑中滥用 `lambda`；命名函数更可读、可测试。
- 使用 `nonlocal` 管理可变闭包状态，慎用全局变量。

## 描述符（Descriptor）

### 概念（描述符）

描述符是实现 `__get__`/`__set__`/`__delete__` 的对象，用于拦截并控制属性访问；`property` 是其语法糖形式。

`__get__`在读取属性的时候会自动执行，`__set__`会在给属性赋值的时候自动执行， `__del__`只有在使用`del`关键词删除属性时才会自动执行。

### 应用场景（描述符）

- 属性校验与转换：类型/范围检查、单位换算
- 懒加载与缓存：首次计算后写回同名属性，后续直接读取
- 代理存取：将访问重定向到其他对象或存储层（如 ORM 字段）

### 入门示例：基础描述符

```python
class Typed:
    def __init__(self, name: str, expected_type: type):
        self.name = name
        self.expected_type = expected_type

    def __set_name__(self, owner, name):
        # 支持自动注入属性名，简化初始化
        if not hasattr(self, "name") or self.name is None:
            self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__.get(self.name)

    def __set__(self, instance, value):
        if not isinstance(value, self.expected_type):
            raise TypeError(f"{self.name} must be {self.expected_type.__name__}")
        instance.__dict__[self.name] = value

class User:
    name = Typed("name", str)
    age = Typed("age", int)

u = User()
u.name = "Alice"
u.age = 20
```

### 非数据描述符与缓存属性

```python
class LazyProperty:
    def __init__(self, func):
        self.func = func
        self.__doc__ = getattr(func, "__doc__")

    def __get__(self, instance, owner):
        if instance is None:
            return self
        value = self.func(instance)
        setattr(instance, self.func.__name__, value)  # 覆盖为普通属性，实现缓存
        return value

class Report:
    @LazyProperty
    def heavy_result(self) -> list[int]:
        # 假装是昂贵计算
        return [x * x for x in range(10_000)]

r = Report()
print(len(r.heavy_result))
print(len(r.heavy_result))  # 第二次访问命中缓存
```

### `property` 的等价描述符写法

```python
class Rectangle:
    def __init__(self, width: float, height: float):
        self._width = width
        self._height = height

    @property
    def area(self) -> float:
        """只读属性。"""
        return self._width * self._height
```

### 常见坑与最佳实践（描述符）

- 数据描述符优先级高于实例字典；非数据描述符相反，注意覆盖行为。
- 使用 `__set_name__` 自动注入属性名，减少重复代码。
- 对性能敏感的只读属性可使用“懒加载 + 缓存”策略。

### 练习与思考（描述符）

- 实现 `Positive` 描述符，强制数值属性为正。
- 为配置类实现自动将字符串转换为 `int/float/bool` 的描述符。
- 将 `@property` 改写为等价描述符类，理解两者关系。

## 综述与选型建议

- 横切逻辑：优先装饰器；复杂时考虑类装饰器或中间件。
- 大数据流与管道：优先生成器与 `itertools`，避免一次性载入。
- 资源管理：统一封装上下文管理器，并结合 `ExitStack` 管理多资源。
- 类创建期约束：必要时使用元类，避免过度设计。
- 闭包管理状态：配合 `nonlocal`，或改用类封装显式状态。
- 属性控制与缓存：使用描述符或 `property`，保持简单可测。

以上模式配合单一职责、KISS、DRY 原则，可以显著提升代码的可维护性与可测试性。
