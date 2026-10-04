/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

/** vite.config.ts define — package.json 의 version */
declare const __APP_VERSION__: string;
