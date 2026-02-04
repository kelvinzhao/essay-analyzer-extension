/**
 * Background Service Worker
 * 处理扩展的后台逻辑、API调用和消息中转
 */

// 消息类型常量
const ACTIONS = {
  CHECK_ARTICLE: 'checkArticle',
  EXTRACT_ARTICLE: 'extractArticle',
  ANALYZE_ARTICLE: 'analyzeArticle',
  OPEN_SIDEBAR: 'openSidebar',
  GET_CONFIG: 'getConfig',
  SAVE_CONFIG: 'saveConfig',
  EXPORT_MARKDOWN: 'exportMarkdown',
  VALIDATE_API: 'validateApi'
};

// 当前分析状态
let analysisState = {
  isAnalyzing: false,
  currentArticle: null,
  currentAnalysis: null
};

/**
 * 监听扩展图标点击
 */
chrome.action.onClicked.addListener(async (tab) => {
  // 打开侧边栏
  await chrome.sidePanel.open({ tabId: tab.id });

  // 检查当前页面是否有文章
  try {
    const response = await sendMessageToTab(tab.id, { action: ACTIONS.CHECK_ARTICLE });

    if (response && response.hasArticle) {
      // 通知侧边栏页面信息已更新
      notifySidebar({
        action: 'pageDetected',
        data: response
      });
    }
  } catch (error) {
    console.error('[范文拆解器] 检查页面失败:', error);
  }
});

/**
 * 监听来自popup和sidebar的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 忽略发给sidebar的消息，让sidebar的监听器处理
  if (message.target === 'sidebar') {
    return false;
  }
  handleMessage(message, sendResponse);
  return true; // 保持消息通道开放
});

/**
 * 处理消息
 */
async function handleMessage(message, sendResponse) {
  const { action, data } = message;

  try {
    switch (action) {
      case ACTIONS.CHECK_ARTICLE:
        await handleCheckArticle(sendResponse);
        break;

      case ACTIONS.EXTRACT_ARTICLE:
        await handleExtractArticle(sendResponse);
        break;

      case ACTIONS.ANALYZE_ARTICLE:
        await handleAnalyzeArticle(data, sendResponse);
        break;

      case ACTIONS.GET_CONFIG:
        await handleGetConfig(sendResponse);
        break;

      case ACTIONS.SAVE_CONFIG:
        await handleSaveConfig(data, sendResponse);
        break;

      case ACTIONS.EXPORT_MARKDOWN:
        await handleExportMarkdown(data, sendResponse);
        break;

      case ACTIONS.VALIDATE_API:
        await handleValidateApi(data, sendResponse);
        break;

      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  } catch (error) {
    console.error('[范文拆解器] 处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 检查当前活动标签页是否有文章
 */
async function handleCheckArticle(sendResponse) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    sendResponse({ success: false, error: '无法获取当前标签页' });
    return;
  }

  const response = await sendMessageToTab(tab.id, { action: ACTIONS.CHECK_ARTICLE });
  sendResponse(response);
}

/**
 * 提取当前活动标签页的文章
 */
async function handleExtractArticle(sendResponse) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    sendResponse({ success: false, error: '无法获取当前标签页' });
    return;
  }

  const response = await sendMessageToTab(tab.id, { action: ACTIONS.EXTRACT_ARTICLE });
  sendResponse(response);
}

/**
 * 分析文章
 */
