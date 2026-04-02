// tests/api/monica/v1/monica-api.test.ts
import { test, expect, vi } from 'vitest';
import { createServer } from 'http';
import { apiResolver } from 'next/dist/server/api-utils/node';
import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'url';

// Mock environment variables for testing
process.env.MONICA_API_TOKEN = 'test-token';
process.env.MONICA_API_BASE_URL = 'http://localhost:3001/api'; // Mock Monica API

// Mock the monicaApi functions for testing
vi.mock('../../../../monicaApi', () => ({
  searchContacts: vi.fn((token, query) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (query === 'test') return { data: [{ id: 1, first_name: 'Test' }] };
    return { data: [] };
  }),
  getContact: vi.fn((token, id) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (id === 1) return { id: 1, first_name: 'Test' };
    throw new Error('Contact not found');
  }),
  createContact: vi.fn((token, data) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    return { id: 2, ...data };
  }),
  updateContact: vi.fn((token, id, data) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (id === 1) return { id: 1, ...data };
    throw new Error('Contact not found');
  }),
  deleteContact: vi.fn((token, id) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (id === 1) return { message: 'Contact deleted' };
    throw new Error('Contact not found');
  }),
  // Mock Task API functions
  listTasks: vi.fn((token, contactId) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (contactId === 1) return { data: [{ id: 101, title: 'Task for Contact 1', contact_id: 1 }] };
    return { data: [{ id: 100, title: 'Global Task' }] };
  }),
  getTask: vi.fn((token, id) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (id === 100) return { id: 100, title: 'Global Task' };
    if (id === 101) return { id: 101, title: 'Task for Contact 1', contact_id: 1 };
    throw new Error('Task not found');
  }),
  createTask: vi.fn((token, data) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    return { id: 102, ...data };
  }),
  updateTask: vi.fn((token, id, data) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (id === 100) return { id: 100, ...data };
    throw new Error('Task not found');
  }),
  deleteTask: vi.fn((token, id) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (id === 100) return { message: 'Task deleted' };
    throw new Error('Task not found');
  }),
}));

// Helper to simulate API requests
async function makeApiRequest(
  handler: Function,
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>
) {
  const request = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true);
    await apiResolver(
      req as NextApiRequest,
      res as NextApiResponse,
      parsedUrl.query,
      handler,
      {},
      false
    );
  });

  return new Promise((resolve, reject) => {
    request.listen(0, () => {
      const { port } = request.address() as any;
      const apiUrl = `http://localhost:${port}${url}`;
      
      fetch(apiUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      .then(res => res.json().then(json => resolve({ status: res.status, json })))
      .catch(reject)
      .finally(() => request.close());
    });
  });
}

// Import the API handlers
import contactsSearchHandler from '../../../../app/api/monica/v1/contacts/search';
import contactsIndexHandler from '../../../../app/api/monica/v1/contacts/index';
import contactsIdHandler from '../../../../app/api/monica/v1/contacts/[id]';
import tasksIndexHandler from '../../../../app/api/monica/v1/tasks/index';
import tasksIdHandler from '../../../../app/api/monica/v1/tasks/[id]';

// Contact API Tests
test('GET /api/monica/v1/contacts - unauthorized', async () => {
  const { status, json } = await makeApiRequest(contactsSearchHandler, 'GET', '/api/monica/v1/contacts');
  expect(status).toBe(401);
  expect(json.error.code).toBe('UNAUTHORIZED');
});

test('GET /api/monica/v1/contacts - authorized', async () => {
  const { status, json } = await makeApiRequest(
    contactsSearchHandler,
    'GET',
    '/api/monica/v1/contacts?query=test',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(200);
  expect(json.data).toEqual([{ id: 1, first_name: 'Test' }]);
});

test('POST /api/monica/v1/contacts - create new contact', async () => {
  const { status, json } = await makeApiRequest(
    contactsIndexHandler,
    'POST',
    '/api/monica/v1/contacts',
    { first_name: 'New', last_name: 'Contact' },
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(201);
  expect(json).toEqual({ id: 2, first_name: 'New', last_name: 'Contact' });
});

test('GET /api/monica/v1/contacts/:id - retrieve contact', async () => {
  const { status, json } = await makeApiRequest(
    contactsIdHandler,
    'GET',
    '/api/monica/v1/contacts/1',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(200);
  expect(json).toEqual({ id: 1, first_name: 'Test' });
});

test('PUT /api/monica/v1/contacts/:id - update contact', async () => {
  const { status, json } = await makeApiRequest(
    contactsIdHandler,
    'PUT',
    '/api/monica/v1/contacts/1',
    { first_name: 'Updated' },
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(200);
  expect(json).toEqual({ id: 1, first_name: 'Updated' });
});

test('DELETE /api/monica/v1/contacts/:id - delete contact', async () => {
  const { status } = await makeApiRequest(
    contactsIdHandler,
    'DELETE',
    '/api/monica/v1/contacts/1',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(204);
});

test('GET /api/monica/v1/contacts/:id - invalid ID', async () => {
  const { status, json } = await makeApiRequest(
    contactsIdHandler,
    'GET',
    '/api/monica/v1/contacts/abc',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(400);
  expect(json.error.code).toBe('INVALID_INPUT');
});

// Task API Tests
test('GET /api/monica/v1/tasks - list all tasks', async () => {
  const { status, json } = await makeApiRequest(
    tasksIndexHandler,
    'GET',
    '/api/monica/v1/tasks',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(200);
  expect(json.data).toEqual([{ id: 100, title: 'Global Task' }]);
});

test('GET /api/monica/v1/tasks?contactId=1 - list tasks for a contact', async () => {
  const { status, json } = await makeApiRequest(
    tasksIndexHandler,
    'GET',
    '/api/monica/v1/tasks?contactId=1',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(200);
  expect(json.data).toEqual([{ id: 101, title: 'Task for Contact 1', contact_id: 1 }]);
});

test('POST /api/monica/v1/tasks - create new task', async () => {
  const { status, json } = await makeApiRequest(
    tasksIndexHandler,
    'POST',
    '/api/monica/v1/tasks',
    { title: 'New Task', contact_id: 1 },
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(201);
  expect(json).toEqual({ id: 102, title: 'New Task', contact_id: 1 });
});

test('GET /api/monica/v1/tasks/:id - retrieve task', async () => {
  const { status, json } = await makeApiRequest(
    tasksIdHandler,
    'GET',
    '/api/monica/v1/tasks/100',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(200);
  expect(json).toEqual({ id: 100, title: 'Global Task' });
});

test('PUT /api/monica/v1/tasks/:id - update task', async () => {
  const { status, json } = await makeApiRequest(
    tasksIdHandler,
    'PUT',
    '/api/monica/v1/tasks/100',
    { title: 'Updated Task' },
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(200);
  expect(json).toEqual({ id: 100, title: 'Updated Task' });
});

test('DELETE /api/monica/v1/tasks/:id - delete task', async () => {
  const { status } = await makeApiRequest(
    tasksIdHandler,
    'DELETE',
    '/api/monica/v1/tasks/100',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(204);
});

test('GET /api/monica/v1/tasks/:id - invalid ID', async () => {
  const { status, json } = await makeApiRequest(
    tasksIdHandler,
    'GET',
    '/api/monica/v1/tasks/abc',
    undefined,
    { Authorization: 'Bearer test-token' }
  );
  expect(status).toBe(400);
  expect(json.error.code).toBe('INVALID_INPUT');
});
