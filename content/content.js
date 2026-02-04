/**
 * Content Script
 * 在网页中注入，负责提取文章内容
 */

(function() {
  'use strict';

  let extractor = null;

  // 初始化
  function init() {
    console.log('[范文拆解器 Content] init 开始');

    if (window.ArticleExtractor) {
      extractor = new window.ArticleExtractor();
      console.log('[范文拆解器 Content] ArticleExtractor 已初始化');
    } else {
      console.error('[范文拆解器 Content] ArticleExtractor 未找到！');
    }

    // 监听来自popup/background的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[范文拆解器 Content] 收到消息:', message);
      handleMessage(message, sendResponse);
      return true; // 保持消息通道开放以支持异步响应
    });

    console.log('[范文拆解器 Content] Content script 已加载');
  }

  /**
   * 处理接收到的消息
   */
  async function handleMessage(message, sendResponse) {
    const { action } = message;
    console.log('[范文拆解器 Content] handleMessage:', action);

    switch (action) {
      case 'checkArticle':
        handleCheckArticle(sendResponse);
        break;

      case 'extractArticle':
        await handleExtractArticle(sendResponse);
        break;

      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  }

  /**
   * 检查当前页面是否包含可提取的文章
   */
  function handleCheckArticle(sendResponse) {
    console.log('[范文拆解器 Content] handleCheckArticle');

    if (!extractor) {
      console.error('[范文拆解器 Content] 提取器未初始化');
      sendResponse({ hasArticle: false, error: '提取器未初始化' });
      return;
    }

    const hasArticle = extractor.hasArticle();
    const title = extractor.extractTitle();

    console.log('[范文拆解器 Content] 检查结果:', { hasArticle, title });

    sendResponse({
      hasArticle,
      title,
      url: window.location.href
    });
  }

  /**
   * 提取当前页面的文章
   */
  async function handleExtractArticle(sendResponse) {
    console.log('[范文拆解器 Content] handleExtractArticle 开始');

    if (!extractor) {
      console.error('[范文拆解器 Content] 提取器未初始化');
      sendResponse({ success: false, error: '提取器未初始化' });
      return true;
    }

    try {
      console.log('[范文拆解器 Content] 开始提取文章...');
      const article = extractor.extract();

      console.log('[范文拆解器 Content] 提取结果:', {
        hasTitle: !!article.title,
        hasAuthor: !!article.author,
        contentLength: article.content?.length || 0,
        title: article.title
      });

      // 验证提取结果
      if (!article.content || article.content.length < 100) {
        console.warn('[范文拆解器 Content] 内容不足，长度:', article.content?.length || 0);
        sendResponse({
          success: false,
          error: '未能提取到足够的文章内容，请尝试其他页面'
        });
        return true;
      }

      console.log('[范文拆解器 Content] 文章提取成功，发送响应');

      const response = {
        success: true,
        article: {
          title: article.title,
          author: article.author,
          publishDate: article.publishDate,
          url: article.url,
          content: article.content,
          wordCount: article.content.length,
          extractedAt: article.extractedAt
        }
      };

      console.log('[范文拆解器 Content] 响应对象:', response);
      sendResponse(response);
      return true;

    } catch (error) {
      console.error('[范文拆解器 Content] 提取失败:', error);
      sendResponse({
        success: false,
        error: error.message || '提取文章时发生错误'
      });
      return true;
    }
  }

  /**
   * 获取页面基本信息（用于快速预检）
   */
  function getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      hasArticle: extractor ? extractor.hasArticle() : false
    };
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 导出页面信息到全局（供调试使用）
  window.__essayAnalyzer = {
    getPageInfo,
    extract: () => extractor ? extractor.extract() : null
  };
})();
