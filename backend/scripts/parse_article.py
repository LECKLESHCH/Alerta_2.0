import json
import sys
import warnings
from datetime import date, datetime

import requests
import trafilatura
from bs4 import BeautifulSoup

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
}


def parse_date_string(value):
    if not value:
        return None

    try:
        parsed_date = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed_date.isoformat()
    except ValueError:
        pass

    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            parsed_date = datetime.strptime(value, fmt)
            return parsed_date.isoformat()
        except ValueError:
            continue

    current_year = date.today().year
    formats_to_try = [
        f"%B %d, {current_year}",
        f"%d %B, {current_year}",
        f"%b %d, {current_year}",
        f"%d %b, {current_year}",
    ]
    for fmt in formats_to_try:
        try:
            parsed_date = datetime.strptime(value, fmt)
            return parsed_date.isoformat()
        except ValueError:
            continue

    return value


def extract_with_trafilatura(url):
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return None

    extracted = trafilatura.extract(
        downloaded,
        include_links=False,
        include_comments=False,
        include_images=False,
        date_extraction_params={"extensive_search": True},
    )
    if not extracted:
        return None

    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning)
        metadata = trafilatura.extract_metadata(downloaded)

    return {
        "title": metadata.title if metadata and metadata.title else "",
        "text": extracted,
        "publishedAt": parse_date_string(metadata.date if metadata else None)
        or datetime.now().isoformat(),
        "author": metadata.author if metadata and metadata.author else "",
        "url": url,
    }


def select_article_container(soup):
    selectors = [
        "article",
        "[itemprop='articleBody']",
        ".article-content",
        ".article-body",
        ".entry-content",
        ".post-content",
        ".td-post-content",
        ".main-content",
        ".c-article__content",
        ".single-post-content",
    ]
    for selector in selectors:
        node = soup.select_one(selector)
        if node:
            return node
    return None


def extract_text_from_container(container):
    for tag in container.select(
        "script, style, noscript, form, nav, header, footer, aside, "
        ".advertisement, .ads, .social-share, .related-posts"
    ):
        tag.decompose()

    chunks = []
    for node in container.select("p, li, h2, h3, h4"):
        text = node.get_text(" ", strip=True)
        if text:
            chunks.append(text)

    if not chunks:
        raw = container.get_text("\n", strip=True)
        if raw:
            chunks = [line.strip() for line in raw.splitlines() if line.strip()]

    return "\n".join(chunks).strip()


def extract_with_requests(url):
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"

    soup = BeautifulSoup(response.text, "lxml")
    title = ""

    meta_title = soup.find("meta", attrs={"property": "og:title"})
    if meta_title and meta_title.get("content"):
        title = meta_title["content"].strip()
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()
    else:
        h1 = soup.find("h1")
        title = h1.get_text(" ", strip=True) if h1 else ""

    published_at = None
    for attrs in (
        {"property": "article:published_time"},
        {"name": "article:published_time"},
        {"name": "pubdate"},
        {"name": "date"},
    ):
        node = soup.find("meta", attrs=attrs)
        if node and node.get("content"):
            published_at = parse_date_string(node["content"].strip())
            if published_at:
                break

    author = ""
    for attrs in (
        {"name": "author"},
        {"property": "author"},
    ):
        node = soup.find("meta", attrs=attrs)
        if node and node.get("content"):
            author = node["content"].strip()
            break

    container = select_article_container(soup)
    if not container:
        raise ValueError("Failed to locate article container")

    text = extract_text_from_container(container)
    if not text:
        raise ValueError("Failed to extract article text")

    return {
        "title": title,
        "text": text,
        "publishedAt": published_at or datetime.now().isoformat(),
        "author": author,
        "url": url,
    }


def parse_article(url):
    try:
        result = extract_with_trafilatura(url)
        if result is None:
            result = extract_with_requests(url)

        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        error_result = {
            "error": str(exc),
            "url": url,
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}, ensure_ascii=False))
        sys.exit(1)

    parse_article(sys.argv[1])
