<#
.SYNOPSIS
  Publish this site to all six live hosts, then check that each one really
  serves what is on disk.

.DESCRIPTION
  Only GitHub Pages redeploys itself when you push. The other five each need an
  explicit command, so "publish everywhere" is six separate steps and it is easy
  to leave one behind. This runs all of them and then proves it.

  The five CLI hosts upload the WORKING DIRECTORY. GitHub Pages serves the
  COMMIT. Deploy with uncommitted changes and the hosts silently disagree with
  each other, so this refuses to run on a dirty tree unless you insist.

.PARAMETER Only
  Deploy just these targets. Names: github, vercel, netlify, surge, surge-mirror,
  firebase.

.PARAMETER Skip
  Deploy everything except these.

.PARAMETER DryRun
  Print what would run and stop. Verification still runs, so this doubles as a
  way to ask "are all six currently in sync?" without touching anything.

.PARAMETER AllowDirty
  Deploy anyway with uncommitted changes. The hosts will diverge from GitHub
  Pages until you commit and push.

.PARAMETER NoVerify
  Skip the post-deploy check.

.PARAMETER Canary
  The file used to decide whether a host is current. Default index.html. If your
  change did not touch it, point this at something the change did touch, e.g.
  -Canary nyc-walk/index.html

.EXAMPLE
  .\deploy.ps1
  Deploy everywhere and verify.

.EXAMPLE
  .\deploy.ps1 -DryRun
  Do nothing; just report which hosts are already current.

.EXAMPLE
  .\deploy.ps1 -Only github,vercel -Canary nyc-walk/index.html
#>
[CmdletBinding()]
param(
  [string[]] $Only,
  [string[]] $Skip,
  [switch]   $DryRun,
  [switch]   $AllowDirty,
  [switch]   $NoVerify,
  [string]   $Canary = 'index.html'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
Set-Location $Root

# ---------------------------------------------------------------- the targets
# `Tool` is what must be on PATH (npx-run tools say 'npx'), `Run` is the deploy
# itself, `Url` is where the result should show up.
$Targets = @(
  [ordered]@{
    Name = 'github'; Tool = 'git'; Url = 'https://artgeorge.github.io'
    What = 'push main -> GitHub Pages'
    Run  = { git push origin main }
  },
  [ordered]@{
    Name = 'vercel'; Tool = 'npx'; Url = 'https://artgeorge.vercel.app'
    What = 'vercel production'
    Run  = { npx -y vercel@latest deploy --prod --yes }
  },
  [ordered]@{
    Name = 'netlify'; Tool = 'netlify'; Url = 'https://argeorge.netlify.app'
    What = 'netlify production'
    Run  = { netlify deploy --prod --dir . }
  },
  [ordered]@{
    Name = 'surge'; Tool = 'surge'; Url = 'https://artgeorge.surge.sh'
    What = 'surge, primary domain'
    Run  = { surge . artgeorge.surge.sh }
  },
  [ordered]@{
    Name = 'surge-mirror'; Tool = 'surge'; Url = 'https://art-george.surge.sh'
    What = 'surge, mirror domain'
    Run  = { surge . art-george.surge.sh }
  },
  [ordered]@{
    # The CLI is not installed; credentials are. firebase.json names the SITE
    # but not the PROJECT, so --project is not optional here.
    Name = 'firebase'; Tool = 'npx'; Url = 'https://artgeorge.web.app'
    What = 'firebase hosting'
    Run  = { npx -y firebase-tools@latest deploy --only hosting --project artgeorge-82797 --non-interactive }
  }
)

# ------------------------------------------------------------------- helpers
function Write-Head([string] $text) {
  Write-Host ''
  Write-Host "== $text" -ForegroundColor Cyan
}

# Line endings differ between the working copy (CRLF, courtesy of git's autocrlf)
# and what GitHub Pages serves from the commit (LF). Comparing raw bytes would
# call Pages stale on every single run, so strip CR from both sides first.
function Get-Fingerprint([byte[]] $bytes) {
  if ($null -eq $bytes -or $bytes.Length -eq 0) { return 'empty' }
  $keep = New-Object System.Collections.Generic.List[byte]
  foreach ($b in $bytes) { if ($b -ne 13) { $keep.Add($b) } }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash($keep.ToArray())
  } finally {
    $sha.Dispose()
  }
  return (([System.BitConverter]::ToString($hash)) -replace '-', '').Substring(0, 12).ToLower()
}

function Get-RemoteBytes([string] $url) {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60 -Headers @{ 'Cache-Control' = 'no-cache' }
  $ms = New-Object System.IO.MemoryStream
  try {
    $r.RawContentStream.Position = 0
    $r.RawContentStream.CopyTo($ms)
    return @{ Status = [int] $r.StatusCode; Bytes = $ms.ToArray() }
  } finally {
    $ms.Dispose()
  }
}

