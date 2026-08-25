import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    // es2022+: top-level await (debugEvent fast-boot) requires it; every
    // browser that can run this game supports it.
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          data: ['./src/data/types.ts', './src/data/enemies.ts', './src/data/events.ts', './src/data/skills.ts', './src/data/items.ts', './src/data/factions.ts', './src/data/bosses.ts', './src/data/loreFragments.ts', './src/data/whispers.ts', './src/data/shardShop.ts', './src/data/endings.ts', './src/data/stats.ts', './src/data/minorLandmarks.ts'],
          systems: ['./src/systems/BoardGenerator.ts', './src/systems/CombatEngine.ts', './src/systems/EventEngine.ts', './src/systems/ResonanceSystem.ts', './src/systems/EchoShardSystem.ts', './src/systems/WhisperSystem.ts', './src/systems/StatusEffectSystem.ts', './src/systems/checks.ts', './src/systems/sceneTransition.ts', './src/systems/SaveManager.ts', './src/systems/rng.ts'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@data': resolve(__dirname, 'src/data'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@store': resolve(__dirname, 'src/store'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@scenes': resolve(__dirname, 'src/scenes'),
      '@placeholder': resolve(__dirname, 'src/placeholder'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
