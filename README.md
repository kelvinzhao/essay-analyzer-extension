# 范文拆解器 - Chrome扩展

智能分析网页文章的写作风格和结构，帮助写作者学习优秀范文的写作技巧。

## 功能特点

- **智能文章提取** - 自动识别并提取网页正文内容
- **四阶段分析** - 语义解构、逻辑建模、金句采样、风格总结
- **多家AI支持** - 支持 Anthropic (Claude)、OpenAI (GPT)、智谱AI、百度文心、阿里通义
- **侧边栏展示** - 分析结果在侧边栏展示，可折叠/展开各阶段
- **导出Markdown** - 一键导出分析报告为Markdown文件

## 安装方式

1. 下载或克隆本项目到本地
2. 打开 Chrome 扩展管理页面：`chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录 `essay-analyzer-extension`

## 使用方法

1. **配置API密钥**
   - 点击扩展图标，打开弹窗
   - 点击"设置"按钮
   - 选择AI服务商，输入API密钥
   - 点击"保存设置"

2. **分析文章**
   - 浏览到要分析的文章页面（支持微信公众号、Telegraph、知乎等）
   - 点击扩展图标
   - 点击"开始分析"按钮
   - 等待AI分析完成，在侧边栏查看结果

3. **导出报告**
   - 在侧边栏点击导出按钮
   - 分析报告将保存为Markdown文件

## 项目结构

```
essay-analyzer-extension/
├── manifest.json          # 扩展配置文件
├── popup/                 # 弹窗界面
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── sidebar/               # 侧边栏界面
│   ├── sidebar.html
│   ├── sidebar.css
│   └── sidebar.js
├── content/               # 内容脚本
│   └── content.js
├── background/            # 后台服务
│   └── background.js
├── lib/                   # 核心库
│   ├── article-extractor.js   # 文章提取器
│   ├── ai-client.js           # AI客户端
│   ├── analyzer.js            # 分析器
│   └── markdown-exporter.js   # Markdown导出器
└── icons/                 # 图标文件
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 支持的网站

- 微信公众号 (mp.weixin.qq.com)
- Telegraph (telegra.ph)
- 知乎 (www.zhihu.com)
- 豆瓣 (www.douban.com)
- 其他常见的文章网站

## API配置

### Anthropic (Claude)
- 端点: `https://api.anthropic.com/v1/messages`
- 默认模型: `claude-3-5-sonnet-20241022`

### OpenAI (GPT)
- 端点: `https://api.openai.com/v1/chat/completions`
- 默认模型: `gpt-4o`

### 智谱AI (GLM)
- 端点: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
- 默认模型: `glm-4`

### 百度文心
- 端点: `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions`
- 默认模型: `ernie-4.0-8k`

### 阿里通义
- 端点: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 默认模型: `qwen-plus`

## 开发说明

### 技术栈
- Manifest V3
- Vanilla JavaScript (无框架依赖)
- Chrome Storage API
- Chrome Downloads API
- Chrome Side Panel API

### 重新生成图标
```bash
cd icons
python generate_icons.py
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
