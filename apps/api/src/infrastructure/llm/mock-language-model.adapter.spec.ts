import { describe, expect, it } from 'vitest';
import { Ticket } from '../../domain/tickets/ticket.js';
import { MockLanguageModelAdapter } from './mock-language-model.adapter.js';

const ticket = (subject: string, description: string) =>
  Ticket.create({
    id: 'ticket-1',
    number: 'TKT-000001',
    subject,
    description,
    requesterId: 'user-123',
    createdAt: new Date('2026-09-29T12:00:00.000Z'),
    containsRedactedData: false,
  });

describe('MockLanguageModelAdapter', () => {
  const adapter = new MockLanguageModelAdapter();

  it('classifies a VPN incident as supported infrastructure', async () => {
    await expect(
      adapter.classifyTicket(
        ticket('VPN no conecta', 'La conexion falla desde esta manana'),
      ),
    ).resolves.toMatchObject({
      category: 'INFRASTRUCTURE_SOFTWARE',
      subcategory: 'VPN',
      impact: 'SINGLE_USER',
      confidence: 0.94,
      entities: { service: 'corporate-vpn' },
      missingInformation: [],
    });
  });

  it('detects a widespread critical incident', async () => {
    await expect(
      adapter.classifyTicket(
        ticket(
          'VPN caida para toda la empresa',
          'Es urgente: nadie puede conectarse',
        ),
      ),
    ).resolves.toMatchObject({
      impact: 'WIDESPREAD',
      urgency: 'HIGH',
    });
  });

  it('returns low confidence and missing information for unsupported requests', async () => {
    await expect(
      adapter.classifyTicket(
        ticket('Necesito ayuda', 'Algo no funciona correctamente'),
      ),
    ).resolves.toMatchObject({
      category: 'OTHER',
      confidence: 0.45,
      missingInformation: ['service'],
    });
  });
});
