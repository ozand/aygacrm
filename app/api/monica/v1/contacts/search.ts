// api/monica/v1/contacts/search.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { searchContacts } from '../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { query } = req.query;
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
      }

      const contacts = await searchContacts(token, query as string);
      res.status(200).json(contacts);
    } catch (error: any) {
      sendError(res, 500, ErrorCode.InternalServerError, error.message);
    }
  } else {
    sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
  }
}

export default authenticate(handler);
