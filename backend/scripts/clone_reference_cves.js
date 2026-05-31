#!/usr/bin/env node

const mongoose = require('mongoose');

const SOURCE_COLLECTION = 'reference_cves';
const TARGET_COLLECTION = 'CVE_translated';
const BATCH_SIZE = 500;
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/alerta';

async function ensureIndexes(targetCollection) {
  await targetCollection.createIndex({ cveId: 1 }, { unique: true });
  await targetCollection.createIndex({ vendors: 1 });
  await targetCollection.createIndex({ products: 1 });
  await targetCollection.createIndex({ cwes: 1 });
}

async function cloneCollection() {
  await mongoose.connect(MONGO_URI);

  const source = mongoose.connection.collection(SOURCE_COLLECTION);
  const target = mongoose.connection.collection(TARGET_COLLECTION);

  const total = await source.countDocuments({});
  process.stdout.write(`Source documents: ${total}\n`);

  await ensureIndexes(target);

  const cursor = source.find({}, { projection: { _id: 0 } });
  let processed = 0;
  let batch = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    batch.push({
      updateOne: {
        filter: { cveId: doc.cveId },
        update: { $set: doc },
        upsert: true,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      await target.bulkWrite(batch, { ordered: false });
      processed += batch.length;
      process.stdout.write(`Processed: ${processed}/${total}\n`);
      batch = [];
    }
  }

  if (batch.length) {
    await target.bulkWrite(batch, { ordered: false });
    processed += batch.length;
    process.stdout.write(`Processed: ${processed}/${total}\n`);
  }

  const translatedTotal = await target.countDocuments({});
  process.stdout.write(
    `${JSON.stringify(
      {
        sourceCollection: SOURCE_COLLECTION,
        targetCollection: TARGET_COLLECTION,
        sourceTotal: total,
        targetTotal: translatedTotal,
      },
      null,
      2,
    )}\n`,
  );

  await mongoose.disconnect();
}

cloneCollection().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
