# 图标说明

## 当前状态

目前只有 SVG 格式的源图标文件 `icon.svg`。

## 如何生成 PNG 图标

Chrome 扩展需要以下尺寸的 PNG 图标：
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

### 方法一：使用在线工具

1. 访问 https://cloudconvert.com/svg-to-png
2. 上传 `icon.svg`
3. 分别设置尺寸为 16、48、128
4. 下载并重命名

### 方法二：使用 ImageMagick

```bash
# 安装 ImageMagick 后
magick convert -background none -resize 16x16 icon.svg icon16.png
magick convert -background none -resize 48x48 icon.svg icon48.png
magick convert -background none -resize 128x128 icon.svg icon128.png
```

### 方法三：使用 Figma/Sketch

1. 导入 `icon.svg`
2. 导出时选择多个尺寸
3. 格式选择 PNG

## 临时方案

在图标准备好之前，扩展仍然可以正常工作，只是在工具栏和扩展管理页面会显示默认图标。
