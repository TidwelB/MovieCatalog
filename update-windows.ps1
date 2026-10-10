$ErrorActionPreference = 'Stop'

$RepoOwner = 'TIDWELB'
$RepoName = 'MovieCatalog'
$Branch = 'main'
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ArchiveUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$Branch.zip"
$TempRoot = Join-Path $env:TEMP ("MovieCatalog-Update-" + [guid]::NewGuid().ToString('N'))
$ZipPath = Join-Path $TempRoot 'MovieCatalog.zip'
$ExtractDir = Join-Path $TempRoot 'extract'
$BackupRoot = Join-Path $AppDir '.moviecatalog-update-backups'
$BackupDir = Join-Path $BackupRoot (Get-Date -Format 'yyyyMMdd-HHmmss')

function Read-MovieCatalogVersion([string]$Path) {
    if (-not (Test-Path $Path)) { return 'unknown' }
    $text = Get-Content -Raw -LiteralPath $Path
    $match = [regex]::Match($text, 'MOVIE_CATALOG_VERSION\s*=\s*[''"]([^''"]+)[''"]')
    if ($match.Success) { return $match.Groups[1].Value }
    return 'unknown'
}

function Copy-AppSource([string]$Source, [string]$Destination) {
    $skipNames = @('.git', '.github', '.moviecatalog-update-backups')
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        $shouldCopy = ($skipNames -notcontains $_.Name) -and
                      ($_.Name -notlike 'movie-room-backup-*.json') -and
                      ($_.Extension -ne '.zip')
        if ($shouldCopy) {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Destination $_.Name) -Recurse -Force
        }
    }
}

try {
    Write-Host ''
    Write-Host 'MovieCatalog Updater' -ForegroundColor Cyan
    Write-Host '--------------------'
    Write-Host 'Checking GitHub for the newest build...'

    New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null

    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ZipPath -UseBasicParsing
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractDir -Force

    $SourceDir = Get-ChildItem -LiteralPath $ExtractDir -Directory | Select-Object -First 1
    if (-not $SourceDir) { throw 'The downloaded GitHub archive did not contain the application folder.' }

    $CurrentVersion = Read-MovieCatalogVersion (Join-Path $AppDir 'version.js')
    $LatestVersion = Read-MovieCatalogVersion (Join-Path $SourceDir.FullName 'version.js')

    Write-Host "Installed version: $CurrentVersion"
    Write-Host "GitHub version:    $LatestVersion"

    if ($CurrentVersion -eq $LatestVersion -and $CurrentVersion -ne 'unknown') {
        Write-Host ''
        Write-Host 'MovieCatalog is already up to date.' -ForegroundColor Green
        Write-Host 'Opening MovieCatalog...'
        Start-Process (Join-Path $AppDir 'index.html')
        Start-Sleep -Seconds 2
        exit 0
    }

    Write-Host ''
    Write-Host 'Creating a safety copy of the current program files...'
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Copy-AppSource -Source $AppDir -Destination $BackupDir

    Write-Host 'Installing the new build...'
    try {
        Copy-AppSource -Source $SourceDir.FullName -Destination $AppDir
    }
    catch {
        Write-Host 'Install failed. Restoring the previous program files...' -ForegroundColor Yellow
        Copy-AppSource -Source $BackupDir -Destination $AppDir
        throw
    }

    $InstalledVersion = Read-MovieCatalogVersion (Join-Path $AppDir 'version.js')
    Write-Host ''
    Write-Host "Update complete. MovieCatalog $InstalledVersion is installed." -ForegroundColor Green
    Write-Host 'Your movie catalog data was not replaced; it remains in browser IndexedDB.'
    Write-Host 'Opening MovieCatalog...'
    Start-Process (Join-Path $AppDir 'index.html')
    Start-Sleep -Seconds 3
}
catch {
    Write-Host ''
    Write-Host ('Update failed: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
