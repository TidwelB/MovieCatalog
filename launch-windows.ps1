$ErrorActionPreference = 'Stop'

$RepoOwner = 'TIDWELB'
$RepoName = 'MovieCatalog'
$Branch = 'main'
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VersionPath = Join-Path $AppDir 'version.js'
$IndexPath = Join-Path $AppDir 'index.html'

function Read-MovieCatalogVersion([string]$Path) {
    if (-not (Test-Path $Path)) { return '0.0.0' }
    $text = Get-Content -Raw -LiteralPath $Path
    $match = [regex]::Match($text, 'MOVIE_CATALOG_VERSION\s*=\s*[''"]([^''"]+)[''"]')
    if ($match.Success) { return $match.Groups[1].Value }
    return '0.0.0'
}

function Compare-Version([string]$A, [string]$B) {
    try {
        return ([version]$A).CompareTo([version]$B)
    }
    catch {
        return 0
    }
}

try {
    $CurrentVersion = Read-MovieCatalogVersion $VersionPath
    $Headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'MovieCatalog-Launcher' }
    $Ref = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/ref/heads/$Branch" -Headers $Headers -Method Get
    $Sha = $Ref.object.sha
    if ($Sha) {
        $RemoteVersionText = Invoke-RestMethod -Uri "https://raw.githubusercontent.com/$RepoOwner/$RepoName/$Sha/version.js" -Headers @{ 'User-Agent' = 'MovieCatalog-Launcher' } -Method Get
        $Match = [regex]::Match([string]$RemoteVersionText, 'MOVIE_CATALOG_VERSION\s*=\s*[''"]([^''"]+)[''"]')
        if ($Match.Success) {
            $LatestVersion = $Match.Groups[1].Value
            if ((Compare-Version $LatestVersion $CurrentVersion) -gt 0) {
                & (Join-Path $AppDir 'update-windows.ps1')
                exit $LASTEXITCODE
            }
        }
    }
}
catch {
    # The launcher is intentionally tolerant of offline GitHub checks. The last
    # installed local build still opens when the internet is unavailable.
}

if (-not (Test-Path $IndexPath)) {
    throw 'index.html is missing from the MovieCatalog folder.'
}
Start-Process $IndexPath
