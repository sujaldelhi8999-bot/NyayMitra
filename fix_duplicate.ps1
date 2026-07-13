$lines = Get-Content 'C:\Users\l\Desktop\NyayMitra\src\lib\i18n.tsx'
$lines[511] = ''
$lines | Set-Content 'C:\Users\l\Desktop\NyayMitra\src\lib\i18n.tsx'