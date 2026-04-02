// app/api/monica/v1/contacts/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { getContact, updateContact, deleteContact } from '../../../../../monicaApi';

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

  try {
    switch (req.method) {
      case 'GET':
        const contact = await getContact(token, contactId);
        res.status(200).json(contact);
        break;
      case 'PUT':
      case 'PATCH':
        const updatedContact = await updateContact(token, contactId, req.body);
        res.status(200).json(updatedContact);
        break;
      case 'DELETE':
        await deleteContact(token, contactId);
        res.status(204).end(); // No content for successful deletion
        break;
      default:
        sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    sendError(res, 500, ErrorCode.InternalServerError, error.message);
  }
}

export default authenticate(handler);
