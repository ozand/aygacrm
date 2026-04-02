// utils/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { sendError, ErrorCode } from './errors';

export function authenticate(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token || token !== process.env.MONICA_API_TOKEN) {
      return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication required');
    }

    return handler(req, res);
  };
}
