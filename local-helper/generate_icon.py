from PIL import Image, ImageDraw
import os

def create_icon():
    os.makedirs('assets', exist_ok=True)
    
    img_size = 256
    image = Image.new('RGBA', (img_size, img_size), color=(0, 0, 0, 0))
    dc = ImageDraw.Draw(image)
    
    # Instagram gradient approx (simple circle for now)
    dc.ellipse([16, 16, 240, 240], fill=(225, 48, 108))
    
    # Download arrow
    # center is 128,128
    dc.polygon([(96, 64), (160, 64), (160, 144), (192, 144), (128, 208), (64, 144), (96, 144)], fill="white")
    
    image.save('assets/icon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48), (256,256)])
    print("Icon generated successfully.")

if __name__ == '__main__':
    create_icon()
