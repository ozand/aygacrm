// tests/api/mcp.test.ts
import { test, expect, vi } from 'vitest';
import { createServer } from 'http';
import { apiResolver } from 'next/dist/server/api-utils/node';
import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'url';

// Mock environment variables for testing
process.env.MONICA_API_TOKEN = 'test-token';
process.env.MONICA_API_BASE_URL = 'http://localhost:3001/api'; // Mock Monica API

// Mock the monicaApi functions for testing
vi.mock('../../monicaApi', () => ({
  createContact: vi.fn((token, data) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    return { id: 1, ...data };
  }),
  searchContacts: vi.fn((token, query) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (query === 'test') return { data: [{ id: 1, first_name: 'Test' }] };
    return { data: [] };
  }),
  logActivity: vi.fn((token, contactId, summary) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    return { id: 101, contact_id: contactId, summary };
  }),
  listTasks: vi.fn((token, contactId) => {
    if (token !== process.env.MONICA_API_TOKEN) throw new Error('Unauthorized');
    if (contactId === 1) return { data: [{ id: 201, title: 'Task for Contact 1', contact_id: 1 }] };
    return { data: [{ id: 200, title: 'Global Task' }] };
  }),
}));

// Helper to simulate API requests to the MCP endpoint
async function makeMcpRequest(payload: any) {
  const handler = await import('../../app/api/mcp/route'); // Import the MCP route handler
  
  const request = createServer(async (req, res) => {
    // For POST requests, we need to handle the body
    req.method = 'POST';
    req.url = '/api/mcp';

    const mockReq: Partial<NextApiRequest> = {
      method: 'POST',
      url: '/api/mcp',
      headers: { 'content-type': 'application/json' },
      body: payload,
    };

    // Simulate the request body for the Next.js API route
    // This is a simplified approach, a real test setup might use supertest or similar
    const json = () => Promise.resolve(payload);
    const mockRes: Partial<NextApiResponse> = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
    };

    const response = await handler.POST({ json } as any);
    const jsonResponse = await response.json();
    return { status: response.status, json: jsonResponse };

  });

  return new Promise((resolve, reject) => {
    request.listen(0, () => {
      const { port } = request.address() as any;
      const apiUrl = `http://localhost:${port}/api/mcp`;
      
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      .then(res => res.json().then(json => resolve({ status: res.status, json })))
      .catch(reject)
      .finally(() => request.close());
    });
  });
}

test('MCP GET /api/mcp - returns manifest', async () => {
  const handler = await import('../../app/api/mcp/route');
  const response = await handler.GET();
  const jsonResponse = await response.json();
  expect(response.status).toBe(200);
  expect(jsonResponse.name).toBe('monica-crm-adapter');
  expect(jsonResponse.tools).toBeDefined();
  expect(Object.keys(jsonResponse.tools)).toContain('monica_create_contact');
});

test('MCP POST /api/mcp - monica_create_contact action', async () => {
  const payload = {
    jsonrpc: '2.0',
    id: '1',
    method: 'monica_create_contact',
    params: {
      contactData: { first_name: 'MCP', last_name: 'Test' },
    },
  };
  const { status, json } = await makeMcpRequest(payload);
  expect(status).toBe(200);
  expect(json.result).toEqual({ id: 1, first_name: 'MCP', last_name: 'Test' });
});

test('MCP POST /api/mcp - monica_search_contacts action', async () => {
  const payload = {
    jsonrpc: '2.0',
    id: '2',
    method: 'monica_search_contacts',
    params: {
      query: 'test',
    },
  };
  const { status, json } = await makeMcpRequest(payload);
  expect(status).toBe(200);
  expect(json.result.data).toEqual([{ id: 1, first_name: 'Test' }]);
});

test('MCP POST /api/mcp - monica_log_activity action', async () => {
  const payload = {
    jsonrpc: '2.0',
    id: '3',
    method: 'monica_log_activity',
    params: {
      contactId: 1,
      summary: 'MCP logged activity',
    },
  };
  const { status, json } = await makeMcpRequest(payload);
  expect(status).toBe(200);
  expect(json.result).toEqual({ id: 101, contact_id: 1, summary: 'MCP logged activity' });
});

test('MCP POST /api/mcp - monica_list_tasks action', async () => {
  const payload = {
    jsonrpc: '2.0',
    id: '4',
    method: 'monica_list_tasks',
    params: {},
  };
  const { status, json } = await makeMcpRequest(payload);
  expect(status).toBe(200);
  expect(json.result.data).toEqual([{ id: 200, title: 'Global Task' }]);
});

test('MCP POST /api/mcp - unknown method', async () => {
  const payload = {
    jsonrpc: '2.0',
    id: '5',
    method: 'unknown_method',
    params: {},
  };
  const { status, json } = await makeMcpRequest(payload);
  expect(status).toBe(500); // MCP SDK returns 500 for unknown methods
  expect(json.error).toBeDefined();
});
