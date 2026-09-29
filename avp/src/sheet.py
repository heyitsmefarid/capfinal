# Tile preview JPEGs into 2x2 sheets for quick review: python sheet.py dir out_prefix
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
d, pre = sys.argv[1], sys.argv[2]
files = sys.argv[3:] or sorted(glob.glob(os.path.join(d, '*.jpg')))
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
for k in range(0, len(files), 4):
    s = Image.new('RGB', (1920, 1080), 'black'); dr = ImageDraw.Draw(s)
    for j, f in enumerate(files[k:k + 4]):
        im = Image.open(f if os.path.exists(f) else os.path.join(d, f)).resize((958, 538))
        x, y = (j % 2) * 962, (j // 2) * 542
        s.paste(im, (x, y)); dr.text((x + 8, y + 6), os.path.basename(f), fill='yellow', font=font)
    s.save(f'{pre}_{k // 4}.jpg', quality=85)
