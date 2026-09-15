# نظمني (Nazemni)

نظمني is a bilingual personal academic operating system for one university student. It manages courses, lectures, study tasks, assessments, grades, weak topics, backlog, deterministic daily planning, daily check-out, and weekly review. V1 has no AI dependency.

## Stack

- React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, i18next, PWA
- Node.js, Express, TypeScript, PostgreSQL, Prisma, Zod
- npm workspaces: apps/web, apps/api, and packages/shared

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL 16 or newer, or Docker

## Setup

1. Copy .env.example to .env.
2. Start PostgreSQL with docker compose up -d postgres, or set DATABASE_URL to an existing database.
3. Install packages with npm install.
4. Generate the client and apply migrations with npm run db:generate and npm run db:migrate.
5. Seed the semester, six courses, and weekly university schedule with npm run db:seed.
6. Start both applications with npm run dev.

The web app runs at http://localhost:5173; the API runs at http://localhost:4000.

## Environment variables

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL connection string |
| API_PORT | Express port (default 4000) |
| WEB_ORIGIN | Allowed browser origin |
| VITE_API_URL | API URL used by the web application |

## Commands

- npm run dev — run web and API in development
- npm run typecheck — strict TypeScript validation
- npm test — business-logic and API foundation tests
- npm run build — production builds for all workspaces
- npm run db:migrate — apply/create Prisma migrations
- npm run db:seed — seed the real semester configuration

## Structure

- apps/web — bilingual RTL/LTR PWA interface
- apps/api — REST API, Prisma schema, validation, and services
- packages/shared — testable priority, grade, status, review, focus, and weekly-score logic
