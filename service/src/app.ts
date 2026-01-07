/**
 * PetStore API Service
 * 
 * This is the PROVIDER service. Consumers use Spec-Kit to:
 * 1. Get the OpenAPI spec (openapi.yaml)
 * 2. Generate SDK: `spec generate sdk --language java`
 * 3. Use the SDK in their existing code
 * 
 * NO MANUAL HTTP CALLS - SDK is the only interface
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Types
interface Pet {
  id: string;
  name: string;
  category?: string;
  status: 'available' | 'pending' | 'sold';
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// In-memory database
const pets: Map<string, Pet> = new Map();

// Seed some initial data
function seedData() {
  const seedPets: Omit<Pet, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { name: 'Buddy', category: 'dog', status: 'available', tags: ['friendly', 'trained'] },
    { name: 'Whiskers', category: 'cat', status: 'available', tags: ['indoor'] },
    { name: 'Tweety', category: 'bird', status: 'pending', tags: ['singing'] },
  ];
  
  seedPets.forEach(pet => {
    const id = uuidv4();
    const now = new Date().toISOString();
    pets.set(id, { ...pet, id, createdAt: now, updatedAt: now });
  });
}

// === API Routes ===

// Health check
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// List pets
app.get('/api/v1/pets', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const status = req.query.status as string | undefined;
  
  let allPets = Array.from(pets.values());
  
  // Filter by status if provided
  if (status) {
    allPets = allPets.filter(p => p.status === status);
  }
  
  // Sort by createdAt desc
  allPets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Paginate
  const paginatedPets = allPets.slice(offset, offset + limit);
  
  res.json({
    data: paginatedPets,
    total: allPets.length,
    limit,
    offset
  });
});

// Get pet by ID
app.get('/api/v1/pets/:id', (req: Request, res: Response) => {
  const pet = pets.get(req.params.id);
  
  if (!pet) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: `Pet with ID '${req.params.id}' not found`
    });
  }
  
  res.json(pet);
});

// Create pet
app.post('/api/v1/pets', (req: Request, res: Response) => {
  const { name, category, status = 'available', tags } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Name is required and must be a non-empty string'
    });
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const pet: Pet = {
    id,
    name: name.trim(),
    category,
    status,
    tags: tags || [],
    createdAt: now,
    updatedAt: now
  };
  
  pets.set(id, pet);
  
  res.status(201).json(pet);
});

// Update pet
app.put('/api/v1/pets/:id', (req: Request, res: Response) => {
  const existingPet = pets.get(req.params.id);
  
  if (!existingPet) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: `Pet with ID '${req.params.id}' not found`
    });
  }
  
  const { name, category, status, tags } = req.body;
  
  const updatedPet: Pet = {
    ...existingPet,
    name: name !== undefined ? name : existingPet.name,
    category: category !== undefined ? category : existingPet.category,
    status: status !== undefined ? status : existingPet.status,
    tags: tags !== undefined ? tags : existingPet.tags,
    updatedAt: new Date().toISOString()
  };
  
  pets.set(req.params.id, updatedPet);
  
  res.json(updatedPet);
});

// Delete pet
app.delete('/api/v1/pets/:id', (req: Request, res: Response) => {
  const pet = pets.get(req.params.id);
  
  if (!pet) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: `Pet with ID '${req.params.id}' not found`
    });
  }
  
  pets.delete(req.params.id);
  res.status(204).send();
});

// Serve OpenAPI spec
app.get('/openapi.yaml', (_req: Request, res: Response) => {
  res.sendFile('openapi.yaml', { root: __dirname + '/..' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
});

// Start server
seedData();
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    PetStore API Service                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                     ║
║  API Base URL:      http://localhost:${PORT}/api/v1              ║
║  OpenAPI Spec:      http://localhost:${PORT}/openapi.yaml        ║
╠═══════════════════════════════════════════════════════════════╣
║  For Consumers:                                                ║
║    1. spec init my-client                                      ║
║    2. curl http://localhost:${PORT}/openapi.yaml > spec/openapi.yaml ║
║    3. spec generate sdk --language java                        ║
║    4. Use the SDK in your code                                 ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
