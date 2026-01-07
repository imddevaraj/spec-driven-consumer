#  Spec-Kit

**Spec-Driven API Client Generator**

Spec-Kit is a CLI tool that automates the creation of robust, compliant API clients directly from OpenAPI specifications. It promotes a spec-first workflow where the API definition is the single source of truth.

## Features

- **Direct REST Client Generation**: Generates complete, self-contained REST clients (Java, TypeScript*, Python*) without heavy SDK dependencies.
- **Spec Synchronization**: Keeps your local OpenApi spec in sync with the provider.
- **Intent-Based Planning**: Converts natural language implementation requests into structured tasks (e.g., "Implement create and list pets").
- **Guardrails**: Static analysis to prevent manual HTTP calls and unauthorized patterns, ensuring all API access goes through the generated client.
- **Flat Project Structure**: Simple, developer-friendly project layout.

## Installation

```bash
# Clone the repository
git clone git@github.com:imddevaraj/spec-driven-consumer.git
cd spec-driven-consumer

# Install dependencies and link locally
npm install
npm run build
npm link
```

## Quick Start

### 1. Initialize a Client Project

```bash
mkdir my-client
cd my-client
spec init my-client --language java
```

This creates a new project with the following structure:
```
my-client/
├── openapi.yaml       # OpenAPI source of truth
├── plan.yaml          # Implementation tasks
├── consumer/          # Generated client code
└── spec-kit.yaml      # Configuration
```

### 2. Sync with API Provider

Fetch the latest OpenAPI specification from your service.

```bash
spec sync --url http://localhost:3000/openapi.yaml
```

### 3. Plan Implementation

Tell Spec-Kit what you want to do using natural language.

```bash
spec plan "Create and list all users"
```

This analyzes the spec and creates a task list in `plan.yaml`.

### 4. Implement

Generate the client code for the planned tasks.

```bash
spec implement
```

The generated code (e.g., `consumer/src/client/ApiClient.java`) will contain methods like `createUser()` and `listUsers()` using the language's native HTTP client (e.g., `java.net.http.HttpClient`).

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

## License

ISC
