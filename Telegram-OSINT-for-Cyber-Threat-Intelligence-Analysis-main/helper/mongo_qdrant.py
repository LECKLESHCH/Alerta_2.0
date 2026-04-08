import logging
import uuid
from datetime import datetime
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from openai import OpenAI
from configs import (
    MONGODB_URI, MONGODB_COLLECTION, 
    QDRANT_URL, QDRANT_COLLECTION, 
    OPENAI_API_KEY, OPENAI_BASE_URL, EMBEDDING_MODEL
)

# Initialize clients
mongo_client = MongoClient(MONGODB_URI)
db = mongo_client.get_database()
collection = db[MONGODB_COLLECTION]

qdrant_client = QdrantClient(url=QDRANT_URL)
openai_client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)

CLASSIFICATION_PROMPT = """
You are a cybersecurity expert. Your task is to classify the provided text.
Return ONLY a JSON object with the following structure:
{
    "type": "news" | "threat",
    "category": "category name" | null,
    "subcategory": "subcategory name" | null,
    "severity": "high" | "medium" | "low" | null,
    "country": "Country Name" | "Global",
    "reasoning": "brief explanation in Russian"
}

Classification rules:
1. "type": 
   - "threat": If the text describes a specific cyber attack, vulnerability, data leak, or malware activity.
   - "news": If it's a general industry update, legal change, or non-specific security advice.

2. "severity": Assess potential impact (high/medium/low). High if large scale breach, critical infra, or active malware. If "news", severity can be null.

3. "country": Identify the country mentioned or where the incident occurred. Use "Global" if no specific country.

4. If type is "threat", use this taxonomy for "category" and "subcategory":
   - "Вредоносное ПО (Malware)": [ransomware, spyware, trojan, botnet]
   - "Фишинг и социальная инженерия (Phishing & Social Engineering)": [phishing, spear-phishing, smishing, vishing, impersonation]
   - "Уязвимости и эксплойты (Vulnerabilities & Exploits)": [zero-day, CVE disclosure, exploit in the wild, misconfiguration]
   - "Утечка данных / Разглашение информации (Data Breach / Information Disclosure)": [leaks, dumps, credential exposure, insider leaks]
   - "Атаки на сеть и инфраструктуру (Network / Infrastructure Attacks)": [DDoS-атака, BGP hijacking, DNS-атаки, scanning campaigns]
   - "Атаки на цепочку поставок (Supply Chain Attacks)": [compromised dependencies, poisoned updates, third-party breach]
   - "Активность APT / Государственных структур (APT / Nation-State Activity)": [espionage, sabotage, influence operations, cyber warfare]
   - "Мошенничество / Финансовые преступления (Fraud / Financial Crime)": [payment fraud, crypto scams, account takeover]
   - "Инциденты безопасности в облаке / SaaS (Cloud / SaaS Security Incidents)": [IAM abuse, cloud misconfig, token leakage]
   - "Физическо-кибернетические / АСУ ТП (Physical-Cyber / ICS)": [SCADA, critical infrastructure, industrial incidents]

If the text is "news", set category and subcategory to null.
Text to classify:
"""

def classify_content(text: str):
    """Classifies the content using OpenAI LLM."""
    try:
        response = openai_client.chat.completions.create(
            model="openai/gpt-4o-mini", # Using a fast model for classification
            messages=[
                {"role": "system", "content": CLASSIFICATION_PROMPT},
                {"role": "user", "content": text[:4000]} # Limit text length
            ],
            response_format={ "type": "json_object" }
        )
        import json
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logging.error(f"Error in classification: {e}")
        return {"type": "news", "category": None, "subcategory": None, "reasoning": "Error occurred during classification"}

def ensure_qdrant_collection():
    """Ensures that the Qdrant collection exists."""
    try:
        collections = qdrant_client.get_collections().collections
        exists = any(c.name == QDRANT_COLLECTION for c in collections)
        if not exists:
            logging.info(f"Creating Qdrant collection: {QDRANT_COLLECTION}")
            qdrant_client.create_collection(
                collection_name=QDRANT_COLLECTION,
                vectors_config=rest.VectorParams(size=1536, distance=rest.Distance.COSINE),
            )
    except Exception as e:
        logging.error(f"Error ensuring Qdrant collection: {e}")

def get_embedding(text: str):
    """Generates embedding for the given text using OpenAI."""
    try:
        # Truncate text to avoid token limits
        truncated_text = text[:8000]
        response = openai_client.embeddings.create(
            input=truncated_text,
            model=EMBEDDING_MODEL
        )
        return response.data[0].embedding
    except Exception as e:
        logging.error(f"Error generating embedding: {e}")
        return None

def save_to_mongo_and_qdrant(article_data: dict):
    """
    Saves article data to MongoDB and its embedding to Qdrant.
    
    article_data format:
    {
        'url': str,
        'source': str,
        'title': str,
        'text': str,
        'publishedAt': datetime
    }
    """
    try:
        # Check if already exists in Mongo
        if collection.find_one({'url': article_data['url']}):
            logging.debug(f"Article already exists in Mongo: {article_data['url']}")
            return False

        # Save to Mongo
        article_data['createdAt'] = datetime.utcnow()
        
        # Classification
        classification = classify_content(f"{article_data['title']}. {article_data['text']}")
        article_data.update({
            'type': classification.get('type', 'news'),
            'category': classification.get('category'),
            'subcategory': classification.get('subcategory'),
            'severity': classification.get('severity'),
            'country': classification.get('country', 'Global'),
            'classification_reasoning': classification.get('reasoning')
        })

        result = collection.insert_one(article_data)
        mongo_id = str(result.inserted_id)
        
        logging.info(f"Saved to Mongo ({article_data['type']}): {article_data['title']} (ID: {mongo_id})")

        # Generate embedding
        text_for_embedding = f"{article_data['title']}. {article_data['text']}"
        vector = get_embedding(text_for_embedding)
        
        if vector:
            # Save to Qdrant
            ensure_qdrant_collection()
            qdrant_id = str(uuid.uuid4())
            qdrant_client.upsert(
                collection_name=QDRANT_COLLECTION,
                points=[
                    rest.PointStruct(
                        id=qdrant_id,
                        vector=vector,
                        payload={
                            'mongo_id': mongo_id,
                            'url': article_data['url'],
                            'source': article_data['source'],
                            'title': article_data['title'],
                            'type': article_data['type'],
                            'category': article_data['category'],
                            'publishedAt': article_data['publishedAt'].isoformat() if isinstance(article_data['publishedAt'], datetime) else article_data['publishedAt']
                        }
                    )
                ]
            )
            logging.info(f"Saved to Qdrant: {article_data['title']}")
            return True
        else:
            logging.warning(f"Failed to generate vector for: {article_data['title']}")
            return True # Still return True because it's in Mongo
            
    except Exception as e:
        logging.error(f"Error in save_to_mongo_and_qdrant: {e}")
        return False
