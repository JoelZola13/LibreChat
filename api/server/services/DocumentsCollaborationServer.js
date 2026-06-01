const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { WebSocket, WebSocketServer } = require('ws');
const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const { logger } = require('@librechat/data-schemas');

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;
const DEFAULT_PATH = '/api/documents/collaboration';
const ROOM_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_CONNECTIONS_PER_ROOM = 32;
const DEFAULT_MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const DEFAULT_PERSISTENCE_DEBOUNCE_MS = 750;
const DEFAULT_PERSISTENCE_DIR = path.resolve(__dirname, '../../data/documents-collaboration');
const DEFAULT_PERSISTENCE_PROVIDER = 'file';
const DEFAULT_ROOM_TOKEN_TTL_MS = 30 * 60 * 1000;
const DEFAULT_FANOUT_CHANNEL_PREFIX = 'documents:collaboration';
const ROOM_NAME_PATTERN = /^document-[A-Za-z0-9_-]{1,160}$/;
const FANOUT_REMOTE_ORIGIN = Symbol('documentsCollaborationFanoutRemoteOrigin');

const rooms = new Map();

function parsePositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isExplicitlyDisabled(value) {
  return ['0', 'false', 'off', 'no', 'disabled'].includes(String(value || '').toLowerCase().trim());
}

function isExplicitlyEnabled(value) {
  return ['1', 'true', 'on', 'yes', 'enabled'].includes(String(value || '').toLowerCase().trim());
}

function createInstanceId() {
  return crypto.randomBytes(12).toString('hex');
}

function normalizePersistenceProvider(value) {
  const provider = String(value || DEFAULT_PERSISTENCE_PROVIDER).toLowerCase().trim();

  if (['db', 'database', 'mongo', 'mongodb'].includes(provider)) {
    return 'database';
  }

  return 'file';
}

function createPersistenceOptions(options) {
  const persistenceOptions =
    options.persistence && typeof options.persistence === 'object' ? options.persistence : {};
  const envEnabled = process.env.DOCUMENTS_COLLABORATION_PERSISTENCE_ENABLED;
  const enabled = options.persistence === false ? false : !isExplicitlyDisabled(envEnabled);
  const provider = normalizePersistenceProvider(
    persistenceOptions.provider ||
      options.persistenceProvider ||
      process.env.DOCUMENTS_COLLABORATION_PERSISTENCE_PROVIDER,
  );
  const dir = path.resolve(
    persistenceOptions.dir ||
      options.persistenceDir ||
      process.env.DOCUMENTS_COLLABORATION_PERSISTENCE_DIR ||
      DEFAULT_PERSISTENCE_DIR,
  );
  const debounceMs = parsePositiveInteger(
    persistenceOptions.debounceMs ??
      options.persistenceDebounceMs ??
      process.env.DOCUMENTS_COLLABORATION_PERSISTENCE_DEBOUNCE_MS,
    DEFAULT_PERSISTENCE_DEBOUNCE_MS,
  );

  return {
    enabled,
    provider,
    dir,
    debounceMs,
    store: persistenceOptions.store || options.persistenceStore,
  };
}

