# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack Learning Management System with institution/school management. Monorepo with two independent projects: `client/` (React frontend) and `server/` (Bun backend). No root-level package.json — each project has its own dependencies and lock files.

## Development Commands

### Client (`cd client`)
```bash
bun install              # Install dependencies (runs postinstall patch script)
bun run dev              # Vite dev server on port 3001
bun run build            # Production build (vite build && tsc)
bun run test             # Run tests (vitest)
```

### Server (`cd server`)
```bash
bun install              # Install dependencies
bun run dev              # Dev server with watch mode (default port 3000, configurable via PORT env)
```

Set `SWAGGER=YES` in `.env` to enable Swagger docs at `/docs`.

### shadcn/ui Components
```bash
cd client && pnpx shadcn@latest add <component-name>
```

## Architecture

### Client Stack
- **React 19 + Vite 7 + TypeScript**
- **TanStack Router** — file-based routing in `src/routes/`. Route tree auto-generated in `src/routeTree.gen.ts` (do not edit manually).
- **TanStack React Query** — server state / data fetching
- **Zustand** — client state (auth store at `src/store/userAuthStore.ts`, persisted to localStorage under key `auth-storage`)
- **Tailwind CSS v4** — styling via `@tailwindcss/vite` plugin, theme variables in `src/styles.css`
- **shadcn/ui** — component primitives in `src/components/ui/` (new-york style, zinc base color)
- **Tiptap** — rich text editor (`src/components/editors/`)
- **Axios** — HTTP client configured in `src/lib/axios.ts` with base URL `http://localhost:4000/api`, auto-attaches Bearer token from localStorage

### Server Stack
- **Bun runtime + Elysia framework**
- **MongoDB via Mongoose** — db name `"LMS"`, connection in `src/setup.ts`
- **PASETO v4 tokens** (not JWT) — implemented in `src/lib/paseto.ts`. Three secret keys for different roles (`PASETO_SECRET_KEY`, `PASETO_SUPERADMIN_SECRET`, `PASETO_ADMIN_SECRET`)
- **Auth middleware** — Elysia macro in `src/modules/admin/admin-macro.ts`, checks `x-admin` header or `Authorization: Bearer` header
- **Password hashing** — `Bun.password.hash()` with bcrypt (in admin-model pre-save hook)
- **File uploads** — stored locally in `server/uploads/` directory, handled by `src/lib/file.ts`

### Import Aliases
Both client and server use `@/*` → `./src/*`.

### API Structure
All routes prefixed `/api`. Admin routes at `/api/admin/`:
- `src/modules/router.ts` — base router, mounts `fileController` + `adminBaseRouter`
- `src/modules/admin/controller/admin-router.ts` — mounts all admin domain controllers (auth, institution, department, staff, class, student, curriculum, gradeBook, etc.)
- `userBaseRouter` is **commented out** in `router.ts`

### API Response Pattern
Server returns `{ success: boolean, message: string, data?: ... }`.

### Client Organization
- `src/pages/` — feature modules (institutions, curriculum, staff, students, course, classes, settings)
- `src/components/` — shared components (editors, viewers, quiz, ui primitives)
- `src/modules/sidebar.tsx` — role-based navigation (roles: `super_admin`, `admin`, `staff`, `teacher`)
- `src/types/` — shared TypeScript interfaces and DTOs

### Server Schema Organization
Mongoose models in `src/schema/`:
- `admin/` — Admin, Institution, Class, Department, Staff, Student
- `books/` — Curriculum, GradeBook, Chapter, ChapterContent
- `staff/` — ClassSession
- `students/` — StudentProgress

### Naming Conventions
- **Mongoose models**: PascalCase with `Model` suffix (e.g., `InstitutionModel`)
- **Server interfaces**: `I` prefix (e.g., `IInstitution`)
- **Client DTOs**: `Create[Entity]DTO` / `Update[Entity]DTO`
- **Controllers**: kebab-case with `-controller` suffix
- **Components**: PascalCase filenames (e.g., `StaffTable.tsx`)

## Known Issues
- `userBaseRouter` and `staffCurriculumController` are commented out in the server routing
- `StudentProgress.userId` references a "User" model that doesn't exist in the schema yet
