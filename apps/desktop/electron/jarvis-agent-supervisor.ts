/**
 * J.A.R.V.I.S. LiveKit voice-agent supervisor.
 *
 * Spawns the Python LiveKit Agents worker (Documents/Jarvis/livekit_agent)
 * alongside the desktop app so real-time voice is warm the moment a session
 * starts — the agent is a native component of this install, not a script the
 * user has to remember to run.
 *
 * Lifecycle: auto-starts on app ready (when the agent directory + venv exist),
 * restarts on crash with capped backoff, and is torn down on app quit so no
 * orphaned python worker outlives the window.
 *
 * Kill switch: set JARVIS_LIVEKIT_AUTOSTART=0 to disable entirely.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { app, ipcMain } from 'electron'

const MAX_CONSECUTIVE_CRASHES = 5
const STABLE_AFTER_MS = 5 * 60 * 1000
const RESTART_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000]

interface SupervisorState {
  proc: ChildProcess | null
  quitting: boolean
  restarts: number
  lastStartAt: number
  logStream: fs.WriteStream | null
}

const state: SupervisorState = {
  proc: null,
  quitting: false,
  restarts: 0,
  lastStartAt: 0,
  logStream: null
}

let started = false

function resolveAgentDir(): string | null {
  if (process.env.JARVIS_LIVEKIT_AGENT_DIR) {
    return process.env.JARVIS_LIVEKIT_AGENT_DIR
  }

  try {
    return path.join(app.getPath('documents'), 'Jarvis', 'livekit_agent')
  } catch {
    return null
  }
}

function logLine(logStream: fs.WriteStream | null, line: string): void {
  const stamp = new Date().toISOString()
  try {
    logStream?.write(`[${stamp}] ${line}\n`)
  } catch {}
}

function killProcessTree(pid: number): void {
  if (process.platform === 'win32') {
    try {
      // /T kills the tree (python may own ffmpeg/child workers), /F force-kills.
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true })
    } catch {}
  } else {
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        state.proc?.kill('SIGTERM')
      } catch {}
    }
  }
}

function launch(agentDir: string, pythonExe: string, logFile: string): void {
  if (state.quitting) {
    return
  }

  fs.mkdirSync(path.dirname(logFile), { recursive: true })

  if (!state.logStream) {
    state.logStream = fs.createWriteStream(logFile, { flags: 'a' })
  }

  logLine(state.logStream, `── launching: "${pythonExe}" jarvis_agent.py start (cwd: ${agentDir})`)

  const proc = spawn(pythonExe, ['jarvis_agent.py', 'start'], {
    cwd: agentDir,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })

  state.proc = proc
  state.lastStartAt = Date.now()

  proc.stdout?.on('data', (chunk: Buffer) => logLine(state.logStream, chunk.toString().trimEnd()))
  proc.stderr?.on('data', (chunk: Buffer) => logLine(state.logStream, chunk.toString().trimEnd()))

  proc.on('exit', (code, signal) => {
    logLine(state.logStream, `── exited (code: ${code}, signal: ${signal})`)
    state.proc = null

    if (state.quitting) {
      return
    }

    // Stable for a while → the crash is fresh, reset the breaker.
    if (Date.now() - state.lastStartAt > STABLE_AFTER_MS) {
      state.restarts = 0
    }

    if (state.restarts >= MAX_CONSECUTIVE_CRASHES) {
      logLine(
        state.logStream,
        `── giving up after ${state.restarts} consecutive crashes; fix the agent and restart the app`
      )
      return
    }

    const delay = RESTART_DELAYS_MS[Math.min(state.restarts, RESTART_DELAYS_MS.length - 1)]
    state.restarts += 1
    logLine(state.logStream, `── restarting in ${delay}ms (attempt ${state.restarts}/${MAX_CONSECUTIVE_CRASHES})`)
    setTimeout(() => launch(agentDir, pythonExe, logFile), delay)
  })
}

/** Auto-start the voice agent worker. Safe to call once at app ready. */
export function startJarvisAgentSupervisor(logDir: string): void {
  if (started) {
    return
  }
  started = true

  if (process.env.JARVIS_LIVEKIT_AUTOSTART === '0') {
    console.log('[jarvis-agent] autostart disabled via JARVIS_LIVEKIT_AUTOSTART=0')
    return
  }

  const agentDir = resolveAgentDir()

  if (!agentDir) {
    console.log('[jarvis-agent] no agent directory resolved; supervisor idle')
    return
  }

  const isWin = process.platform === 'win32'
  const pythonExe = isWin
    ? path.join(agentDir, '.venv', 'Scripts', 'python.exe')
    : path.join(agentDir, '.venv', 'bin', 'python')
  const script = path.join(agentDir, 'jarvis_agent.py')

  if (!fs.existsSync(pythonExe) || !fs.existsSync(script)) {
    console.log('[jarvis-agent] agent venv/script not found; supervisor idle')
    return
  }

  const logFile = path.join(logDir, 'livekit-agent.log')
  launch(agentDir, pythonExe, logFile)

  ipcMain.handle('hermes:livekit:agent:status', () => ({
    running: state.proc !== null,
    pid: state.proc?.pid ?? null,
    restarts: state.restarts,
    agentDir
  }))
}

/** Tear the worker down on app quit (kills the whole process tree). */
export function stopJarvisAgent(): void {
  state.quitting = true

  if (state.proc?.pid) {
    killProcessTree(state.proc.pid)
  }

  try {
    state.logStream?.end()
  } catch {}
  state.logStream = null
}
