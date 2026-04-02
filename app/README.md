# Monica - Personal Relationship Manager

Modern rewrite of [Monica CRM](https://github.com/monicahq/monica) using Next.js 15, TypeScript, Prisma, and PostgreSQL.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** NextAuth.js (Auth.js v5)
- **Styling:** Tailwind CSS v4
- **UI Components:** Shadcn/ui
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your database connection:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/monica"
   AUTH_SECRET="your-secret-key-minimum-32-characters"
   ```

3. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

4. **Run database migrations:**
   ```bash
   npx prisma db push
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages (login, register)
│   ├── (dashboard)/       # Protected dashboard pages
│   │   ├── contacts/      # Contact management
│   │   ├── dashboard/     # Main dashboard
│   │   ├── journal/       # Journal entries
│   │   └── settings/      # User settings
│   └── api/               # API routes
├── components/
│   ├── features/          # Feature-specific components
│   └── ui/                # Shadcn/ui components
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Prisma client
│   └── utils.ts           # Utility functions
├── server/
│   ├── actions/           # Server actions
│   └── services/          # Business logic
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript type definitions
```

## Features

### Implemented
- [x] Project setup with Next.js 15
- [x] PostgreSQL database with Prisma ORM
- [x] Complete database schema (50+ models)
- [x] Authentication (Email/Password, Google, GitHub)
- [x] Dashboard layout with sidebar
- [x] Basic pages structure

### Roadmap
- [ ] Contact CRUD operations
- [ ] Contact relationships
- [ ] Birthday reminders
- [ ] Notes and activities
- [ ] Journal with mood tracking
- [ ] File uploads
- [ ] Search functionality
- [ ] Settings and preferences
- [ ] Data export/import
- [ ] CalDAV/CardDAV sync

## Database Schema

The Prisma schema includes all entities from the original Monica:

- **Core:** Account, User, Vault
- **Contacts:** Contact, Gender, Pronoun, Religion
- **Information:** Address, ContactInformation, ImportantDate
- **Relationships:** RelationshipType, Relationship, Group
- **Activities:** Note, Activity, Call, LifeEvent
- **Journal:** Journal, Post, SliceOfLife, MoodTracking
- **And more:** Tasks, Goals, Gifts, Loans, Files, Templates

## Development

```bash
# Run development server
npm run dev

# Run Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database
npx prisma db push

# Create a migration
npx prisma migrate dev --name migration_name

# Type checking
npm run lint
```

## License

AGPL-3.0-or-later (same as original Monica)

## API Endpoints

This section documents the Next.js API Routes implemented for Monica CRM.

### Base URL

`/api/monica/v1`

### Authentication

All API endpoints require Bearer Token authentication. Include the `Authorization` header with your API token:

`Authorization: Bearer YOUR_API_TOKEN`

The API token is set via the `MONICA_API_TOKEN` environment variable.

### Error Handling

API errors are returned in a consistent JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {
      // Optional additional error details
    }
  }
}
```

Possible `ERROR_CODE` values include:
*   `UNAUTHORIZED`: Authentication failed.
*   `NOT_FOUND`: Resource not found.
*   `INVALID_INPUT`: Invalid request parameters or body.
*   `METHOD_NOT_ALLOWED`: HTTP method not supported for the endpoint.
*   `INTERNAL_SERVER_ERROR`: An unexpected server error occurred.

### Contacts

#### List/Search Contacts

`GET /api/monica/v1/contacts`

*   **Description:** Retrieves a list of contacts, optionally filtered by a search query.
*   **Query Parameters:**
    *   `query` (optional): A string to search for contacts by name or other attributes.
*   **Response:** `200 OK` - An array of contact objects.

#### Retrieve Contact

`GET /api/monica/v1/contacts/:id`

*   **Description:** Retrieves a single contact by its ID.
*   **Path Parameters:**
    *   `id` (required): The ID of the contact.
*   **Response:** `200 OK` - A contact object.
*   **Error Codes:** `INVALID_INPUT` (if ID is not a number), `NOT_FOUND` (if contact does not exist).

#### Create Contact

`POST /api/monica/v1/contacts`

*   **Description:** Creates a new contact.
*   **Request Body:** A JSON object representing the new contact's data. (Specific fields depend on Monica API).
*   **Response:** `201 Created` - The newly created contact object.
*   **Error Codes:** `INVALID_INPUT` (if required fields are missing or invalid).

#### Update Contact

`PUT /api/monica/v1/contacts/:id` (Full update)
`PATCH /api/monica/v1/contacts/:id` (Partial update)

*   **Description:** Updates an existing contact by its ID.
*   **Path Parameters:**
    *   `id` (required): The ID of the contact.
*   **Request Body:** A JSON object with the updated contact data.
*   **Response:** `200 OK` - The updated contact object.
*   **Error Codes:** `INVALID_INPUT`, `NOT_FOUND`.

#### Delete Contact

`DELETE /api/monica/v1/contacts/:id`

*   **Description:** Deletes a contact by its ID.
*   **Path Parameters:**
    *   `id` (required): The ID of the contact.
*   **Response:** `204 No Content`
*   **Error Codes:** `INVALID_INPUT`, `NOT_FOUND`.

### Activities

#### Log Activity

`POST /api/monica/v1/activities`

*   **Description:** Logs a new activity for a contact.
*   **Request Body:**
    *   `contact_id` (required): The ID of the contact.
    *   `summary` (required): A summary of the activity.
    *   `happened_at` (optional): Date and time of the activity (e.g., "YYYY-MM-DD HH:MM:SS").
    *   `description` (optional): Detailed description of the activity.
*   **Response:** `201 Created` - The newly logged activity object.
*   **Error Codes:** `INVALID_INPUT`.

### Notes

#### Add Note

`POST /api/monica/v1/notes`

*   **Description:** Adds a new note to a contact.
*   **Request Body:**
    *   `contact_id` (required): The ID of the contact.
    *   `body` (required): The content of the note.
*   **Response:** `201 Created` - The newly created note object.
*   **Error Codes:** `INVALID_INPUT`.

### Contact Field Types

#### List Contact Field Types

`GET /api/monica/v1/contactfieldtypes`

*   **Description:** Retrieves a list of available contact field types (e.g., phone, email, etc.).
*   **Response:** `200 OK` - An array of contact field type objects.

### Custom Contact Fields

#### Add Custom Contact Field

`POST /api/monica/v1/contacts/:id/fields`

*   **Description:** Adds a custom field (e.g., email, phone, social media) to a contact.
*   **Path Parameters:**
    *   `id` (required): The ID of the contact.
    *   `field_type` (required): The ID or identifier of the contact field type.
    *   `value` (required): The value for the custom field.
*   **Response:** `201 Created` - The newly created contact field object.
*   **Error Codes:** `INVALID_INPUT`, `NOT_FOUND`.

## Model Context Protocol (MCP) Integration

This application exposes an MCP server endpoint, allowing AI agents to interact with Monica CRM functionalities using the Model Context Protocol.

### Endpoint

`GET /api/mcp`
`POST /api/mcp`

### Available MCP Actions (Tools)

AI agents can interact with the following tools provided by this MCP adapter:

*   **`monica_create_contact(contactData: object)`:** Creates a new contact in Monica CRM.
*   **`monica_get_contact(contactId: number)`:** Retrieves a contact by ID.
*   **`monica_search_contacts(query: string)`:** Searches for contacts by a query string.
*   **`monica_update_contact(contactId: number, contactData: object)`:** Updates an existing contact by its ID.
*   **`monica_delete_contact(contactId: number)`:** Deletes a contact by its ID.
*   **`monica_log_activity(contactId: number, summary: string, happenedAt?: string, description?: string)`:** Logs a new activity for a contact.
*   **`monica_add_note(contactId: number, body: string)`:** Adds a new note to a contact.
*   **`monica_list_contact_field_types()`:** Lists available custom contact field types.
*   **`monica_add_contact_field(contactId: number, fieldType: string, value: string)`:** Adds a custom field to a contact.
*   **`monica_list_tasks(contactId?: number)`:** Retrieves a list of tasks, optionally filtered by contact ID.
*   **`monica_get_task(taskId: number)`:** Retrieves a single task by its ID.
*   **`monica_create_task(taskData: object)`:** Creates a new task.
*   **`monica_update_task(taskId: number, taskData: object)`:** Updates an existing task by its ID.
*   **`monica_delete_task(taskId: number)`:** Deletes a task by its ID.

### Usage

Agents should make `POST` requests to `/api/mcp` with an MCP-compliant JSON payload to invoke these actions. A `GET` request to `/api/mcp` will return the server's manifest, detailing the available tools and their schemas.

**Example MCP Request (to create a contact):**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "monica_create_contact",
  "params": {
    "contactData": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com"
    }
  }
}
```

**Example MCP Response (success):**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "id": 123,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "...": "..."
  }
}
```

