import { EventEmitter } from 'events';

export default class MockPDFDocument extends EventEmitter {
  private chunks: Buffer[] = [];

  fontSize() {
    return this;
  }

  text(value: string) {
    if (value) {
      this.chunks.push(Buffer.from(value));
    }
    return this;
  }

  moveDown() {
    return this;
  }

  end() {
    const data = Buffer.concat([Buffer.from('%PDF-TEST'), ...this.chunks]);
    this.emit('data', data);
    this.emit('end');
  }
}
