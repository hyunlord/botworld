import Phaser from 'phaser'
import type { CharacterAppearance, Race, RacialFeatures } from '@botworld/shared'
import { hexToTint } from './tint-calculator.js'
import { createAuraEffect } from './aura-effects.js'

export interface ComposedSprite {
  /** Sub-container holding all body part layers (breathing animation target) */
  bodyGroup: Phaser.GameObjects.Container
  /** Aura particle emitter, if any */
  auraEmitter?: Phaser.GameObjects.Particles.ParticleEmitter
}

/**
 * Compose a layered character sprite from CharacterAppearance.
 * All base sprites are grayscale; color is applied via Phaser's setTint().
 * Returns a bodyGroup Container that replaces the single Image in agent rendering.
 */
export function composeCharacterSprite(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
  race: Race,
): ComposedSprite {
  const bodyGroup = scene.add.container(0, 0)

  // 1. Body layer
  const bodyKey = resolveTextureKey(scene, `char_body_${appearance.bodyType}`, 'char_body_average')
  if (bodyKey) {
    const body = scene.add.image(0, 0, bodyKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.skinTone))
    applyHeight(body, appearance.height)
    bodyGroup.add(body)
  }

  // 2. Armor layer
  const armorKey = resolveTextureKey(scene, `char_armor_${appearance.armor}`, 'char_armor_casual')
  if (armorKey) {
    const armor = scene.add.image(0, 0, armorKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.armorPrimaryColor))
    applyHeight(armor, appearance.height)
    bodyGroup.add(armor)
  }

  // 3. Cape layer (optional)
  if (appearance.cape && appearance.cape !== 'none') {
    const capeKey = resolveTextureKey(scene, `char_cape_${appearance.cape}`, null)
    if (capeKey) {
      const cape = scene.add.image(0, 0, capeKey)
        .setOrigin(0.5, 0.7)
      if (appearance.capeColor) {
        cape.setTint(hexToTint(appearance.capeColor))
      }
      applyHeight(cape, appearance.height)
      bodyGroup.add(cape)
    }
  }

  // 4. Hair layer
  const hairKey = resolveTextureKey(scene, `char_hair_${appearance.hairStyle}`, 'char_hair_short_messy')
  if (hairKey) {
    const hair = scene.add.image(0, 0, hairKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.hairColor))
    applyHeight(hair, appearance.height)
    bodyGroup.add(hair)
  }

  // 5. Headgear layer (optional)
  if (appearance.headgear && appearance.headgear !== 'none') {
    const headgearKey = resolveTextureKey(scene, `char_headgear_${appearance.headgear}`, null)
    if (headgearKey) {
      const headgear = scene.add.image(0, 0, headgearKey)
        .setOrigin(0.5, 0.7)
      applyHeight(headgear, appearance.height)
      bodyGroup.add(headgear)
    }
  }

  // 6. Face layer
  const faceKey = resolveTextureKey(scene, `char_face_${appearance.faceShape}`, 'char_face_oval')
  if (faceKey) {
    const face = scene.add.image(0, 0, faceKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.skinTone))
    applyHeight(face, appearance.height)
    bodyGroup.add(face)
  }

  // 7. Facial hair layer (optional)
  if (appearance.facialHair && appearance.facialHair !== 'none') {
    const fhKey = resolveTextureKey(scene, `char_facialhair_${appearance.facialHair}`, null)
    if (fhKey) {
      const fh = scene.add.image(0, 0, fhKey)
        .setOrigin(0.5, 0.7)
        .setTint(hexToTint(appearance.hairColor))
      applyHeight(fh, appearance.height)
      bodyGroup.add(fh)
    }
  }

  // 8. Racial features (optional)
  if (appearance.racialFeatures) {
    addRacialFeatures(scene, bodyGroup, appearance.racialFeatures, appearance)
  }

  // 9. Accessories (up to 3)
  for (const acc of appearance.accessories.slice(0, 3)) {
    const accKey = resolveTextureKey(scene, `char_acc_${acc}`, null)
    if (accKey) {
      const accSprite = scene.add.image(0, 0, accKey)
        .setOrigin(0.5, 0.7)
      applyHeight(accSprite, appearance.height)
      bodyGroup.add(accSprite)
    }
  }

  // 10. Markings (overlays)
  for (const marking of appearance.markings.slice(0, 5)) {
    const markKey = resolveTextureKey(scene, `char_marking_${marking}`, null)
    if (markKey) {
      const markSprite = scene.add.image(0, 0, markKey)
        .setOrigin(0.5, 0.7)
        .setAlpha(0.6)
      applyHeight(markSprite, appearance.height)
      bodyGroup.add(markSprite)
    }
  }

  // 11. Aura (animated particle effect)
  let auraEmitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined
  if (appearance.aura && appearance.aura !== 'none') {
    auraEmitter = createAuraEffect(scene, appearance.aura, bodyGroup)
  }

  return { bodyGroup, auraEmitter }
}

/** Resolve a texture key, falling back to fallbackKey if texture doesn't exist */
function resolveTextureKey(
  scene: Phaser.Scene,
  preferredKey: string,
  fallbackKey: string | null,
): string | null {
  if (scene.textures.exists(preferredKey)) return preferredKey
  if (fallbackKey && scene.textures.exists(fallbackKey)) return fallbackKey
  return null
}

/** Adjust sprite scale and Y-offset based on character height */
function applyHeight(sprite: Phaser.GameObjects.Image, height: string): void {
  switch (height) {
    case 'short':
      sprite.setScale(sprite.scaleX * 0.9, sprite.scaleY * 0.9)
      sprite.y += 3
      break
    case 'tall':
      sprite.setScale(sprite.scaleX * 1.1, sprite.scaleY * 1.1)
      sprite.y -= 3
      break
    // 'medium' = default, no adjustment
  }
}

function addRacialFeatures(
  scene: Phaser.Scene,
  group: Phaser.GameObjects.Container,
  features: RacialFeatures,
  appearance: CharacterAppearance,
): void {
  if (features.earType && features.earType !== 'normal') {
    const earKey = resolveTextureKey(scene, `char_racial_ear_${features.earType}`, null)
    if (earKey) {
      group.add(
        scene.add.image(0, 0, earKey)
          .setOrigin(0.5, 0.7)
          .setTint(hexToTint(appearance.skinTone))
      )
    }
  }

  if (features.hornType && features.hornType !== 'none') {
    const hornKey = resolveTextureKey(scene, `char_racial_horn_${features.hornType}`, null)
    if (hornKey) {
      group.add(scene.add.image(0, -10, hornKey).setOrigin(0.5, 0.7))
    }
  }

  if (features.tailType && features.tailType !== 'none') {
    const tailKey = resolveTextureKey(scene, `char_racial_tail_${features.tailType}`, null)
    if (tailKey) {
      group.add(scene.add.image(8, 5, tailKey).setOrigin(0.5, 0.7))
    }
  }

  if (features.wingType && features.wingType !== 'none') {
    const wingKey = resolveTextureKey(scene, `char_racial_wing_${features.wingType}`, null)
    if (wingKey) {
      group.add(scene.add.image(0, -5, wingKey).setOrigin(0.5, 0.7).setAlpha(0.85))
    }
  }
}
