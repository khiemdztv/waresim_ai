param(
  [string]$InputHtml = "D:\Documents\AI Talent\Building Blocks\docs\HUONG_DAN_SU_DUNG_WARESIM_AI_V2.html",
  [string]$OutputDocx = "D:\Documents\AI Talent\Building Blocks\docs\HUONG_DAN_SU_DUNG_WARESIM_AI_V2.docx",
  [string]$DeliveryDocx = "D:\Documents\AI Talent\HUONG_DAN_SU_DUNG_WARESIM_AI_V2.docx"
)

$ErrorActionPreference = "Stop"
$resolvedInput = (Resolve-Path -LiteralPath $InputHtml).Path
$outputDirectory = Split-Path -Parent $OutputDocx
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open($resolvedInput, $false, $true)
  foreach ($shape in $document.InlineShapes) {
    try {
      $shape.LinkFormat.SavePictureWithDocument = $true
      $shape.LinkFormat.BreakLink()
    }
    catch {
      # The image is already embedded.
    }
    $shape.LockAspectRatio = -1
    $shape.Width = 430
    if ($shape.Height -gt 260) { $shape.Height = 260 }
  }
  $document.SaveAs2($OutputDocx, 16)
  $document.Close($false)
  $document = $null
  Copy-Item -LiteralPath $OutputDocx -Destination $DeliveryDocx -Force
  Write-Output "DOCX generated: $OutputDocx"
  Write-Output "Delivery copy: $DeliveryDocx"
}
finally {
  if ($document) { $document.Close($false) }
  if ($word) { $word.Quit() }
  if ($document) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null }
  if ($word) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
