# YouTube 视频片段下载操作指南（yt-dlp）

## 环境准备

- 安装 yt-dlp：确保已安装最新版 yt-dlp。
- 安装 Node.js：用于解决 YouTube 的 JS challenge。
- 安装 Cookie-Editor 插件：在 Edge/Chrome 浏览器中安装，用于导出 cookies。

## 导出 Cookies

1. 登录 YouTube。
2. 打开目标视频页面。
3. 使用 Cookie-Editor 插件导出 cookies。
4. 选择 Netscape 格式，保存为 youtube.txt。
5. 将文件放在英文路径下，例如：F:\cookies\youtube.txt。

## 查看可用格式

运行以下命令查看视频可用的音视频格式：

```
yt-dlp https://www.youtube.com/watch?v=SuzmYTFGBuQ --cookies "F:\cookies\youtube.txt" --js-runtime node --remote-components ejs:github --list-formats
```

## 下载片段

根据 --list-formats 的结果，选择合适的音视频组合：

### 下载 1080p + M4A 音频（推荐）

```
yt-dlp https://www.youtube.com/watch?v=SuzmYTFGBuQ --download-sections "*0:00-0:15" --cookies "F:\cookies\youtube.txt" --js-runtime node --remote-components ejs:github -f 137+140
```

### 下载 4K AV1 + M4A 音频

```
yt-dlp https://www.youtube.com/watch?v=SuzmYTFGBuQ --download-sections "*0:00-0:15" --cookies "F:\cookies\youtube.txt" --js-runtime node --remote-components ejs:github -f 401+140
```

## 常见问题

- 403 Forbidden：通常是 cookies 不完整或过期，需重新导出。
- 只有 HLS 格式：说明未登录或 challenge solver 未启用，需确认 cookies 文件和 --remote-components ejs:github 参数。
- **路径错误**：确保 cookies 文件路径存在且为英文路径。

## 总结

- 使用完整 cookies 文件（含 SID/HSID/SAPISID 等）。
- 启用 [Node.js](https://Node.js) 和远程组件解决 JS challenge。
- 通过 `--list-formats` 确认可用格式，再用 `-f` 指定下载组合。
- 推荐使用 `137+140`（1080p AVC + M4A），兼容性最好。# YouTube 视频片段下载操作指南（yt-dlp）

## 环境准备

- 安装 yt-dlp：确保已安装最新版 yt-dlp。
- 安装 Node.js：用于解决 YouTube 的 JS challenge。
- 安装 Cookie-Editor 插件：在 Edge/Chrome 浏览器中安装，用于导出 cookies。

## 导出 Cookies

1. 登录 YouTube。
2. 打开目标视频页面。
3. 使用 Cookie-Editor 插件导出 cookies。
4. 选择 Netscape 格式，保存为 youtube.txt。
5. 将文件放在英文路径下，例如：F:\cookies\youtube.txt。

## 查看可用格式

运行以下命令查看视频可用的音视频格式：

```
yt-dlp https://www.youtube.com/watch?v=SuzmYTFGBuQ --cookies "F:\cookies\youtube.txt" --js-runtime node --remote-components ejs:github --list-formats
```

## 下载片段

根据 --list-formats 的结果，选择合适的音视频组合：

### 下载 1080p + M4A 音频（推荐）

```
yt-dlp https://www.youtube.com/watch?v=SuzmYTFGBuQ --download-sections "*0:00-0:15" --cookies "F:\cookies\youtube.txt" --js-runtime node --remote-components ejs:github -f 137+140
```

### 下载 4K AV1 + M4A 音频

```
yt-dlp https://www.youtube.com/watch?v=SuzmYTFGBuQ --download-sections "*0:00-0:15" --cookies "F:\cookies\youtube.txt" --js-runtime node --remote-components ejs:github -f 401+140
```

## 常见问题

- 403 Forbidden：通常是 cookies 不完整或过期，需重新导出。
- 只有 HLS 格式：说明未登录或 challenge solver 未启用，需确认 cookies 文件和 --remote-components ejs:github 参数。
- **路径错误**：确保 cookies 文件路径存在且为英文路径。

## 总结

- 使用完整 cookies 文件（含 SID/HSID/SAPISID 等）。
- 启用 [Node.js](https://Node.js) 和远程组件解决 JS challenge。
- 通过 `--list-formats` 确认可用格式，再用 `-f` 指定下载组合。
- 推荐使用 `137+140`（1080p AVC + M4A），兼容性最好。