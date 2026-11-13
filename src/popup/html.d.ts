// Vitest/Vite raw imports let popup tests use the actual shipped markup.
declare module '*.html?raw' {
  const html: string;
  export default html;
}
