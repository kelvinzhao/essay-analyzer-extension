/**
 * Popup 脚本
 */

(function() {
  'use strict';

  // DOM元素
  const elements = {
    pageStatus: document.getElementById('pageStatus'),
    statusDot: document.querySelector('.status-dot'),
    statusText: document.querySelector('.status-text'),
    btnAnalyze: document.getElementById('btnAnalyze'),
    btnSettings: document.getElementById('btnSettings'),
    btnHelp: document.getElementById('btnHelp'),
    quickTip: document.getElementById('quickTip'),
    tipText: document.getElementById('tipText'),
    settingsPanel: document.getElementById('settingsPanel'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    apiProvider: document.getElementById('apiProvider'),
    apiKey: document.getElementById('apiKey'),
    apiModel: document.getElementById('apiModel'),
    apiEndpoint: document.getElementById('apiEndpoint'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnValidateApi: document.getElementById('btnValidateApi'),
    validationResult: document.getElementById('validationResult')
  };

  // 状态
  let currentState = {
    hasArticle: false,
    articleTitle: '',
    isConfigured: false
  };

  /**
   * 初始化
   */
  async function init() {
    bindEvents();
    await checkPage();
    await checkConfig();
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    elements.btnAnalyze.addEventListener('click', handleAnalyze);
    elements.btnSettings.addEventListener('click', openSettings);
    elements.btnCloseSettings.addEventListener('click', closeSettings);
    elements.btnSaveSettings.addEventListener('click', saveSettings);
    elements.btnValidateApi?.addEventListener('click', handleValidateApi);
    elements.btnHelp.addEventListener('click', handleHelp);
    elements.apiProvider.addEventListener('change', updateModelPlaceholder);
  }

  /**
   * 检查当前页面
   */
  async function checkPage() {
    setStatus('checking', '检测页面中...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        setStatus('error', '无法获取当前页面');
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'checkArticle'
      });

      if (response && response.hasArticle) {
        currentState.hasArticle = true;
        currentState.articleTitle = response.title;
        setStatus('success', `找到文章：${truncateText(response.title, 20)}`);
        elements.btnAnalyze.disabled = false;
      } else {
        setStatus('error', '当前页面未检测到文章');
        showTip('请尝试在微信公众号文章、 Telegraph 或新闻网站页面使用');
      }
    } catch (error) {
      setStatus('error', '检测失败，请刷新页面后重试');
      console.error('检查页面失败:', error);
    }
  }

  /**
   * 检查配置
   */
  async function checkConfig() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getConfig'
      });

      if (response && response.success) {
        const { config } = response;
        currentState.isConfigured = !!config.apiKey;

        // 填充表单
        if (config.provider) elements.apiProvider.value = config.provider;
        if (config.apiKey) elements.apiKey.value = config.apiKey;
        if (config.model) elements.apiModel.value = config.model;
        if (config.endpoint) elements.apiEndpoint.value = config.endpoint;

        // 更新表单状态（占位符、标签等）
        updateModelPlaceholder();

        if (!currentState.isConfigured) {
          showTip('首次使用请先配置API密钥');
        }
      }
    } catch (error) {
      console.error('检查配置失败:', error);
    }
  }

  /**
   * 处理分析点击
   */
  async function handleAnalyze() {
    if (!currentState.hasArticle) {
      showToast('当前页面没有可分析的文章', 'error');
      return;
    }

    try {
      // 打开侧边栏（sidebar 会自动开始分析流程）
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.sidePanel.open({ tabId: tab.id });

      // 通知 sidebar 开始分析
      await chrome.runtime.sendMessage({
        action: 'startAnalysis',
        target: 'sidebar'
      });

      window.close();
    } catch (error) {
      console.error('打开侧边栏失败:', error);
      showToast('打开侧边栏失败，请重试', 'error');
    }
  }

  /**
   * 打开设置
   */
  function openSettings() {
    elements.settingsPanel.style.display = 'flex';
  }

  /**
   * 关闭设置
   */
  function closeSettings() {
    elements.settingsPanel.style.display = 'none';
  }

  /**
   * 保存设置
   */
  async function saveSettings() {
    const config = {
      provider: elements.apiProvider.value,
      apiKey: elements.apiKey.value.trim(),
      model: elements.apiModel.value.trim(),
      endpoint: elements.apiEndpoint.value.trim().replace(/\/+$/, '') // 去除末尾斜杠和空格
    };

    if (!config.apiKey) {
      showToast('请输入API密钥', 'error');
      return;
    }

    // openai-compatible 需要提供端点
    if (config.provider === 'openai-compatible' && !config.endpoint) {
      showToast('自定义端点为必填项', 'error');
      return;
    }

    elements.btnSaveSettings.classList.add('loading');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveConfig',
        data: config
      });

      if (response && response.success) {
        currentState.isConfigured = true;
        showToast('设置已保存', 'success');
        closeSettings();
      } else {
        showToast('保存设置失败', 'error');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      showToast('保存设置失败', 'error');
    } finally {
      elements.btnSaveSettings.classList.remove('loading');
    }
  }

  /**
   * 更新模型占位符
   */
  function updateModelPlaceholder() {
    const provider = elements.apiProvider.value;
    const models = {
      anthropic: 'claude-3-5-sonnet-20241022',
      openai: 'gpt-4o',
      zhipu: 'glm-4',
      baidu: 'ernie-4.0-8k',
      alibaba: 'qwen-plus',
      'openai-compatible': 'gpt-4o'
    };
    elements.apiModel.placeholder = models[provider] || '';

    // 自定义选项需要用户输入端点
    const endpointLabel = document.getElementById('endpointLabel');
    if (provider === 'openai-compatible') {
      if (endpointLabel) {
        endpointLabel.textContent = 'API 端点（必填）*';
      }
      elements.apiEndpoint.placeholder = 'https://api.example.com/v1/chat/completions';
    } else {
      if (endpointLabel) {
        endpointLabel.textContent = '自定义端点（可选）';
      }
      elements.apiEndpoint.placeholder = '留空使用官方端点';
    }
  }

  /**
   * 验证API配置
   */
  async function handleValidateApi() {
    const config = {
      provider: elements.apiProvider.value,
      apiKey: elements.apiKey.value.trim(),
      model: elements.apiModel.value.trim(),
      endpoint: elements.apiEndpoint.value.trim()
    };

    // 验证必填字段
    if (!config.apiKey) {
      showValidationResult('error', '请输入API密钥');
      return;
    }

    if (config.provider === 'openai-compatible' && !config.endpoint) {
      showValidationResult('error', '自定义端点为必填项');
      return;
    }

    // 显示加载中状态
    showValidationResult('loading', '正在验证API配置...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateApi',
        data: config
      });

      if (response && response.success) {
        showValidationResult('success', `验证成功！已连接到 ${response.data.model || config.model || '默认模型'}`);
      } else {
        showValidationResult('error', `验证失败：${response?.error || '未知错误'}`);
      }
    } catch (error) {
      showValidationResult('error', `验证失败：${error.message}`);
    }
  }

  /**
   * 处理帮助点击
   */
  function handleHelp(e) {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/kelvinzhao/essay-analyzer-extension#readme'
    });
  }

  /**
   * 设置状态
   */
  function setStatus(status, text) {
    elements.statusDot.className = 'status-dot ' + status;
    elements.statusText.textContent = text;
  }

  /**
   * 显示提示
   */
  function showTip(text) {
    elements.tipText.textContent = text;
    elements.quickTip.style.display = 'flex';
  }

  /**
   * 显示消息提示
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * 显示验证结果（使用toast）
   */
  function showValidationResult(status, message) {
    const type = status === 'success' ? 'success' : status === 'error' ? 'error' : 'info';
    showToast(message, type);
  }

  /**
   * 截断文本
   */
  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // 页面加载时初始化
  document.addEventListener('DOMContentLoaded', init);
})();
