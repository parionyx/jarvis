import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import { useTheme } from '@/themes/context'
import { cn } from '@/lib/utils'


export type IntroProps = {
  personality?: string
  seed?: number
}

// Continent vector paths for 3D Holographic Globe (with detailed country & peninsula borders)
// Continent vector paths for 3D Holographic Globe (with detailed country & peninsula borders and custom colors)
const CONTINENT_PATHS = [
  // North America (US, Canada, Mexico, Alaska) - Cool Cyan
  {
    pts: [[-168,65],[-165,70],[-150,71],[-140,70],[-120,72],[-100,75],[-85,75],[-70,68],[-60,60],[-55,45],[-60,43],[-70,42],[-80,25],[-82,23],[-95,18],[-98,16],[-105,22],[-110,23],[-115,28],[-120,35],[-125,48],[-130,50],[-135,55],[-140,60],[-165,65]],
    color: 0x00d0ff
  },
  // South America (Brazil, Argentina, Colombia, Peru) - Electric Blue
  {
    pts: [[-80,10],[-72,12],[-60,12],[-48,-2],[-35,-5],[-38,-15],[-40,-20],[-50,-30],[-55,-35],[-62,-45],[-65,-55],[-75,-50],[-73,-40],[-70,-20],[-78,-10],[-80,0],[-80,10]],
    color: 0x0088ff
  },
  // Europe (detailed Scandinavian peninsula & Mediterranean shape) - Indigo/Purple
  {
    pts: [[-10,35],[-5,36],[-2,42],[5,43],[5,49],[10,54],[14,53],[22,54],[32,55],[40,65],[50,66],[60,67],[60,50],[50,45],[40,40],[35,36],[27,38],[20,38],[15,40],[12,37],[5,36],[-5,36],[-10,35]],
    color: 0xa855f7
  },
  // United Kingdom & Ireland - Pink/Magenta
  {
    pts: [[-5,50],[-6,53],[-5,56],[-3,58],[-2,57],[-1,54],[2,51],[-2,50],[-5,50]],
    color: 0xec4899
  },
  // Africa (North, South, Horn, Madagascar) - Amber/Gold
  {
    pts: [[-15,30],[-5,36],[10,37],[20,32],[32,32],[34,27],[42,18],[50,12],[45,5],[39,-15],[30,-35],[18,-35],[10,-5],[-10,5],[-15,10],[-18,25],[-15,30]],
    color: 0xffb300
  },
  // Madagascar - Orange
  {
    pts: [[47,-12],[49,-15],[47,-25],[43,-25],[45,-16],[47,-12]],
    color: 0xf97316
  },
  // Asia / Eurasia (Siberia, China, Middle East) - Emerald Green
  {
    pts: [[35,42],[50,45],[70,45],[90,45],[110,40],[120,50],[130,55],[140,60],[160,65],[170,65],[175,60],[160,40],[140,35],[120,22],[108,18],[95,15],[60,25],[45,30],[35,42]],
    color: 0x00ff88
  },
  // India (detailed subcontinent peninsula) - Fire red/orange for active zone!
  {
    pts: [[68,23],[73,22],[72,19],[75,15],[77,11],[78,8],[80,9],[80,13],[84,16],[88,22],[92,21],[91,24],[88,24],[88,27],[84,26],[78,25],[72,24],[68,23]],
    color: 0xff3355
  },
  // Indochina & Southeast Asia - Teal
  {
    pts: [[98,15],[102,15],[105,10],[108,10],[109,20],[115,15],[110,8],[105,5],[100,1],[98,5],[98,15]],
    color: 0x0d9488
  },
  // Japan (islands outline) - Bright yellow
  {
    pts: [[130,32],[132,34],[136,35],[140,36],[142,40],[145,43],[140,40],[135,35],[130,32]],
    color: 0xfacc15
  },
  // Australia (peninsulas & Tasmania) - Lime/Green
  {
    pts: [[113,-26],[115,-20],[120,-15],[135,-12],[138,-15],[143,-10],[150,-22],[152,-34],[152,-38],[140,-38],[130,-35],[115,-30],[113,-26]],
    color: 0x84cc16
  },
  // Greenland - Mint/Light Blue
  {
    pts: [[-55,60],[-40,62],[-20,70],[-25,80],[-40,83],[-60,82],[-55,60]],
    color: 0xa5f3fc
  }
]

