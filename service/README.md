# PetStore API Service

The provider API service that consumers integrate with using Spec-Kit.

## Quick Start

```bash
# Start the service
npm install
npm run dev
```

The server will start at **http://localhost:3000**

## For Consumers

Consumers use Spec-Kit commands to integrate with this API:

```bash
# 1. Initialize consumer project
spec init my-pet-client
cd my-pet-client

# 2. Sync the OpenAPI spec from this service
spec sync --url http://localhost:3000/openapi.yaml

# 3. Use the SDK in your existing Java code - no manual HTTP calls!
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/health | Health check |
| GET | /api/v1/pets | List all pets |
| POST | /api/v1/pets | Create a pet |
| GET | /api/v1/pets/:id | Get a pet |
| PUT | /api/v1/pets/:id | Update a pet |
| DELETE | /api/v1/pets/:id | Delete a pet |
| GET | /openapi.yaml | OpenAPI specification |

## OpenAPI Spec

The spec is available at: http://localhost:3000/openapi.yaml

This is the **single source of truth** for the API contract.
