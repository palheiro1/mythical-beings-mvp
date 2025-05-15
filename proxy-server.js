// Local proxy server for development to avoid CORS issues
// Save this file as proxy-server.js in the root of your project
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:5173', // Your frontend dev server
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Info', 'Apikey'],
  credentials: true
}));

// Proxy middleware for Supabase Edge Functions
app.use('/api/moralis-auth', createProxyMiddleware({
  target: process.env.SUPABASE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/moralis-auth': '/functions/v1/moralis-auth'
  },
  onProxyReq: (proxyReq, req, res) => {
    // Log the request
    console.log('Proxying request:', {
      method: req.method,
      url: req.url,
      headers: req.headers
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log the response status
    console.log('Proxy response:', {
      status: proxyRes.statusCode,
      headers: proxyRes.headers
    });
  }
}));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Proxying requests to ${process.env.SUPABASE_URL}`);
});
