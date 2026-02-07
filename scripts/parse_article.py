import sys
import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime

def parse_article(url):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Title
        title = soup.find('h1').get_text(strip=True) if soup.find('h1') else ''
        if not title:
            title = soup.title.get_text(strip=True) if soup.title else ''
            
        # Text
        paragraphs = soup.find_all('p')
        text = ' '.join([p.get_text(strip=True) for p in paragraphs])
        
        # Date
        published_at = None
        # Try to find date in meta tags
        date_meta = soup.find('meta', {'property': 'article:published_time'}) or \
                   soup.find('meta', {'name': 'date'}) or \
                   soup.find('meta', {'name': 'pubdate'})
                   
        if date_meta and date_meta.get('content'):
            published_at = date_meta['content']
            
        # Author
        author = ''
        author_meta = soup.find('meta', {'name': 'author'}) or \
                     soup.find('meta', {'property': 'article:author'})
        if author_meta and author_meta.get('content'):
            author = author_meta['content']

        result = {
            'title': title,
            'text': text,
            'publishedAt': published_at,
            'author': author,
            'url': url
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'url': url
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No URL provided'}, ensure_ascii=False))
        sys.exit(1)
        
    url = sys.argv[1]
    parse_article(url)
