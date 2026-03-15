import re
import argparse
from urllib.parse import urlparse, urlunparse
from pathlib import Path

def process_markdown_links(content: str) -> str:
    # Regex to match markdown links: [text](url) or [text](url "title")
    # (?<!\!) ensures we don't match image tags like ![alt](url)
    link_pattern = re.compile(r'(?<!\!)\[(.*?)\]\((.*?)\)')

    def replace_link(match):
        link_text = match.group(1)
        full_url_content = match.group(2)

        # Handle optional titles in markdown links e.g., [text](/path "My Title")
        parts = full_url_content.split(maxsplit=1)
        actual_url = parts[0]
        title = f" {parts[1]}" if len(parts) > 1 else ""

        parsed = urlparse(actual_url)

        # 1. Skip external links, mailto, tel, ftp
        if parsed.scheme in ['http', 'https', 'mailto', 'tel', 'ftp'] or actual_url.startswith('//'):
            return match.group(0)

        # 2. Skip empty paths (e.g., anchor-only links like "#section")
        if not parsed.path:
            return match.group(0)

        # 3. Skip paths that already end with a slash
        if parsed.path.endswith('/'):
            return match.group(0)

        # 4. Skip files with extensions (e.g., .md, .png, .pdf)
        if '.' in parsed.path.split('/')[-1]:
            return match.group(0)

        # Add the trailing slash to the path component
        new_path = parsed.path + '/'

        # Reconstruct the URL safely keeping queries (?foo=bar) and fragments (#anchor) intact
        new_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            new_path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))

        return f"[{link_text}]({new_url}{title})"

    # Apply the replacement function to all matches in the file content
    return link_pattern.sub(replace_link, content)


def process_directory(directory_path: str):
    base_dir = Path(directory_path)
    
    if not base_dir.is_dir():
        print(f"Error: The directory '{directory_path}' does not exist.")
        return

    modified_files_count = 0

    # Recursively find all .md files in the folder
    for filepath in base_dir.rglob("*.md"):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                original_content = f.read()

            new_content = process_markdown_links(original_content)

            # Only write back if changes were actually made
            if original_content != new_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated: {filepath}")
                modified_files_count += 1
                
        except Exception as e:
            print(f"Failed to process {filepath}: {e}")

    print(f"\nDone! Updated {modified_files_count} file(s).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add trailing slashes to internal markdown links.")
    parser.add_argument("directory", help="Path to the folder containing your markdown files.")
    
    args = parser.parse_args()
    process_directory(args.directory)