import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import * as webpush from 'web-push';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = process.env.DEFAULT_APP_PORT
  ? Number(process.env.DEFAULT_APP_PORT)
  : IS_PRODUCTION && process.env.PORT && process.env.PORT !== process.env.NGINX_PORT
  ? Number(process.env.PORT)
  : 3000;
const VAPID_FILE_PATH = path.resolve(process.cwd(), '.vapid-keys.json');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function loadOrCreateVapidKeys(): VapidKeys {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate };
  }

  try {
    if (fs.existsSync(VAPID_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE_PATH, 'utf8'));
      if (parsed?.publicKey && parsed?.privateKey) {
        return { publicKey: String(parsed.publicKey), privateKey: String(parsed.privateKey) };
      }
    }
  } catch (err) {
    console.warn('[WebPush] Impossible de lire .vapid-keys.json:', err);
  }

  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(
      VAPID_FILE_PATH,
      JSON.stringify({ publicKey: generated.publicKey, privateKey: generated.privateKey }, null, 2),
      { mode: 0o600 }
    );
  } catch (err) {
    console.warn('[WebPush] Impossible de persister .vapid-keys.json:', err);
  }
  return generated;
}

const vapidKeys = loadOrCreateVapidKeys();
const vapidSubject = process.env.VAPID_SUBJECT?.trim() || 'mailto:contact@erouama.app';

try {
  webpush.setVapidDetails(vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);
} catch (err) {
  console.error('[WebPush] Erreur configuration VAPID:', err);
}

interface StoredPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushSendRequestBody {
  subscriptions?: StoredPushSubscription[];
  payload?: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
    data?: Record<string, unknown>;
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, webPushConfigured: Boolean(vapidKeys.publicKey) });
  });

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post('/api/push/send', async (req, res) => {
    try {
      const body = (req.body || {}) as PushSendRequestBody;
      const rawSubs = Array.isArray(body.subscriptions) ? body.subscriptions : [];
      const payloadInput = body.payload || {};

      if (rawSubs.length === 0) {
        res.json({ ok: true, sent: 0, failed: 0, expiredEndpoints: [] });
        return;
      }

      // Déduplication stricte par endpoint et validation minimale
      const uniqueMap = new Map<string, StoredPushSubscription>();
      for (const sub of rawSubs) {
        if (
          sub &&
          typeof sub.endpoint === 'string' &&
          sub.endpoint.startsWith('https://') &&
          sub.keys &&
          typeof sub.keys.p256dh === 'string' &&
          typeof sub.keys.auth === 'string'
        ) {
          uniqueMap.set(sub.endpoint, {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime ?? null,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          });
        }
        if (uniqueMap.size >= 100) break;
      }

      const subscriptions = Array.from(uniqueMap.values());
      if (subscriptions.length === 0) {
        res.json({ ok: true, sent: 0, failed: 0, expiredEndpoints: [] });
        return;
      }

      const targetUrl = typeof payloadInput.url === 'string' && payloadInput.url ? payloadInput.url : '/';
      const title = String(payloadInput.title || 'E-ROUAMA').slice(0, 140);
      const msgBody = String(payloadInput.body || '').slice(0, 500);
      const tag = String(payloadInput.tag || `erouama-${Date.now()}`);

      const pushPayload = JSON.stringify({
        notification: {
          title,
          body: msgBody,
          icon: payloadInput.icon || '/icon-192.png',
          badge: payloadInput.badge || '/icon-192.png',
          tag,
        },
        data: {
          ...(payloadInput.data || {}),
          title,
          body: msgBody,
          tag,
          url: targetUrl,
          click_action: targetUrl,
        },
      });

      const expiredEndpoints: string[] = [];
      let sent = 0;
      let failed = 0;

      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(sub, pushPayload, {
              TTL: 86400,
              urgency: 'high',
            });
            sent++;
          } catch (err: any) {
            failed++;
            const statusCode = err?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              expiredEndpoints.push(sub.endpoint);
            } else {
              console.warn('[WebPush] Échec envoi push:', statusCode || err?.message);
            }
          }
        })
      );

      void results;
      res.json({ ok: true, sent, failed, expiredEndpoints });
    } catch (err: any) {
      console.error('[WebPush] Erreur /api/push/send:', err);
      res.status(500).json({ ok: false, error: 'Erreur envoi Web Push' });
    }
  });

  // Headers no-cache pour Service Worker, manifest et version.json
  app.use((req, res, next) => {
    if (
      req.path === '/firebase-messaging-sw.js' ||
      req.path === '/version.json' ||
      req.path === '/manifest.json'
    ) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('.html') ||
            filePath.endsWith('firebase-messaging-sw.js') ||
            filePath.endsWith('version.json') ||
            filePath.endsWith('manifest.json')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 E-ROUAMA Server (Express + WebPush VAPID) actif sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erreur critique démarrage serveur:', err);
  process.exit(1);
});
