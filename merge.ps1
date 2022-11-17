$propertiesFileLocation = $args[0]
$migrationsDestination = $args[1]
$properties = Get-Content $propertiesFileLocation
$key_value_map = ConvertFrom-StringData($properties -join [Environment]::NewLine)
$subFolders = Get-ChildItem -Path $migrationsDestination -Directory
foreach($subFolder in $subFolders){  
  Get-ChildItem $migrationsDestination/$subFolder -Filter "*.sql" -Recurse |
  ForEach-Object {
    foreach($key in $key_value_map.Keys){
        If (Get-Content $_.FullName | Select-String -Pattern "{$key}") {
          (Get-Content $_.FullName -Raw)-replace "{$key}", $key_value_map.$key | Set-Content $_.FullName          
        }
    }
  }
}
