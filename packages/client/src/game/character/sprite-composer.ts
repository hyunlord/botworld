import Phaser from 'phaser'
import type { CharacterAppearance, Race, RacialFeatures } from '@botworld/shared'
import { hexToTint, darkenTint } from './tint-calculator.js'
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
 *
 * 14-layer rendering order (bottom to top):
 * 1. shadow, 2. body, 3. pants, 4. shoes, 5. chest/armor, 6. hair_back,
 * 7. face, 8. hair_front, 9. headgear/helmet, 10. cloak, 11. weapon_back,
 * 12. weapon_hand, 13. shield, 14. effect/aura
 */
export function composeCharacterSprite(
  scene: Phaser.Scene,
  appearance: CharacterAppearance,
  race: Race,
): ComposedSprite {
  const bodyGroup = scene.add.container(0, 0)

  // 1. Shadow layer (always present)
  const shadow = createShadow(scene)
  applyHeight(shadow, appearance.height)
  bodyGroup.add(shadow)

  // 2. Body layer (race+gender body with fallback to bodyType)
  const bodyKey = appearance.gender
    ? resolveTextureKey(scene, `char_body_${race}_${appearance.gender}`, `char_body_${appearance.bodyType}`)
    : resolveTextureKey(scene, `char_body_${appearance.bodyType}`, 'char_body_average')
  if (bodyKey) {
    const body = scene.add.image(0, 0, bodyKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.skinTone))
    applyHeight(body, appearance.height)
    bodyGroup.add(body)
  }

  // 3. Pants layer (optional)
  if (appearance.pants) {
    const pantsKey = resolveTextureKey(scene, `char_pants_${appearance.pants}`, null)
    if (pantsKey) {
      const pants = scene.add.image(0, 0, pantsKey)
        .setOrigin(0.5, 0.7)
        .setTint(hexToTint(appearance.armorSecondaryColor))
      applyHeight(pants, appearance.height)
      bodyGroup.add(pants)
    }
  }

  // 4. Shoes layer (optional)
  if (appearance.shoes) {
    const shoesKey = resolveTextureKey(scene, `char_shoes_${appearance.shoes}`, null)
    if (shoesKey) {
      const shoes = scene.add.image(0, 0, shoesKey)
        .setOrigin(0.5, 0.7)
      applyHeight(shoes, appearance.height)
      bodyGroup.add(shoes)
    }
  }

  // 5. Chest/Armor layer
  const armorKey = resolveTextureKey(scene, `char_armor_${appearance.armor}`, 'char_armor_casual')
  if (armorKey) {
    const armor = scene.add.image(0, 0, armorKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.armorPrimaryColor))
    applyHeight(armor, appearance.height)
    applyQualityEffect(scene, armor, appearance.armorQuality)
    bodyGroup.add(armor)
  }

  // 6. Hair back layer (for long hairstyles)
  const hairBackKey = resolveTextureKey(scene, `char_hair_back_${appearance.hairStyle}`, null)
  if (hairBackKey) {
    const hairBack = scene.add.image(0, 0, hairBackKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.hairColor))
    applyHeight(hairBack, appearance.height)
    bodyGroup.add(hairBack)
  }

  // 7. Face layer
  const faceKey = resolveTextureKey(scene, `char_face_${appearance.faceShape}`, 'char_face_oval')
  if (faceKey) {
    const face = scene.add.image(0, 0, faceKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.skinTone))
    applyHeight(face, appearance.height)
    bodyGroup.add(face)
  }

  // 7b. Facial hair layer (optional)
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

  // 8. Hair front layer (fallback to legacy char_hair_* if needed)
  const hairFrontKey = resolveTextureKey(
    scene,
    `char_hair_front_${appearance.hairStyle}`,
    `char_hair_${appearance.hairStyle}`,
  )
  if (hairFrontKey) {
    const hairFront = scene.add.image(0, 0, hairFrontKey)
      .setOrigin(0.5, 0.7)
      .setTint(hexToTint(appearance.hairColor))
    applyHeight(hairFront, appearance.height)
    bodyGroup.add(hairFront)
  }

  // 9. Headgear/Helmet layer (optional)
  const helmetOrHeadgear = appearance.helmet && appearance.helmet !== 'none'
    ? `char_helmet_${appearance.helmet}`
    : appearance.headgear && appearance.headgear !== 'none'
      ? `char_headgear_${appearance.headgear}`
      : null
  if (helmetOrHeadgear) {
    const headKey = resolveTextureKey(scene, helmetOrHeadgear, null)
    if (headKey) {
      const headgear = scene.add.image(0, 0, headKey)
        .setOrigin(0.5, 0.7)
      applyHeight(headgear, appearance.height)
      bodyGroup.add(headgear)
    }
  }

  // 10. Cloak layer (optional, new cloak or legacy cape)
  const cloakOrCape = appearance.cloak && appearance.cloak !== 'none'
    ? `char_cloak_${appearance.cloak}`
    : appearance.cape && appearance.cape !== 'none'
      ? `char_cape_${appearance.cape}`
      : null
  if (cloakOrCape) {
    const cloakKey = resolveTextureKey(scene, cloakOrCape, null)
    if (cloakKey) {
      const cloak = scene.add.image(0, 0, cloakKey)
        .setOrigin(0.5, 0.7)
      if (appearance.capeColor) {
        cloak.setTint(hexToTint(appearance.capeColor))
      }
      applyHeight(cloak, appearance.height)
      bodyGroup.add(cloak)
    }
  }

  // 11. Weapon back layer (weapon on back when idle)
  if (appearance.weapon && appearance.weapon !== 'none') {
    const weaponBackKey = resolveTextureKey(scene, `char_weapon_back_${appearance.weapon}`, null)
    if (weaponBackKey) {
      const weaponBack = scene.add.image(0, 0, weaponBackKey)
        .setOrigin(0.5, 0.7)
      applyHeight(weaponBack, appearance.height)
      applyQualityEffect(scene, weaponBack, appearance.weaponQuality)
      bodyGroup.add(weaponBack)
    }
  }

  // 12. Weapon hand layer (weapon in hand)
  if (appearance.weapon && appearance.weapon !== 'none') {
    const weaponKey = resolveTextureKey(scene, `char_weapon_${appearance.weapon}`, null)
    if (weaponKey) {
      const weapon = scene.add.image(0, 0, weaponKey)
        .setOrigin(0.5, 0.7)
      applyHeight(weapon, appearance.height)
      applyQualityEffect(scene, weapon, appearance.weaponQuality)
      bodyGroup.add(weapon)
    }
  }

  // 13. Shield layer (optional)
  if (appearance.shield && appearance.shield !== 'none') {
    const shieldKey = resolveTextureKey(scene, `char_shield_${appearance.shield}`, null)
    if (shieldKey) {
      const shield = scene.add.image(0, 0, shieldKey)
        .setOrigin(0.5, 0.7)
      applyHeight(shield, appearance.height)
      bodyGroup.add(shield)
    }
  }

  // 13b. Racial features (optional)
  if (appearance.racialFeatures) {
    addRacialFeatures(scene, bodyGroup, appearance.racialFeatures, appearance)
  }

  // 13c. Accessories (up to 3)
  for (const acc of appearance.accessories.slice(0, 3)) {
    const accKey = resolveTextureKey(scene, `char_acc_${acc}`, null)
    if (accKey) {
      const accSprite = scene.add.image(0, 0, accKey)
        .setOrigin(0.5, 0.7)
      applyHeight(accSprite, appearance.height)
      bodyGroup.add(accSprite)
    }
  }

  // 13d. Markings (overlays)
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

  // 14. Effect/Aura layer (animated particle effect)
  let auraEmitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined
  if (appearance.aura && appearance.aura !== 'none') {
    auraEmitter = createAuraEffect(scene, appearance.aura, bodyGroup)
  }

  return { bodyGroup, auraEmitter }
}

