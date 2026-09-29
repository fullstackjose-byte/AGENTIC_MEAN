import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
  diagnosticMessage,
  problemMessage,
  recommendationMessage,
  statusMessage,
} from './ticket-presenter';

describe('ticket presenter', () => {
  it('translates technical state and diagnostic codes', () => {
    expect(statusMessage('PENDING_APPROVAL')).toContain('necesita aprobación');
    expect(
      diagnosticMessage({ outcome: 'CONNECTIVITY_OK' } as never),
    ).toBe('La conexión básica funciona correctamente.');
    expect(recommendationMessage('VERIFY_CLIENT_CONFIGURATION')).toContain(
      'configuración del cliente VPN',
    );
  });

  it('uses safe Problem Details and its correlation ID', () => {
    const error = new HttpErrorResponse({
      status: 400,
      headers: new HttpHeaders({ 'X-Correlation-Id': 'trace-header' }),
      error: { detail: 'Falta información requerida', correlationId: 'trace-1' },
    });
    expect(problemMessage(error, 'Error')).toBe(
      'Falta información requerida Seguimiento: trace-1.',
    );
  });
});
