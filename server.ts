import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';
import http from 'http';
import fs from 'fs';

async function startServer() {
  const app = express();
  let currentPort = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // API Proxy Route to bypass CORS
  app.post('/api/proxy', async (req, res) => {
    const { method, url, headers, data, params } = req.body;

    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
        params,
        validateStatus: () => true, // Return status even if error
      });

      res.status(200).json({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        time: response.headers['request-duration'] || 0, // Fallback if needed
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
        details: error.response?.data || 'An error occurred during the request',
      });
    }
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
