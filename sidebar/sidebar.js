/**
 * Sidebar 脚本
 * 展示分析结果，处理用户交互
 */

(function() {
  'use strict';

  // DOM元素
  const elements = {
    mainContent: document.getElementById('mainContent'),
    emptyState: document.getElementById('emptyState'),
    analyzingState: document.getElementById('analyzingState'),
    errorState: document.getElementById('errorState'),
    resultState: document.getElementById('resultState'),
    articleTitle: document.getElementById('articleTitle'),
    articleAuthor: document.getElementById('articleAuthor'),
    articleWordCount: document.getElementById('articleWordCount'),
    articleUrl: document.getElementById('articleUrl'),
    analysisContent: document.getElementById('analysisContent'),
    errorMessage: document.getElementById('errorMessage'),
    statusText: document.getElementById('statusText'),
    btnStart: document.getElementById('btnStart'),
    btnRetry: document.getElementById('btnRetry'),
    btnExport: document.getElementById('btnExport'),
    btnNewAnalysis: document.getElementById('btnNewAnalysis')
  };

  // 状态
  let currentState = {
    currentArticle: null,
    currentAnalysis: null
  };

  /**
   * 初始化
   */
  function init() {
    bindEvents();
    listenToMessages();
    showState('empty');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    elements.btnStart.addEventListener('click', handleStart);
    elements.btnRetry.addEventListener('click', handleStart);
    elements.btnExport.addEventListener('click', handleExport);
    elements.btnNewAnalysis.addEventListener('click', handleStart);

    // 点击阶段标题展开/折叠
    elements.analysisContent.addEventListener('click', (e) => {
      const header = e.target.closest('.stage-header');
      if (header) {
        const card = header.closest('.stage-card');
        card.classList.toggle('expanded');
      }
    });
  }

  /**
   * 监听来自background的消息
   */
  function listenToMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.target !== 'sidebar') return;

      handleBackgroundMessage(message);
      sendResponse({ received: true });
      return true;
    });
  }

  /**
   * 处理background消息
   */
  function handleBackgroundMessage(message) {
    const { action, data } = message;

    switch (action) {
      case 'startAnalysis':
        handleStart();
        break;

      case 'analysisStarted':
        onAnalysisStarted(data);
        break;

      case 'analysisProgress':
        onAnalysisProgress(data);
        break;

      case 'analysisCompleted':
        onAnalysisCompleted(data);
        break;

      case 'analysisError':
        onAnalysisError(data);
        break;

      case 'pageDetected':
        onPageDetected(data);
        break;

      case 'exportRequested':
        // 执行导出
        currentState.currentArticle = data.article;
        currentState.currentAnalysis = data.analysis;
        handleExport();
        break;
    }
  }

  /**
   * 开始分析
   */
  async function handleStart() {
    try {
      console.log('[Sidebar] handleStart 开始');

      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        showError('无法获取当前页面');
        return;
      }

      console.log('[Sidebar] 当前标签页:', tab.url);

      showState('analyzing');
      // 初始化步骤状态
      initProgressSteps();
      updateProgressStep(1, 'loading');
      updateStatus('正在提取文章内容...');

      // 提取文章（添加超时保护）
      console.log('[Sidebar] 开始提取文章');

      const extractResponse = await Promise.race([
        chrome.tabs.sendMessage(tab.id, {
          action: 'extractArticle'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('提取文章超时（10秒）')), 10000)
        )
      ]);

      console.log('[Sidebar] 收到提取响应:', extractResponse);

      if (!extractResponse || !extractResponse.success) {
        showError(extractResponse?.error || '提取文章失败');
        return;
      }

      console.log('[Sidebar] 文章提取成功', {
        title: extractResponse.article?.title,
        contentLength: extractResponse.article?.content?.length
      });

      currentState.currentArticle = extractResponse.article;
      updateProgressStep(1, 'completed');
      updateStatus('文章提取完成，准备分析...');

      // 发送分析请求到background（background会发送step=2的进度通知）
      console.log('[Sidebar] 发送分析请求到background');
      await chrome.runtime.sendMessage({
        action: 'analyzeArticle',
        data: {
          article: extractResponse.article,
          simple: false
        }
      });

      console.log('[Sidebar] 分析请求已发送');

    } catch (error) {
      console.error('[Sidebar] 启动分析失败:', error);
      showError(error.message || '启动分析失败，请重试');
    }
  }

  /**
   * 初始化进度步骤
   */
  function initProgressSteps() {
    for (let i = 1; i <= 5; i++) {
      const step = document.getElementById(`step${i}`);
      if (step) {
        step.className = 'step-item';
        step.querySelector('.step-pending').style.display = '';
        step.querySelector('.step-done').style.display = 'none';
        step.querySelector('.step-loading').style.display = 'none';
      }
    }
  }

  /**
   * 更新进度步骤
   */
  function updateProgressStep(stepNumber, status) {
    const step = document.getElementById(`step${stepNumber}`);
    if (!step) return;

    // 重置该步骤所有图标
    step.querySelector('.step-pending').style.display = 'none';
    step.querySelector('.step-done').style.display = 'none';
    step.querySelector('.step-loading').style.display = 'none';

    // 移除所有状态类
    step.classList.remove('active', 'completed');

    if (status === 'loading') {
      step.classList.add('active');
      step.querySelector('.step-loading').style.display = '';
    } else if (status === 'completed') {
      step.classList.add('completed');
      step.querySelector('.step-done').style.display = '';
    } else {
      step.querySelector('.step-pending').style.display = '';
    }
  }

  /**
   * 分析开始回调
   */
  function onAnalysisStarted(data) {
    console.log('[Sidebar] onAnalysisStarted', data);
    showState('analyzing');
    // 不重置步骤，因为handleStart已经初始化过了
    // 只需要确保处于analyzing状态
    updateStatus(`正在分析: ${data.title}`);
  }

  /**
   * 分析进度更新
   */
  function onAnalysisProgress(data) {
    console.log('[Sidebar] onAnalysisProgress', data);
    const { step } = data;

    // 完成之前的步骤
    for (let i = 1; i < step; i++) {
      updateProgressStep(i, 'completed');
    }
    // 当前步骤设为loading
    updateProgressStep(step, 'loading');

    // 更新状态文本
    const stepTitles = ['', '提取文章内容', '构建分析Prompt', '调用AI分析', '解析分析结果', '完成'];
    updateStatus(stepTitles[step] || '分析中...');
  }

  /**
   * 分析完成回调
   */
  function onAnalysisCompleted(data) {
    console.log('[Sidebar] onAnalysisCompleted', {
      hasArticle: !!data.article,
      hasAnalysis: !!data.analysis
    });

    currentState.currentArticle = data.article;
    currentState.currentAnalysis = data.analysis;

    // 完成所有步骤
    for (let i = 1; i <= 5; i++) {
      updateProgressStep(i, 'completed');
    }

    renderArticleInfo(data.article);
    renderAnalysis(data.rawResult || data.analysis);
    showState('result');
    updateStatus('分析完成');
  }

  /**
   * 分析错误回调
   */
  function onAnalysisError(data) {
    showError(data.error || '分析失败，请重试');
  }

  /**
   * 页面检测回调
   */
  function onPageDetected(data) {
    if (data.hasArticle) {
      updateStatus(`检测到文章: ${data.title}`);
    }
  }

  /**
   * 渲染文章信息
   */
  function renderArticleInfo(article) {
    elements.articleTitle.textContent = article.title || '未知标题';
    elements.articleAuthor.textContent = `作者: ${article.author || '未知'}`;
    elements.articleWordCount.textContent = `字数: ${article.wordCount || 0}`;
    elements.articleUrl.href = article.url || '#';
  }

  /**
   * 渲染分析结果
   */
  function renderAnalysis(analysisText) {
    elements.analysisContent.innerHTML = '';

    // 解析各个阶段
    const stages = parseStages(analysisText);

    if (stages.length === 0) {
      // 如果无法解析阶段，直接显示原始内容
      elements.analysisContent.innerHTML = `
        <div class="stage-card expanded">
          <div class="stage-content" style="max-height: none;">
            <div class="stage-body markdown-content">
              ${formatMarkdown(analysisText)}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 创建阶段卡片
    const stageTitles = ['语义解构', '逻辑建模', '金句采样', '风格总结', '适合哪些题材'];

    stages.forEach((stage, index) => {
      const card = createStageCard(index + 1, stageTitles[index] || `阶段${index + 1}`, stage);
      elements.analysisContent.appendChild(card);
    });

    // 默认展开第一个阶段
    const firstCard = elements.analysisContent.querySelector('.stage-card');
    if (firstCard) {
      firstCard.classList.add('expanded');
    }
  }

  /**
   * 解析分析结果的各个阶段
   */
  function parseStages(text) {
    const stages = [];
    const lines = text.split('\n');
    let currentStage = [];
    let inStage = false;

    for (const line of lines) {
      // 检测阶段标题（## 第一阶段到第五阶段）
      if (line.match(/^##\s*第?[一二三四五1-5]?\s*阶段/)) {
        if (inStage) {
          stages.push(currentStage.join('\n'));
        }
        currentStage = [line];
        inStage = true;
      } else if (line.match(/^##\s*语义解构/)) {
        if (inStage) {
          stages.push(currentStage.join('\n'));
        }
        currentStage = [line];
        inStage = true;
      } else if (line.match(/^##\s*逻辑建模/)) {
        if (inStage) {
          stages.push(currentStage.join('\n'));
        }
        currentStage = [line];
        inStage = true;
      } else if (line.match(/^##\s*金句采样/)) {
        if (inStage) {
          stages.push(currentStage.join('\n'));
        }
        currentStage = [line];
        inStage = true;
      } else if (line.match(/^##\s*风格总结/)) {
        if (inStage) {
          stages.push(currentStage.join('\n'));
        }
        currentStage = [line];
        inStage = true;
      } else if (line.match(/^##\s*适合哪些题材/)) {
        if (inStage) {
          stages.push(currentStage.join('\n'));
        }
        currentStage = [line];
        inStage = true;
      } else if (inStage) {
        currentStage.push(line);
      }
    }

    if (currentStage.length > 0) {
      stages.push(currentStage.join('\n'));
    }

    return stages.filter(s => s.trim().length > 0);
  }

  /**
   * 创建阶段卡片
   */
  function createStageCard(number, title, content) {
    const card = document.createElement('div');
    card.className = 'stage-card';

    card.innerHTML = `
      <div class="stage-header">
        <span class="stage-title">
          <span class="stage-number">${number}</span>
          ${escapeHtml(title)}
        </span>
        <svg class="stage-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <div class="stage-content">
        <div class="stage-body markdown-content">
          ${formatMarkdown(content)}
        </div>
      </div>
    `;

    return card;
  }

  /**
   * 格式化Markdown内容为HTML
   */
  function formatMarkdown(text) {
    if (!text) return '';

    const lines = text.split('\n');
    const result = [];
    let inUl = false;
    let inOl = false;
    let inBlockquote = false;

    for (let line of lines) {
      const trimmed = line.trim();

      // 空行
      if (!trimmed) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
        continue;
      }

      // 引用 >
      if (trimmed.startsWith('>')) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (!inBlockquote) { result.push('<blockquote>'); inBlockquote = true; }
        // 引用中：粗体转为斜体
        const content = trimmed.slice(1).trim();
        const formatted = formatInline(content, true); // true 表示在引用中
        result.push('<p>' + formatted + '</p>');
        continue;
      }

      // 标题
      if (trimmed.startsWith('###')) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
        result.push('<h3>' + escapeHtml(trimmed.slice(3).trim()) + '</h3>');
        continue;
      }
      if (trimmed.startsWith('##')) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
        result.push('<h2>' + escapeHtml(trimmed.slice(2).trim()) + '</h2>');
        continue;
      }

      // 无序列表
      if (trimmed.match(/^[\*\-]\s+/)) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
        if (!inUl) { result.push('<ul>'); inUl = true; }
        result.push('<li>' + formatInline(trimmed.replace(/^[\*\-]\s+/, '')) + '</li>');
        continue;
      }

      // 有序列表
      if (trimmed.match(/^\d+\.\s+/)) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
        if (!inOl) { result.push('<ol>'); inOl = true; }
        result.push('<li>' + formatInline(trimmed.replace(/^\d+\.\s+/, '')) + '</li>');
        continue;
      }

      // 普通段落
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
      result.push('<p>' + formatInline(trimmed) + '</p>');
    }

    // 关闭未闭合的标签
    if (inUl) result.push('</ul>');
    if (inOl) result.push('</ol>');
    if (inBlockquote) result.push('</blockquote>');

    return result.join('');
  }

  /**
   * 格式化行内元素（粗体、代码、链接）
   * @param {string} text - 要格式化的文本
   * @param {boolean} inBlockquote - 是否在引用中（引用中粗体转斜体）
   */
  function formatInline(text, inBlockquote = false) {
    let html = escapeHtml(text);

    if (inBlockquote) {
      // 引用中：粗体转为斜体
      html = html.replace(/\*\*(.+?)\*\*/g, '<em>$1</em>');
    } else {
      // 普通文本：保持粗体
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }

    // 代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    return html;
  }

  /**
   * 转义HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 处理导出
   */
  async function handleExport() {
    console.log('[Sidebar] handleExport 开始', {
      hasArticle: !!currentState.currentArticle,
      hasAnalysis: !!currentState.currentAnalysis,
      hasRaw: !!currentState.currentAnalysis?.raw
    });

    if (!currentState.currentArticle || !currentState.currentAnalysis) {
      showToast('没有可导出的分析结果', 'error');
      return;
    }

    try {
      // 创建markdown内容
      const markdown = generateMarkdownExport();
      console.log('[Sidebar] markdown 长度:', markdown.length);

      // 使用downloads API下载
      const filename = generateFilename();
      console.log('[Sidebar] 文件名:', filename);

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const downloadId = await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      });

      console.log('[Sidebar] 下载ID:', downloadId);
      showToast('导出成功', 'success');

      // 释放URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (error) {
      console.error('[Sidebar] 导出失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  /**
   * 生成Markdown导出内容
   */
  function generateMarkdownExport() {
    const article = currentState.currentArticle;
    const analysis = currentState.currentAnalysis;

    const timestamp = new Date().toLocaleString('zh-CN');
    const date = new Date().toISOString().split('T')[0];

    return `---
title: ${article.title || '未知'}
author: ${article.author || '未知'}
url: ${article.url || ''}
analyzed_at: ${timestamp}
---

# 范文分析报告

${analysis.raw || ''}

---

*本报告由【范文拆解器】Chrome扩展自动生成*
`;
  }

  /**
   * 生成文件名
   */
  function generateFilename() {
    const title = (currentState.currentArticle?.title || '范文分析')
      .replace(/[<>:"/\\|?*]/g, '')
      .substring(0, 30);

    const date = new Date().toISOString().split('T')[0];
    return `${date}_${title}_分析报告.md`;
  }

  /**
   * 显示指定状态
   */
  function showState(state) {
    elements.emptyState.style.display = state === 'empty' ? 'flex' : 'none';
    elements.analyzingState.style.display = state === 'analyzing' ? 'flex' : 'none';
    elements.errorState.style.display = state === 'error' ? 'flex' : 'none';
    elements.resultState.style.display = state === 'result' ? 'block' : 'none';

    // 更新导出按钮状态
    elements.btnExport.disabled = state !== 'result';
  }

  /**
   * 显示错误
   */
  function showError(message) {
    elements.errorMessage.textContent = message;
    showState('error');
    updateStatus('错误: ' + message);
  }

  /**
   * 更新状态栏
   */
  function updateStatus(text) {
    elements.statusText.textContent = text;
  }

  /**
   * 显示消息提示
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 16px;
      background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--error-color)' : '#333'};
      color: white;
      border-radius: 6px;
      font-size: 13px;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 100;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // 初始化
  init();
})();
