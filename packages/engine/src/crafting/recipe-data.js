// ── Crop Configuration ──

export const CROPS = [
  {
    type: 'grain',
    outputId: 'grain',
    growthTicks: { spring: 20, summer: 15, autumn: 25, winter: null },
    yieldMin: 3,
    yieldMax: 6,
    seedReturnRate: 0.3,
  },
  {
    type: 'potato',
    outputId: 'potato',
    growthTicks: { spring: 15, summer: 12, autumn: 18, winter: null },
    yieldMin: 4,
    yieldMax: 8,
    seedReturnRate: 0.4,
  },
  {
    type: 'carrot',
    outputId: 'carrot',
    growthTicks: { spring: 12, summer: 10, autumn: 15, winter: null },
    yieldMin: 5,
    yieldMax: 10,
    seedReturnRate: 0.35,
  },
  {
    type: 'cotton',
    outputId: 'cotton',
    growthTicks: { spring: 25, summer: 20, autumn: 30, winter: null },
    yieldMin: 2,
    yieldMax: 5,
    seedReturnRate: 0.25,
  },
  {
    type: 'herb',
    outputId: 'herb',
    growthTicks: { spring: 10, summer: 8, autumn: 12, winter: null },
    yieldMin: 3,
    yieldMax: 7,
    seedReturnRate: 0.5,
  },
  {
    type: 'flax',
    outputId: 'flax',
    growthTicks: { spring: 18, summer: 15, autumn: 22, winter: null },
    yieldMin: 3,
    yieldMax: 6,
    seedReturnRate: 0.3,
  },
  {
    type: 'grape',
    outputId: 'grape',
    growthTicks: { spring: 30, summer: 25, autumn: 35, winter: null },
    yieldMin: 4,
    yieldMax: 9,
    seedReturnRate: 0.2,
  },
]

// ── Orchard Trees (perennial crops) ──

export const ORCHARD_TREES = [
  {
    type: 'apple',
    outputId: 'apple',
    maturityTicks: 100,  // time until first harvest
    harvestInterval: 30, // ticks between harvests
    yieldMin: 5,
    yieldMax: 12,
    lifespan: 500,       // total productive ticks
  },
  {
    type: 'cherry',
    outputId: 'cherry',
    maturityTicks: 80,
    harvestInterval: 25,
    yieldMin: 6,
    yieldMax: 15,
    lifespan: 400,
  },
]
