import { vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock `next/dist/server/api-utils/node`
// Specifically, we need to mock `apiResolver`
vi.mock('next/dist/server/api-utils/node', () => ({
  apiResolver: async (
    req: NextApiRequest,
    res: NextApiResponse,
    query: any,
    handler: Function,
    connection: any,
    _is  : boolean,
  ) => {
    // Simulate the behavior of apiResolver:
    // It calls the handler with req, res, and potentially other arguments.
    // For simplicity, we'll just call the handler with req and res.
    // In a real scenario, you might need to deeply mock req/res/query based on test needs.
    req.query = query;
    await handler(req, res);
  },
}));
