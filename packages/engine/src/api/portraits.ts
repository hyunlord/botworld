import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import type { PortraitService } from '../services/portrait-service.js'

export function createPortraitRouter(portraitService: PortraitService): Router {
  const router = Router()

  // Serve portrait images
  router.get('/portraits/:filename', (req, res) => {
    const filename = req.params.filename
    // Sanitize filename
    if (!filename || filename.includes('..') || !filename.match(/^[\w-]+\.png$/)) {
      res.status(400).json({ error: 'Invalid filename' })
      return
    }

    const filePath = portraitService.getPortraitPath(filename.replace('.png', ''))
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400') // Cache 1 day
      fs.createReadStream(filePath).pipe(res)
    } else {
      // Check for JSON placeholder metadata
      const metaPath = filePath.replace('.png', '.json')
      if (fs.existsSync(metaPath)) {
        // Return placeholder metadata - client generates visual
        res.json(JSON.parse(fs.readFileSync(metaPath, 'utf-8')))
      } else {
        res.status(404).json({ error: 'Portrait not found' })
      }
    }
  })

  // Generate portrait on demand
  router.post('/portraits/generate/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params
      const { race, gender, appearance, personality, characterClass } = req.body

      if (!race || !appearance) {
        res.status(400).json({ error: 'race and appearance are required' })
        return
      }

      const url = await portraitService.generatePortrait(agentId, {
        race,
        gender,
        appearance,
        personality,
        characterClass,
      })

      res.json({ portraitUrl: url })
    } catch (err) {
      console.error('[Portraits] Generation error:', err)
      res.status(500).json({ error: 'Portrait generation failed' })
    }
  })

  return router
}
