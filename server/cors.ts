import cors, { CorsOptions, CorsOptionsDelegate } from 'cors';

// CORS configuration for development
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow all origins in development
    if (!origin || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // In production, only allow specific origins
      const allowedOrigins = ['https://your-production-domain.com'];
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['set-cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

export default cors(corsOptions);
