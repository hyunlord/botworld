import { useState, useEffect, createContext, useContext } from 'react'

interface MobileContextType {
  isMobile: boolean
  isTablet: boolean
  width: number
  height: number
}

const MobileContext = createContext<MobileContextType>({
  isMobile: false,
  isTablet: false,
  width: 1920,
  height: 1080,
})

export function useMobile() {
  return useContext(MobileContext)
}

export function MobileProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MobileContextType>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1920
    const h = typeof window !== 'undefined' ? window.innerHeight : 1080
    return {
      isMobile: w < 768,
      isTablet: w >= 768 && w < 1024,
      width: w,
      height: h,
    }
  })

  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setState({
        isMobile: w < 768,
        isTablet: w >= 768 && w < 1024,
        width: w,
        height: h,
      })
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <MobileContext.Provider value={state}>
      {children}
    </MobileContext.Provider>
  )
}
