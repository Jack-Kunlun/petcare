param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("logo", "hero", "validate", "all")]
  [string]$Task
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$candidates = @(
  $env:PETCARE_PYTHON,
  (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")
)

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
  $candidates += $pythonCommand.Source
}

$python = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
if (-not $python) {
  throw "Python was not found. Set PETCARE_PYTHON to a Python executable and install scripts/brand-assets/requirements-brand-assets.txt."
}

function Invoke-BrandPython([string]$Script) {
  & $python (Join-Path $repoRoot $Script)
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if ($Task -in @("logo", "all")) {
  Invoke-BrandPython "scripts/brand-assets/vectorize_approved_logo.py"
  Invoke-BrandPython "scripts/brand-assets/export_logo_assets.py"
}
if ($Task -in @("hero", "all")) {
  Invoke-BrandPython "scripts/brand-assets/process_hero_assets.py"
}
if ($Task -in @("validate", "all")) {
  Invoke-BrandPython "scripts/brand-assets/validate_brand_assets.py"
}
