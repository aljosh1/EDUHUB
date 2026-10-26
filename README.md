# EDUHUB — Document Management and Collaboration Platform

EDUHUB is a web-based document workspace designed to make document creation, editing, organization, importing, and sharing easier. Built with Next.js, React, TypeScript, and Supabase, the application provides a foundation for managing documents through a modern web interface with authentication and access control.

## Features

- **Document Management:** Access and manage documents within a centralized workspace.
- **Document Editing:** Create and edit documents through an interactive editing interface.
- **Document Import:** Import supported document files into the workspace.
- **Document Sharing:** Share documents and manage sharing permissions.
- **Authentication:** Integrate user authentication through Supabase.
- **Protected Workspace:** Restrict workspace access based on authentication.
- **Responsive Interface:** Build and use the application through a modern web interface.

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | React framework and application routing |
| React 19 | User interface development |
| TypeScript | Type-safe application development |
| Tailwind CSS 4 | Styling and responsive design |
| Supabase | Authentication and backend data services |
| PostgreSQL | Relational database provided by Supabase |
| TipTap | Rich-text editing framework |
| Vitest | Unit testing |
| Playwright | End-to-end testing |

## Project Structure

```text
EDUHUB/
├── public/                   # Static assets
├── src/
│   ├── app/
│   │   ├── (workspace)/
│   │   │   ├── documents/
│   │   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   ├── shared/
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   └── documents/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/           # Reusable UI components
│   ├── lib/                  # Shared utilities and Supabase helpers
│   └── proxy.ts              # Request interception/authentication
├── supabase/                 # Supabase-related files
├── tests/                    # Automated tests
├── docs/                     # Project documentation
├── scripts/                  # Utility scripts
├── .env.example              # Environment variable template
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

*Note: The structure above reflects the main directories and routes. Some folders may contain additional files.*

## Getting Started

### Prerequisites

Before running EDUHUB locally, ensure you have:

- Node.js compatible with your installed Next.js version.
- npm.
- Git.
- A Supabase account and project.
- Visual Studio Code or another code editor.

### 1. Clone the repository

```bash
git clone https://github.com/aljosh1/EDUHUB.git
cd EDUHUB
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project's root directory.

You can use `.env.example` as a reference.

Add your Supabase project credentials:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

Replace the placeholders with the actual Project URL and publishable key or legacy anon key from your Supabase dashboard.

If the application contains server-side code that requires a service role key, configure it separately:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVER_KEY
```

**Security:** Never expose a service role or secret key in client-side code, assign it a `NEXT_PUBLIC_` prefix, or commit `.env.local` to GitHub. Use elevated credentials only in trusted server-side code when necessary.

### 4. Configure Supabase

Create or select the Supabase project intended for EDUHUB.

1. Obtain the Project URL and public client key from the Supabase dashboard.
2. Configure the environment variables.
3. Ensure the required database tables, authentication settings, and Row Level Security policies are configured for the application.
4. Apply any database migrations or setup scripts included in the repository.

The exact database initialization procedure depends on the migration files and configuration present in the project.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The root route redirects visitors to the document workspace. Users who are not authenticated may be redirected to the login page.

## Available Scripts

Run these commands from the project directory.

| Command | Description |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Creates a production build |
| `npm run start` | Starts the production server after a successful build |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Checks TypeScript types |
| `npm run test` | Runs unit tests with Vitest |
| `npm run test:watch` | Runs tests in watch mode |
| `npm run e2e` | Runs Playwright end-to-end tests |

## Application Routes

| Route | Description |
|---|---|
| `/` | Application entry point |
| `/login` | User authentication page |
| `/documents` | Main document workspace |
| `/documents/[id]` | Individual document editor |
| `/shared` | Shared documents page |

The application also defines API routes for document operations, importing documents, and managing sharing permissions.

## Testing

To run the unit tests:

```bash
npm run test
```

To verify TypeScript types:

```bash
npm run typecheck
```

To run the lint checks:

```bash
npm run lint
```

To execute end-to-end tests:

```bash
npm run e2e
```

End-to-end tests may require additional browser setup, environment variables, and a running application.

## Deployment

EDUHUB can be deployed to a platform that supports Next.js, such as Vercel.

General deployment steps:

1. Push the project to GitHub.
2. Import the repository into your deployment platform.
3. Configure the required environment variables in the platform's project settings.
4. Confirm that the Supabase database and authentication settings are correct.
5. Build and deploy the application.
6. Test login, document creation, editing, importing, and sharing in the deployed environment.

Never commit database passwords, service role keys, or other private credentials to the repository.

## Security Considerations

- Keep private credentials on the server.
- Apply appropriate Row Level Security policies to database tables.
- Validate and authorize document access on the server.
- Verify permissions before allowing document edits or sharing operations.
- Validate imported files and handle unsupported or malformed content safely.
- Test authentication and access control before deploying to production.

## Future Improvements

Potential areas for further development include:

- Collaborative real-time document editing.
- Version history and document recovery.
- Advanced document search and filtering.
- Notifications for document sharing and updates.
- Improved document export options.
- Audit logs and administrative controls.

These are potential enhancements, not necessarily features implemented in the current version.

## Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run the available tests and checks.
5. Submit a pull request describing your changes.

## License

No license has been specified for this project yet. Add a `LICENSE` file and update this section when the project's licensing terms have been decided.
