#!/usr/bin/env python3
"""
Script to verify that French/English tag page language switcher links are consistent.

For each tag on /fr/tags/:
1. Visit the French tag page
2. Find the "Switch to English" link
3. Visit the English tag page
4. Find the "Passer en Français" link
5. Check it points back to the original French tag page
"""

import sys
from urllib.parse import unquote, urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "http://localhost:4321"


def get_soup(url: str) -> BeautifulSoup:
    """Fetch a URL and return a BeautifulSoup object."""
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return BeautifulSoup(resp.text, "html.parser")


def get_all_tag_links(soup: BeautifulSoup) -> list[str]:
    """Extract all tag links (hrefs starting with /fr/tag/) from the tags page."""
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/fr/tag/"):
            links.append(href)
    return links


def main() -> None:
    print(f"Fetching tags page: {BASE_URL}/fr/tags/")
    soup = get_soup(f"{BASE_URL}/fr/tags/")
    tag_links = get_all_tag_links(soup)

    if not tag_links:
        print("No tag links found!")
        sys.exit(1)

    print(f"Found {len(tag_links)} tag link(s)\n")

    passed = 0
    failed = 0
    errors = 0

    for fr_link in tag_links:
        fr_url = urljoin(BASE_URL, fr_link)
        print(f"--- Checking: {fr_link}")

        # Step 1: Visit the French tag page
        try:
            fr_soup = get_soup(fr_url)
        except Exception as e:
            print(f"  ✗ Error fetching French page {fr_url}: {e}\n")
            errors += 1
            continue

        # Step 2: Find the "Switch to English" link
        en_anchor = fr_soup.find("a", title="Switch to English")
        if not en_anchor or not en_anchor.get("href"):
            print(f"  ✗ No 'Switch to English' link found on {fr_url}\n")
            errors += 1
            continue

        en_link = en_anchor["href"]
        en_url = urljoin(BASE_URL, en_link)
        print(f"  → Switch to English: {en_link}")

        # Step 3: Visit the English tag page
        try:
            en_soup = get_soup(en_url)
        except Exception as e:
            print(f"  ✗ Error fetching English page {en_url}: {e}\n")
            errors += 1
            continue

        # Step 4: Find the "Passer en Français" link
        fr_anchor = en_soup.find("a", title="Passer en Français")
        if not fr_anchor or not fr_anchor.get("href"):
            print(f"  ✗ No 'Passer en Français' link found on {en_url}\n")
            errors += 1
            continue

        back_link = fr_anchor["href"]
        print(f"  ← Passer en Français: {back_link}")

        # Step 5: Compare (normalize URL encoding for fair comparison)
        if unquote(back_link) == unquote(fr_link):
            print(f"  ✓ PASS: round-trip is consistent\n")
            passed += 1
        else:
            print(f"  ✗ FAIL: expected {fr_link}, got {back_link}\n")
            failed += 1

    # Summary
    print("=" * 50)
    print(f"Results: {passed} passed, {failed} failed, {errors} errors")
    print("=" * 50)

    if failed > 0 or errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
