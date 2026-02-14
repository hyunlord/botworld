import Phaser from 'phaser'
import { BootScene } from './scenes/boot-scene.js'
import { WorldScene } from './scenes/world-scene.js'

export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  // Ensure game container allows pointer events and prevents browser gestures
  const container = document.getElementById(parent)
  if (container) {
    container.style.touchAction = 'none'
    container.style.userSelect = 'none'
    container.style.webkitUserSelect = 'none'
  }

  return {
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scene: [BootScene, WorldScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    input: {
      mouse: {
        preventDefaultWheel: true,
      },
      touch: {
        capture: true,
      },
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
  }
}
