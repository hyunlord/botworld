import Phaser from 'phaser'

// ── Texture generators ──

/** Ensure generic effect textures exist */
export function ensureEffectTextures(scene: Phaser.Scene): void {
  // White circle (for most particles)
  if (!scene.textures.exists('fx_particle')) {
    const g = scene.add.graphics()
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(4, 4, 4)
    g.generateTexture('fx_particle', 8, 8)
    g.destroy()
  }

  // Slash arc
  if (!scene.textures.exists('fx_slash')) {
    const g = scene.add.graphics()
    g.lineStyle(3, 0xFFFFFF, 0.9)
    g.beginPath()
    g.arc(16, 16, 12, -1.5, 0.5, false)
    g.strokePath()
    g.generateTexture('fx_slash', 32, 32)
    g.destroy()
  }

  // Arrow
  if (!scene.textures.exists('fx_arrow')) {
    const g = scene.add.graphics()
    g.fillStyle(0xFFFFFF, 1)
    g.fillRect(2, 6, 16, 2) // shaft
    g.beginPath(); g.moveTo(18, 4); g.lineTo(22, 7); g.lineTo(18, 10); g.closePath(); g.fillPath() // head
    g.generateTexture('fx_arrow', 24, 14)
    g.destroy()
  }

  // Star sparkle
  if (!scene.textures.exists('fx_sparkle')) {
    const g = scene.add.graphics()
    g.fillStyle(0xFFFFFF, 1)
    g.beginPath()
    g.moveTo(6, 0); g.lineTo(7, 4); g.lineTo(12, 6); g.lineTo(7, 8); g.lineTo(6, 12); g.lineTo(5, 8); g.lineTo(0, 6); g.lineTo(5, 4)
    g.closePath(); g.fillPath()
    g.generateTexture('fx_sparkle', 12, 12)
    g.destroy()
  }

  // Magic orb
  if (!scene.textures.exists('fx_magic_orb')) {
    const g = scene.add.graphics()
    g.fillStyle(0xFFFFFF, 0.8)
    g.fillCircle(8, 8, 8)
    g.fillStyle(0xFFFFFF, 0.4)
    g.fillCircle(8, 8, 12)
    g.generateTexture('fx_magic_orb', 24, 24)
    g.destroy()
  }
}

// ── Combat Effect Functions ──

/** Melee slash effect at a world position */
export function playSlashEffect(scene: Phaser.Scene, x: number, y: number, tint: number = 0xFFFFFF): void {
  ensureEffectTextures(scene)
  const slash = scene.add.image(x, y - 8, 'fx_slash').setTint(tint).setAlpha(0.9).setDepth(1000)
  scene.tweens.add({
    targets: slash,
    alpha: 0,
    scaleX: 1.5,
    scaleY: 1.5,
    rotation: 0.5,
    duration: 300,
    onComplete: () => slash.destroy(),
  })
}

/** Arrow/projectile trail effect */
export function playArrowTrail(scene: Phaser.Scene, fromX: number, fromY: number, toX: number, toY: number): void {
  ensureEffectTextures(scene)
  const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY)
  const arrow = scene.add.image(fromX, fromY, 'fx_arrow').setRotation(angle).setDepth(1000).setTint(0xCCBB88)
  const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY)
  const duration = Math.max(200, dist * 2)

  scene.tweens.add({
    targets: arrow,
    x: toX,
    y: toY,
    duration,
    ease: 'Linear',
    onComplete: () => {
      // Impact particles
      const emitter = scene.add.particles(toX, toY, 'fx_particle', {
        speed: { min: 20, max: 60 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 300,
        quantity: 4,
        tint: 0x8B7355,
        emitting: false,
      })
      emitter.explode(4)
      scene.time.delayedCall(400, () => emitter.destroy())
      arrow.destroy()
    },
  })
}

/** Magic impact burst */
export function playMagicImpact(scene: Phaser.Scene, x: number, y: number, element: string = 'arcane'): void {
  ensureEffectTextures(scene)
  const tints: Record<string, number> = {
    fire: 0xFF4400, ice: 0x88CCFF, nature: 0x44DD44,
    shadow: 0x440066, holy: 0xFFDD88, arcane: 0xCC44FF,
    dark: 0x440066, heal: 0x44DD44,
  }
  const tint = tints[element] || 0xCC44FF

  const emitter = scene.add.particles(x, y - 4, 'fx_magic_orb', {
    speed: { min: 30, max: 80 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 0.7, end: 0 },
    lifespan: 500,
    quantity: 8,
    tint,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  })
  emitter.setDepth(1000)
  emitter.explode(8)
  scene.time.delayedCall(600, () => emitter.destroy())
}

/** Hit spark (physical damage) */
export function playHitSpark(scene: Phaser.Scene, x: number, y: number): void {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y - 4, 'fx_sparkle', {
    speed: { min: 40, max: 100 },
    scale: { start: 0.4, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 250,
    quantity: 5,
    tint: 0xFFFFAA,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  })
  emitter.setDepth(1000)
  emitter.explode(5)
  scene.time.delayedCall(300, () => emitter.destroy())
}

/** Healing glow (rising green particles) */
export function playHealGlow(scene: Phaser.Scene, x: number, y: number): void {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 10, max: 30 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.4, end: 0 },
    alpha: { start: 0.6, end: 0 },
    lifespan: 800,
    frequency: 60,
    quantity: 2,
    tint: 0x44FF44,
    blendMode: Phaser.BlendModes.ADD,
  })
  emitter.setDepth(1000)
  scene.time.delayedCall(1200, () => { emitter.stop(); scene.time.delayedCall(1000, () => emitter.destroy()) })
}

/** Level up sparkle burst */
export function playLevelUpEffect(scene: Phaser.Scene, x: number, y: number): void {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y - 8, 'fx_sparkle', {
    speed: { min: 50, max: 120 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 800,
    quantity: 15,
    tint: [0xFFDD44, 0xFFAA00, 0xFFFFFF],
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  })
  emitter.setDepth(1000)
  emitter.explode(15)
  scene.time.delayedCall(1000, () => emitter.destroy())
}

/** Explosion effect (for siege, spell impact) */
export function playExplosion(scene: Phaser.Scene, x: number, y: number, radius: number = 40): void {
  ensureEffectTextures(scene)
  // Fire core
  const fire = scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 30, max: radius * 2 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 0.9, end: 0 },
    lifespan: 500,
    quantity: 20,
    tint: [0xFF4400, 0xFF8800, 0xFFCC00],
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  })
  fire.setDepth(1000)
  fire.explode(20)

  // Smoke ring
  const smoke = scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 10, max: radius },
    scale: { start: 1.0, end: 0.2 },
    alpha: { start: 0.4, end: 0 },
    lifespan: 1200,
    quantity: 10,
    tint: 0x444444,
    emitting: false,
  })
  smoke.setDepth(999)
  smoke.explode(10)

  scene.time.delayedCall(1500, () => { fire.destroy(); smoke.destroy() })
}