function createFanoutOptions(options = {}) {
  const fanoutOptions = options.fanout && typeof options.fanout === 'object' ? options.fanout : {};
  const envEnabled = process.env.DOCUMENTS_COLLABORATION_FANOUT_ENABLED;
  const redisUrl =
    fanoutOptions.redisUrl ||
    options.redisUrl ||
    process.env.DOCUMENTS_COLLABORATION_REDIS_URL ||
    process.env.REDIS_URI ||
    '';
  const enabled =
    options.fanout === false
      ? false
      : fanoutOptions.enabled != null
        ? Boolean(fanoutOptions.enabled)
        : envEnabled != null
          ? isExplicitlyEnabled(envEnabled)
          : Boolean(process.env.DOCUMENTS_COLLABORATION_REDIS_URL);
  const deploymentPrefix =
    process.env.DOCUMENTS_COLLABORATION_REDIS_CHANNEL_PREFIX ||
    (process.env.REDIS_KEY_PREFIX
      ? `${process.env.REDIS_KEY_PREFIX}:${DEFAULT_FANOUT_CHANNEL_PREFIX}`
      : DEFAULT_FANOUT_CHANNEL_PREFIX);

  return {
    enabled: enabled && Boolean(redisUrl || fanoutOptions.publisher || fanoutOptions.redisClientFactory),
    redisUrl,
    channelPrefix: fanoutOptions.channelPrefix || options.fanoutChannelPrefix || deploymentPrefix,
    instanceId:
      fanoutOptions.instanceId ||
      options.instanceId ||
      process.env.DOCUMENTS_COLLABORATION_INSTANCE_ID ||
      createInstanceId(),
    publisher: fanoutOptions.publisher,
    subscriber: fanoutOptions.subscriber,
    redisClientFactory: fanoutOptions.redisClientFactory,
    redisOptions: fanoutOptions.redisOptions || options.redisOptions,
  };
}

function createAccessOptions(options = {}) {
  const secret =
    options.authSecret ||
    options.secret ||
    process.env.DOCUMENTS_COLLABORATION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.JWT_REFRESH_SECRET ||
    '';
  const disabled =
    options.authRequired === false ||
    options.required === false ||
    isExplicitlyDisabled(process.env.DOCUMENTS_COLLABORATION_AUTH_REQUIRED);
  const tokenTtlMs = parsePositiveInteger(
    options.roomTokenTtlMs ?? process.env.DOCUMENTS_COLLABORATION_ROOM_TOKEN_TTL_MS,
    DEFAULT_ROOM_TOKEN_TTL_MS,
  );

  return {
    required: options.required === true ? Boolean(secret) : !disabled && Boolean(secret),
    secret,
    tokenTtlMs,
  };
}

function isValidDocumentsCollaborationRoomName(roomName) {
  return ROOM_NAME_PATTERN.test(roomName);
}

function getRoomPersistencePath(roomName, persistence) {
  return path.join(persistence.dir, `${roomName}.ydoc`);
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function signRoomTokenPayload(payloadSegment, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadSegment)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function safeEqualString(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createDocumentsCollaborationRoomToken(
  { roomName, documentId, userId, userName },
  options = {},
) {
  const access = createAccessOptions(options);

  if (!access.required) {
    return {
      authRequired: false,
      token: null,
      expiresAt: null,
    };
  }

  if (!isValidDocumentsCollaborationRoomName(roomName)) {
    throw new Error('Invalid collaboration room name');
  }

  const now = Date.now();
  const payload = {
    v: 1,
    room: roomName,
    document: documentId,
    user: userId,
    name: userName || undefined,
    iat: now,
    exp: now + access.tokenTtlMs,
  };
  const payloadSegment = toBase64Url(JSON.stringify(payload));
  const signature = signRoomTokenPayload(payloadSegment, access.secret);

  return {
    authRequired: true,
    token: `${payloadSegment}.${signature}`,
    expiresAt: payload.exp,
  };
}

function verifyDocumentsCollaborationRoomToken(token, { roomName, userId }, options = {}) {
  const access = createAccessOptions(options);

  if (!access.required) {
    return { ok: true, authRequired: false, payload: null };
  }

  if (!token) {
    return { ok: false, authRequired: true, reason: 'missing_token' };
  }

  const [payloadSegment, signature, extra] = String(token).split('.');

  if (!payloadSegment || !signature || extra) {
    return { ok: false, authRequired: true, reason: 'malformed_token' };
  }

  const expectedSignature = signRoomTokenPayload(payloadSegment, access.secret);

  if (!safeEqualString(signature, expectedSignature)) {
    return { ok: false, authRequired: true, reason: 'invalid_signature' };
  }

  let payload;

  try {
    payload = JSON.parse(fromBase64Url(payloadSegment).toString('utf8'));
  } catch (_error) {
    return { ok: false, authRequired: true, reason: 'invalid_payload' };
  }

  if (payload?.v !== 1 || payload?.room !== roomName) {
    return { ok: false, authRequired: true, reason: 'room_mismatch' };
  }

  if (userId && payload.user !== userId) {
    return { ok: false, authRequired: true, reason: 'user_mismatch' };
  }

  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) {
    return { ok: false, authRequired: true, reason: 'expired_token' };
  }

  return { ok: true, authRequired: true, payload };
}

function rejectUpgrade(socket, statusCode = 400, reason = 'Bad Request') {
  try {
    socket.write(`HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\n\r\n`);
  } catch (_error) {
    // The socket may already be closed by the time we reject the upgrade.
  }

  socket.destroy();
}

function getMessageByteLength(data) {
  if (typeof data === 'string') {
    return Buffer.byteLength(data);
  }

  if (Buffer.isBuffer(data) || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return data.byteLength;
  }

  if (Array.isArray(data)) {
    return data.reduce((total, chunk) => total + getMessageByteLength(chunk), 0);
  }

  return 0;
}

function toBinaryMessage(data) {
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data.map(toBinaryMessage));
  }

  if (typeof data === 'string') {
    return Buffer.from(data);
  }

  return new Uint8Array(data);
}

