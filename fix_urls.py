import re
from urllib.parse import unquote

def process():
    filepath = "src/pages/[lang]/index.astro"
    with open(filepath, "r") as f:
        html = f.read()

    # Replace /_next/image?url=... with decoded URL for src
    def repl_image(m):
        decoded = unquote(m.group(1))
        return f'src="{decoded}"'
        
    html = re.sub(r'src="/_next/image\?url=([^&"]+)&[^"]+"', repl_image, html)

    # Remove srcSet and sizes parameter
    html = re.sub(r'\s*srcSet="[^"]+"', '', html)
    html = re.sub(r'\s*sizes="[^"]+"', '', html)

    # Replace specific post hrefs with short slugs and append ${lang}
    def repl_href(m):
        link = m.group(1)
        # Skip external or internal assets
        if link.startswith('/_next') or link.startswith('#') or link.startswith('http'):
            return m.group(0)
        
        # We manually map the two known imported articles to their short slugs to avoid 404
        if link == '/data-poisoning-sabotaging-training-datasets-to-corrupt-future-models':
            return 'href={`/${lang}/data-poisoning`}'
        if link == '/the-silent-vulnerability-shadow-ai-and-the-integrity-of-the-software-supply-chain':
            return 'href={`/${lang}/shadow-ai`}'
            
        return f'href={{`/${{lang}}{link}`}}'

    html = re.sub(r'href="(/[^"]+)"', repl_href, html)

    with open(filepath, "w") as f:
        f.write(html)
        
if __name__ == "__main__":
    process()
