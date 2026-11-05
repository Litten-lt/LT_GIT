param([string]$ConfigPath = "$PSScriptRoot\backup-config.json")
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$secret = (Get-Content -LiteralPath $config.SecretPath -Raw).Trim() | ConvertTo-SecureString
$credential = [System.Management.Automation.PSCredential]::new('backup', $secret)
try {
    $env:ZHIMU_BACKUP_KEY_PASSWORD = $credential.GetNetworkCredential().Password
    & $config.Python (Join-Path $PSScriptRoot 'pull-backup.py') $ConfigPath
    if ($LASTEXITCODE -ne 0) { throw "Backup task failed with exit code $LASTEXITCODE" }
} finally { Remove-Item Env:ZHIMU_BACKUP_KEY_PASSWORD -ErrorAction SilentlyContinue }
