---
name: codebase-exploration
description: Systematically explore codebase structure before implementing changes. Use when starting work on unfamiliar code or feature area.
---

# Codebase Exploration Skill

Systematically explore a codebase to understand its structure before making changes. This skill prevents wasted effort by ensuring you understand the existing patterns, conventions, and architecture.

## When to Use

- Starting work on a new feature or bug fix
- Entering an unfamiliar codebase or module
- Before implementing changes that touch multiple files

## Procedure

### 1. Project Structure Discovery

```bash
# List top-level directories
Get-ChildItem -Path <project-root> -Directory -Name

# List key source directories
Get-ChildItem -Path <project-root>\client\src -Directory -Name
Get-ChildItem -Path <project-root>\server\src -Directory -Name
```

### 2. File Pattern Discovery

Use glob to find relevant files by pattern:

```bash
# Find all TypeScript files in a module
glob: {"pattern":"**/*.ts","path":"<module-path>"}

# Find specific file types
glob: {"pattern":"**/*Controller*","path":"<project-root>"}
glob: {"pattern":"**/*Schema*","path":"<project-root>"}
glob: {"pattern":"**/*Page*","path":"<project-root>"}
```

### 3. Content Pattern Discovery

Use grep to find code patterns:

```bash
# Find TODO/FIXME markers
grep: {"pattern":"TODO|FIXME|HACK","include":"*.ts","path":"<project-root>"}

# Find specific function usage
grep: {"pattern":"functionName","include":"*.ts","path":"<project-root>"}

# Find imports/exports
grep: {"pattern":"export.*function|export.*class","include":"*.ts","path":"<project-root>"}
```

### 4. Key File Reading

Read the most important files to understand patterns:

```bash
# Read main entry points
read: <project-root>/src/index.ts
read: <project-root>/src/App.tsx

# Read configuration files
read: <project-root>/package.json
read: <project-root>/tsconfig.json
```

### 5. Architecture Documentation

Always check for existing documentation:

```bash
# Check for CLAUDE.md, README.md, etc.
read: <project-root>/CLAUDE.md
read: <project-root>/README.md
```

## Output Format

After exploration, produce a summary:

1. **Project Structure**: Key directories and their purposes
2. **Tech Stack**: Frameworks, libraries, patterns used
3. **File Organization**: How code is organized (feature-based, layer-based, etc.)
4. **Key Files**: Important files for the task at hand
5. **Patterns**: Coding conventions, naming patterns, common utilities
6. **Gaps**: Missing documentation, unclear areas, potential issues

## Tips

- Start broad (project root) then narrow (specific module)
- Read existing patterns before inventing new ones
- Check for shared components/utilities before building from scratch
- Note any TODO/FIXME markers that might be relevant
