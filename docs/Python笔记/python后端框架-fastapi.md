# FASTAPI

## 背景介绍

fastAPI 是一个现代、快速（高性能）的 Python Web 框架，用于构建 API。它基于 Python 的类型提示（Type Hints）和异步编程，结合 Starlette 和 Pydantic，提供高效、易用的开发体验。

**核心特性**：

- **高性能**：基于 Starlette 的异步 I/O 支持，性能接近 Node.js 和 Go，远超传统同步框架如 Flask。
- **类型提示**：利用 Python 3.6+ 的类型注解（Type Hints），结合 Pydantic 进行数据验证和序列化，减少代码错误。
- **自动生成文档**：内置支持 OpenAPI（Swagger UI）和 ReDoc，自动生成交互式 API 文档，方便开发和调试。
- **异步支持**：支持 Python 的 async/await 语法，适合处理高并发场景，如 WebSocket 或长连接。
- **依赖注入**：提供强大的依赖注入系统，简化代码复用和测试。
- **易于上手**：API 设计直观，学习曲线平缓，适合从初学者到高级开发者。

FastAPI 构建在以下核心库之上：

- **Starlette**：一个轻量级的 ASGI（Asynchronous Server Gateway Interface）框架，负责处理 HTTP 请求和 WebSocket。
- **Pydantic**：用于数据验证和序列化，确保输入输出数据的类型安全和格式正确。
- **Uvicorn**：一个 ASGI 服务器实现，用于运行 FastAPI 应用，支持高并发。

<span style="color: orange; font-family: 'kaiti'">如果ide使用的是`pycharm`，建议使用 [Pydantic PyCharm 插件](https://github.com/koxudaxi/pydantic-pycharm-plugin/)</span>

## 安装

`pip install fastapi`

`pip install "uvicorn[standard]"`     --运行fastapi的ASGI服务器

## 运行服务

`uvicorn main:app --reload`   --mian -> main.py     --app fastapi的实例名    --reload  开发模式下自动重载代码

## 类型提示

类型提示是`Python3.6`版本加入的，作用类似ts，好处就是可以在编译阶段就可以报错，提前把存在的风险暴露出来，同时ide也会有相应的错误提示，其次可以使ide智能代码补全。

```python
def demo(name: str, sex: boole) -> void:
    pass
```



## Pydantic 模型

`Pydantic`是一个用来执行数据校验的 Python 库

你可以将数据的"结构"声明为具有属性的类。

每个属性都拥有类型。 每个属性都拥有类型。

接着你用一些值来创建这个类的实例，这些值会被校验，**并被转换为适当的类型**（在需要的情况下），返回一个包含所有数据的对象。

然后，你将获得这个对象的所有编辑器支持。

```python
from datetime import datetime

from pydantic import BaseModel


class User(BaseModel):
    id: int
    name: str = "John Doe"
    signup_ts: datetime | None = None
    friends: list[int] = []


external_data = {
    "id": "123",
    "signup_ts": "2017-06-01 12:22",
    "friends": [1, "2", b"3"],
    "test": "test"  # 额外字段，默认会被忽视，如果要报错，可以在User里设置 model_config = {"extra": "forbid"}
}
user = User(**external_data)
print(user)
# > User id=123 name='John Doe' signup_ts=datetime.datetime(2017, 6, 1, 12, 22) friends=[1, 2, 3]
print(user.id)
# > 123
```

- 如果类型不匹配，Pydantic 会尝试智能转换
- 如果无法转换，就会抛出 ，阻止错误数据进入你的程序
- 额外字段会被忽视

**也就是使用这个库，可以实现无需手动转换数据类型，如字符串的日期“2025-01-01 12:00”  如果不用这个库，需要手动`datatime.strptime("2025-01-01 12:00", "%Y-%m-%d %H:%M")`**

## async/await

基础知识，此处不再赘述

## 简单的开始

fastapi通过`@app.get("/")`注解来标注接口的请求方法，外部只需要请求对应的路劲就能直接调用对应的方法。

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}
```

在开发 API 时，通常使用特定的 HTTP 方法去执行特定的行为。

通常使用：

- POST: 创建数据
- GET：读取数据
- PUT：更新数据
- DELETE：删除数据

**返回内容**

返回内容可以是`dict`、`list`、`str`、`int`...

还可以返回 Pydantic 模型

## 路径参数

FastAPI 支持使用`Python`字符串格式化语法声明路径参数：

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/items/{item_id}")
async def read_item(item_id):
    return {"item_id": item_id}
```

