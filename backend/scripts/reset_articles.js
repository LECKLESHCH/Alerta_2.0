#!/usr/bin/env node

const mongoose = require('mongoose');
const { QdrantClient } = require('@qdrant/js-client-rest');

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/alerta';
const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333';

async function main() {
  await mongoose.connect(MONGO_URI);
  const articleCollection = mongoose.connection.collection('articles');
  const result = await articleCollection.deleteMany({});

  const qdrant = new QdrantClient({ url: QDRANT_URL });
  try {
    await qdrant.deleteCollection('articles');
  } catch {}
  await qdrant.createCollection('articles', {
    vectors: { size: 1536, distance: 'Cosine' },
  });

  console.log(
    JSON.stringify(
      {
        deletedArticles: result.deletedCount || 0,
        resetQdrantCollection: true,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
