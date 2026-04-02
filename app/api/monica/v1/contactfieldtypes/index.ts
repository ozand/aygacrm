// app/api/monica/v1/contactfieldtypes/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { listContactFieldTypes } from '../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
          return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
        }
        
        const fieldTypes = await listContactFieldTypes(token); 
        res.status(200).json(fieldTypes);
      } catch (error: any) {
        sendError(res, 500, ErrorCode.InternalServerError, error.message);
      }
      break;
    default:
      sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
  }
}

export default authenticate(handler);