### 声明路径参数的类型

使用类型注解声明路径操作函数中路径参数的类型

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}
```



### 数据转换

`/items/3`这里的3接收并返回的值是 int

### 数据校验

当外部请求的参数类型与声明的参数类型不一致时，返回的响应会报错。

`/items/foo`

```python
{
    "detail": [
        {
            "loc": [
                "path",
                "item_id"
            ],
            "msg": "value is not a valid integer",
            "type": "type_error.integer"
        }
    ]
}
```

### 自动生成的API文档

通过`/docs`路径可以访问自动生成的 API 文档

`/redoc` 备选 API 文档

### 路径函数顺序

由于路径操作是按顺序依次运行的，在某些场景下需要注意路径操作的顺序。

如：要使用 /users/me 获取当前用户的数据，然后使用 /users/{user_id} 来查看指定用户的数据。

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/users/me")
async def read_user_me():
    return {"user_id": "the current user"}


@app.get("/users/{user_id}")
async def read_user(user_id: str):
    return {"user_id": user_id}
```

**为什么 `/users/me` 要放在前面？**

- 如果把 `/users/{user_id}` 放在前面，请求 `/users/me` 会被它匹配到，并把 `"me"` 当成 `user_id` 传进去
- 结果 `/users/me` 这个专门的接口永远不会被调用



<span style="color: red">所以要养成固定路径放在动态路径前面的习惯</span>

<span style="color: red">重复路径，会使用后面的路径，前面的不会使用。</span>

### 预设值

路径操作使用`Enum`类型接收预设的路径参数，即使用枚举来限制路径参数的取值范围

```python
from enum import Enum
from fastapi import FastAPI

app = FastAPI()

class ModelName(str, Enum):
    alexnet = "alexnet"
    resnet = "resnet"
    lenet = "lenet"

@app.get("/models/{model_name}")
def get_model(model_name: ModelName):
    return {"model_name": model_name}
```

这样 `/models/alexnet` 是合法的，而 `/models/unknown` 会返回 422 错误，因为它不在枚举**值**中。<span style="color: red; font-family: 'kaiti'; font-size: 15.5px;">注意 访问时的`url`参数是值而不是成员名</span>

API 文档会显示预定义*路径参数*的可用值

### 包含路径的路径参数

正常情况下，FastAPI 的路径参数只匹配单个片段（比如  中的 ）。但如果希望路径参数能包含斜杠 ，就需要用到 Starlette 的路径转换器。

如 路径参数为：`/files/{file_path}`

其中{file_path}为：home/johndoe/myfile.txt

默认的  只匹配一个路径片段（不含 ）

如果你传入 ，FastAPI 会认为`home`是 `file_path`后面的`johndoe/myfile.txt`不属于这个路径

**解决方案：**

```python
@app.get("/files/{file_path:path}")
async def read_file(file_path: str):
    return {"file_path": file_path}
```

:path 是路径转换器，告诉 fastapi 这个参数可以包含 /

<span style="color: red">注意：<br>包含`/home/johndoe/myfile.txt`的路径参数要以(/)开头<br>本例中的URL 是`/files//home/johndoe/myfile.txt`</span>

## 查询参数

如果函数的参数不在路径参数内，它们会被自动解释为“查询”参数。

```python
from fastapi import FastAPI

app = FastAPI()

fake_items_db = [{"item_name": "Foo"}, {"item_name": "Bar"}, {"item_name": "Baz"}]


@app.get("/items/")
async def read_item(skip: int = 0, limit: int = 10):
    return fake_items_db[skip : skip + limit]
```