function closeWebSocket(ws, code, reason) {
  try {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(code, reason);
      return;
    }
  } catch (_error) {
    // Fall through to terminate if close throws.
  }

  ws.terminate();
}

function getPersistenceStore(persistence) {
  if (persistence.store) {
    return persistence.store;
  }

  if (!persistence.modelStore) {
    persistence.modelStore = require('../../models/DocumentsCollaborationSnapshot');
  }

  return persistence.modelStore;
}

function normalizePersistedUpdate(snapshot) {
  if (!snapshot) {
    return null;
  }

  const update = Buffer.isBuffer(snapshot) ? snapshot : snapshot.update;

  if (!update) {
    return null;
  }

  if (typeof update.value === 'function') {
    return Buffer.from(update.value());
  }

  if (Array.isArray(update.data)) {
    return Buffer.from(update.data);
  }

  if (Buffer.isBuffer(update)) {
    return update;
  }

  if (update instanceof Uint8Array) {
    return Buffer.from(update);
  }

  if (update.buffer && Buffer.isBuffer(update.buffer)) {
    return update.buffer;
  }

  if (update.buffer instanceof ArrayBuffer) {
    return Buffer.from(update.buffer);
  }

  return Buffer.from(update);
}

async function readPersistedRoomUpdate(room) {
  if (room.persistence.provider === 'database') {
    const store = getPersistenceStore(room.persistence);
    const snapshot = await store.getDocumentsCollaborationSnapshot(room.name);
    return normalizePersistedUpdate(snapshot);
  }

  return fs.readFile(room.persistencePath);
}

