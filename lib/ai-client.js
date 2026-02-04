/**
 * AI客户端
 * 统一的AI调用接口，支持多家API
 */

class AIClient {
  constructor() {
    this.config = null;
    this.providers = {
      anthropic: {
        name: 'Anthropic (Claude)',
        endpoint: 'https://api.anthropic.com/v1/messages',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        defaultModel: 'claude-3-5-sonnet-20241022'
      },
      openai: {
        name: 'OpenAI (GPT)',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o'
      },
      zhipu: {
        name: '智谱AI (GLM)',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        models: ['glm-4-plus', 'glm-4', 'glm-4-flash', 'glm-4-air'],
        defaultModel: 'glm-4'
      },
      baidu: {
        name: '百度文心',
        endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
        models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-8k'],
        defaultModel: 'ernie-4.0-8k'
      },
      alibaba: {
        name: '阿里通义',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
        defaultModel: 'qwen-plus'
      }
    };
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['apiProvider', 'apiKey', 'apiModel', 'apiEndpoint'],
        (result) => {
          this.config = {
            provider: result.apiProvider || 'anthropic',
            apiKey: result.apiKey || '',
            model: result.apiModel || this.providers.anthropic.defaultModel,
            endpoint: result.apiEndpoint
          };
          resolve(this.config);
        }
      );
    });
  }

  /**
   * 验证配置是否完整
   */
  isConfigured() {
    return this.config && this.config.apiKey;
  }

  /**
   * 调用AI分析
   * @param {string} prompt - 分析提示词
   * @returns {Promise<string>} AI返回结果
   */
  async analyze(prompt) {
    if (!this.isConfigured()) {
      throw new Error('请先在设置中配置API密钥');
    }

    const provider = this.config.provider;

    switch (provider) {
      case 'anthropic':
        return await this.callAnthropic(prompt);
      case 'openai':
        return await this.callOpenAI(prompt);
      case 'zhipu':
        return await this.callZhipu(prompt);
      case 'baidu':
        return await this.callBaidu(prompt);
      case 'alibaba':
        return await this.callAlibaba(prompt);
      default:
        throw new Error(`不支持的AI提供商: ${provider}`);
    }
  }

  /**
   * 调用Anthropic API
   */
  async callAnthropic(prompt) {
    const endpoint = this.config.endpoint || this.providers.anthropic.endpoint;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * 调用OpenAI API
   */
  async callOpenAI(prompt) {
    const endpoint = this.config.endpoint || this.providers.openai.endpoint;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * 调用智谱AI API
   */
  async callZhipu(prompt) {
    const endpoint = this.config.endpoint || this.providers.zhipu.endpoint;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`智谱AI API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * 调用百度文心API
   */
  async callBaidu(prompt) {
    const endpoint = this.config.endpoint || this.providers.baidu.endpoint;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: this.config.apiKey,
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`百度文心 API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.result;
  }

  /**
   * 调用阿里通义API
   */
  async callAlibaba(prompt) {
    const endpoint = this.config.endpoint || this.providers.alibaba.endpoint;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`阿里通义 API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * 获取所有可用提供商
   */
  getProviders() {
    return this.providers;
  }

  /**
   * 获取指定提供商的模型列表
   */
  getModels(provider) {
    return this.providers[provider]?.models || [];
  }
}

// 导出
window.AIClient = AIClient;
