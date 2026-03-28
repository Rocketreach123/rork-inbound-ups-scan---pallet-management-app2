declare global {
  function test(name: string, fn: () => void): void;
  function describe(name: string, fn: () => void): void;
  function beforeAll(fn: () => void): void;
  function afterAll(fn: () => void): void;
  function expect(actual: any): any;
  
  namespace jest {
    function fn(): any;
  }
}
export {};
