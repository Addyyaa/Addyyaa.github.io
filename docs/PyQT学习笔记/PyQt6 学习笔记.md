

# PyQt6 学习笔记

## `QpushButton`信号

1. 先定义一个小部件

   ```python
   from PyQt6.QtWidgets import QApplication, QMainWindow, QPushButton
   
   # 创建按钮
   button = QPushButton("我是按钮")
   ```

2. 将按钮控件设置为可选中状态，使其可以切换选中状态

   ```python
   button.setCheckable(True)
   ```

3. 如果按钮变为点击状态则连接信号函数

   ```python
   button.clicked.connect(self.the_button_was_clicked)
   self.setCentralWidget(button)
   
   def the_button_was_clicked(self):
           print("Clicked!")
   ```

4. 创建`app`对象

   ```python\
   app = QApplication(sys.argv)
   ```

5. 创建主窗口

   ```python
   window = MainWindow()
   window.show()
   ```

6. 进入事件循环

   ```python
   app.exec()
   ```

7. 获取按钮自身状态

   ```python
   button.clicked.connect(self.the_button_was_toggled)
   def the_button_was_toggled(self, checked):
       print("Checked?", checked)
   ```

8. 使用变量存储按钮状态

   ```python
   self.button_status = True
   def the_button_was_toggled(self, checked):
       self.button_status = checked
       print(self.button_status)
   ```

9. 禁用按钮

   ```python
   self.button.setEnabled(False)
   ```

10. 点击后改变按钮文本

    ```python
        def the_button_was_clicked(self):
            self.button.setText("You clicked me!")
            self.button.setEnabled(False)
            self.setWindowTitle("SHEN'S App - Clicked")
    ```

11. 什么信号连接的函数，那么这个函数接收到的信号内容就是该信号相关的内容。例如，如果信号是clicked发出的，那么接收这个信号的函数就会得到布尔值，如果信号是`widowTitleChanged`，那么接收这个信号的函数就会是title内容

    >![](./assets/image-20240207130548944.png)

## 常用控件和布局

### `QLabel`

-- 用于显示静态文本或图像的标签控件，用户不能与其交互。通常用于显示程序的标题、说明、状态信息等

`label = QLabel`属于`QtWidgets`

### `QLineEdit`

-- 用户可以在 `QLineEdit` 中输入文本，并且可以通过键盘或鼠标进行编辑。`QLineEdit` 主要用于获取用户输入的文本信息，例如用户名、密码、搜索关键词等

`input = QLineEdit()`属于`QtWidgets`

### `QVBoxLayout`

-- 垂直布局管理器会将添加到其中的窗口部件垂直地排列，依次放置在上方或下方

`layout = QVBoxLayout()`属于`QWidgets`

### `QHBoxLayout`

-- 用于创建水平布局管理器。水平布局管理器会将添加到其中的窗口部件水平地排列，依次放置在左侧或右侧。

`layout = QHBoxLayout()`属于`QWidgets`

### `QWidget`

-- 是 PyQt 中的一个类，代表用户界面中的一个可视窗口部件。它是所有用户界面控件的基类，可以包含其他窗口部件，如按钮、标签、文本框等。`QWidget()` 提供了一些基本的功能，例如绘制、事件处理、布局管理等，是构建用户界面的基础。

`widget = Qwidget()`

## 接收信号的槽函数

槽函数可以是自定义也可以是`PyQt`定义的一些函数

如`setText`、`setTitle`、`deleteLater()`、`close()`等等

## 事件

### 鼠标相关时间

| Event handler             | Event type moved       |
| ------------------------- | ---------------------- |
| `mouseMoveEvent()`        | 当鼠标移动时触发       |
| `mousePressEvent()`       | 当鼠标按钮被按下时触发 |
| `mouseReleaseEvent()`     | 当鼠标按钮被释放时触发 |
| `mouseDoubleClickEvent()` | 当鼠标按钮被双击时触发 |
| `Mouse Enter Event`       | 当鼠标进入窗口时触发   |
| `Mouse Leave Event`       | 当鼠标离开窗口时触发   |
| `Wheel Event`             | 滚轮事件               |

