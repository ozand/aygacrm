// tests/api/monica/v1/contacts.test.ts
import { test, expect, vi } from 'vitest'; // Assuming Vitest is available or will be configured
import { createServer } from 'http';
import { apiResolver } from 'next/dist/server/api-utils/node';
import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'url';

// Mock environment variables for testing
process.env.MONICA_API_TOKEN = 'test-token';
process.env.MONICA_API_BASE_URL = 'http://localhost:3001/api'; // Mock Monica API

// Mock the monicaApi functions for testing
// In a real scenario, you would mock the actual network requests or use a testing library like nock
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

// Test for invalid contact ID
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
