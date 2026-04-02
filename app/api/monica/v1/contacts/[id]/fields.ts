// app/api/monica/v1/contacts/[id]/fields.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../../utils/errors';
import { addContactField } from '../../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query; // Get the contact ID from the URL

  if (typeof id !== 'string' || isNaN(Number(id))) {
    return sendError(res, 400, ErrorCode.InvalidInput, 'Invalid contact ID');
  }

  const contactId = Number(id);
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
  }

  switch (req.method) {
    case 'POST':
      try {
        const { field_type, value } = req.body;

        if (!field_type || !value) {
          return sendError(res, 400, ErrorCode.InvalidInput, 'Missing required fields: field_type, value');
        }
        
        const newField = await addContactField(token, contactId, field_type, value); 
        res.status(201).json(newField);
      } catch (error: any) {
        sendError(res, 500, ErrorCode.InternalServerError, error.message);
      }
      break;
    default:
      sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
  }
}

export default authenticate(handler);
