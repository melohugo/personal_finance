import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GeminiService } from './gemini.service';
import { ReceiptProcessorWorker } from './receipt-processor.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'receipt_processing',
    }),
  ],
  providers: [GeminiService, ReceiptProcessorWorker],
  exports: [GeminiService, BullModule],
})
export class ProcessorModule {}
