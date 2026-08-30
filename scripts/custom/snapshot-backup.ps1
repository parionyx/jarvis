#!/usr/bin/env pwsh
# Snapshot-backup for the shallow-cloned managed hermes-agent install.
#
# 1. Mirrors SAFE items from HERMES_HOME (skills, custom plugins, MCP servers,
#    SOUL.md) into scripts/custom/home-backup/ - NEVER config.yaml or .env
#    (they hold secrets and must not reach GitHub).
# 2. Creates an incremental checkpoint commit of the index over the previous
#    backup/state commit (plumbing only - no checkout, no stash), then pushes
#    to parionyx/hermes-custom (main + timestamped tag).
#
# Usage:  powershell -File scripts\custom\snapshot-backup.ps1 [-Message "why"]

param(
    [string]$Message = "checkpoint"
)

$ErrorActionPreference = "Stop"
$Repo = "C:\Users\works_ar\AppData\Local\hermes\hermes-agent"
$Home_ = "C:\Users\works_ar\AppData\Local\hermes"
$Remote = "custom"
$Branch = "backup/state"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $Repo "scripts\custom\home-backup"

function Copy-Safe([string]$From, [string]$To) {
    if (Test-Path $From) {
        $dest = Join-Path $BackupRoot $To
        New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
        Copy-Item $From $dest -Recurse -Force
    }
}

Push-Location $Repo
try {
    # --- 1. mirror safe HERMES_HOME items -------------------------------
    Remove-Item $BackupRoot -Recurse -Force -ErrorAction SilentlyContinue

    Copy-Safe "$Home_\SOUL.md" "SOUL.md"
    Copy-Safe "$Home_\skills" "skills"
    Copy-Safe "$Home_\plugins" "plugins"
    Copy-Safe "$Home_\mcp_servers\hermes_capabilities" "mcp_servers/hermes_capabilities"

    # Drop caches/junk from the mirror.
    Get-ChildItem $BackupRoot -Recurse -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -in @("__pycache__", ".hub", ".curator_backups", "node_modules", "venv") } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

    # --- 2. checkpoint + push -------------------------------------------
    git add -A | Out-Null

    $tree = (git write-tree).Trim()
    if (-not $tree) { throw "write-tree produced no tree" }

    $parent = ""
    try {
        $parent = (git rev-parse "refs/heads/$Branch").Trim()
    } catch {
        $parent = ""  # first checkpoint: orphan root
    }

    $commitArgs = @("commit-tree", $tree, "-m", "checkpoint: $Message ($Stamp)")
    if ($parent) { $commitArgs += @("-p", $parent) }

    $commit = (git @commitArgs).Trim()
    if (-not $commit) { throw "commit-tree failed" }

    git update-ref "refs/heads/$Branch" $commit
    git tag "checkpoint-$Stamp" $commit

    git push $Remote "${Branch}:main" --force 2>&1 | Out-Null
    git push $Remote "checkpoint-$Stamp" 2>&1 | Out-Null

    Write-Host "Snapshot pushed: checkpoint-$Stamp ($commit)"
}
finally {
    Pop-Location
}
