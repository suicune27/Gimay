import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
