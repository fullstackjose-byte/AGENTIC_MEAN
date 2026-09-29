import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MetricsService } from './infrastructure/observability/metrics.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    const prisma = { isReady: async () => true };
    appController = new AppController(
      new AppService(prisma as never),
      new MetricsService(),
    );
  });

  describe('health', () => {
    it('returns a healthy response without external dependencies', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        service: 'helpdesk-api',
      });
    });
  });
});
