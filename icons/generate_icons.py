"""
生成Chrome扩展图标
使用PIL库创建PNG图标
"""

from PIL import Image, ImageDraw
import os

def create_icon(size, filename):
    """创建指定尺寸的图标"""
    # 创建图像
    img = Image.new('RGBA', (size, size), (37, 99, 235, 255))  # 蓝色背景
    draw = ImageDraw.Draw(img)

    # 计算缩放比例
    scale = size / 128

    # 绘制书本（白色）
    book_color = (255, 255, 255, 230)

    # 左书页
    draw.rounded_rectangle(
        [int(30*scale), int(34*scale), int(56*scale), int(94*scale)],
        radius=int(4*scale),
        fill=book_color
    )

    # 右书页
    draw.rounded_rectangle(
        [int(72*scale), int(34*scale), int(98*scale), int(94*scale)],
        radius=int(4*scale),
        fill=book_color
    )

    # 左书页线条
    line_color = (37, 99, 235, 255)
    line_width = max(1, int(3*scale))

    for y in [50, 60, 70]:
        draw.line(
            [int(42*scale), int(y*scale), int(50*scale), int(y*scale)],
            fill=line_color,
            width=line_width
        )

    # 右书页线条
    for y in [50, 60, 70]:
        draw.line(
            [int(78*scale), int(y*scale), int(86*scale), int(y*scale)],
            fill=line_color,
            width=line_width
        )

    # 放大镜
    lens_radius = int(14 * scale)
    lens_width = max(1, int(4 * scale))
    center = (int(64 * scale), int(64 * scale))

    # 镜框
    draw.ellipse(
        [center[0] - lens_radius, center[1] - lens_radius,
         center[0] + lens_radius, center[1] + lens_radius],
        outline=(255, 255, 255, 255),
        width=lens_width
    )

    # 镜柄
    draw.line(
        [int(74*scale), int(74*scale), int(82*scale), int(82*scale)],
        fill=(255, 255, 255, 255),
        width=lens_width
    )

    # 保存
    img.save(filename, 'PNG')
    print(f"已生成: {filename}")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # 生成三种尺寸的图标
    create_icon(16, os.path.join(script_dir, 'icon16.png'))
    create_icon(48, os.path.join(script_dir, 'icon48.png'))
    create_icon(128, os.path.join(script_dir, 'icon128.png'))

    print("\n所有图标生成完成！")
