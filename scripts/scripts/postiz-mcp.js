#!/usr/bin/env node
/**
 * Postiz MCP Server
 * Exposes social media posting tools via the Model Context Protocol (stdio).
 * Configure via environment variables:
 *   POSTIZ_API_KEY  - Organization API key from Postiz Settings
 *   POSTIZ_API_URL  - Base URL of Postiz instance (default: http://host.docker.internal:4007/api)
 */

"use strict";

const readline = require("readline");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const API_KEY = process.env.POSTIZ_API_KEY || "";
const API_URL = (process.env.POSTIZ_API_URL || "http://host.docker.internal:4007/api").replace(/\/$/, "");

// ─── HTTP helper ────────────────────────────────────────────────────────────

function postizRequest(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/public/v1${path}`);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Authorization": API_KEY,
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Multipart upload helper ────────────────────────────────────────────────

function postizUploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/public/v1/upload`);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const boundary = "----MCP" + Date.now().toString(36);
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    // Determine mime type from extension
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".gif": "image/gif", ".webp": "image/webp", ".mp4": "video/mp4",
      ".mov": "video/quicktime",
    };
    const mime = mimeTypes[ext] || "application/octet-stream";

    const preamble = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, fileData, epilogue]);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Authorization": API_KEY,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data, statusCode: res.statusCode }); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "postiz_list_integrations",
    description:
      "List all connected social media accounts/channels available in Postiz. " +
      "Returns integration IDs needed for posting.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "postiz_create_post",
    description:
      "Create and schedule a social media post via Postiz. " +
      "Use postiz_list_integrations first to get integration IDs. " +
      "To post immediately set schedule_date to the current ISO timestamp.",
    inputSchema: {
      type: "object",
      properties: {
        integration_id: {
          type: "string",
          description: "The integration ID from postiz_list_integrations (e.g. 'cmlus86vx0005mg83ye5lei7a')",
        },
        content: {
          type: "string",
          description: "The text content of the post",
        },
        schedule_date: {
          type: "string",
          description:
            "ISO 8601 datetime when to publish (e.g. '2026-02-21T16:00:00Z'). " +
            "Use a date 2-5 minutes in the future to post immediately.",
        },
        media_paths: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of previously-uploaded media paths returned by postiz_upload_media",
        },
      },
      required: ["integration_id", "content", "schedule_date"],
    },
  },
  {
    name: "postiz_upload_media",
    description:
      "Upload a media file (image/video) to Postiz for use in posts. " +
      "Provide EITHER a local file path OR a public URL. " +
      "Local file path is preferred (uses multipart upload which preserves file extensions).",
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Local file path to upload (e.g. '/tmp/my-image.png'). Preferred method.",
        },
        url: {
          type: "string",
          description: "Public URL of the image or video (fallback if no local file).",
        },
      },
      required: [],
    },
  },
];

// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleTool(name, args) {
  if (name === "postiz_list_integrations") {
    const result = await postizRequest("/integrations");
    if (!Array.isArray(result)) {
      return `Error: ${JSON.stringify(result)}`;
    }
    return JSON.stringify(result, null, 2);
  }

  if (name === "postiz_create_post") {
    const { integration_id, content, schedule_date, media_paths = [] } = args;
    const postBody = {
      type: "now",
      date: schedule_date,
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: integration_id },
          value: [
            {
              content,
              image: media_paths.map((p) => ({
                id: p.id || "",
                path: p.path || p,
              })),
            },
          ],
          settings: { post_type: "post" },
        },
      ],
    };
    const result = await postizRequest("/posts", "POST", postBody);
    return JSON.stringify(result, null, 2);
  }

  if (name === "postiz_upload_media") {
    const { file_path: filePath, url } = args;
    let result;
    if (filePath) {
      // Preferred: multipart upload preserves file extensions
      result = await postizUploadFile(filePath);
    } else if (url) {
      // Fallback: upload from URL (note: may strip file extensions)
      result = await postizRequest("/upload-from-url", "POST", { url });
    } else {
      return "Error: provide either file_path or url";
    }
    return JSON.stringify(result, null, 2);
  }

  return `Unknown tool: ${name}`;
}

// ─── MCP protocol ────────────────────────────────────────────────────────────

function jsonrpc(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(msg) {
  const { method, id, params } = msg;

  if (method === "initialize") {
    return jsonrpc(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "postiz-mcp", version: "1.0.0" },
    });
  }

  if (method === "notifications/initialized") {
    return null; // no response for notifications
  }

  if (method === "tools/list") {
    return jsonrpc(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    try {
      const text = await handleTool(toolName, toolArgs);
      return jsonrpc(id, { content: [{ type: "text", text }] });
    } catch (err) {
      return jsonrpc(id, {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  }

  if (id !== undefined && id !== null) {
    return jsonrpcError(id, -32601, `Method not found: ${method}`);
  }
  return null;
}

// ─── Main loop ───────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch (e) {
    process.stdout.write(jsonrpcError(null, -32700, `Parse error: ${e.message}`) + "\n");
    return;
  }
  const response = await handleMessage(msg);
  if (response !== null) {
    process.stdout.write(response + "\n");
  }
});

rl.on("close", () => process.exit(0));
