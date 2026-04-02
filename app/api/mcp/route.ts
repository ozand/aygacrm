// @ts-nocheck
// app/api/mcp/route.ts
import { NextResponse } from 'next/server';
import { ModelContextProtocol } from '@modelcontextprotocol/sdk';
import * as monicaApi from '../../../../monicaApi'; // Import all functions from monicaApi.ts

// Define the tools for the MCP server
const tools = {
  monica_create_contact: {
    description: "Creates a new contact in Monica CRM.",
    parameters: {
      type: "object",
      properties: {
        contactData: {
          type: "object",
          description: "Data for the new contact (e.g., first_name, last_name, birthdate).",
        },
      },
      required: ["contactData"],
    },
    handler: async (args: { contactData: any }) => {
      // In a real scenario, the token would come from a secure context,
      // not directly from process.env in a client-facing route.
      // For this example, we'll use a placeholder.
      const token = process.env.MONICA_API_TOKEN; 
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.createContact(token, args.contactData);
    },
  },
  monica_get_contact: {
    description: "Retrieves a contact by ID.",
    parameters: {
      type: "object",
      properties: {
        contactId: {
          type: "number",
          description: "The ID of the contact to retrieve.",
        },
      },
      required: ["contactId"],
    },
    handler: async (args: { contactId: number }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.getContact(token, args.contactId);
    },
  },
  monica_search_contacts: {
    description: "Searches for contacts by a query string.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query string.",
        },
      },
      required: ["query"],
    },
    handler: async (args: { query: string }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.searchContacts(token, args.query);
    },
  },
  monica_update_contact: {
    description: "Updates an existing contact by its ID.",
    parameters: {
      type: "object",
      properties: {
        contactId: {
          type: "number",
          description: "The ID of the contact to update.",
        },
        contactData: {
          type: "object",
          description: "The updated contact data.",
        },
      },
      required: ["contactId", "contactData"],
    },
    handler: async (args: { contactId: number; contactData: any }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.updateContact(token, args.contactId, args.contactData);
    },
  },
  monica_delete_contact: {
    description: "Deletes a contact by its ID.",
    parameters: {
      type: "object",
      properties: {
        contactId: {
          type: "number",
          description: "The ID of the contact to delete.",
        },
      },
      required: ["contactId"],
    },
    handler: async (args: { contactId: number }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.deleteContact(token, args.contactId);
    },
  },
  monica_log_activity: {
    description: "Logs a new activity for a contact.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "The ID of the contact." },
        summary: { type: "string", description: "A summary of the activity." },
        happenedAt: { type: "string", description: "Date and time of the activity (e.g., 'YYYY-MM-DD HH:MM:SS')." },
        description: { type: "string", description: "Detailed description of the activity." },
      },
      required: ["contactId", "summary"],
    },
    handler: async (args: { contactId: number; summary: string; happenedAt?: string; description?: string }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.logActivity(token, args.contactId, args.summary, args.happenedAt, args.description);
    },
  },
  monica_add_note: {
    description: "Adds a new note to a contact.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "The ID of the contact." },
        body: { type: "string", description: "The content of the note." },
      },
      required: ["contactId", "body"],
    },
    handler: async (args: { contactId: number; body: string }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.addNote(token, args.contactId, args.body);
    },
  },
  monica_list_contact_field_types: {
    description: "Lists available custom contact field types.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.listContactFieldTypes(token);
    },
  },
  monica_add_contact_field: {
    description: "Adds a custom field to a contact.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "The ID of the contact." },
        fieldType: { type: "string", description: "The ID or identifier of the contact field type." },
        value: { type: "string", description: "The value for the custom field." },
      },
      required: ["contactId", "fieldType", "value"],
    },
    handler: async (args: { contactId: number; fieldType: string; value: string }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.addContactField(token, args.contactId, args.fieldType, args.value);
    },
  },
  monica_list_tasks: {
    description: "Retrieves a list of tasks, optionally filtered by contact ID.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "Filter tasks by contact ID." },
      },
    },
    handler: async (args: { contactId?: number }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.listTasks(token, args.contactId);
    },
  },
  monica_get_task: {
    description: "Retrieves a single task by its ID.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The ID of the task to retrieve." },
      },
      required: ["taskId"],
    },
    handler: async (args: { taskId: number }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.getTask(token, args.taskId);
    },
  },
  monica_create_task: {
    description: "Creates a new task.",
    parameters: {
      type: "object",
      properties: {
        taskData: {
          type: "object",
          description: "Data for the new task (e.g., title, description, contact_id, due_date, status).",
        },
      },
      required: ["taskData"],
    },
    handler: async (args: { taskData: any }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.createTask(token, args.taskData);
    },
  },
  monica_update_task: {
    description: "Updates an existing task by its ID.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The ID of the task to update." },
        taskData: { type: "object", description: "The updated task data." },
      },
      required: ["taskId", "taskData"],
    },
    handler: async (args: { taskId: number; taskData: any }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.updateTask(token, args.taskId, args.taskData);
    },
  },
  monica_delete_task: {
    description: "Deletes a task by its ID.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The ID of the task to delete." },
      },
      required: ["taskId"],
    },
    handler: async (args: { taskId: number }) => {
      const token = process.env.MONICA_API_TOKEN;
      if (!token) throw new Error('MONICA_API_TOKEN is not set.');
      return monicaApi.deleteTask(token, args.taskId);
    },
  },
};

// Create the MCP server instance
const mcp = new ModelContextProtocol({
  name: 'monica-crm-adapter',
  description: 'Adapter for Monica CRM functionalities',
  tools: tools,
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const response = await mcp.handleRequest(json);
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(mcp.getManifest());
}
