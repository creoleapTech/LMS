---
name: fullstack-feature
description: Implement a feature across database, backend, and frontend layers. Use for new features requiring schema changes, API endpoints, and UI components.
---

# Full-Stack Feature Implementation Skill

Implement a feature across all layers of the stack: database schema, backend API, and frontend UI. This skill ensures consistency and completeness.

## When to Use

- Implementing a new feature that requires database changes
- Adding new API endpoints with frontend integration
- Creating a new page/module with backend support

## Procedure

### 1. Requirements Analysis

Before writing code, understand:

- What data needs to be stored?
- What operations (CRUD) are needed?
- What UI components are required?
- What are the user workflows?

### 2. Database Schema

```bash
# Find existing schema patterns
glob: {"pattern":"**/schema/**/*.ts","path":"<project-root>"}

# Read similar schemas for patterns
read: <existing-schema-file>

# Create new schema following patterns
write: <new-schema-file>
```

**Checklist:**
- [ ] Define interface with `I` prefix (e.g., `IInstitution`)
- [ ] Create Mongoose schema with proper types
- [ ] Export model with `Model` suffix (e.g., `InstitutionModel`)
- [ ] Add indexes for query patterns
- [ ] Include timestamps (createdAt, updatedAt)

### 3. Backend Controller

```bash
# Find existing controllers
glob: {"pattern":"**/controller/**/*.ts","path":"<project-root>"}

# Read similar controllers for patterns
read: <existing-controller-file>

# Create new controller following patterns
write: <new-controller-file>
```

**Checklist:**
- [ ] Implement CRUD operations
- [ ] Use proper error handling with try/catch
- [ ] Return consistent response format: `{ success, message, data? }`
- [ ] Add authentication middleware if needed
- [ ] Validate input data

### 4. Backend Routes

```bash
# Find router files
glob: {"pattern":"**/router*.ts","path":"<project-root>"}

# Read router patterns
read: <existing-router-file>

# Add new routes
edit: <router-file>
```

**Checklist:**
- [ ] Add routes to appropriate router
- [ ] Use consistent naming: `/admin/<entity>/...`
- [ ] Mount controller methods

### 5. Frontend Types/DTOs

```bash
# Find existing types
glob: {"pattern":"**/types/**/*.ts","path":"<project-root>"}

# Create/update types
write: <types-file>
```

**Checklist:**
- [ ] Define `Create[Entity]DTO` and `Update[Entity]DTO`
- [ ] Match backend interface structure
- [ ] Export from types index

### 6. Frontend API Client

```bash
# Find API configuration
read: <project-root>/client/src/lib/axios.ts

# Create API hooks/functions
write: <api-file>
```

**Checklist:**
- [ ] Use configured axios instance
- [ ] Implement proper error handling
- [ ] Use React Query for caching
- [ ] Follow existing patterns

### 7. Frontend UI Components

```bash
# Find existing page patterns
glob: {"pattern":"**/pages/**/*.tsx","path":"<project-root>"}

# Read similar pages for patterns
read: <existing-page-file>

# Create new page/components
write: <new-page-file>
```

**Checklist:**
- [ ] Use shadcn/ui components
- [ ] Follow existing layout patterns
- [ ] Implement proper loading/error states
- [ ] Add form validation
- [ ] Use proper TypeScript types

### 8. Frontend Routes

```bash
# Find route configuration
glob: {"pattern":"**/routes/**/*.tsx","path":"<project-root>"}

# Add new route
write: <route-file>
```

**Checklist:**
- [ ] Follow file-based routing conventions
- [ ] Add to sidebar navigation if needed
- [ ] Set proper page title

### 9. Testing

```bash
# Run build to verify compilation
bash: cd client && bun run build
bash: cd server && bun run build

# Run tests if available
bash: cd client && bun run test
```

**Checklist:**
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Manual verification of key workflows
- [ ] API endpoints work as expected

## Response Pattern

Server should return:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

## Naming Conventions

| Layer | Pattern | Example |
|-------|---------|---------|
| Model | PascalCase + `Model` | `InstitutionModel` |
| Interface | `I` prefix | `IInstitution` |
| DTO | `Create[Entity]DTO` | `CreateInstitutionDTO` |
| Controller | kebab-case + `-controller` | `institution-controller` |
| Page | PascalCase + `Page` | `InstitutionPage` |
| Component | PascalCase | `InstitutionForm` |

## Tips

- Follow existing patterns in the codebase
- Don't reinvent the wheel - check for shared utilities
- Keep changes minimal and focused
- Test incrementally as you build
