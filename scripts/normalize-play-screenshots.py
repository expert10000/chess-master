"""Keep Play captures at the recommended 1080 x 1920, without overlays."""

from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent / 'play-listing'
for path in sorted(root.glob('0?-*.png')):
    with Image.open(path) as source:
        width, height = source.size
        if abs(width - 1080) > 4 or abs(height - 1920) > 4:
            raise ValueError(f'{path.name}: unexpected capture size {width}x{height}')
        left = (width - 1080) // 2
        top = (height - 1920) // 2
        source.crop((left, top, left + 1080, top + 1920)).convert('RGB').save(path)
        print(f'{path.name}: 1080x1920 RGB')
