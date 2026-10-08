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
import assessmentRoutes from './routes/assessment.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { notFoundHandler, centralErrorHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimiter.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

// Security Headers & CORS
app.use(helmet());

const clientOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL;
const isProd = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Localhost origins allowed for development & testing
      const devOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      if (devOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Strict production check: allow CLIENT_ORIGIN (or Vercel preview domains if CLIENT_ORIGIN matches)
      if (clientOrigin) {
        if (origin === clientOrigin) return callback(null, true);
        if (clientOrigin.includes('vercel.app') && origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
      }

      if (!isProd && !clientOrigin) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

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
app.use('/api/assessments', assessmentRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/chat', chatRoutes);

// Catch 404
app.use(notFoundHandler);

// Central Error Handler
app.use(centralErrorHandler);

export default app;
