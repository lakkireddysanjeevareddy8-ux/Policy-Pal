import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import schemeRoutes from './routes/scheme.routes.js';
import documentRoutes from './routes/document.routes.js';
import matchRoutes from './routes/match.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { notFoundHandler, centralErrorHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimiter.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

// Security Headers & CORS
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true); // Allow during development
    },
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter
app.use('/api', apiLimiter);

// Health Check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'PolicyPal API',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Catch 404
app.use(notFoundHandler);

// Central Error Handler
app.use(centralErrorHandler);

export default app;
