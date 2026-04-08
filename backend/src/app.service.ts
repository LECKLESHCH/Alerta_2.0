import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'ALERTA 2.0 API',
      timestamp: new Date().toISOString(),
    };
  }
}