// ── 1. 3D Holographic Earth Component ───────────────────────────────────────
function EarthHologram() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let width = container.clientWidth || 240
    const height = 115

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.z = 2.6

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' })
      renderer.setSize(width, height)
      renderer.setPixelRatio(1)
      container.innerHTML = ''
      container.appendChild(renderer.domElement)
    } catch {
      return
    }

    const earthGroup = new THREE.Group()
    scene.add(earthGroup)

    const sphereGeo = new THREE.SphereGeometry(0.96, 32, 32)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x020814,
      transparent: true,
      opacity: 0.94
    })
    earthGroup.add(new THREE.Mesh(sphereGeo, sphereMat))

    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.15
    })

    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (90 - lat) * (Math.PI / 180)
      const r = Math.sin(phi) * 1.002
      const y = Math.cos(phi) * 1.002
      const pts: any[] = []
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      earthGroup.add(new THREE.Line(geo, wireMat))
    }

    for (let lon = 0; lon < 180; lon += 45) {
      const pts: any[] = []
      const rad = lon * (Math.PI / 180)
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2
        pts.push(
          new THREE.Vector3(
            Math.sin(theta) * Math.cos(rad) * 1.002,
            Math.cos(theta) * 1.002,
            Math.sin(theta) * Math.sin(rad) * 1.002
          )
        )
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      earthGroup.add(new THREE.Line(geo, wireMat))
    }

    function latLonToVector3(lat: number, lon: number, radius = 1.008): any {
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lon + 180) * (Math.PI / 180)
      return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      )
    }

    // Draw multi-colored continent outlines
    CONTINENT_PATHS.forEach(path => {
      const pts: any[] = []
      path.pts.forEach(([lon, lat]) => pts.push(latLonToVector3(lat, lon)))
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
      
      const continentMat = new THREE.LineBasicMaterial({
        color: path.color,
        transparent: true,
        opacity: 0.9,
        linewidth: 1.8
      })
      earthGroup.add(new THREE.Line(lineGeo, continentMat))
    })

    // General global connection hubs (excluding India New Delhi)
    const hubs = [
      [37.77, -122.41], [40.71, -74.0], [51.5, -0.12],
      [35.67, 139.65], [-33.86, 151.2]
    ]
    const hubPts: any[] = []
    hubs.forEach(([lat, lon]) => hubPts.push(latLonToVector3(lat, lon, 1.015)))
    const dotGeo = new THREE.BufferGeometry().setFromPoints(hubPts)
    const dotMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.08,
      transparent: true,
      opacity: 0.9
    })
    earthGroup.add(new THREE.Points(dotGeo, dotMat))

    // Dedicated Pulsating active base locator pin on India (New Delhi)
    const indiaLoc = latLonToVector3(28.61, 77.2, 1.018)
    const indiaGeo = new THREE.BufferGeometry().setFromPoints([indiaLoc])
    const indiaMat = new THREE.PointsMaterial({
      color: 0xff3355, // Stark active red indicator
      size: 0.18,
      transparent: true,
      opacity: 0.95
    })
    const indiaPin = new THREE.Points(indiaGeo, indiaMat)
    earthGroup.add(indiaPin)

    const haloGeo = new THREE.RingGeometry(1.04, 1.14, 48)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    })
    earthGroup.add(new THREE.Mesh(haloGeo, haloMat))


    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        width = entry.contentRect.width || 240
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }
    })
    ro.observe(container)

    // Interactive Mouse & Touch Dragging controls
    let isDragging = false
    let autoRotate = true
    let previousMousePosition = { x: 0, y: 0 }
    let inactivityTimer: NodeJS.Timeout

    const handleStart = (clientX: number, clientY: number) => {
      isDragging = true
      autoRotate = false
      previousMousePosition = { x: clientX, y: clientY }
      container.style.cursor = 'grabbing'
      clearTimeout(inactivityTimer)
    }

    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging) return
      const deltaX = clientX - previousMousePosition.x
      const deltaY = clientY - previousMousePosition.y

      // Rotate group based on drag speed/direction
      earthGroup.rotation.y += deltaX * 0.008
      earthGroup.rotation.x += deltaY * 0.008

      previousMousePosition = { x: clientX, y: clientY }
    }

    const handleEnd = () => {
      if (!isDragging) return
      isDragging = false
      container.style.cursor = 'grab'
      // Auto resume rotation after 2.5s
      clearTimeout(inactivityTimer)
      inactivityTimer = setTimeout(() => {
        autoRotate = true
      }, 2500)
    }

    const onMouseDown = (e: MouseEvent) => {
      handleStart(e.clientX, e.clientY)
    }

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }

    const onMouseUp = () => {
      handleEnd()
    }

    // Touch support (trackpads/mobiles)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const onTouchEnd = () => {
      handleEnd()
    }

    container.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    container.style.cursor = 'grab'

    let animId: number
    const animate = () => {
      if (autoRotate) {
        earthGroup.rotation.y += 0.003
        // Slowly return X rotation back to a calibrated horizontal slant (0.2 rad)
        earthGroup.rotation.x += (0.2 - earthGroup.rotation.x) * 0.05
      }

      // Dynamic pulsating animation for India active pin
      const time = Date.now() * 0.006
      indiaMat.size = 0.14 + Math.sin(time) * 0.05

      renderer.render(scene, camera)
      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
      clearTimeout(inactivityTimer)

      container.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      container.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return <div ref={containerRef} className="flex h-[115px] w-full items-center justify-center overflow-hidden select-none pointer-events-auto" />
}

