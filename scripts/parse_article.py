import sys
import json
import trafilatura
from datetime import datetime

def parse_article(url):
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            # Используем trafilatura для извлечения содержимого
            extracted = trafilatura.extract(downloaded, \
                                            include_links=False, \
                                            include_comments=False, \
                                            include_images=False, \
                                            date_extraction_params={"extensive_search": True})
            
            if extracted:
                # trafilatura.extract возвращает строку или None. 
                # Для получения метаданных нужно использовать extract_metadata
                metadata = trafilatura.extract_metadata(downloaded)

                title = metadata.title if metadata and metadata.title else ''
                text = extracted # trafilatura.extract уже возвращает чистый текст
                published_at = metadata.date if metadata and metadata.date else None
                author = metadata.author if metadata and metadata.author else ''

                result = {
                    'title': title,
                    'text': text,
                    'publishedAt': published_at,
                    'author': author,
                    'url': url
                }
                print(json.dumps(result, ensure_ascii=False))
            else:
                print(json.dumps({'error': 'Failed to extract content with Trafilatura', 'url': url}, ensure_ascii=False))
                sys.exit(1)
        else:
            print(json.dumps({'error': 'Failed to download content with Trafilatura', 'url': url}, ensure_ascii=False))
            sys.exit(1)
            
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