上面代码中路径函数中的参数并非存在于@注解中声明的路径参数，所以会被识别为查询参数。

查询参数时url问号后面的关键词，由`&`字符分隔。

### 默认值

由于查询参数并非路径的固定组成部分，因此它们可以是可选的，并且可以有默认值。，上面的代码中的默认参数便是默认值。

### 可选参数

可以通过将可选查询参数的默认值设置为`None`来声明它们：

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/items/{item_id}")
async def read_item(item_id: str, q: str | None = None):
    if q:
        return {"item_id": item_id, "q": q}
    return {"item_id": item_id}
```

### 多个路径和查询参数

无需按特定顺序声明它们

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/users/{user_id}/items/{item_id}")
async def read_user_item(
    user_id: int, item_id: str, q: str | None = None, short: bool = False
):
    item = {"item_id": item_id, "owner_id": user_id}
    if q:
        item.update({"q": q})
    if not short:
        item.update(
            {"description": "This is an amazing item that has a long description"}
        )
    return item
```

### 必须的查询参数

不声明任何默认值即代表参数必须要输入

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/items/{item_id}")
async def read_user_item(item_id: str, needy: str):
    item = {"item_id": item_id, "needy": needy}
    return item
```

## 请求体

函数的参数若不在路径中，则就是body的参数

```python
from fastapi import FastAPI
from pydantic import BaseModel


class Item(BaseModel):
    name: str
    description: str | None = None   # 代表可选参数
    price: float
    tax: float | None = None  # 代表可选参数


app = FastAPI()


@app.post("/items/")
async def create_item(item: Item):
    return item
```

`BaseModel`对象提供dict方法，只需要.dict()调用

### 请求体+路径参数

FastAPI能够识别与路径匹配的函数参数以及请求体中的`Pydantic`类的函数参数

```python
from fastapi import FastAPI
from pydantic import BaseModel


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None


app = FastAPI()


@app.put("/items/{item_id}") 
async def update_item(item_id: int, item: Item): # 第一个参数被识别为路径参数，第二个参数被识别为`Pydantic`参数
    return {"item_id": item_id, **item.dict()}
```

### 请求体+路径参数+查询参数

```python
from fastapi import FastAPI
from pydantic import BaseModel


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None


app = FastAPI()


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item, q: str | None = None):
    result = {"item_id": item_id, **item.dict()}
    if q:
        result.update({"q": q})
    return result
```

## 查询参数和字符串校验

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/items/")
async def read_items(q: str | None = None):
    results = {"items": [{"item_id": "Foo"}, {"item_id": "Bar"}]}
    if q:
        results.update({"q": q})
    return results
```

### 字符数约束

在 FastAPI 中，**查询参数**（Query Parameters）是通过 URL `?key=value` 形式传递的参数。
 `Query` 是 FastAPI 提供的一个**函数**，用于：

- 显式声明某个参数是**查询参数**（即使有默认值）
- 添加**验证规则**（长度、范围、正则等）
- 添加**元数据**（描述、示例、别名等）
- 让这些规则自动反映到 **OpenAPI 文档** 中

```python
from typing import Union

from fastapi import FastAPI, Query

app = FastAPI()


@app.get("/items/")
async def read_items(q: Union[str, None] = Query(default=None, max_length=50)):
    results = {"items": [{"item_id": "Foo"}, {"item_id": "Bar"}]}
    if q:
        results.update({"q": q})
    return results
```

也可以添加正则表达式,不符合正则的会报错

```python
from typing import Union

from fastapi import FastAPI, Query

app = FastAPI()


@app.get("/items/")
async def read_items(
    q: Union[str, None] = Query(
        default=None, min_length=3, max_length=50, pattern="^fixedquery$"
    ),
):
    results = {"items": [{"item_id": "Foo"}, {"item_id": "Bar"}]}
    if q:
        results.update({"q": q})
    return results
```



必要参数，但可以接收None

