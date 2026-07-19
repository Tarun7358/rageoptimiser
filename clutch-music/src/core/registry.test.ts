import { ModuleRegistry } from './ModuleRegistry.js';

describe('ModuleRegistry', () => {
  it('should instantiate successfully', () => {
    const registry = new ModuleRegistry(() => {});
    expect(registry).toBeDefined();
  });
});
