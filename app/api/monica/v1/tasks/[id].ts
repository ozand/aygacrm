// app/api/monica/v1/tasks/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../../utils/auth';
import { sendError, ErrorCode } from '../../../../../utils/errors';
import { getTask, updateTask, deleteTask } from '../../../../../monicaApi';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || isNaN(Number(id))) {
    return sendError(res, 400, ErrorCode.InvalidInput, 'Invalid task ID');
  }

  const taskId = Number(id);
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return sendError(res, 401, ErrorCode.Unauthorized, 'Authentication token missing');
  }

  try {
    switch (req.method) {
      case 'GET':
        const task = await getTask(token, taskId);
        res.status(200).json(task);
        break;
      case 'PUT':
      case 'PATCH':
        const updatedTask = await updateTask(token, taskId, req.body);
        res.status(200).json(updatedTask);
        break;
      case 'DELETE':
        await deleteTask(token, taskId);
        res.status(204).end();
        break;
      default:
        sendError(res, 405, ErrorCode.MethodNotAllowed, `Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    sendError(res, 500, ErrorCode.InternalServerError, error.message);
  }
}

export default authenticate(handler);