```python
from typing import Union

from fastapi import FastAPI, Query

app = FastAPI()


@app.get("/items/")
async def read_items(q: Union[str, None] = Query(min_length=3)):
    results = {"items": [{"item_id": "Foo"}, {"item_id": "Bar"}]}
    if q:
        results.update({"q": q})
    return results
```

### 多个查询参数

```python
from typing import List, Union

from fastapi import FastAPI, Query

app = FastAPI()


@app.get("/items/")
async def read_items(q: Union[List[str], None] = Query(default=None)):
    query_items = {"q": q}
    return query_items
```

然后地址栏输入`http://localhost:8000/items/?q=foo&q=bar`

### 别名参数

如果查询的参数带有python中的非法字符(-)，但又想使用时，可以使用别名参数。

```python
from typing import Union

from fastapi import FastAPI, Query

app = FastAPI()


@app.get("/items/")
async def read_items(q: Union[str, None] = Query(default=None, alias="item-query")):
    results = {"items": [{"item_id": "Foo"}, {"item_id": "Bar"}]}
    if q:
        results.update({"q": q})
    return results
```

对于外部来讲，参数名就不是`q`了，而是`item-query`

### 参数弃用

`Query`参数`deprecated=True,`将参数标记为弃用，仅作提醒，没有实际限制

## 路径参数和数值校验

路径参数的校验使用`Path`

```python
from typing import Annotated

from fastapi import FastAPI, Path, Query

app = FastAPI()


@app.get("/items/{item_id}")
async def read_items(
    item_id: Annotated[int, Path(title="The ID of the item to get")],
    q: Annotated[str | None, Query(alias="item-query")] = None,
):
    results = {"item_id": item_id}
    if q:
        results.update({"q": q})
    return results
```

还可以数值约束，如`Path`的参数使用`ge`代表大于等于，`gt`代表大于，以及其他。

## 查询参数模型

使用`Pydantic`模型的参数

```python
from typing import Annotated, Literal

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

app = FastAPI()


class FilterParams(BaseModel):
    limit: int = Field(100, gt=0, le=100)
    offset: int = Field(0, ge=0)
    order_by: Literal["created_at", "updated_at"] = "created_at"
    tags: list[str] = []


@app.get("/items/")
async def read_items(filter_query: Annotated[FilterParams, Query()]): # 通过Annotated声明参数类型
    return filter_query
```

### 禁止传入额外的参数

```python
from typing import Annotated, Literal

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

app = FastAPI()


class FilterParams(BaseModel):
    model_config = {"extra": "forbid"}

    limit: int = Field(100, gt=0, le=100)
    offset: int = Field(0, ge=0)
    order_by: Literal["created_at", "updated_at"] = "created_at"
    tags: list[str] = []


@app.get("/items/")
async def read_items(filter_query: Annotated[FilterParams, Query()]):
    return filter_query
```

## 请求体-多个参数

### 多个查询参数

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None


class User(BaseModel):
    username: str
    full_name: str | None = None


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item, user: User):
    results = {"item_id": item_id, "item": item, "user": user}
    return results
```

请求体应为：

```json
{
    "item": {
        "name": "Foo",
        "description": "The pretender",
        "price": 42.0,
        "tax": 3.2
    },
    "user": {
        "username": "dave",
        "full_name": "Dave Grohl"
    }
}
```

可以使用`FastApi`的`Body`声明参数是请求体。

默认情况下单一值被解释为查询参数，因此你不必显式地添加 `Query`

### 同时存在查询参数和请求体

```python
from typing import Annotated

from fastapi import Body, FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None


class User(BaseModel):
    username: str
    full_name: str | None = None


@app.put("/items/{item_id}")
async def update_item(
    *,
    item_id: int,
    item: Item,
    user: User,
    importance: Annotated[int, Body(gt=0)],
    q: str | None = None,
):
    results = {"item_id": item_id, "item": item, "user": user, "importance": importance}
    if q:
        results.update({"q": q})
    return results