**Example MCP Response (error):**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "error": {
    "code": -32000,
    "message": "MONICA_API_TOKEN is not set."
  }
}
```



#### Delete Contact

`DELETE /api/monica/v1/contacts/:id`

*   **Description:** Deletes a contact by its ID.
*   **Path Parameters:**
    *   `id` (required): The ID of the contact.
*   **Response:** `204 No Content`
*   **Error Codes:** `INVALID_INPUT`, `NOT_FOUND`.

### Activities

#### Log Activity

`POST /api/monica/v1/activities`

*   **Description:** Logs a new activity for a contact.
*   **Request Body:**
    *   `contact_id` (required): The ID of the contact.
    *   `summary` (required): A summary of the activity.
    *   `happened_at` (optional): Date and time of the activity (e.g., "YYYY-MM-DD HH:MM:SS").
    *   `description` (optional): Detailed description of the activity.
*   **Response:** `201 Created` - The newly logged activity object.
*   **Error Codes:** `INVALID_INPUT`.

### Notes

#### Add Note

`POST /api/monica/v1/notes`

*   **Description:** Adds a new note to a contact.
*   **Request Body:**
    *   `contact_id` (required): The ID of the contact.
    *   `body` (required): The content of the note.
*   **Response:** `201 Created` - The newly created note object.
*   **Error Codes:** `INVALID_INPUT`.

### Contact Field Types

#### List Contact Field Types

`GET /api/monica/v1/contactfieldtypes`

*   **Description:** Retrieves a list of available contact field types (e.g., phone, email, etc.).
*   **Response:** `200 OK` - An array of contact field type objects.

### Custom Contact Fields

#### Add Custom Contact Field

`POST /api/monica/v1/contacts/:id/fields`

*   **Description:** Adds a custom field (e.g., email, phone, social media) to a contact.
*   **Path Parameters:**
    *   `id` (required): The ID of the contact.
*   **Request Body:**
    *   `field_type` (required): The ID or identifier of the contact field type.
    *   `value` (required): The value for the custom field.
*   **Response:** `201 Created` - The newly created contact field object.
*   **Error Codes:** `INVALID_INPUT`, `NOT_FOUND`.
