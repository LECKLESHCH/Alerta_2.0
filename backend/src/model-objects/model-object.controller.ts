import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateModelObjectPayload,
  ModelObjectService,
} from './model-object.service';

@UseGuards(JwtAuthGuard)
@Controller('model-objects')
export class ModelObjectController {
  constructor(private readonly modelObjectService: ModelObjectService) {}

  @Get()
  async findAll() {
    return this.modelObjectService.findAll();
  }

  @Post()
  async create(@Body() body: CreateModelObjectPayload) {
    if (!body.objectName?.trim()) {
      throw new BadRequestException('objectName is required');
    }

    if (!body.objectType?.trim()) {
      throw new BadRequestException('objectType is required');
    }

    if (!body.industry?.trim()) {
      throw new BadRequestException('industry is required');
    }

    if (!['high', 'medium', 'low'].includes(body.protectionLevel)) {
      throw new BadRequestException(
        'protectionLevel must be one of: high, medium, low',
      );
    }

    return this.modelObjectService.create(body);
  }

  @Post('seed-defaults')
  async seedDefaults() {
    const items = await this.modelObjectService.seedDefaults();
    return {
      insertedOrUpdated: items.length,
      items,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<CreateModelObjectPayload>,
  ) {
    if (
      body.protectionLevel &&
      !['high', 'medium', 'low'].includes(body.protectionLevel)
    ) {
      throw new BadRequestException(
        'protectionLevel must be one of: high, medium, low',
      );
    }

    const updated = await this.modelObjectService.updateById(id, body);
    if (!updated) {
      throw new NotFoundException('Object model not found');
    }
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const removed = await this.modelObjectService.removeById(id);

    if (!removed) {
      throw new NotFoundException('Object model not found');
    }

    return {
      deleted: true,
      id,
    };
  }
}