async function handleAnalyzeArticle(data, sendResponse) {
  console.log('[范文拆解器] ===== handleAnalyzeArticle 开始 =====', {
    hasArticle: !!data.article,
    articleTitle: data.article?.title,
    timestamp: new Date().toISOString()
  });

  if (analysisState.isAnalyzing) {
    console.log('[范文拆解器] 已有分析任务进行中，忽略请求');
    sendResponse({ success: false, error: '正在分析中，请稍候' });
    return;
  }

  analysisState.isAnalyzing = true;
  analysisState.currentArticle = data.article;

  // 通知侧边栏开始分析
  console.log('[范文拆解器] 发送 analysisStarted 通知');
  await notifySidebar({ action: 'analysisStarted', data: { title: data.article.title } });

  // 添加超时保护
  const timeout = setTimeout(() => {
    if (analysisState.isAnalyzing) {
      console.error('[范文拆解器] 分析超时（5分钟）');
      notifySidebar({
        action: 'analysisError',
        data: { error: '分析超时，请检查网络连接或重试' }
      });
      analysisState.isAnalyzing = false;
    }
  }, 5 * 60 * 1000); // 5分钟超时

  try {
    // 步骤1: 提取文章（已完成，通知进度）
    console.log('[范文拆解器] 步骤1完成，发送进度 step=2');
    await notifySidebar({ action: 'analysisProgress', data: { step: 2 } });

    // 构建分析prompt（使用内联的Analyzer类）
    const analyzer = new Analyzer();
    const prompt = analyzer.buildPrompt(data.article, data.simple);

    console.log('[范文拆解器] Prompt已构建', {
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 200) + '...'
    });

    // 步骤2完成，进入步骤3
    console.log('[范文拆解器] 步骤2完成，发送进度 step=3');
    await notifySidebar({ action: 'analysisProgress', data: { step: 3 } });

    // 加载AI配置并调用（使用内联的AIClient类）
    const aiClient = new AIClient();
    console.log('[范文拆解器] 开始加载AI配置...');
    await aiClient.loadConfig();

    console.log('[范文拆解器] API配置已加载', {
      isConfigured: aiClient.isConfigured(),
      provider: aiClient.config?.provider,
      hasApiKey: !!aiClient.config?.apiKey,
      model: aiClient.config?.model
    });

    if (!aiClient.isConfigured()) {
      throw new Error('请先在设置中配置API密钥');
    }

    // 调用AI分析
    console.log('[范文拆解器] 开始调用AI API...', {
      endpoint: aiClient.config.endpoint || aiClient.providers[aiClient.config.provider]?.endpoint
    });

    const result = await aiClient.analyze(prompt);

    console.log('[范文拆解器] AI分析完成', {
      resultType: typeof result,
      resultLength: result?.length || 0,
      resultPreview: result?.substring(0, 100) || '(empty)'
    });

    // 步骤3完成，进入步骤4
    console.log('[范文拆解器] 步骤3完成，发送进度 step=4');
    await notifySidebar({ action: 'analysisProgress', data: { step: 4 } });

    // 检查结果是否有效
    if (!result) {
      throw new Error('API返回结果为空，请检查网络连接和API配置');
    }

    if (typeof result !== 'string') {
      console.error('[范文拆解器] 返回结果类型错误', { type: typeof result, result });
      throw new Error('API返回格式错误：期望字符串，实际返回 ' + typeof result);
    }

    // 解析结果
    const parsedResult = analyzer.parseResponse(result);
    const validation = analyzer.validateResponse(result);

    console.log('[范文拆解器] 结果验证', validation);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    analysisState.currentAnalysis = parsedResult;
    analysisState.isAnalyzing = false;
    clearTimeout(timeout);

    console.log('[范文拆解器] ===== 分析成功，通知侧边栏 =====');

    // 步骤4完成，进入步骤5（添加延迟让用户看到步骤4）
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log('[范文拆解器] 步骤4完成，发送进度 step=5');
    await notifySidebar({ action: 'analysisProgress', data: { step: 5 } });

    // 通知侧边栏分析完成
    await notifySidebar({
      action: 'analysisCompleted',
      data: {
        article: data.article,
        analysis: parsedResult,
        rawResult: result
      }
    });

    sendResponse({
      success: true,
      analysis: parsedResult
    });

  } catch (error) {
    analysisState.isAnalyzing = false;
    clearTimeout(timeout);

    console.error('[范文拆解器] ===== 分析失败 =====', {
      message: error.message,
      stack: error.stack
    });

    await notifySidebar({
      action: 'analysisError',
      data: { error: error.message }
    });

    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 获取配置
 */
async function handleGetConfig(sendResponse) {
  chrome.storage.local.get(
    ['apiProvider', 'apiKey', 'apiModel', 'apiEndpoint'],
    (result) => {
      sendResponse({
        success: true,
        config: {
          provider: result.apiProvider || 'anthropic',
          apiKey: result.apiKey || '',
          model: result.apiModel || '',
          endpoint: result.apiEndpoint || ''
        }
      });
    }
  );
}

/**
 * 保存配置
 */
async function handleSaveConfig(data, sendResponse) {
  const { provider, apiKey, model, endpoint } = data;

  chrome.storage.local.set(
    {
      apiProvider: provider,
      apiKey: apiKey,
      apiModel: model,
      apiEndpoint: endpoint
    },
    () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    }
  );
}

