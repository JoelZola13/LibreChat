#!/usr/bin/env node

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const apiDir = path.join(rootDir, 'api');

require('module-alias')({ base: apiDir });

const defaultBaseURL = process.env.LIBRECHAT_BASE_URL || 'http://localhost:3180';
const defaultStorageState = path.resolve(rootDir, 'e2e/.auth/messages-storage-state.json');
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const equalsArg = args.find((arg) => arg.startsWith(`${name}=`));
  if (equalsArg) {
    return equalsArg.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }

  return fallback;
}

function hasArg(name) {
  return args.includes(name);
}

function fail(message) {
  console.error(`Messages storage-state seed failed: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Seed a local authenticated Playwright storage state for Messages smoke tests.

This creates or reuses a dedicated local LibreChat user, creates a normal refresh-token
session, and writes the ignored Playwright storage-state file used by the Messages smoke spec.

Usage:
  npm run e2e:messages-auth:seed
  npm run e2e:messages-auth:seed -- --base-url http://localhost:3180 --email messages-smoke@streetvoices.local

Options:
  --base-url <url>       LibreChat base URL. Defaults to LIBRECHAT_BASE_URL or ${defaultBaseURL}
  --output <path>        Storage-state output path. Defaults to MESSAGES_STORAGE_STATE or ${defaultStorageState}
  --email <email>        Local smoke user email. Defaults to MESSAGES_AUTH_SEED_EMAIL or messages-smoke@streetvoices.local
  --username <username>  Local smoke username. Defaults to MESSAGES_AUTH_SEED_USERNAME or messages-smoke
  --name <name>          Local smoke display name. Defaults to MESSAGES_AUTH_SEED_NAME or Messages Smoke User
  --role <role>          Local smoke role. Defaults to MESSAGES_AUTH_SEED_ROLE or USER
  --mongo-uri <uri>      Mongo URI for seeding. Defaults to MESSAGES_AUTH_SEED_MONGO_URI, then local Nanobot Docker Mongo when available, then MONGO_URI
  --ttl-days <number>    Refresh-token lifetime in days. Defaults to MESSAGES_AUTH_SEED_TTL_DAYS or 7
  --help                Show this help.
`);
}

if (hasArg('--help') || hasArg('-h')) {
  printHelp();
  process.exit(0);
}

const baseURL = argValue('--base-url', defaultBaseURL);
const outputPath = path.resolve(
  rootDir,
  argValue('--output', process.env.MESSAGES_STORAGE_STATE || defaultStorageState),
);
const email = argValue(
  '--email',
  process.env.MESSAGES_AUTH_SEED_EMAIL || 'messages-smoke@streetvoices.local',
).toLowerCase();
const username = argValue(
  '--username',
  process.env.MESSAGES_AUTH_SEED_USERNAME || 'messages-smoke',
).toLowerCase();
const name = argValue('--name', process.env.MESSAGES_AUTH_SEED_NAME || 'Messages Smoke User');
const role = argValue('--role', process.env.MESSAGES_AUTH_SEED_ROLE || 'USER').toUpperCase();
const explicitMongoUri = argValue('--mongo-uri', process.env.MESSAGES_AUTH_SEED_MONGO_URI || '');
const ttlDays = Number(argValue('--ttl-days', process.env.MESSAGES_AUTH_SEED_TTL_DAYS || '7'));

if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
  fail('MESSAGES_AUTH_SEED_TTL_DAYS / --ttl-days must be a positive number.');
}

let parsedBaseUrl;
try {
  parsedBaseUrl = new URL(baseURL);
} catch {
  fail(`invalid base URL: ${baseURL}`);
}

if (!process.env.JWT_REFRESH_SECRET) {
  require('dotenv').config({ path: path.join(rootDir, '.env') });
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function dbNameFromMongoUri(mongoUri) {
  const match = mongoUri?.match(/\/([^/?]+)(?:[?]|$)/);
  return match?.[1] || 'LibreChat';
}

function dockerMongoUri() {
  if (!isLocalHostname(parsedBaseUrl.hostname)) return null;

  try {
    const hostPort = execFileSync(
      'docker',
      [
        'inspect',
        'nanobot-mongodb',
        '--format',
        '{{(index (index .NetworkSettings.Ports "27017/tcp") 0).HostPort}}',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();

    if (!hostPort) return null;
    return `mongodb://127.0.0.1:${hostPort}/${dbNameFromMongoUri(process.env.MONGO_URI)}`;
  } catch {
    return null;
  }
}

if (explicitMongoUri) {
  process.env.MONGO_URI = explicitMongoUri;
} else {
  const localDockerMongoUri = dockerMongoUri();
  if (localDockerMongoUri) {
    process.env.MONGO_URI = localDockerMongoUri;
  }
}

if (!process.env.JWT_REFRESH_SECRET) {
  fail('JWT_REFRESH_SECRET is missing. Load LibreChat/.env before seeding auth state.');
}

if (!process.env.MONGO_URI) {
  fail('MONGO_URI is missing. Load LibreChat/.env before seeding auth state.');
}

const mongoose = require('mongoose');
const { connectDb } = require('~/db/connect');
require('~/db/models');
const { createSession } = require('~/models');
const { User } = require('~/db/models');

function storageCookie(name, value, expires) {
  return {
    name,
    value,
    domain: parsedBaseUrl.hostname,
    path: '/',
    expires,
    httpOnly: true,
    secure: parsedBaseUrl.protocol === 'https:',
    sameSite: 'Strict',
  };
}

try {
  await connectDb();

  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        username,
        provider: 'local',
        emailVerified: true,
        role,
      },
      $setOnInsert: {
        email,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const { refreshToken } = await createSession(user._id.toString(), {
    expiration: expiresAt,
  });
  const expires = Math.floor(expiresAt.getTime() / 1000);
  const storageState = {
    cookies: [
      storageCookie('refreshToken', refreshToken, expires),
      storageCookie('token_provider', 'librechat', expires),
    ],
    origins: [
      {
        origin: parsedBaseUrl.origin,
        localStorage: [{ name: 'navVisible', value: 'true' }],
      },
    ],
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(storageState, null, 2)}\n`, {
    mode: 0o600,
  });

  console.log(`Seeded Messages smoke user ${email} (${role}).`);
  console.log(`Messages storage-state written to ${outputPath}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await mongoose.disconnect().catch(() => {});
}
