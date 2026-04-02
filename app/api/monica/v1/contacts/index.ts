// app/api/monica/v1/contacts/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { createContact } from '../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'POST':
      try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
          return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
        }
        const newContact = await createContact(token, req.body);
        res.status(201).json(newContact);
      } catch (error: any) {
        sendError(res, 500, ErrorCode.InternalServerError, error.message);
      }
      break;
    default:
      sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
  }
}

export default authenticate(handler);