/** Create shadow sprite (ellipse under feet) */
function createShadow(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const key = 'char_shadow'
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics()
    g.fillStyle(0x000000, 0.3)
    g.fillEllipse(24, 58, 28, 10)
    g.generateTexture(key, 48, 64)
    g.destroy()
  }
  return scene.add.image(0, 0, key).setOrigin(0.5, 0.7).setAlpha(0.35)
}

/** Apply quality-based visual effects to equipment sprites */
function applyQualityEffect(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  quality?: string,
): void {
  if (!quality) return

  switch (quality) {
    case 'crude':
      sprite.setAlpha(0.85)
      // Darken tint
      const currentTint = sprite.tintTopLeft || 0xFFFFFF
      sprite.setTint(darkenTint(currentTint, 0.7))
      break
    case 'fine':
      // Slightly brighter (no change needed, default is fine)
      break
    case 'masterwork':
      // Add golden outline glow via postFX if available
      if (sprite.preFX) {
        sprite.preFX.addGlow(0xFFD700, 2, 0, false, 0.3, 8)
      }
      break
    case 'legendary':
      // Strong purple/gold glow
      if (sprite.preFX) {
        sprite.preFX.addGlow(0xCC44FF, 4, 0, false, 0.5, 12)
      }
      break
  }
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
