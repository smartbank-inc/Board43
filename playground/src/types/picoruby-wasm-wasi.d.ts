/**
 * Type declarations for @picoruby/wasm-wasi package
 */

declare module '@picoruby/wasm-wasi/picoruby.js' {
  interface PicoRubyModule {
    ccall: (
      name: string,
      returnType: string | null,
      argTypes: string[],
      args: unknown[],
      options?: { async?: boolean },
    ) => unknown;
    FS: {
      mkdir: (path: string) => void;
      writeFile: (path: string, data: string | Uint8Array) => void;
      readFile: (path: string) => Uint8Array;
      unlink: (path: string) => void;
    };
  }

  type CreateModuleFunction = () => Promise<PicoRubyModule>;

  const createModule: CreateModuleFunction;
  export default createModule;
}
