$content = Get-Content 'C:\Users\l\Desktop\NyayMitra\src\lib\i18n.tsx'
$seen = @{}
$output = @()
foreach ($line in $content) {
    if ($line -match '^\s+(\w+):') {
        $key = $matches[1]
        if ($seen.ContainsKey($key)) {
            Write-Host "Removing duplicate: $key"
            continue
        }
        $seen[$key] = $true
    }
    $output += $line
}
$output | Set-Content 'C:\Users\l\Desktop\NyayMitra\src\lib\i18n.tsx'