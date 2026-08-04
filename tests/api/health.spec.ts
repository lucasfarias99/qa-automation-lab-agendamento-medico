import { test, expect } from '@playwright/test';

test('CT-001 - GET /health deve retornar status UP', async ({ request }) => {
  // Arrange
  // nenhuma massa de dados necessária para este teste

  // Act
  const response = await request.get('/health');
  const body = await response.json();

  // Assert
  expect(response.status()).toBe(200);
  expect(body.status).toBe('UP');
  expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
});
