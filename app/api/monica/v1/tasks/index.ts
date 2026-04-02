// app/api/monica/v1/tasks/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { listTasks, createTask } from '../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
  }

  try {
    switch (req.method) {
      case 'GET':
        const { contactId } = req.query;
        const tasks = await listTasks(token, contactId ? Number(contactId) : undefined);
        res.status(200).json(tasks);
        break;
      case 'POST':
        const newTask = await createTask(token, req.body);
        res.status(201).json(newTask);
        break;
      default:
        sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    sendError(res, 500, ErrorCode.InternalServerError, error.message);
  }
}

export default authenticate(handler);