function Test-LiveHost($target, [string] $wantHash, [string] $canaryPath) {
  $url = $target.Url.TrimEnd('/') + '/' + $canaryPath.Replace('\', '/')
  try {
    $res = Get-RemoteBytes $url
  } catch {
    $code = ''
    if ($_.Exception.PSObject.Properties.Name -contains 'Response' -and $_.Exception.Response) {
      $code = ' http ' + [int] $_.Exception.Response.StatusCode
    }
    return @{ State = 'unreachable'; Detail = ('failed' + $code) }
  }
  if ($res.Status -ne 200) { return @{ State = 'error'; Detail = ('http ' + $res.Status) } }
  $got = Get-Fingerprint $res.Bytes
  if ($got -eq $wantHash) { return @{ State = 'current'; Detail = $got } }
  return @{ State = 'stale'; Detail = ('serving ' + $got) }
}

# --------------------------------------------------------------- which to run
$selected = $Targets
if ($Only)  { $selected = $selected | Where-Object { $Only  -contains $_.Name } }
if ($Skip)  { $selected = $selected | Where-Object { $Skip -notcontains $_.Name } }
if (-not $selected) {
  Write-Host 'Nothing selected. Valid names: ' -NoNewline -ForegroundColor Yellow
  Write-Host (($Targets | ForEach-Object { $_.Name }) -join ', ')
  exit 2
}

# ------------------------------------------------------------------- preflight
Write-Head 'Preflight'

$canaryFull = Join-Path $Root $Canary
if (-not (Test-Path $canaryFull)) {
  Write-Host "Canary file not found: $Canary" -ForegroundColor Red
  exit 2
}
$wantHash = Get-Fingerprint ([System.IO.File]::ReadAllBytes($canaryFull))
Write-Host ("  canary          {0}  [{1}]" -f $Canary, $wantHash)

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host ("  branch          {0}" -f $branch)
if ($branch -ne 'main') {
  Write-Host "  main is what GitHub Pages serves; you are not on it." -ForegroundColor Yellow
}

$dirty = git status --porcelain
if ($dirty) {
  Write-Host '  working tree    DIRTY' -ForegroundColor Yellow
  $dirty -split "`n" | Where-Object { $_ } | ForEach-Object { Write-Host ("                  " + $_.Trim()) }
  # A dry run touches nothing, so there is nothing to protect it from.
  if (-not $AllowDirty -and -not $DryRun) {
    Write-Host ''
    Write-Host 'Refusing to deploy. The five CLI hosts upload these files; GitHub Pages will not' -ForegroundColor Red
    Write-Host 'have them, so your hosts would disagree. Commit and push, or pass -AllowDirty.' -ForegroundColor Red
    exit 1
  }
  if ($DryRun) {
    Write-Host '  dry run, so nothing here would ship anyway.' -ForegroundColor Yellow
  } else {
    Write-Host '  -AllowDirty given; hosts will diverge from GitHub Pages.' -ForegroundColor Yellow
  }
} else {
  Write-Host '  working tree    clean'
}

$missing = @()
foreach ($t in $selected) {
  if (-not (Get-Command $t.Tool -ErrorAction SilentlyContinue)) { $missing += ('{0} (needs {1})' -f $t.Name, $t.Tool) }
}
if ($missing) {
  Write-Host ('  missing tools   ' + ($missing -join ', ')) -ForegroundColor Red
  exit 2
}
Write-Host '  tools           all present'

# --------------------------------------------------------------------- deploy
$results = @()

if ($DryRun) {
  Write-Head 'Dry run - would deploy'
  foreach ($t in $selected) { Write-Host ('  {0,-13} {1}' -f $t.Name, $t.What) }
} else {
  foreach ($t in $selected) {
    Write-Head ('Deploying {0} - {1}' -f $t.Name, $t.What)
    $global:LASTEXITCODE = 0
    $failed = $false
    try {
      & $t.Run
      # Native tools report through the exit code, not through exceptions.
      if ($LASTEXITCODE -ne 0) { $failed = $true }
    } catch {
      $failed = $true
      Write-Host ('  ' + $_.Exception.Message) -ForegroundColor Red
    }
    if ($failed) {
      Write-Host ('  {0} FAILED (exit {1})' -f $t.Name, $LASTEXITCODE) -ForegroundColor Red
      $results += @{ Name = $t.Name; Deploy = 'failed'; Verify = 'not checked' }
    } else {
      Write-Host ('  {0} ok' -f $t.Name) -ForegroundColor Green
      $results += @{ Name = $t.Name; Deploy = 'ok'; Verify = 'not checked' }
    }
  }
}

# --------------------------------------------------------------------- verify
if (-not $NoVerify) {
  Write-Head 'Verifying'
  # Pages rebuilds after the push lands rather than during it, so give the CDNs
  # a moment before asking. Skipped on a dry run, where nothing changed.
  if (-not $DryRun) {
    Write-Host '  waiting 25s for the CDNs to catch up...'
    Start-Sleep -Seconds 25
  }
  foreach ($t in $selected) {
    $v = Test-LiveHost $t $wantHash $Canary
    $colour = 'Red'
    if ($v.State -eq 'current') { $colour = 'Green' }
    elseif ($v.State -eq 'stale') { $colour = 'Yellow' }
    Write-Host ('  {0,-13} {1,-12} {2,-46} {3}' -f $t.Name, $v.State, $t.Url, $v.Detail) -ForegroundColor $colour
    $row = $results | Where-Object { $_.Name -eq $t.Name } | Select-Object -First 1
    if ($row) { $row.Verify = $v.State } else { $results += @{ Name = $t.Name; Deploy = 'not run'; Verify = $v.State } }
  }
}

# -------------------------------------------------------------------- summary
Write-Head 'Summary'
$bad = 0
foreach ($r in $results) {
  $deploy = $r.Deploy
  $verify = $r.Verify
  if ($deploy -eq 'failed') { $bad++ }
  elseif ($verify -eq 'stale' -or $verify -eq 'error' -or $verify -eq 'unreachable') { $bad++ }
  Write-Host ('  {0,-13} deploy: {1,-8} serving: {2}' -f $r.Name, $deploy, $verify)
}

Write-Host ''
if ($bad -gt 0) {
  Write-Host ("$bad target(s) need attention.") -ForegroundColor Red
  Write-Host 'A host stuck on "stale" is usually CDN lag - re-run with -DryRun in a minute to re-check.'
  exit 1
}
if ($DryRun) {
  Write-Host 'Dry run complete; nothing was deployed.' -ForegroundColor Cyan
} else {
  Write-Host 'All targets deployed and serving the current build.' -ForegroundColor Green
}
exit 0