/**
 * 导出Markdown
 * 直接在sidebar中执行，不需要动态导入
 */
async function handleExportMarkdown(data, sendResponse) {
  try {
    const { article, analysis } = data;

    // 通知sidebar执行导出
    notifySidebar({
      action: 'exportRequested',
      data: { article, analysis }
    });

    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 验证API配置
 */
async function handleValidateApi(data, sendResponse) {
  console.log('[范文拆解器] 开始验证API配置', {
    provider: data.provider,
    hasApiKey: !!data.apiKey,
    model: data.model,
    endpoint: data.endpoint
  });

  try {
    const aiClient = new AIClient();
    const result = await aiClient.validate(data);

    if (result.success) {
      console.log('[范文拆解器] API验证成功', result);
      sendResponse({ success: true, data: result });
    } else {
      console.error('[范文拆解器] API验证失败', result.error);
      sendResponse({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[范文拆解器] API验证异常', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 向指定标签页发送消息
 */
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 通知侧边栏
 * 需要获取当前活动标签页，然后向其关联的侧边栏发送消息
 */
async function notifySidebar(message) {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      // 向侧边栏发送消息（通过设置target标记）
      chrome.runtime.sendMessage({
        ...message,
        target: 'sidebar',
        tabId: tab.id
      }).catch(() => {
        // 侧边栏可能还没打开，忽略错误
        console.log('[范文拆解器] 侧边栏未打开，忽略通知');
      });
    }
  } catch (error) {
    console.log('[范文拆解器] notifySidebar 错误（可能侧边栏未打开）:', error.message);
  }
}

/**
 * 动态导入脚本
 * 注意：Service Worker环境需要特殊处理
 * 我们将分析器和AI客户端逻辑内联到background.js中
 */

// Analyzer 类 - 内联实现
class Analyzer {
  constructor() {
    this.analysisPrompt = `请按照以下五阶段流程分析这篇范文，深入解构其写作技法和风格特征：

## 第一阶段：语义解构

### 词频与意象提取
- 统计高频词汇（名词、动词、形容词）
- 识别核心意象和隐喻
- 分析词汇的语体色彩（口语/书面语、网络用语/传统表达）

### 句式分布建模
- 平均句长与句长分布
- 长短句交替节奏特征
- 特殊句式使用（排比、反问、倒装等）
- 段落结构规律

### 情绪曲线图谱
- 识别文章的情绪起伏节点
- 分析情绪转换的触发点
- 描述整体情绪走向（上扬/下沉/波动）

## 第二阶段：逻辑建模

### 开头钩子识别
- 开篇策略（提问/故事/数据/金句/冲突）
- 注意力捕获机制分析
- 开头与主题的关联方式

### 论证路径复刻
- 主体结构框架（总分/递进/对比/并列）
- 段落间的过渡手法
- 论据类型与排列顺序
- 逻辑链条完整性分析

### 结尾升华策略
- 收束方式（总结/呼吁/反问/留白/呼应）
- 情感落点设计
- 与开头的呼应关系

## 第三阶段：金句采样

提取3-5个最具代表性的句式，并对每个进行微观分析：

**句式1：[摘录原句]**
- 句式类型：[陈述/反问/排比/对偶等]
- 修辞手法：[比喻/拟人/夸张/借代等]
- 表达效果：[为什么有力]
- 可迁移场景：[什么类型文章可借鉴]

**句式2：[摘录原句]**
- （同上结构）

...依此类推

## 第四阶段：风格总结

### 语感特征
- 语言风格定位（犀利/温和/理性/感性等）
- 用词偏好（具象/抽象、华丽/朴实）
- 人称使用（第一/第三/无明确叙述者）

### 节奏特征
- 叙述节奏（紧凑/舒缓/变化）
- 信息密度（高/中/低）
- 段落长短偏好

### 修辞偏好
- 常用修辞手法排序
- 修辞出现的典型位置
- 修辞与内容的关系

### 意象类型
- 核心意象库（常引用的事物/人物/场景）
- 意象的情感色彩
- 意象的文化内涵

## 第五阶段：适合哪些题材

### 题材适配度分析
- 这篇文章最擅长处理哪类题材？（如：职场成长、情感故事、社会评论、科技科普、人物传记等）
- 判断依据：从文章的主题选择、切入角度、表达方式来分析

### 场景应用建议
- 适合的写作场景：公众号文章、短视频脚本、演讲稿、商业文案、心得分享等
- 推荐的发布平台和受众群体

### 风格迁移提示
- 如果要模仿这种风格，最适合用在什么主题上？
- 有哪些题材类型不太适合用这种风格？
- 迁移时需要注意的关键点

---

请用markdown格式输出分析结果，每个阶段用二级标题（##）分隔，子内容用三级标题（###）或列表格式。保持分析的专业性和可读性。

---
【文章内容】
{CONTENT}

【文章标题】
{TITLE}

【作者】
{AUTHOR}`;
  }

  buildPrompt(article, simple = false) {
    let content = article.content;
    const maxLength = 8000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n...[内容过长已截取]';
    }

    return this.analysisPrompt
      .replace('{CONTENT}', content)
      .replace('{TITLE}', article.title || '未知')
      .replace('{AUTHOR}', article.author || '未知');
  }

  parseResponse(response) {
    return {
      raw: response,
      wordCount: response.length
    };
  }

  validateResponse(response) {
    if (!response || typeof response !== 'string') {
      return { valid: false, error: '返回结果为空' };
    }
    if (response.length < 100) {
      return { valid: false, error: '分析结果过短，可能不完整' };
    }
    return { valid: true };
  }
}

// AIClient 类 - 内联实现
class AIClient {
  constructor() {
    this.config = null;
    this.providers = {
      anthropic: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-3-5-sonnet-20241022'
      },
      openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o'
      },
      zhipu: {
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        defaultModel: 'glm-4'
      },
      baidu: {
        endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
        defaultModel: 'ernie-4.0-8k'
      },
      alibaba: {
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        defaultModel: 'qwen-plus'
      },
      'openai-compatible': {
        endpoint: '',  // 需要用户提供
        defaultModel: 'gpt-4o'
      }
    };
  }

  async loadConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get(
        ['apiProvider', 'apiKey', 'apiModel', 'apiEndpoint'],
        result => {
          this.config = {
            provider: result.apiProvider || 'anthropic',
            apiKey: result.apiKey || '',
            model: result.apiModel || '',
            endpoint: result.apiEndpoint || ''
          };
          console.log('[范文拆解器] 已加载API配置', {
            provider: this.config.provider,
            hasApiKey: !!this.config.apiKey,
            model: this.config.model,
            endpoint: this.config.endpoint
          });
          resolve(this.config);
        }
      );
    });
  }

  isConfigured() {
    return this.config && this.config.apiKey;
  }

  /**
   * 验证API配置
   */
  async validate(config) {
    console.log('[范文拆解器] AIClient.validate 开始', {
      provider: config.provider,
      model: config.model,
      endpoint: config.endpoint
    });

    const provider = config.provider;
    const providerInfo = this.providers[provider] || this.providers['openai-compatible'];

    // 确定端点
    let endpoint = config.endpoint;
    if (!endpoint) {
      if (provider === 'openai-compatible') {
        return { success: false, error: '自定义端点为必填项' };
      }
      endpoint = providerInfo.endpoint;
    }

    // 确定模型
    const model = config.model || providerInfo.defaultModel;

    console.log('[范文拆解器] 验证参数', {
      provider,
      endpoint,
      model,
      isAnthropic: provider === 'anthropic'
    });

    // 判断是否使用 Anthropic 格式
    const isAnthropic = provider === 'anthropic';

    const body = isAnthropic ? {
      model: model,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hi' }]
    } : {
      model: model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (isAnthropic) {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    console.log('[范文拆解器] 发送验证请求', {
      url: endpoint,
      method: 'POST',
      headersKeys: Object.keys(headers),
      bodyKeys: Object.keys(body)
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      console.log('[范文拆解器] 验证响应状态', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[范文拆解器] API验证失败', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        // 提供更友好的错误信息
        let errorMsg = `API错误 ${response.status}`;
        if (response.status === 401) {
          errorMsg = 'API密钥无效，请检查';
        } else if (response.status === 404) {
          errorMsg = 'API端点不存在（404），请检查端点URL是否正确';
        } else if (response.status === 429) {
          errorMsg = 'API请求过于频繁，请稍后再试';
        } else if (response.status === 500) {
          errorMsg = 'API服务器错误，请稍后再试';
        } else {
          errorMsg = `API错误 ${response.status}: ${errorText}`;
        }

        return { success: false, error: errorMsg };
      }

      const data = await response.json();
      console.log('[范文拆解器] API验证成功', {
        model: model
      });

      return { success: true, model: model };
    } catch (error) {
      console.error('[范文拆解器] API验证网络错误', error);
      return { success: false, error: error.message };
    }
  }

  async analyze(prompt) {
    console.log('[范文拆解器] AIClient.analyze 开始');

    if (!this.isConfigured()) {
      console.error('[范文拆解器] 未配置API密钥');
      throw new Error('请先配置API密钥');
    }

    const provider = this.config.provider;
    const providerInfo = this.providers[provider] || this.providers['openai-compatible'];

    // 确定端点
    let endpoint = this.config.endpoint;
    if (!endpoint) {
      if (provider === 'openai-compatible') {
        console.error('[范文拆解器] 自定义端点未提供');
        throw new Error('自定义端点为必填项');
      }
      endpoint = providerInfo.endpoint;
    }

    // 确定模型
    const model = this.config.model || providerInfo.defaultModel;

    console.log('[范文拆解器] 分析参数', {
      provider,
      endpoint,
      model,
      promptLength: prompt.length
    });

    // 判断是否使用 Anthropic 格式
    const isAnthropic = provider === 'anthropic';

    const body = isAnthropic ? {
      model: model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    } : {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (isAnthropic) {
      headers['x-api-key'] = this.config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    console.log('[范文拆解器] 发送分析请求', {
      url: endpoint,
      headersKeys: Object.keys(headers),
      body: JSON.stringify({ ...body, messages: [`[${body.messages.length} messages]`] })
    });

    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000); // 3分钟超时

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[范文拆解器] 分析响应状态', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[范文拆解器] API分析失败', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        // 提供更友好的错误信息
        let errorMsg = `API错误 ${response.status}`;
        if (response.status === 401) {
          errorMsg = 'API密钥无效，请检查设置';
        } else if (response.status === 404) {
          errorMsg = `API端点不存在（404）。端点: ${endpoint}`;
        } else if (response.status === 429) {
          errorMsg = 'API请求过于频繁，请稍后再试';
        } else if (response.status === 500) {
          errorMsg = 'API服务器错误，请稍后再试';
        } else {
          errorMsg = `API错误 ${response.status}: ${errorText}`;
        }

        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('[范文拆解器] 分析响应数据', {
        dataKeys: Object.keys(data),
        isAnthropic
      });

      // 处理不同格式的响应
      if (isAnthropic) {
        const result = data.content?.[0]?.text || data.content || '';
        console.log('[范文拆解器] Anthropic响应解析成功', { resultLength: result.length });
        return result;
      } else {
        const result = data.choices?.[0]?.message?.content || data.result || data.output?.text || '';
        console.log('[范文拆解器] OpenAI兼容响应解析成功', { resultLength: result.length });
        return result;
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error('[范文拆解器] 请求超时（3分钟）');
        throw new Error('API请求超时（3分钟），请检查网络连接或稍后重试');
      }
      throw error;
    }
  }
}

// 初始化
console.log('[范文拆解器] Background service worker 已加载');
