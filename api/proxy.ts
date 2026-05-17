import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}