import { useState } from 'react'

const DRAGON_PATHS = [
  'M199.02,231.09c-13.25-57.48-90.49-86.23-108.58-107.12c-9.3-10.74-6.97-22.15-1.16-28.29c6.24-6.58,18.13-7.88,27-2.09c7.76,5.05,22.86,19.06,26.25,24.23c3.39,5.16,3.35,9.43,5.17,12.9c2.07,3.9,6.75,5.98,13.53,3.95c6.28-1.87,9.75-4.35,9.75-4.35s-6.56-0.25-9.16-3.94c0,0-9.1-19.95-12.36-28.11c10.43,2.77,17.05,5.97,21.68,8.89c0.57,4.44-1.32,12.09-1.4,12.43c0.21-0.12,3.58-2.11,8.59-7.1c0.25,0.21,0.5,0.41,0.74,0.6c1.77,1.41-1.49,12.56-1.49,12.56s6.12-4.11,10.8-9.67c4.05-4.79,7.46-10.87,7.46-10.87s-13.25-5.6-19.36-15.3c-6.13-9.69-0.79-20.21-0.79-20.21s-10.22-3.28-18.78-15.62c-9-12.98-5.52-28.93-5.52-28.93c-7.32,2.94-13.74,17.5-13.74,17.5s-18.49-9.87-42.51-6.8C73.47,35.69,53.33,22.55,44.97,1.8c0,0-6.47,28.39,18.04,46.26c-1.33,0.9-2.66,1.85-3.99,2.87c-11.96,6.81-27.15,6.41-38.85-1.79c0,0,0.62,4.26,2.9,9.38c2.28,5.11,6.21,11.09,12.84,14.53c0.71,0.37,1.41,0.67,2.1,0.93c-1.38,2.2-2.66,4.48-3.81,6.82C27.67,91.76,14.56,97.3,2,94.02c0,0,6.59,12.03,18.41,13.5c2.73,0.34,5.11-0.07,7.15-0.88c-0.1,4.98,0.15,9.64,0.71,14.06c-0.3,9.68-6.83,18.27-16.35,20.99h-0.01c0,0,9.18,5.46,17.68,1.78c1.66-0.72,2.94-1.7,3.93-2.79c6.98,16.86,19.64,30.46,35.78,45.97c4.33,4.17,9.19,8.63,14.12,13.28c48.5,2.8,85.22,24.51,116.32,57.87C200.72,250.56,201.44,241.58,199.02,231.09z',
  'M147.91,70.11l13.72,13.65l-21.9-7.9L147.91,70.11z',
  'M181.003,133.297c0,0,6.706,6.836,16.005,8.195c-0.628,3.718-1.577,5.572-1.577,5.572s15.96,12.85,35.508,4.572c-0.902,10.276-13.643,14.81-13.643,14.81S230.983,183.407,258,173c-14.657,19.075-36.539,13.759-49.848,6.944C196.19,173.819,180.788,155.727,181.003,133.297z',
]

type Speed = 'slow' | 'med' | 'fast'
const SPEED_MUL: Record<Speed, number> = { slow: 3, med: 1, fast: 0.33 }