// ── 2. Tactical Location Radar Component ────────────────────────────────────
function LocationRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 28.4595, lon: 77.0266 })
  const [cityText, setCityText] = useState<string>('GURGAON, INDIA')

  useEffect(() => {
    let active = true

    const tryIpGeo = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/')
        const data = await res.json()
        if (active && data && data.latitude && data.longitude) {
          setCoords({ lat: data.latitude, lon: data.longitude })
          setCityText(`${data.city || 'LOCAL'}${data.country_name ? ', ' + data.country_name.toUpperCase() : ''}`)
          return
        }
      } catch {}
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          if (!active) return
          const { latitude: lat, longitude: lon } = pos.coords
          setCoords({ lat, lon })
          tryIpGeo()
        },
        () => { tryIpGeo() },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      tryIpGeo()
    }

    return () => { active = false }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let tick = 0

    const render = () => {
      const w = container.clientWidth || 240
      const h = 68
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      ctx.clearRect(0, 0, w, h)
      tick += 0.035

      const cx = w / 2
      const cy = h / 2

      // Background Grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 18) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 18) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Radar Concentric Circles
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, 28, 0, Math.PI * 2)
      ctx.stroke()

      // Crosshairs
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)'
      ctx.beginPath()
      ctx.moveTo(cx - 32, cy)
      ctx.lineTo(cx + 32, cy)
      ctx.moveTo(cx, cy - 26)
      ctx.lineTo(cx, cy + 26)
      ctx.stroke()

      // Sweep Fan
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(tick)
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 28)
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)')
      grad.addColorStop(1, 'rgba(0, 240, 255, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, 28, 0, 0.6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Pulsing Red Focal Point
      const ringSize = 4 + (tick * 10) % 14
      const ringAlpha = Math.max(0, 1 - ringSize / 14)

      ctx.strokeStyle = `rgba(255, 60, 80, ${ringAlpha})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, ringSize, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#FF3355'
      ctx.shadowColor = '#FF3355'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      animId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animId)
  }, [coords])

  return (
    <div ref={containerRef} className="flex flex-col w-full">
      <div className="h-[68px] w-full overflow-hidden rounded bg-[#030914]">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[8.5px] xl:text-[9px] text-[#528499]">
        <span>LAT {coords.lat.toFixed(4)} · LON {coords.lon.toFixed(4)}</span>
        <span className="text-[#00FF88] font-bold">LOCK ACQUIRED</span>
      </div>
      <div className="flex items-center justify-between font-mono text-[8.5px] xl:text-[9px] text-[#528499]">
        <span>REGION // SECTOR</span>
        <span className="text-[#00F0FF] font-semibold">{cityText}</span>
      </div>
    </div>
  )
}

// ── 3. High-Detail Engineered Iron Man Arc Reactor ──────────────────────────
function CinematicArcReactor({
  batteryLevel,
  isCharging
}: {
  batteryLevel: number
  isCharging: boolean
}) {
  const levelPct = Math.round(batteryLevel * 100)

  return (
    <div className="relative flex aspect-square w-full max-w-[min(28vw,380px)] min-w-[210px] items-center justify-center select-none">
      {/* ── Outer Concentric Geometric Blueprint Lines ──────────────────────── */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Calibrated Dial Ticks */}
        <circle cx="200" cy="200" r="195" stroke="rgba(0, 240, 255, 0.18)" strokeWidth="1" />
        <circle cx="200" cy="200" r="185" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="1.2" strokeDasharray="4 6" />

        {/* 60 Outer Radial Laser Ticks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const deg = i * 6
          const isMajor = i % 5 === 0
          return (
            <line
              key={i}
              x1="200"
              y1={isMajor ? "12" : "18"}
              x2="200"
              y2="26"
              transform={`rotate(${deg} 200 200)`}
              stroke={isMajor ? "#FFB300" : "#00F0FF"}
              strokeWidth={isMajor ? "1.8" : "0.8"}
              strokeOpacity={isMajor ? "0.9" : "0.35"}
            />
          )
        })}

        {/* Fast Rotating Segmented Outer Notch Ring */}
        <circle
          cx="200"
          cy="200"
          r="172"
          stroke={isCharging ? '#00FF88' : '#00F0FF'}
          strokeWidth="1.5"
          strokeDasharray="20 40 10 20 45 35"
          strokeOpacity="0.75"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 200"
            to="360 200 200"
            dur={isCharging ? "12s" : "28s"}
            repeatCount="indefinite"
          />
        </circle>

        {/* Reverse-Rotating Dotted Ring */}
        <circle
          cx="200"
          cy="200"
          r="145"
          stroke="#FFB300"
          strokeWidth="2"
          strokeDasharray="3 7"
          strokeOpacity="0.55"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="360 200 200"
            to="0 200 200"
            dur={isCharging ? "10s" : "22s"}
            repeatCount="indefinite"
          />
        </circle>

        {/* 10 Heavy Copper Electromagnets / Arc Blocks */}
        {Array.from({ length: 10 }).map((_, i) => {
          const deg = i * 36
          return (
            <g key={i} transform={`rotate(${deg} 200 200)`}>
              {/* Outer Metallic Housing */}
              <rect
                x="188"
                y="28"
                width="24"
                height="30"
                rx="2"
                stroke={isCharging ? '#00FF88' : '#00F0FF'}
                strokeWidth="1.5"
                fill="#030C1A"
              />
              {/* Copper Coil Filaments */}
              <rect
                x="192"
                y="32"
                width="16"
                height="22"
                rx="1"
                fill={isCharging ? '#00FF88' : '#00F0FF'}
                fillOpacity="0.95"
              />
              {/* Core Dividing Line */}
              <line x1="200" y1="32" x2="200" y2="54" stroke="#030C1A" strokeWidth="2" />
              {/* Radiating High-Energy Conduit */}
              <line x1="200" y1="58" x2="200" y2="80" stroke={isCharging ? '#00FF88' : '#00F0FF'} strokeWidth="1.2" strokeOpacity="0.6" />
            </g>
          )
        })}

        {/* Pulsing Energy Conduit Flux Lines (Only visible when charging) */}
        {isCharging && (
          <g className="animate-pulse">
            {Array.from({ length: 10 }).map((_, i) => {
              const deg = i * 36
              return (
                <line
                  key={i}
                  x1="200"
                  y1="82"
                  x2="200"
                  y2="110"
                  transform={`rotate(${deg} 200 200)`}
                  stroke="#00FF88"
                  strokeWidth="1.5"
                  strokeOpacity="0.75"
                  strokeDasharray="3 3"
                />
              )
            })}
          </g>
        )}

        {/* Continuous Rotating Solid Calibrator Ring (Glow Backing - 60 FPS) */}
        <circle
          cx="200"
          cy="200"
          r="135"
          stroke={isCharging ? '#00FF88' : '#00F0FF'}
          strokeWidth="6"
          strokeDasharray="260 40"
          strokeOpacity="0.18"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 200"
            to="360 200 200"
            dur={isCharging ? "14s" : "26s"}
            repeatCount="indefinite"
          />
        </circle>
        {/* Continuous Rotating Solid Calibrator Ring (Foreground) */}
        <circle
          cx="200"
          cy="200"
          r="135"
          stroke={isCharging ? '#00FF88' : '#00F0FF'}
          strokeWidth="2.5"
          strokeDasharray="260 40"
          strokeOpacity="0.85"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 200"
            to="360 200 200"
            dur={isCharging ? "14s" : "26s"}
            repeatCount="indefinite"
          />
        </circle>

        {/* Counter-Rotating Mid Mechanical Turbine Segment (20s) */}
        <g>
          <circle
            cx="200"
            cy="200"
            r="120"
            stroke={isCharging ? '#00FF88' : '#00F0FF'}
            strokeWidth="3"
            strokeDasharray="60 30 20 30 80 40"
            strokeOpacity="0.9"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 200 200"
              to="0 200 200"
              dur={isCharging ? "18s" : "40s"}
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="200" cy="200" r="108" stroke="rgba(255, 179, 0, 0.4)" strokeWidth="1.2" strokeDasharray="4 6">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 200 200"
              to="360 200 200"
              dur={isCharging ? "24s" : "50s"}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>

      {/* ── Central Power Core (Glassmorphic + Intense Photonic Arc Glow) ──── */}
      <div
        className={cn(
          "relative z-10 flex h-[38%] w-[38%] min-h-[90px] min-w-[90px] flex-col items-center justify-center rounded-full border-2 bg-[#030A17]/95 text-center backdrop-blur-md transition-all duration-500 hover:scale-105",
          isCharging
            ? "border-[#00FF88] shadow-[0_0_55px_rgba(0,255,136,0.85),inset_0_0_30px_rgba(0,255,136,0.65)] animate-[jarvis-pulse-ring_1.8s_infinite]"
            : "border-[#00F0FF] shadow-[0_0_45px_rgba(0,240,255,0.7),inset_0_0_25px_rgba(0,240,255,0.45)] animate-[jarvis-pulse-ring_3.5s_infinite]"
        )}
      >
        <span className="font-mono text-[8.5px] xl:text-[9.5px] font-extrabold tracking-[0.26em] text-[#528499] uppercase">
          ARC CORE
        </span>
        <span
          className={cn(
            "font-mono text-xl xl:text-3xl font-black tracking-tight",
            isCharging ? "text-[#00FF88] drop-shadow-[0_0_14px_rgba(0,255,136,0.9)]" : "text-[#00F0FF] drop-shadow-[0_0_14px_rgba(0,240,255,0.9)]"
          )}
        >
          {levelPct}%
        </span>
        <span
          className="mt-0.5 font-mono text-[8px] xl:text-[9px] font-bold tracking-[0.14em]"
          style={{ color: isCharging ? '#00FF88' : '#528499' }}
        >
          {isCharging ? '⚡ CHARGING' : 'OPTIMAL'}
        </span>
      </div>
    </div>
  )
}

// ── 4. Main Desktop Intro Component ─────────────────────────────────────────
export function Intro({ personality: _p, seed: _s }: IntroProps) {
  const { themeName } = useTheme()
  const isJarvis = themeName === 'jarvis'

  // Real System Telemetry State
  const [telemetry, setTelemetry] = useState<{
    cpu: { percent: number; model: string; cores: number; speedMhz: number }
    memory: { percent: number; usedGb: string; totalGb: string; freeGb: string }
    uptime: { totalSec: number; formatted: string; days: number }
    network: { downMbps: number; upMbps: number; connected: boolean; adapter: string }
    power: { onBattery: boolean }
  }>({
    cpu: { percent: 44.5, model: '8 CORES · 2.40 GHz', cores: 8, speedMhz: 2400 },
    memory: { percent: 92.7, usedGb: '7.2', totalGb: '7.7', freeGb: '0.5' },
    uptime: { totalSec: 51596, formatted: '14:19:56', days: 0 },
    network: { downMbps: 1.2, upMbps: 0.4, connected: true, adapter: 'Wi-Fi' },
    power: { onBattery: true }
  })

  // Rolling History Buffers for Live Waveform Graphs
  const [cpuHistory, setCpuHistory] = useState<number[]>([38, 42, 40, 45, 42, 48, 44, 46, 45, 44.5])
  const [netHistory, setNetHistory] = useState<number[]>([0.8, 1.1, 0.9, 1.4, 1.2, 1.0, 1.5, 1.3, 1.1, 1.2])

  // Battery State
  const [batteryState, setBatteryState] = useState<{
    level: number
    charging: boolean
  }>({
    level: 0.94,
    charging: false
  })

  // Poll Real System Telemetry via Electron IPC (every 1s)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const poll = async () => {
      try {
        if (window.hermesDesktop?.getSystemTelemetry) {
          const data = await window.hermesDesktop.getSystemTelemetry()
          if (data) {
            setTelemetry(data)
            setCpuHistory(prev => [...prev.slice(1), data.cpu.percent])
            setNetHistory(prev => [...prev.slice(1), data.network.downMbps])
          }
        }
      } catch {}
    }

    poll()
    const timer = setInterval(poll, 1000)
    return () => clearInterval(timer)
  }, [])

  // Battery API Listener
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      ;(navigator as any).getBattery().then((battery: any) => {
        const update = () => {
          setBatteryState({
            level: battery.level ?? 0.94,
            charging: battery.charging ?? false
          })
        }
        update()
        battery.addEventListener('levelchange', update)
        battery.addEventListener('chargingchange', update)
      })
    }
  }, [])

  // Rolling Canvas Waveform Graphs
  const cpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const netCanvasRef = useRef<HTMLCanvasElement>(null)

  const drawWave = (canvas: HTMLCanvasElement | null, history: number[], color: string, maxVal = 100) => {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const w = canvas.width
    const h = canvas.height
    const step = w / (history.length - 1)

    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, `${color}40`)
    grad.addColorStop(1, `${color}00`)

    ctx.beginPath()
    history.forEach((val, i) => {
      const x = i * step
      const y = h - (Math.min(val, maxVal) / maxVal) * (h - 4) - 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2.2
    ctx.shadowColor = color
    ctx.shadowBlur = 8

    history.forEach((val, i) => {
      const x = i * step
      const y = h - (Math.min(val, maxVal) / maxVal) * (h - 4) - 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  const [activeCards, setActiveCards] = useState<number>(0)
  const [reactorLoaded, setReactorLoaded] = useState<boolean>(false)
  const [diagnosticMode, setDiagnosticMode] = useState<boolean>(false)

  useEffect(() => {
    // Reactor scales up first
    setReactorLoaded(true)

    // Staggered card release
    const timeouts = [
      setTimeout(() => setActiveCards(1), 600),   // Left 1
      setTimeout(() => setActiveCards(2), 950),   // Left 2
      setTimeout(() => setActiveCards(3), 1300),  // Left 3
      setTimeout(() => setActiveCards(4), 1650),  // Right 1
      setTimeout(() => setActiveCards(5), 2000),  // Right 2
      setTimeout(() => setActiveCards(6), 2350),  // Right 3
    ]

    return () => timeouts.forEach(clearTimeout)
  }, [])

  // Simulate CPU core spike history updates during diagnostic trigger runs
  useEffect(() => {
    if (!diagnosticMode) return
    const interval = setInterval(() => {
      setCpuHistory(prev => [...prev.slice(1), Math.floor(65 + Math.random() * 30)])
    }, 120)

    const timer = setTimeout(() => {
      setDiagnosticMode(false)
    }, 2500)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [diagnosticMode])

  useEffect(() => { drawWave(cpuCanvasRef.current, cpuHistory, diagnosticMode ? '#FFB300' : '#00F0FF', 100) }, [cpuHistory, diagnosticMode])
  useEffect(() => { drawWave(netCanvasRef.current, netHistory, '#00FF88', 10) }, [netHistory])

  if (!isJarvis) {
    return (
      <div className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-0.5 py-6 text-center text-muted-foreground sm:px-6 lg:px-8">
        <p className="fit-text mx-auto mb-1 w-[calc(100%-1rem)] font-['Collapse'] font-bold uppercase leading-[0.9] tracking-[0.08em] text-midground mix-blend-plus-lighter dark:text-foreground/90">
          <span>HERMES AGENT</span>
        </p>
      </div>
    )
  }

  return (
    <div
      className="jarvis-desktop-hud relative flex h-full min-h-0 w-full min-w-0 items-center justify-center gap-2 md:gap-3 xl:gap-6 px-2 md:px-4 py-2 select-none overflow-hidden jarvis-hud-container"
      data-slot="aui_intro"
    >
      {/* ── LEFT FLIGHT WING: 3 BIG HUD CARDS ───────────────────────────────── */}
      <div className="jarvis-hud-left-wing relative z-20 flex flex-col justify-between flex-shrink-0" style={{ height: 'clamp(380px, 80vh, 510px)' }}>
        {/* LEFT CARD 1: CPU TELEMETRY */}
        <div
          onClick={() => {
            if (!diagnosticMode) {
              setDiagnosticMode(true)
            }
          }}
          className={cn(
            "jarvis-hud-panel p-3 transition-all duration-700 ease-out transform cursor-pointer select-none relative overflow-hidden group hover:border-[#00F0FF]/40 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)]",
            activeCards >= 1
              ? "opacity-100 scale-100 translate-x-0 translate-y-0 blur-none"
              : "opacity-0 scale-50 translate-x-[150px] translate-y-[80px] blur-md pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1 text-[9.5px] xl:text-[10.5px] font-extrabold tracking-[0.16em] text-[#528499] uppercase border-b border-[#00F0FF]/15 animate-none">
            <span>01 // CPU TELEMETRY</span>
            {diagnosticMode ? (
              <span className="text-[#FFB300] font-mono text-[8.5px] animate-pulse">DIAGNOSTIC ●</span>
            ) : (
              <span className="text-[#00FF88] font-mono text-[8.5px] group-hover:animate-pulse">ACTIVE ●</span>
            )}
          </div>

          {/* Interactive Split View: Radial Gauge & Core Grid */}
          <div className="mt-2 flex items-center justify-between gap-3">
            {/* Radial Gauge */}
            <div className="relative flex flex-col items-center justify-center flex-shrink-0 w-[55px] h-[55px]">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="27.5"
                  cy="27.5"
                  r="22"
                  stroke="rgba(0, 240, 255, 0.1)"
                  strokeWidth="2.5"
                  fill="transparent"
                />
                {/* Glow backing */}
                <circle
                  cx="27.5"
                  cy="27.5"
                  r="22"
                  stroke={diagnosticMode ? "#FFB300" : "#00F0FF"}
                  strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={
                    2 * Math.PI * 22 * (1 - (diagnosticMode ? 88 : telemetry.cpu.percent) / 100)
                  }
                  strokeOpacity="0.22"
                  className="transition-all duration-500 ease-out"
                />
                {/* Dynamic Progress Ring */}
                <circle
                  cx="27.5"
                  cy="27.5"
                  r="22"
                  stroke={diagnosticMode ? "#FFB300" : "#00F0FF"}
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={
                    2 * Math.PI * 22 * (1 - (diagnosticMode ? 88 : telemetry.cpu.percent) / 100)
                  }
                  strokeOpacity="0.95"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              {/* Central Value */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="font-mono text-[10.5px] xl:text-[11.5px] font-black text-[#00F0FF] tracking-tighter">
                  {diagnosticMode ? "88%" : `${Math.round(telemetry.cpu.percent)}%`}
                </span>
                <span className="font-mono text-[5px] text-[#528499] uppercase font-bold tracking-[0.05em] -mt-0.5">
                  LOAD
                </span>
              </div>
            </div>

            {/* Core Workload Grid (8 Cores) */}
            <div className="flex-1 grid grid-cols-4 gap-x-1.5 gap-y-1">
              {Array.from({ length: 8 }).map((_, i) => {
                // Generate core load percentage based on active or diagnostic mode
                const coreVal = diagnosticMode
                  ? Math.floor(45 + Math.random() * 50)
                  : Math.max(10, Math.min(100, Math.round(telemetry.cpu.percent + Math.sin(Date.now() * 0.001 + i) * 12)))
                return (
                  <div key={i} className="flex flex-col">
                    <span className="font-mono text-[6.5px] text-[#528499] font-extrabold uppercase">
                      C{i + 1}
                    </span>
                    {/* Micro vertical cells representing workload */}
                    <div className="mt-0.5 h-4 w-full bg-[#030914] rounded overflow-hidden flex flex-col-reverse justify-start gap-[1px] p-[1px] border border-[#00F0FF]/10">
                      {Array.from({ length: 4 }).map((_, cIdx) => {
                        const cellTrigger = (coreVal / 100) * 4 > cIdx
                        return (
                          <div
                            key={cIdx}
                            className={cn(
                              "h-[2.5px] w-full rounded-[0.5px] transition-all duration-300",
                              cellTrigger
                                ? diagnosticMode
                                  ? "bg-[#FFB300] shadow-[0_0_2px_#FFB300]"
                                  : "bg-[#00FF88] shadow-[0_0_2px_#00FF88]"
                                : "bg-[#101b2c]"
                            )}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Interactive instruction subtitle */}
          <div className="mt-1 flex items-center justify-between font-mono text-[7px] text-[#528499] uppercase font-extrabold tracking-[0.14em]">
            <span>{telemetry.cpu.model}</span>
            <span className="animate-pulse text-[#00F0FF]/50">CLICK TO DIAGNOSE</span>
          </div>

          {/* Waveform Canvas */}
          <div className="mt-1 h-7 w-full overflow-hidden rounded bg-[#030914]/80 border border-[#00F0FF]/5">
            <canvas ref={cpuCanvasRef} width={280} height={28} className="h-full w-full" />
          </div>
        </div>


        {/* LEFT CARD 2: MEMORY ALLOCATION */}
        <div
          className={cn(
            "jarvis-hud-panel p-3 transition-all duration-700 ease-out transform",
            activeCards >= 2
              ? "opacity-100 scale-100 translate-x-0 translate-y-0 blur-none"
              : "opacity-0 scale-50 translate-x-[150px] translate-y-0 blur-md pointer-events-none"
          )}
        >
          <div className="flex items-center justify-between pb-1 text-[9.5px] xl:text-[10.5px] font-extrabold tracking-[0.16em] text-[#528499] uppercase border-b border-[#00F0FF]/15">
            <span>02 // MEMORY ALLOC</span>
            <span className="text-[#00F0FF] font-mono text-[8.5px]">BUFFER</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] xl:text-[11px]">
            <span className="text-[#528499]">USAGE</span>
            <span className="text-[#00F0FF] font-black text-sm xl:text-base">{telemetry.memory.percent}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#030914]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#00FF88] shadow-[0_0_10px_#00FF88]"
              style={{ width: `${Math.min(100, Math.max(5, telemetry.memory.percent))}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-[8px] xl:text-[9px] text-[#528499] truncate font-semibold">
            {telemetry.memory.usedGb} / {telemetry.memory.totalGb} GB IN USE
          </div>
        </div>

        {/* LEFT CARD 3: NEURAL UPLINK */}
        <div
          className={cn(
            "jarvis-hud-panel p-3 transition-all duration-700 ease-out transform",
            activeCards >= 3
              ? "opacity-100 scale-100 translate-x-0 translate-y-0 blur-none"
              : "opacity-0 scale-50 translate-x-[150px] translate-y-[-80px] blur-md pointer-events-none"
          )}
        >
          <div className="flex items-center justify-between pb-1 text-[9.5px] xl:text-[10.5px] font-extrabold tracking-[0.16em] text-[#528499] uppercase border-b border-[#00F0FF]/15">
            <span>03 // NEURAL UPLINK</span>
            <span className="text-[#00FF88] font-mono text-[8.5px]">ONLINE ●</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="font-mono text-sm xl:text-base font-extrabold text-[#00F0FF]">
              <span>↓ {telemetry.network.downMbps}M</span>
              <span className="ml-1.5 text-[#00FF88]">↑ {telemetry.network.upMbps}M</span>
            </div>
            <span className="font-mono text-[8px] xl:text-[9px] text-[#528499] truncate">
              {telemetry.network.adapter}
            </span>
          </div>
          <div className="mt-1.5 h-7 w-full overflow-hidden rounded bg-[#030914]">
            <canvas ref={netCanvasRef} width={280} height={28} className="h-full w-full" />
          </div>
        </div>
      </div>

      {/* ── CENTER: THE GRAND STARK ARC REACTOR ─────────────────────────────── */}
      <div
        className={cn(
          "jarvis-hud-center relative flex flex-col items-center justify-center px-1 flex-shrink-0 transition-all duration-1000 ease-out transform",
          reactorLoaded ? "scale-100 opacity-100 blur-none" : "scale-50 opacity-0 blur-md"
        )}
      >
        <CinematicArcReactor
          batteryLevel={batteryState.level}
          isCharging={batteryState.charging}
        />

        {/* J.A.R.V.I.S. Core Identity Plaque */}
        <div className="mt-3 flex flex-col items-center text-center">
          <div className="whitespace-nowrap font-mono text-sm sm:text-base xl:text-lg font-black tracking-[0.24em] text-[#00F0FF] drop-shadow-[0_0_14px_rgba(0,240,255,0.9)] select-none">
            J · A · R · V · I · S
          </div>
          <div className="whitespace-nowrap mt-0.5 font-mono text-[8.5px] xl:text-[9.5px] tracking-[0.18em] text-[#528499] uppercase">
            AI NEURAL CORE // MARK-85
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" />
            <span className="h-2 w-2 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88] animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-[#FFB300] shadow-[0_0_8px_#FFB300]" />
          </div>
        </div>
      </div>

      {/* ── RIGHT FLIGHT WING: 3 BIG HUD CARDS ──────────────────────────────── */}
      <div className="jarvis-hud-right-wing relative z-20 flex flex-col justify-between flex-shrink-0" style={{ height: 'clamp(380px, 80vh, 510px)' }}>
        {/* RIGHT CARD 1: GLOBAL SATELLITE NETWORK */}
        <div
          className={cn(
            "jarvis-hud-panel p-3 transition-all duration-700 ease-out transform",
            activeCards >= 4
              ? "opacity-100 scale-100 translate-x-0 translate-y-0 blur-none"
              : "opacity-0 scale-50 -translate-x-[150px] translate-y-[80px] blur-md pointer-events-none"
          )}
        >
          <div className="flex items-center justify-between pb-1 text-[9.5px] xl:text-[10.5px] font-extrabold tracking-[0.16em] text-[#528499] uppercase border-b border-[#00F0FF]/15">
            <span>04 // GLOBAL NETWORK</span>
            <span className="text-[#00F0FF] font-mono text-[8px]">LIVE ●</span>
          </div>
          <EarthHologram />
        </div>

        {/* RIGHT CARD 2: TACTICAL RADAR */}
        <div
          className={cn(
            "jarvis-hud-panel p-3 transition-all duration-700 ease-out transform",
            activeCards >= 5
              ? "opacity-100 scale-100 translate-x-0 translate-y-0 blur-none"
              : "opacity-0 scale-50 -translate-x-[150px] translate-y-0 blur-md pointer-events-none"
          )}
        >
          <div className="flex items-center justify-between pb-1 text-[9.5px] xl:text-[10.5px] font-extrabold tracking-[0.16em] text-[#528499] uppercase border-b border-[#00F0FF]/15">
            <span>05 // TACTICAL RADAR</span>
            <span className="text-[#FF3355] font-mono text-[8px]">SCANNING ●</span>
          </div>
          <LocationRadar />
        </div>

        {/* RIGHT CARD 3: SYSTEM CLEARANCE */}
        <div
          className={cn(
            "jarvis-hud-panel p-3 transition-all duration-700 ease-out transform",
            activeCards >= 6
              ? "opacity-100 scale-100 translate-x-0 translate-y-0 blur-none"
              : "opacity-0 scale-50 -translate-x-[150px] translate-y-[-80px] blur-md pointer-events-none"
          )}
        >
          <div className="flex items-center justify-between pb-1 text-[9.5px] xl:text-[10.5px] font-extrabold tracking-[0.16em] text-[#528499] uppercase border-b border-[#00F0FF]/15">
            <span>06 // CLEARANCE</span>
            <span className="text-[#00FF88] font-mono text-[8px]">LEVEL 7</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center font-mono text-[8px] xl:text-[9px]">
            <div className="rounded bg-[#030914] p-1.5 border border-[#00F0FF]/10">
              <span className="text-[#528499] block text-[7px]">UPTIME</span>
              <span className="text-[#00F0FF] font-bold truncate block mt-0.5">{telemetry.uptime.formatted}</span>
            </div>
            <div className="rounded bg-[#030914] p-1.5 border border-[#00F0FF]/10">
              <span className="text-[#528499] block text-[7px]">DEFENSE</span>
              <span className="text-[#00FF88] font-bold block mt-0.5">ACTIVE 🛡️</span>
            </div>
            <div className="rounded bg-[#030914] p-1.5 border border-[#00F0FF]/10">
              <span className="text-[#528499] block text-[7px]">POWER</span>
              <span className="text-[#00F0FF] font-bold block mt-0.5">{Math.round(batteryState.level * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

