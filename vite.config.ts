import { defineConfig } from 'vite';

/**
 * Rutas relativas: el mismo build vale en la raíz de un dominio, en
 * `usuario.github.io/repo/` y abierto como carpeta. No hay router, así que
 * `./` no rompe ninguna ruta interna.
 */
export default defineConfig({
  base: './',
});
