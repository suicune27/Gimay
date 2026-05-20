import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { method, url, headers, data, params } = req.body;

  const sanitizedHeaders: Record<string, string> = {};
  if (headers && typeof headers === 'object') {
    const blocklist = ['host', 'connection', 'content-length', 'origin', 'referer', 'accept-encoding', 'cookie'];
    for (const [key, value] of Object.entries(headers)) {
      if (!blocklist.includes(key.toLowerCase())) {
        sanitizedHeaders[key] = String(value);
      }
    }
  }

  try {
    const response = await axios({
      method,
      url,
      headers: sanitizedHeaders,
      data,
      params,
      validateStatus: () => true, // Return status even if error
      timeout: 25000, // Safe 25s timeout limit to prevent hanging connections
      maxContentLength: 50 * 1024 * 1024, // Safe 50MB content length limit to shield against OOM leaks
      maxBodyLength: 50 * 1024 * 1024,
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
}