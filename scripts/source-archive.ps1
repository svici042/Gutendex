$ErrorActionPreference = 'Stop'
# Resolve paths from this script so archiving works from any working directory.
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$archiveDirectory = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null
$archivePath = Join-Path $archiveDirectory ('gutendex-source-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.zip')

# Include source explicitly. Never archive the repository directory wholesale.
$allowedDirectories = @('src', 'public', 'scripts', 'tests')
$allowedFiles = @('package.json', 'package-lock.json', 'index.html', 'README.md', 'vite.config.js', 'playwright.config.js', '.oxlintrc.json', '.gitignore')
$excludedSegments = @('.git', 'node_modules', 'dist', '.ai-local', '.agents', '.codex', 'test-results', 'playwright-report', 'coverage', 'artifacts')
$privateNames = @('AGENTS.md', 'AGENTS.override.md', 'CODEX.md', 'AI.md', 'AI_STATE.md', 'AI_NOTES.md', 'SKILL_STATE.md', 'MIKOLINA_CONTEXT.md')

# Stream selected files into the archive without creating a staging directory.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  # Collect existing source folders and explicitly allowed project-level files.
  $candidates = @()
  foreach ($directory in $allowedDirectories) {
    $path = Join-Path $projectRoot $directory
    if (Test-Path -LiteralPath $path) {
      $candidates += Get-ChildItem -LiteralPath $path -Recurse -File -Force
    }
  }
  foreach ($name in $allowedFiles) {
    $path = Join-Path $projectRoot $name
    if (Test-Path -LiteralPath $path) { $candidates += Get-Item -LiteralPath $path }
  }
  # Apply exclusions to every candidate, including files inside allowed folders.
  foreach ($file in $candidates) {
    $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
    $segments = $relative.Split('/')
    if ($segments | Where-Object { $_ -in $excludedSegments }) { continue }
    if ($file.Name -like '.env*' -or $file.Name -in $privateNames -or $file.Extension -in @('.pem', '.key', '.pfx', '.log', '.tmp', '.zip')) { continue }
    # Skip file links so their targets cannot be copied into the archive.
    if ($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { continue }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative) | Out-Null
  }
} finally {
  # Release the file handle even when reading or compressing a file fails.
  $archive.Dispose()
}
Write-Output $archivePath
