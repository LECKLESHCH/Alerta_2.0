const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('../backend/node_modules/mongodb');

const PORT = Number(process.env.PORT || '3000');
const HOST = '127.0.0.1';
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/alerta';
const JWT_SECRET = process.env.JWT_SECRET || 'alerta-dev-insecure-secret';
const JWT_EXPIRES_IN_SECONDS = Number(
  process.env.JWT_EXPIRES_IN_SECONDS || '43200',
);

const client = new MongoClient(MONGO_URI);

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized.padEnd(
          normalized.length + (4 - (normalized.length % 4)),
          '=',
        );
  return Buffer.from(padded, 'base64');
}

function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    iat: now,
    exp: now + JWT_EXPIRES_IN_SECONDS,
  };

  const encodedHeader = base64UrlEncode(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  );
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const encodedSignature = base64UrlEncode(
    crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest(),
  );

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

function verifyToken(token) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Некорректный токен');
  }

  const expectedSignature = base64UrlEncode(
    crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest(),
  );

  if (expectedSignature !== encodedSignature) {
    throw new Error('Подпись токена не прошла проверку');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Срок действия токена истек');
  }

  return payload;
}

function getBearerToken(request) {
  const header = request.headers.authorization || '';
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    throw new Error('Отсутствует токен доступа');
  }
  return token;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Укажите корректный email');
  }
  return normalized;
}

function validatePassword(password) {
  const normalized = String(password || '').trim();
  if (normalized.length < 8) {
    throw new Error('Пароль должен содержать не менее 8 символов');
  }
  return normalized;
}

function validateDisplayName(displayName) {
  const normalized = String(displayName || '').trim();
  if (normalized.length < 3) {
    throw new Error('Имя пользователя должно содержать не менее 3 символов');
  }
  return normalized;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { message });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Некорректный JSON'));
      }
    });
    request.on('error', reject);
  });
}

async function getCollections() {
  const db = client.db();
  return {
    users: db.collection('users'),
    articles: db.collection('articles'),
    objects: db.collection('objects'),
  };
}

async function requireUser(request) {
  const token = getBearerToken(request);
  const payload = verifyToken(token);
  const { users } = await getCollections();
  const user = await users.findOne({ _id: new ObjectId(payload.sub) });
  if (!user) {
    throw new Error('Пользователь не найден');
  }
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

async function handleRequest(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    });
    response.end();
    return;
  }

  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  try {
    if (request.method === 'GET' && pathname === '/') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'ALERTA 2.0 API',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/auth/register') {
      const body = await readJsonBody(request);
      const email = normalizeEmail(body.email);
      const password = validatePassword(body.password);
      const displayName = validateDisplayName(body.displayName);
      const { users } = await getCollections();
      const existingUser = await users.findOne({ email });
      if (existingUser) {
        sendError(response, 409, 'Пользователь с таким email уже существует');
        return;
      }
      const passwordSalt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, passwordSalt);
      const result = await users.insertOne({
        email,
        displayName,
        passwordHash,
        passwordSalt,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const user = {
        id: result.insertedId.toString(),
        email,
        displayName,
        role: 'admin',
      };
      sendJson(response, 201, {
        accessToken: signToken(user),
        tokenType: 'Bearer',
        expiresIn: JWT_EXPIRES_IN_SECONDS,
        user,
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/auth/login') {
      const body = await readJsonBody(request);
      const email = normalizeEmail(body.email);
      const password = validatePassword(body.password);
      const { users } = await getCollections();
      const user = await users.findOne({ email });
      if (!user) {
        sendError(response, 401, 'Неверный логин или пароль');
        return;
      }
      const passwordHash = hashPassword(password, user.passwordSalt);
      if (passwordHash !== user.passwordHash) {
        sendError(response, 401, 'Неверный логин или пароль');
        return;
      }
      const publicUser = {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
      sendJson(response, 200, {
        accessToken: signToken(publicUser),
        tokenType: 'Bearer',
        expiresIn: JWT_EXPIRES_IN_SECONDS,
        user: publicUser,
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/auth/me') {
      try {
        const user = await requireUser(request);
        sendJson(response, 200, user);
      } catch (error) {
        sendError(response, 401, error.message);
      }
      return;
    }

    if (request.method === 'GET' && pathname === '/articles') {
      try {
        await requireUser(request);
      } catch (error) {
        sendError(response, 401, error.message);
        return;
      }

      const page = Math.max(Number(url.searchParams.get('page') || '1'), 1);
      const limit = Math.min(
        Math.max(Number(url.searchParams.get('limit') || '50'), 1),
        200,
      );
      const includeText = ['1', 'true', 'yes'].includes(
        String(url.searchParams.get('includeText') || '').toLowerCase(),
      );
      const filter = {};
      for (const field of ['type', 'severity', 'category', 'source']) {
        const value = url.searchParams.get(field);
        if (value) filter[field] = value;
      }

      const projection = includeText ? {} : { projection: { text: 0 } };
      const skip = (page - 1) * limit;
      const { articles } = await getCollections();
      const [items, total] = await Promise.all([
        articles
          .find(filter, projection)
          .sort({ publishedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        articles.countDocuments(filter),
      ]);

      sendJson(response, 200, {
        items,
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/objects') {
      try {
        await requireUser(request);
      } catch (error) {
        sendError(response, 401, error.message);
        return;
      }
      const { objects } = await getCollections();
      const items = await objects.find().sort({ createdAt: -1 }).toArray();
      sendJson(response, 200, items);
      return;
    }

    if (request.method === 'POST' && pathname === '/objects') {
      try {
        await requireUser(request);
      } catch (error) {
        sendError(response, 401, error.message);
        return;
      }
      const body = await readJsonBody(request);
      if (!String(body.objectName || '').trim()) {
        sendError(response, 400, 'objectName is required');
        return;
      }
      const { objects } = await getCollections();
      const now = new Date();
      const payload = {
        ...body,
        createdAt: now,
        updatedAt: now,
      };
      const result = await objects.insertOne(payload);
      sendJson(response, 201, {
        _id: result.insertedId.toString(),
        ...payload,
      });
      return;
    }

    if (request.method === 'DELETE' && pathname.startsWith('/objects/')) {
      try {
        await requireUser(request);
      } catch (error) {
        sendError(response, 401, error.message);
        return;
      }
      const id = pathname.split('/').pop();
      const { objects } = await getCollections();
      const result = await objects.deleteOne({ _id: new ObjectId(id) });
      if (!result.deletedCount) {
        sendError(response, 404, 'Object model not found');
        return;
      }
      sendJson(response, 200, { deleted: true, id });
      return;
    }

    if (request.method === 'GET' && pathname === '/crawl/status') {
      sendJson(response, 200, {
        isRunning: false,
        scope: null,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/crawl/logs') {
      sendJson(response, 200, {
        logs: ['Сервис сбора временно отключён в облегчённом профиле запуска.'],
      });
      return;
    }

    if (
      request.method === 'GET' &&
      (pathname === '/crawl/all' || pathname === '/crawl/sites')
    ) {
      sendJson(response, 200, {
        started: false,
        scope: pathname === '/crawl/sites' ? 'sites' : 'all',
        message: 'Сервис сбора временно отключён в облегчённом профиле запуска.',
      });
      return;
    }

    sendError(response, 404, 'Not Found');
  } catch (error) {
    sendError(response, 500, error.message || 'Internal Server Error');
  }
}

async function bootstrap() {
  await client.connect();
  const server = http.createServer(handleRequest);
  server.listen(PORT, HOST, () => {
    console.log(`ALERTA lite backend is running at http://${HOST}:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