// dragon radius from center = 60px
// ring inner edges: 88-12=76 > 60 ✓  |  120-11=109 > 100 ✓  |  152-10=142 > 131 ✓
const ORBIT_ITEMS = [
  // inner ring — 3 items 120° apart, r=88
  { src: '/soccer-ball-svgrepo-com.svg',                        r: 88,  deg: 0,   dur: 9,  sz: 24 },
  { src: '/currency-dollar-svgrepo-com.svg',                    r: 88,  deg: 120, dur: 9,  sz: 24 },
  { src: '/soccer-player-svgrepo-com.svg',                      r: 88,  deg: 240, dur: 9,  sz: 24 },
  // middle ring — 4 items 90° apart, r=120
  { src: '/bitcoin-circle-svgrepo-com.svg',                     r: 120, deg: 0,   dur: 15, sz: 22 },
  { src: '/basketball-4-svgrepo-com.svg',                       r: 120, deg: 90,  dur: 15, sz: 22 },
  { src: '/chart-bearish-svgrepo-com.svg',                      r: 120, deg: 180, dur: 15, sz: 22 },
  { src: '/currency-pound-svgrepo-com.svg',                     r: 120, deg: 270, dur: 15, sz: 22 },
  // outer ring — 7 items ~51° apart, r=152
  { src: '/ethereum-crypto-cryptocurrency-2-svgrepo-com.svg',   r: 152, deg: 0,   dur: 22, sz: 20 },
  { src: '/betting-svgrepo-com.svg',                            r: 152, deg: 51,  dur: 22, sz: 20 },
  { src: '/tennis-6-svgrepo-com.svg',                           r: 152, deg: 103, dur: 22, sz: 20 },
  { src: '/currency-exchange-svgrepo-com.svg',                  r: 152, deg: 154, dur: 22, sz: 20 },
  { src: '/crown-1-svgrepo-com.svg',                            r: 152, deg: 206, dur: 22, sz: 20 },
  { src: '/crown-star-svgrepo-com.svg',                         r: 152, deg: 257, dur: 22, sz: 20 },
  { src: '/currency-bag-dollar-solid-svgrepo-com.svg',          r: 152, deg: 309, dur: 22, sz: 20 },
]

const W = 330
const H = 330
const CX = 165
const CY = 165

export default function LogoOrbit() {
  const [speed, setSpeed] = useState<Speed>('med')
  const mul = SPEED_MUL[speed]

  return (
    <div style={{ width: W, margin: '0 auto' }}>
      <div style={{ position: 'relative', width: W, height: H }}>
        <style>{`
          @keyframes tw-lo-cw  { to { transform: rotate( 360deg); } }
          @keyframes tw-lo-ccw { to { transform: rotate(-360deg); } }
          @keyframes tw-lo-dragon {
            0%,100% { filter: drop-shadow(0 0 6px var(--accent));  }
            50%      { filter: drop-shadow(0 0 18px var(--accent)); }
          }
        `}</style>

        {/* Orbiting icons */}
        {ORBIT_ITEMS.map((item, i) => {
          const dur = item.dur * mul
          const delay = `${-(item.deg / 360) * dur}s`
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: CY,
                left: CX,
                width: 0,
                height: 0,
                transformOrigin: '0 0',
                animation: `tw-lo-cw ${dur}s linear ${delay} infinite`,
              }}
            >
              <img
                src={item.src}
                alt=""
                style={{
                  position: 'absolute',
                  top: -item.sz / 2,
                  left: item.r - item.sz / 2,
                  width: item.sz,
                  height: item.sz,
                  animation: `tw-lo-ccw ${dur}s linear ${delay} infinite`,
                  filter: 'brightness(0) invert(1)',
                  opacity: 0.65,
                }}
              />
            </div>
          )
        })}

        {/* Dragon — center */}
        <svg
          viewBox="0 0 260 260"
          style={{
            position: 'absolute',
            top: CY - 60,
            left: CX - 60,
            width: 120,
            height: 120,
            fill: 'var(--accent)',
            animation: 'tw-lo-dragon 3s ease-in-out infinite',
          }}
        >
          {DRAGON_PATHS.map((d, i) => <path key={i} d={d} />)}
        </svg>
      </div>

      {/* Speed control */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
        {(['slow', 'med', 'fast'] as Speed[]).map(s => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            style={{
              padding: '3px 10px', borderRadius: 6, border: 'none',
              fontSize: 11, cursor: 'pointer',
              background: speed === s ? 'var(--accent)' : 'var(--surface-2)',
              color: speed === s ? '#fff' : 'var(--text-muted)',
              fontWeight: speed === s ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
