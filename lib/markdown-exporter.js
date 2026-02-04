/**
 * Markdown导出器
 * 将分析结果导出为markdown文件
 */

class MarkdownExporter {
  constructor() {
    this.template = `# 范文分析报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 标题 | {TITLE} |
| 作者 | {AUTHOR} |
| URL | {URL} |
| 分析时间 | {TIMESTAMP} |

---

{ANALYSIS_CONTENT}

---

*本报告由【范文拆解器】Chrome扩展自动生成*
`;
  }

  /**
   * 导出分析结果为Markdown文件
   * @param {Object} article - 原始文章信息
   * @param {Object} analysis - AI分析结果
   */
  export(article, analysis) {
    const content = this.generateMarkdown(article, analysis);
    this.downloadFile(content, this.generateFilename(article));
  }

  /**
   * 生成Markdown内容
   */
  generateMarkdown(article, analysis) {
    const timestamp = new Date().toLocaleString('zh-CN');

    return this.template
      .replace('{TITLE}', this.escapeMarkdown(article.title || '未知'))
      .replace('{AUTHOR}', this.escapeMarkdown(article.author || '未知'))
      .replace('{URL}', article.url || window.location.href)
      .replace('{TIMESTAMP}', timestamp)
      .replace('{ANALYSIS_CONTENT}', analysis.raw || analysis);
  }

  /**
   * 生成文件名
   */
  generateFilename(article) {
    const title = (article.title || '范文分析')
      .replace(/[<>:"/\\|?*]/g, '') // 移除非法字符
      .substring(0, 30); // 限制长度

    const date = new Date().toISOString().split('T')[0];
    return `${date}_${title}_分析报告.md`;
  }

  /**
   * 转义Markdown特殊字符
   */
  escapeMarkdown(text) {
    if (!text) return '';
    const escapeChars = ['\\', '`', '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '-', '.', '!'];
    let result = text;
    escapeChars.forEach(char => {
      result = result.replace(new RegExp('\\\\' + char, 'g'), '\\' + char);
    });
    return result;
  }

  /**
   * 下载文件
   * 使用Chrome downloads API
   */
  downloadFile(content, filename) {
    // 创建Blob
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接并触发
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false // 不显示另存为对话框
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        // 降级方案：使用传统下载方式
        this.fallbackDownload(content, filename);
      } else {
        console.log('开始下载，ID:', downloadId);
        // 释放URL对象
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  }

  /**
   * 降级下载方案
   * 当Chrome downloads API不可用时使用
   */
  fallbackDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * 导出为纯文本格式
   */
  exportAsText(article, analysis) {
    const text = this.formatAsText(article, analysis);
    const filename = this.generateFilename(article).replace('.md', '.txt');
    this.downloadFile(text, filename);
  }

  /**
   * 格式化为纯文本
   */
  formatAsText(article, analysis) {
    return `范文分析报告
${'='.repeat(30)}

基本信息
--------
标题: ${article.title || '未知'}
作者: ${article.author || '未知'}
URL: ${article.url || window.location.href}
分析时间: ${new Date().toLocaleString('zh-CN')}

${analysis.raw || analysis}

---
由【范文拆解器】Chrome扩展自动生成
`;
  }

  /**
   * 导出为JSON格式
   */
  exportAsJson(article, analysis) {
    const data = {
      metadata: {
        article: article,
        analyzedAt: new Date().toISOString(),
        tool: '范文拆解器 Chrome扩展'
      },
      analysis: analysis
    };

    const content = JSON.stringify(data, null, 2);
    const filename = this.generateFilename(article).replace('.md', '.json');
    this.downloadFile(content, filename);
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(article, analysis) {
    try {
      const content = this.generateMarkdown(article, analysis);

      await navigator.clipboard.writeText([
        new ClipboardItem({
          'text/markdown': new Blob([content], { type: 'text/markdown' }),
          'text/plain': new Blob([content], { type: 'text/plain' })
        })
      ]);

      return { success: true };
    } catch (error) {
      console.error('复制失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 导出
window.MarkdownExporter = MarkdownExporter;
