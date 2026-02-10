import Phaser from 'phaser'
import { BootScene } from './scenes/boot-scene.js'
import { WorldScene } from './scenes/world-scene.js'

export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth * 0.7,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scene: [BootScene, WorldScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
  }
}