async function writePersistedRoomUpdate(room, update) {
  if (room.persistence.provider === 'database') {
    const store = getPersistenceStore(room.persistence);
    await store.saveDocumentsCollaborationSnapshot(room.name, update);
    return;
  }

  const tempPath = `${room.persistencePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await fs.mkdir(room.persistence.dir, { recursive: true });
    await fs.writeFile(tempPath, update);
    await fs.rename(tempPath, room.persistencePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch (_unlinkError) {
      // Best effort cleanup for failed atomic writes.
    }

    throw error;
  }
}

async function loadPersistedRoom(room) {
  if (!room.persistence.enabled) {
    return;
  }

  try {
    const update = await readPersistedRoomUpdate(room);
    if (update?.byteLength) {
      Y.applyUpdate(room.doc, update);
    }
  } catch (error) {
    if (room.persistence.provider === 'file' && error?.code === 'ENOENT') {
      return;
    }

    logger.warn('[documentsCollaboration] Failed to load persisted room', {
      roomName: room.name,
      provider: room.persistence.provider,
      message: error?.message,
    });
  }
}

async function persistRoom(room) {
  if (!room.persistence.enabled || room.destroyed) {
    return;
  }

  if (room.persistencePromise) {
    room.persistenceQueued = true;
    return room.persistencePromise;
  }

  room.persistencePromise = (async () => {
    do {
      room.persistenceQueued = false;
      const update = Buffer.from(Y.encodeStateAsUpdate(room.doc));

      try {
        await writePersistedRoomUpdate(room, update);
      } catch (error) {
        logger.warn('[documentsCollaboration] Failed to persist room', {
          roomName: room.name,
          provider: room.persistence.provider,
          message: error?.message,
        });

        break;
      }
    } while (room.persistenceQueued && !room.destroyed);
  })();

  try {
    await room.persistencePromise;
  } finally {
    room.persistencePromise = null;
  }
}

function scheduleRoomPersistence(room) {
  if (!room.persistence.enabled || room.destroyed || !room.readyForPersistence) {
    return;
  }

  if (room.persistenceTimer) {
    clearTimeout(room.persistenceTimer);
  }

  room.persistenceTimer = setTimeout(() => {
    room.persistenceTimer = null;
    void persistRoom(room);
  }, room.persistence.debounceMs);
  room.persistenceTimer.unref?.();
}

async function flushRoomPersistence(room) {
  if (!room.persistence.enabled) {
    return;
  }

  if (room.persistenceTimer) {
    clearTimeout(room.persistenceTimer);
    room.persistenceTimer = null;
  }

  await persistRoom(room);
}

async function destroyRoom(room) {
  if (room.destroyed || room.connections.size) {
    return;
  }

  await flushRoomPersistence(room);

  if (room.connections.size) {
    return;
  }

  room.destroyed = true;
  rooms.delete(room.name);

  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }

  if (room.persistenceTimer) {
    clearTimeout(room.persistenceTimer);
    room.persistenceTimer = null;
  }

  if (room.persistenceUpdateHandler) {
    room.doc.off('update', room.persistenceUpdateHandler);
  }

  if (room.awarenessUpdateHandler) {
    room.awareness.off('update', room.awarenessUpdateHandler);
  }

  if (room.fanout) {
    await room.fanout.detachRoom(room);
  }

  room.awareness.destroy();
  room.doc.destroy();
}

function createRoom(roomName, persistence, fanout) {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);

  const room = {
    name: roomName,
    doc,
    awareness,
    connections: new Map(),
    cleanupTimer: null,
    destroyed: false,
    persistence,
    persistencePath: getRoomPersistencePath(roomName, persistence),
    persistencePromise: null,
    persistenceQueued: false,
    persistenceTimer: null,
    readyForPersistence: false,
    persistenceUpdateHandler: null,
    awarenessUpdateHandler: null,
    fanout,
    fanoutDocUpdateHandler: null,
    fanoutAwarenessUpdateHandler: null,
  };

  room.awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated, removed);

    if (!changedClients.length) {
      return;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients),
    );
    broadcastAwareness(room, encoding.toUint8Array(encoder), origin);
  };
  room.awareness.on('update', room.awarenessUpdateHandler);

  room.ready = loadPersistedRoom(room).finally(async () => {
    room.readyForPersistence = true;

    if (room.persistence.enabled) {
      room.persistenceUpdateHandler = () => scheduleRoomPersistence(room);
      room.doc.on('update', room.persistenceUpdateHandler);
    }

    if (room.fanout?.enabled) {
      await room.fanout.attachRoom(room);
    }
  });

  return room;
}

function getRoom(roomName, persistence, fanout) {
  let room = rooms.get(roomName);

  if (!room) {
    room = createRoom(roomName, persistence, fanout);
    rooms.set(roomName, room);
  }

  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }

  return room;
}

function scheduleRoomCleanup(room) {
  if (room.connections.size || room.cleanupTimer) {
    return;
  }

  room.cleanupTimer = setTimeout(() => {
    if (room.connections.size) {
      return;
    }

    void destroyRoom(room).catch((error) => {
      logger.warn('[documentsCollaboration] Failed to clean up room', {
        roomName: room.name,
        message: error?.message,
      });
    });
  }, ROOM_TTL_MS);
  room.cleanupTimer.unref?.();
}

function sendEncoded(ws, encoder) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(encoding.toUint8Array(encoder));
  }
}

function broadcastAwareness(room, message, origin) {
  for (const client of room.connections.keys()) {
    if (client !== origin && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function sendAwarenessStates(ws, room) {
  const clients = Array.from(room.awareness.getStates().keys());

  if (!clients.length) {
    return;
  }

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(room.awareness, clients),
  );
  sendEncoded(ws, encoder);
}

function readAwarenessClientIds(update) {
  const decoder = decoding.createDecoder(update);
  const clientCount = decoding.readVarUint(decoder);
  const clientIds = [];

  for (let index = 0; index < clientCount; index += 1) {
    const clientId = decoding.readVarUint(decoder);
    decoding.readVarUint(decoder);
    decoding.readVarString(decoder);
    clientIds.push(clientId);
  }

  return clientIds;
}

function createRedisFanoutClient(role, fanout) {
  if (role === 'publisher' && fanout.publisher) {
    return fanout.publisher;
  }

  if (role === 'subscriber' && fanout.subscriber) {
    return fanout.subscriber;
  }

  if (fanout.redisClientFactory) {
    return fanout.redisClientFactory(role);
  }

  const Redis = require('ioredis');
  const redisOptions = {
    maxRetriesPerRequest: null,
    ...fanout.redisOptions,
  };

  return new Redis(fanout.redisUrl, redisOptions);
}

function encodeFanoutMessage({ roomName, type, update, instanceId }) {
  return JSON.stringify({
    v: 1,
    room: roomName,
    type,
    origin: instanceId,
    update: Buffer.from(update).toString('base64'),
  });
}

function decodeFanoutMessage(message) {
  const payload = JSON.parse(message);

  if (
    payload?.v !== 1 ||
    typeof payload.room !== 'string' ||
    typeof payload.type !== 'string' ||
    typeof payload.origin !== 'string' ||
    typeof payload.update !== 'string'
  ) {
    return null;
  }

  return {
    room: payload.room,
    type: payload.type,
    origin: payload.origin,
    update: Buffer.from(payload.update, 'base64'),
  };
}

function createDocumentsCollaborationFanout(options = {}) {
  const fanout = createFanoutOptions(options);

  if (!fanout.enabled) {
    return {
      enabled: false,
      instanceId: fanout.instanceId,
      attachRoom: async () => {},
      detachRoom: async () => {},
      close: async () => {},
    };
  }

  const publisher = createRedisFanoutClient('publisher', fanout);
  const subscriber = createRedisFanoutClient('subscriber', fanout);
  const attachedRooms = new Map();
  const subscribedRooms = new Set();
  let closed = false;
  let lastErrorLogAt = 0;

  const logFanoutWarning = (message, meta = {}) => {
    const now = Date.now();

    if (now - lastErrorLogAt < 30 * 1000) {
      return;
    }

    lastErrorLogAt = now;
    logger.warn(message, meta);
  };

  const channelForRoom = (roomName) => `${fanout.channelPrefix}:${roomName}`;

  const publishRoomUpdate = (roomName, type, update) => {
    if (closed || !publisher?.publish) {
      return;
    }

    Promise.resolve(
      publisher.publish(
        channelForRoom(roomName),
        encodeFanoutMessage({
          roomName,
          type,
          update,
          instanceId: fanout.instanceId,
        }),
      ),
    ).catch((error) => {
      logFanoutWarning('[documentsCollaboration] Failed to publish fanout update', {
        roomName,
        type,
        message: error?.message,
      });
    });
  };

  const handleFanoutMessage = (_channel, message) => {
    let payload;

    try {
      payload = decodeFanoutMessage(message);
    } catch (error) {
      logFanoutWarning('[documentsCollaboration] Ignored malformed fanout message', {
        message: error?.message,
      });
      return;
    }

    if (
      !payload ||
      payload.origin === fanout.instanceId ||
      channelForRoom(payload.room) !== _channel ||
      !isValidDocumentsCollaborationRoomName(payload.room)
    ) {
      return;
    }

    const room = attachedRooms.get(payload.room);

    if (!room || room.destroyed) {
      return;
    }

    try {
      if (payload.type === 'sync') {
        Y.applyUpdate(room.doc, payload.update, FANOUT_REMOTE_ORIGIN);
      } else if (payload.type === 'awareness') {
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          payload.update,
          FANOUT_REMOTE_ORIGIN,
        );
      }
    } catch (error) {
      logFanoutWarning('[documentsCollaboration] Failed to apply fanout update', {
        roomName: payload.room,
        type: payload.type,
        message: error?.message,
      });
    }
  };

  publisher?.on?.('error', (error) => {
    logFanoutWarning('[documentsCollaboration] Redis fanout publisher error', {
      message: error?.message,
    });
  });
  subscriber?.on?.('error', (error) => {
    logFanoutWarning('[documentsCollaboration] Redis fanout subscriber error', {
      message: error?.message,
    });
  });
  subscriber?.on?.('message', handleFanoutMessage);

  const subscribeRoom = async (roomName) => {
    if (closed || subscribedRooms.has(roomName) || !subscriber?.subscribe) {
      return;
    }

    await subscriber.subscribe(channelForRoom(roomName));
    subscribedRooms.add(roomName);
  };

  const unsubscribeRoom = async (roomName) => {
    if (!subscribedRooms.has(roomName) || !subscriber?.unsubscribe) {
      return;
    }

    subscribedRooms.delete(roomName);
    await subscriber.unsubscribe(channelForRoom(roomName));
  };

  const attachRoom = async (room) => {
    if (closed || attachedRooms.has(room.name)) {
      return;
    }

    attachedRooms.set(room.name, room);

    room.fanoutDocUpdateHandler = (update, origin) => {
      if (origin !== FANOUT_REMOTE_ORIGIN) {
        publishRoomUpdate(room.name, 'sync', update);
      }
    };
    room.fanoutAwarenessUpdateHandler = ({ added, updated, removed }, origin) => {
      if (origin === FANOUT_REMOTE_ORIGIN) {
        return;
      }

      const changedClients = added.concat(updated, removed);

      if (!changedClients.length) {
        return;
      }

      publishRoomUpdate(
        room.name,
        'awareness',
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients),
      );
    };

    room.doc.on('update', room.fanoutDocUpdateHandler);
    room.awareness.on('update', room.fanoutAwarenessUpdateHandler);

    try {
      await subscribeRoom(room.name);
    } catch (error) {
      logFanoutWarning('[documentsCollaboration] Failed to subscribe collaboration fanout room', {
        roomName: room.name,
        message: error?.message,
      });
    }
  };

  const detachRoom = async (room) => {
    attachedRooms.delete(room.name);

    if (room.fanoutDocUpdateHandler) {
      room.doc.off('update', room.fanoutDocUpdateHandler);
      room.fanoutDocUpdateHandler = null;
    }

    if (room.fanoutAwarenessUpdateHandler) {
      room.awareness.off('update', room.fanoutAwarenessUpdateHandler);
      room.fanoutAwarenessUpdateHandler = null;
    }

    try {
      await unsubscribeRoom(room.name);
    } catch (error) {
      logFanoutWarning('[documentsCollaboration] Failed to unsubscribe collaboration fanout room', {
        roomName: room.name,
        message: error?.message,
      });
    }
  };

  const closeClient = async (client) => {
    if (!client) {
      return;
    }

    try {
      if (client.quit) {
        await client.quit();
      } else if (client.disconnect) {
        client.disconnect();
      }
    } catch (_error) {
      client.disconnect?.();
    }
  };

  return {
    enabled: true,
    instanceId: fanout.instanceId,
    channelPrefix: fanout.channelPrefix,
    attachRoom,
    detachRoom,
    close: async () => {
      closed = true;
      await Promise.all(Array.from(attachedRooms.values(), detachRoom));
      subscriber?.off?.('message', handleFanoutMessage);
      await Promise.all([closeClient(publisher), closeClient(subscriber)]);
    },
  };
}

function attachDocumentsCollaborationServer(server, options = {}) {
  const socketPath = options.path || DEFAULT_PATH;
  const persistence = createPersistenceOptions(options);
  const access = createAccessOptions(options);
  const fanout = createDocumentsCollaborationFanout(options);
  const attachedRoomNames = new Set();
  let closeFlushPromise = null;
  const maxConnectionsPerRoom = parsePositiveInteger(
    options.maxConnectionsPerRoom ?? process.env.DOCUMENTS_COLLABORATION_MAX_CONNECTIONS_PER_ROOM,
    DEFAULT_MAX_CONNECTIONS_PER_ROOM,
  );
  const maxMessageBytes = parsePositiveInteger(
    options.maxMessageBytes ?? process.env.DOCUMENTS_COLLABORATION_MAX_MESSAGE_BYTES,
    DEFAULT_MAX_MESSAGE_BYTES,
  );
  const heartbeatIntervalMs = parsePositiveInteger(
    options.heartbeatIntervalMs ?? process.env.DOCUMENTS_COLLABORATION_HEARTBEAT_INTERVAL_MS,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
  const wss = new WebSocketServer({ noServer: true, maxPayload: maxMessageBytes });

  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }

      ws.isAlive = false;
      ws.ping();
    }
  }, heartbeatIntervalMs);
  heartbeatTimer.unref?.();

  const flushAttachedRooms = () => {
    if (!closeFlushPromise) {
      closeFlushPromise = Promise.all(
        Array.from(attachedRoomNames, (roomName) => {
          const room = rooms.get(roomName);
          return room ? destroyRoom(room) : Promise.resolve();
        }),
      );
    }

    return closeFlushPromise;
  };
  const originalClose = wss.close.bind(wss);
  wss.close = (callback) => {
    return originalClose((error) => {
      flushAttachedRooms()
        .then(() => fanout.close())
        .catch((flushError) => {
          logger.warn('[documentsCollaboration] Failed to flush rooms during websocket close', {
            message: flushError?.message,
          });
        })
        .finally(() => callback?.(error));
    });
  };

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
    void flushAttachedRooms().then(() => fanout.close());
  });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const pathPrefix = `${socketPath}/`;

    if (!url.pathname.startsWith(pathPrefix)) {
      return;
    }

    let roomName;

    try {
      roomName = decodeURIComponent(url.pathname.slice(pathPrefix.length)).trim();
    } catch (_error) {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    if (!isValidDocumentsCollaborationRoomName(roomName)) {
      logger.warn('[documentsCollaboration] Rejected invalid room name', {
        roomName: roomName ? roomName.slice(0, 180) : '',
      });
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    const userId = url.searchParams.get('user_id') || '';
    const token = url.searchParams.get('room_token') || '';
    const tokenResult = verifyDocumentsCollaborationRoomToken(token, { roomName, userId }, access);

    if (!tokenResult.ok) {
      logger.warn('[documentsCollaboration] Rejected unauthorized room connection', {
        roomName,
        userId,
        reason: tokenResult.reason,
      });
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    const room = getRoom(roomName, persistence, fanout);
    attachedRoomNames.add(roomName);

    try {
      await room.ready;
    } catch (error) {
      logger.warn('[documentsCollaboration] Room failed to initialize', {
        roomName,
        message: error?.message,
      });
      rejectUpgrade(socket, 503, 'Service Unavailable');
      return;
    }

    if (socket.destroyed) {
      return;
    }

    if (room.connections.size >= maxConnectionsPerRoom) {
      logger.warn('[documentsCollaboration] Rejected room connection limit', {
        roomName,
        maxConnectionsPerRoom,
      });
      rejectUpgrade(socket, 429, 'Too Many Requests');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, roomName, room);
    });
  });

  wss.on('connection', (ws, _request, roomName, existingRoom) => {
    const room = existingRoom || getRoom(roomName, persistence, fanout);
    const controlledClients = new Set();
    let closed = false;

    ws.isAlive = true;
    room.connections.set(ws, controlledClients);

    const docUpdateHandler = (update, origin) => {
      if (origin === ws) {
        return;
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      sendEncoded(ws, encoder);
    };

    const cleanupConnection = () => {
      if (closed) {
        return;
      }

      closed = true;
      room.doc.off('update', docUpdateHandler);
      room.connections.delete(ws);

      if (controlledClients.size) {
        awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(controlledClients), ws);
      }

      scheduleRoomCleanup(room);
    };

    room.doc.on('update', docUpdateHandler);

    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, room.doc);
    sendEncoded(ws, syncEncoder);
    sendAwarenessStates(ws, room);

    ws.on('message', (data) => {
      if (getMessageByteLength(data) > maxMessageBytes) {
        logger.warn('[documentsCollaboration] Rejected oversized websocket message', {
          roomName,
          maxMessageBytes,
        });
        closeWebSocket(ws, 1009, 'Message too large');
        return;
      }

      try {
        const message = toBinaryMessage(data);
        const decoder = decoding.createDecoder(message);
        const encoder = encoding.createEncoder();
        const messageType = decoding.readVarUint(decoder);

        if (messageType === MESSAGE_SYNC) {
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);

          if (encoding.length(encoder) > 1) {
            sendEncoded(ws, encoder);
          }
        } else if (messageType === MESSAGE_AWARENESS) {
          const awarenessUpdate = decoding.readVarUint8Array(decoder);
          readAwarenessClientIds(awarenessUpdate).forEach((clientId) => {
            controlledClients.add(clientId);
          });
          awarenessProtocol.applyAwarenessUpdate(room.awareness, awarenessUpdate, ws);
        } else if (messageType === MESSAGE_QUERY_AWARENESS) {
          sendAwarenessStates(ws, room);
        }
      } catch (error) {
        logger.warn('[documentsCollaboration] Failed to process websocket message', {
          roomName,
          message: error?.message,
        });
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('close', cleanupConnection);

    ws.on('error', (error) => {
      logger.warn('[documentsCollaboration] Websocket error', {
        roomName,
        message: error?.message,
      });
    });
  });

  logger.info(`[documentsCollaboration] Websocket server attached at ${socketPath}/:room`, {
    maxConnectionsPerRoom,
    maxMessageBytes,
    heartbeatIntervalMs,
    authRequired: access.required,
    persistenceEnabled: persistence.enabled,
    persistenceProvider: persistence.enabled ? persistence.provider : null,
    persistenceDir: persistence.enabled && persistence.provider === 'file' ? persistence.dir : null,
    persistenceDebounceMs: persistence.debounceMs,
    fanoutEnabled: fanout.enabled,
    fanoutChannelPrefix: fanout.enabled ? fanout.channelPrefix : null,
  });
  return wss;
}

module.exports = {
  attachDocumentsCollaborationServer,
  createDocumentsCollaborationFanout,
  createDocumentsCollaborationRoomToken,
  isValidDocumentsCollaborationRoomName,
  verifyDocumentsCollaborationRoomToken,
};
