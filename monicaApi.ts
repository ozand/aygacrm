// monicaApi.ts
const MONICA_API_BASE_URL = process.env.MONICA_API_BASE_URL || 'https://app.monicahq.com/api';

async function monicaApiRequest(
  method: string,
  path: string,
  token: string,
  data?: any,
  query?: Record<string, any>
) {
  const url = new URL(`${MONICA_API_BASE_URL}${path}`);
  if (query) {
    Object.keys(query).forEach(key => url.searchParams.append(key, query[key]));
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url.toString(), config);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Monica API error: ${response.statusText}`);
  }

  return response.json();
}

export async function searchContacts(token: string, query?: string) {
  return monicaApiRequest('GET', '/contacts', token, undefined, { query });
}

export async function getContact(token: string, contactId: number) {
  return monicaApiRequest('GET', `/contacts/${contactId}`, token);
}

export async function createContact(token: string, contactData: any) {
  return monicaApiRequest('POST', '/contacts', token, contactData);
}

export async function updateContact(token: string, contactId: number, contactData: any) {
  return monicaApiRequest('PUT', `/contacts/${contactId}`, token, contactData);
}

export async function deleteContact(token: string, contactId: number) {
  return monicaApiRequest('DELETE', `/contacts/${contactId}`, token);
}

export async function logActivity(
  token: string,
  contactId: number,
  summary: string,
  happenedAt?: string,
  description?: string
) {
  const activityData = {
    contact_id: contactId,
    summary,
    happened_at: happenedAt,
    description,
  };
  return monicaApiRequest('POST', '/activities', token, activityData);
}

export async function addNote(token: string, contactId: number, body: string) {
  const noteData = {
    contact_id: contactId,
    note: body, // Monica API expects 'note' for the content of the note
  };
  return monicaApiRequest('POST', '/notes', token, noteData);
}

export async function addContactField(
  token: string,
  contactId: number,
  field_type: string,
  value: string
) {
  const fieldData = {
    contact_id: contactId,
    contact_field_type_id: field_type, // Assuming field_type is the ID for the custom field type
    data: value, // The value of the field
  };
  return monicaApiRequest('POST', `/contacts/${contactId}/contactFields`, token, fieldData);
}

export async function listContactFieldTypes(token: string) {
  return monicaApiRequest('GET', '/contactfieldtypes', token);
}

export async function listTasks(token: string, contactId?: number) {
  const path = contactId ? `/contacts/${contactId}/tasks` : '/tasks';
  return monicaApiRequest('GET', path, token);
}

export async function getTask(token: string, taskId: number) {
  return monicaApiRequest('GET', `/tasks/${taskId}`, token);
}

export async function createTask(token: string, taskData: any) {
  return monicaApiRequest('POST', '/tasks', token, taskData);
}

export async function updateTask(token: string, taskId: number, taskData: any) {
  return monicaApiRequest('PUT', `/tasks/${taskId}`, token, taskData);
}

export async function deleteTask(token: string, taskId: number) {
  return monicaApiRequest('DELETE', `/tasks/${taskId}`, token);
}
