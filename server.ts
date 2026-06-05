import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';
import http from 'http';
import https from 'https';
import fs from 'fs';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 150, maxFreeSockets: 10, timeout: 60000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 150, maxFreeSockets: 10, timeout: 60000 });

async function startServer() {
  const app = express();
  let currentPort = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // API Proxy Route to bypass CORS
  app.post('/api/proxy', async (req, res) => {
    const { method, url, headers, data, params, timeout } = req.body;

    // Sanitizing forwarded headers to avoid misrouting, incorrect compression, or transport size mismatch
    const sanitizedHeaders: Record<string, string> = {
      'Keep-Alive': 'timeout=60'
    };
    if (headers && typeof headers === 'object') {
      const blocklist = ['host', 'connection', 'content-length', 'origin', 'referer', 'accept-encoding', 'cookie'];
      for (const [key, value] of Object.entries(headers)) {
        if (!blocklist.includes(key.toLowerCase())) {
          sanitizedHeaders[key] = String(value);
        }
      }
    }

    try {
      let response: any = await axios({
        method,
        url,
        headers: sanitizedHeaders,
        data,
        params,
        httpAgent,
        httpsAgent,
        validateStatus: () => true, // Return status even if error
        timeout: timeout || 25000, // Enforce client-specified timeout or fallback to 25s
        maxContentLength: 10 * 1024 * 1024, // Optimized safe 10MB limit to protect against OOM leaks
        maxBodyLength: 10 * 1024 * 1024,
      });

      const responseStatus = response.status;
      const responseStatusText = response.statusText;
      const responseHeaders = response.headers;
      const responseData = response.data;
      const responseDuration = response.headers ? (response.headers['request-duration'] || 0) : 0;

      // Eagerly null out massive response tree structure before express JSON stringifies
      (response as any) = null;
      (req as any).body = null; 

      res.status(200).json({
        status: responseStatus,
        statusText: responseStatusText,
        headers: responseHeaders,
        data: responseData,
        time: responseDuration,
      });
    } catch (error: any) {
      const errMsg = error.message || 'CORS Proxy Error';
      const errDetails = error.response?.data || error.stack || 'Target server was unreachable or rejected link';
      
      // Clear references
      (error as any) = null;
      (req as any).body = null;

      res.status(200).json({
        status: 0,
        statusText: 'CORS Proxy Connection Refused / Timeout',
        headers: {},
        data: {
          error: errMsg,
          details: errDetails
        }
      });
    }
  });

  // Global Exception & Rejection Shields to prevent unhandled background errors from crashing the Node.js process
  process.on('uncaughtException', (err) => {
    console.error('[Gimay Server] Uncaught Exception trapped:', err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Gimay Server] Unhandled Promise Rejection trapped at:', promise, 'for reason:', reason);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  function tryListen(port: number) {
    server.listen(port, '0.0.0.0');
  }

  server.on('listening', () => {
    console.log(`Server running on http://localhost:${currentPort}`);
    try {
      fs.writeFileSync(path.join(process.cwd(), '.port.tmp'), currentPort.toString(), 'utf-8');
    } catch (e) {
      console.error('Failed to write port file:', e);
    }
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${currentPort} is in use, trying next port...`);
      currentPort++;
      tryListen(currentPort);
    } else {
      console.error('Server error:', error);
    }
  });

  tryListen(currentPort);
}

startServer();
