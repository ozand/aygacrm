// app/api/monica/v1/notes/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { addNote } from '../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'POST':
      try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
          return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
        }

        const { contact_id, body } = req.body;

        if (!contact_id || !body) {
          return sendError(res, 400, ErrorCode.InvalidInput, 'Missing required fields: contact_id, body');
        }
        
        const newNote = await addNote(token, contact_id, body); 
        res.status(201).json(newNote);
      } catch (error: any) {
        sendError(res, 500, ErrorCode.InternalServerError, error.message);
      }
      break;
    default:
      sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
  }
}

export default authenticate(handler);
