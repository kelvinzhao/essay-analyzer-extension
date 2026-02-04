/**
 * 分析器
 * 实现四阶段范文分析流程
 */

class Analyzer {
  constructor() {
    this.analysisPrompt = `请按照以下四阶段流程分析这篇范文，深入解构其写作技法和风格特征：

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

---

请用markdown格式输出分析结果，每个阶段用二级标题（##）分隔，子内容用三级标题（###）或列表格式。保持分析的专业性和可读性。

---
【文章内容】
{CONTENT}

【文章标题】
{TITLE}

【作者】
{AUTHOR}`;

    this.simplePrompt = `请分析这篇范文的结构和写作风格，包括：
1. 文章结构分析
2. 写作风格特点
3. 金句摘录与赏析
4. 可借鉴的写作技巧

---
文章标题：{TITLE}
作者：{AUTHOR}

正文内容：
{CONTENT}`;
  }

  /**
   * 构建完整的分析Prompt
   * @param {Object} article - 文章对象
   * @param {boolean} simple - 是否使用简化版prompt
   * @returns {string} 完整的prompt
   */
  buildPrompt(article, simple = false) {
    const template = simple ? this.simplePrompt : this.analysisPrompt;

    // 截取内容长度以避免超出token限制
    let content = article.content;
    const maxLength = 8000; // 控制输入长度
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n...[内容过长已截取]';
    }

    return template
      .replace('{CONTENT}', content)
      .replace('{TITLE}', article.title || '未知')
      .replace('{AUTHOR}', article.author || '未知');
  }

  /**
   * 解析AI返回的分析结果
   * @param {string} response - AI返回的markdown格式分析
   * @returns {Object} 结构化的分析结果
   */
  parseResponse(response) {
    // 简单的markdown解析，提取各个阶段
    const stages = {
      stage1: this.extractStage(response, '第一阶段', '第二阶段'),
      stage2: this.extractStage(response, '第二阶段', '第三阶段'),
      stage3: this.extractStage(response, '第三阶段', '第四阶段'),
      stage4: this.extractStage(response, '第四阶段', null)
    };

    return {
      raw: response,
      stages,
      metadata: {
        analyzedAt: new Date().toISOString(),
        wordCount: response.length
      }
    };
  }

  /**
   * 提取指定阶段的内容
   */
  extractStage(text, startMarker, endMarker) {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return '';

    let endIdx = endMarker ? text.indexOf(endMarker, startIdx) : text.length;
    if (endIdx === -1) endIdx = text.length;

    return text.substring(startIdx, endIdx).trim();
  }

  /**
   * 生成分析报告的摘要
   */
  generateSummary(analysis) {
    const { stages } = analysis;
    return {
      title: '分析完成',
      stage1Title: this.extractTitle(stages.stage1, '语义解构'),
      stage2Title: this.extractTitle(stages.stage2, '逻辑建模'),
      stage3Title: this.extractTitle(stages.stage3, '金句采样'),
      stage4Title: this.extractTitle(stages.stage4, '风格总结')
    };
  }

  /**
   * 提取阶段标题
   */
  extractTitle(stageText, defaultTitle) {
    const match = stageText.match(/^##+\s*(.+)$/m);
    return match ? match[1] : defaultTitle;
  }

  /**
   * 验证分析结果是否有效
   */
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

// 导出
window.Analyzer = Analyzer;
