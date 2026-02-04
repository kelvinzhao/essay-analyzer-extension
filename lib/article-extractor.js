/**
 * 文章提取器
 * 从网页中智能提取文章正文内容
 */

class ArticleExtractor {
  constructor() {
    // 常见的文章容器选择器（按优先级排序）
    this.selectors = [
      // 微信公众号
      '#js_content',
      // Telegraph
      'article',
      // 知乎
      '.Post-RichText',
      '.RichContent-inner',
      // 通用语义标签
      '[role="main"] article',
      'main article',
      'article',
      // 常见class名
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '.post-body',
      '.article-body',
      // 特定网站
      '.markdown-body',
      '.post-text',
      '.article-detail',
      '.rich-media-content',
    ];

    // 需要移除的无用元素选择器
    this.removeSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      '.advertisement',
      '.ad',
      '.sidebar',
      '.comments',
      '.comment',
      '.social-share',
      '.related-posts',
      '.recommendation',
      'iframe',
      'noscript',
      '.copyright',
      '.author-info',
    ];
  }

  /**
   * 提取当前页面的文章
   * @returns {Object} 包含标题、作者、发布时间、URL、正文的对象
   */
  extract() {
    const url = window.location.href;

    // 提取标题
    const title = this.extractTitle();

    // 提取作者
    const author = this.extractAuthor();

    // 提取发布时间
    const publishDate = this.extractPublishDate();

    // 提取正文
    const content = this.extractContent();

    return {
      title,
      author,
      publishDate,
      url,
      content,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * 提取标题
   */
  extractTitle() {
    // 优先级1: 微信公众号专用
    const wechatTitle = document.querySelector('.rich_media_title');
    if (wechatTitle) {
      return wechatTitle.textContent.trim();
    }

    // 优先级2: h1标签
    const h1 = document.querySelector('h1');
    if (h1) {
      return h1.textContent.trim();
    }

    // 优先级3: og:title meta标签
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      return ogTitle.getAttribute('content');
    }

    // 优先级4: document.title
    return document.title.trim();
  }

  /**
   * 提取作者
   */
  extractAuthor() {
    // 微信公众号
    const wechatAuthor = document.querySelector('.rich_media_meta_text');
    if (wechatAuthor) {
      return wechatAuthor.textContent.trim();
    }

    // 知乎
    const zhihuAuthor = document.querySelector('.AuthorInfo-name');
    if (zhihuAuthor) {
      return zhihuAuthor.textContent.trim();
    }

    // 通用：meta author
    const metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor) {
      return metaAuthor.getAttribute('content');
    }

    // 通用：byline class
    const byline = document.querySelector('.author, .byline, .post-author');
    if (byline) {
      return byline.textContent.trim();
    }

    return '';
  }

  /**
   * 提取发布时间
   */
  extractPublishDate() {
    // meta标签
    const metaDate = document.querySelector('meta[property="article:published_time"], meta[name="date"], meta[name="pubdate"]');
    if (metaDate) {
      return metaDate.getAttribute('content');
    }

    // time元素
    const timeElement = document.querySelector('time[datetime], time[pubdate]');
    if (timeElement) {
      return timeElement.getAttribute('datetime') || timeElement.textContent.trim();
    }

    // 微信公众号
    const wechatDate = document.querySelector('#publish_time, .publish-time');
    if (wechatDate) {
      return wechatDate.textContent.trim();
    }

    return '';
  }

  /**
   * 提取正文内容
   */
  extractContent() {
    let container = this.findArticleContainer();

    if (!container) {
      return this.fallbackExtraction();
    }

    // 克隆节点避免修改原DOM
    const clone = container.cloneNode(true);

    // 清理无用元素
    this.cleanNode(clone);

    // 提取文本并保留段落结构
    return this.formatContent(clone);
  }

  /**
   * 查找文章容器
   */
  findArticleContainer() {
    for (const selector of this.selectors) {
      const element = document.querySelector(selector);
      if (element && this.isValidContent(element)) {
        return element;
      }
    }
    return null;
  }

  /**
   * 验证是否是有效内容
   */
  isValidContent(element) {
    if (!element) return false;

    const text = element.textContent || '';
    const textLength = text.trim().length;

    // 至少200字才算有效文章
    return textLength >= 200;
  }

  /**
   * 清理节点中的无用元素
   */
  cleanNode(node) {
    for (const selector of this.removeSelectors) {
      const elements = node.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    }
  }

  /**
   * 格式化内容，保留段落结构
   */
  formatContent(node) {
    const paragraphs = [];

    // 处理段落
    const pElements = node.querySelectorAll('p');
    if (pElements.length > 3) {
      pElements.forEach(p => {
        const text = this.cleanText(p.textContent);
        if (text) {
          paragraphs.push(text);
        }
      });
      return paragraphs.join('\n\n');
    }

    // 处理div内容
    const divElements = node.querySelectorAll('div');
    if (divElements.length > 0) {
      divElements.forEach(div => {
        const text = this.cleanText(div.textContent);
        // 只有较长的div才作为独立段落
        if (text && text.length > 30) {
          paragraphs.push(text);
        }
      });
      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }
    }

    // 降级：直接获取全部文本
    return this.cleanText(node.textContent);
  }

  /**
   * 清理文本中的多余空白
   */
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * 降级提取方案
   * 当找不到明确容器时使用
   */
  fallbackExtraction() {
    // 尝试获取body中较长的文本块
    const allParagraphs = document.querySelectorAll('p');
    let longestText = '';
    let maxLength = 0;

    allParagraphs.forEach(p => {
      const text = this.cleanText(p.textContent);
      if (text.length > maxLength) {
        maxLength = text.length;
        longestText = text;
      }
    });

    return longestText || document.body.textContent.trim();
  }

  /**
   * 检查页面是否包含可提取的文章
   */
  hasArticle() {
    const container = this.findArticleContainer();
    return container !== null;
  }
}

// 导出为全局变量（供content.js使用）
window.ArticleExtractor = ArticleExtractor;