```

### 嵌入参数

当使用`Pydantic`模型时，`FastAPI`期望客户端发送的是直接包含模型字段的内容。
如，`Pydantic`定义的模型：

```python
class Item(BaseModel):
    name: str
    price: float
    tax: float | None = None
```

服务端期望

```json
{
  "name": "Foo",
  "price": 42.0,
  "tax": 3.2
}
```

如果期望使用嵌套类型（这里的`item`是参数名）：

```json
{
  "item": {
    "name": "Foo",
    "price": 42.0,
    "tax": 3.2
  }
}
```

那么需要对请求体使用`Body(..., embed=True)`，这样 `FastAPI` 就会正确解析嵌套在 `item` 键中的模型内容。

## 请求体-字段

与在*路径操作函数*中使用 `Query`、`Path` 、`Body` 声明校验与元数据的方式一样，可以使用 Pydantic 的 `Field` 在 Pydantic 模型内部声明校验和元数据。

与`Query`、`Path`、`Body`不同，`Field`从`pydantic`导入。

```python
from typing import Annotated

from fastapi import Body, FastAPI
from pydantic import BaseModel, Field

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = Field(
        default=None, title="The description of the item", max_length=300
    )
    price: float = Field(gt=0, description="The price must be greater than zero")
    tax: float | None = None


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Annotated[Item, Body(embed=True)]):
    results = {"item_id": item_id, "item": item}
    return results
```

## 请求体-嵌套模型

### List 字段

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None
    tags: list = []


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item):
    results = {"item_id": item_id, "item": item}
    return results
```

### 具有子类型的`List`字段

```python
from typing import List, Union

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: Union[str, None] = None
    price: float
    tax: Union[float, None] = None
    tags: List[str] = []


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item):
    results = {"item_id": item_id, "item": item}
    return results
```

### Set类型

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None
    tags: set[str] = set()


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item):
    results = {"item_id": item_id, "item": item}
    return results
```

Pydantic 模型的每个属性都具有类型。

## Pydantic 的额外信息

### 通过`BaseMode`配置额外信息

给模型的 **JSON Schema** 添加额外信息（尤其是示例数据 `example` / `examples`），让它在自动生成的 API 文档（Swagger UI）里更直观地展示。

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Foo",
                    "description": "A very nice Item",
                    "price": 35.4,
                    "tax": 3.2,
                }
            ]
        }
    }


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item):
    results = {"item_id": item_id, "item": item}
    return results
```

![image-20250916170750753](./typora_resource/python%E5%90%8E%E7%AB%AF%E6%A1%86%E6%9E%B6-fastapi/image-20250916170750753.png)![image-20250916170801517](./typora_resource/python%E5%90%8E%E7%AB%AF%E6%A1%86%E6%9E%B6-fastapi/image-20250916170801517.png)

### `Field`附加参数

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI()


class Item(BaseModel):
    name: str = Field(examples=["Foo"])
    description: str | None = Field(default=None, examples=["A very nice Item"])
    price: float = Field(examples=[35.4])
    tax: float | None = Field(default=None, examples=[3.2])


@app.put("/items/{item_id}")
async def update_item(item_id: int, item: Item):
    results = {"item_id": item_id, "item": item}
    return results
```

```python
class FieldExtraItem(BaseModel):
    name: str = Field(title="The name of the item", examples=["MR.SHEN"])
    description: str | None = Field(
        title="The description of the item", examples=["A very nice Item"]
    )
    price: float
    tax: float | None = None
```



![image-20250916171402226](./typora_resource/python%E5%90%8E%E7%AB%AF%E6%A1%86%E6%9E%B6-fastapi/image-20250916171402226.png)

### `Body`额外参数

```python
from typing import Annotated

from fastapi import Body, FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None


@app.put("/items/{item_id}")
async def update_item(
    item_id: int,
    item: Annotated[
        Item,
        Body(
            examples=[
                {
                    "name": "Foo",
                    "description": "A very nice Item",
                    "price": 35.4,
                    "tax": 3.2,
                }
            ],
        ),
    ],
):
    results = {"item_id": item_id, "item": item}
    return results
```

