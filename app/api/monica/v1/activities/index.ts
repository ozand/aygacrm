// app/api/monica/v1/activities/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { logActivity } from '../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'POST':
      try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
          return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
        }

        const { contact_id, summary, happened_at, description } = req.body;

        if (!contact_id || !summary) {
          return sendError(res, 400, ErrorCode.InvalidInput, 'Missing required fields: contact_id, summary');
        }
        
        const newActivity = await logActivity(token, contact_id, summary, happened_at, description); 
        res.status(201).json(newActivity);
      } catch (error: any) {
        sendError(res, 500, ErrorCode.InternalServerError, error.message);
      }
      break;
    default:
      sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
  }
}

export default authenticate(handler);
