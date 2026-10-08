import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { getJwtSecret } from '../utils/jwt.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. No token provided.',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = getJwtSecret();

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid or expired authorization token.',
        },
      });
    }

    // Verify user still exists in database
    const userResult = await query(
      'SELECT id, email, full_name, preferred_language FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User belonging to this token no longer exists.',
        },
      });
    }

    // Attach authenticated user to request
    req.user = userResult.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
