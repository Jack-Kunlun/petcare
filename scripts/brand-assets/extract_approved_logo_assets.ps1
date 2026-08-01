$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$sourcePath = Join-Path $repoRoot "docs/10-brand-system/assets/petcare-brand-positioning-logo-v1.png"
$outputDirectory = Join-Path $repoRoot "docs/10-brand-system/deliverables/logo/png"
$transparentDistance = 24.0
$opaqueDistance = 180.0

function Convert-WhiteMattedChannel {
    param(
        [int]$Channel,
        [int]$Alpha
    )

    if ($Alpha -ge 255) {
        return $Channel
    }
    $unmatted = 255.0 - ((255.0 - $Channel) * 255.0 / $Alpha)
    return [Math]::Max(0, [Math]::Min(255, [int][Math]::Round($unmatted)))
}

function Export-TransparentCrop {
    param(
        [Drawing.Bitmap]$Source,
        [int]$X,
        [int]$Y,
        [int]$Width,
        [int]$Height,
        [string]$OutputPath
    )

    $output = [Drawing.Bitmap]::new(
        $Width,
        $Height,
        [Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
        for ($targetY = 0; $targetY -lt $Height; $targetY++) {
            for ($targetX = 0; $targetX -lt $Width; $targetX++) {
                $pixel = $Source.GetPixel($X + $targetX, $Y + $targetY)
                $distance = [Math]::Sqrt(
                    [Math]::Pow(255 - $pixel.R, 2) +
                    [Math]::Pow(255 - $pixel.G, 2) +
                    [Math]::Pow(255 - $pixel.B, 2)
                )

                if ($distance -le $transparentDistance) {
                    $output.SetPixel($targetX, $targetY, [Drawing.Color]::FromArgb(0, 0, 0, 0))
                    continue
                }

                if ($distance -ge $opaqueDistance) {
                    $alpha = 255
                }
                else {
                    $alpha = [Math]::Max(
                        1,
                        [int][Math]::Round(
                            255.0 * ($distance - $transparentDistance) /
                            ($opaqueDistance - $transparentDistance)
                        )
                    )
                }

                $red = Convert-WhiteMattedChannel $pixel.R $alpha
                $green = Convert-WhiteMattedChannel $pixel.G $alpha
                $blue = Convert-WhiteMattedChannel $pixel.B $alpha
                $output.SetPixel(
                    $targetX,
                    $targetY,
                    [Drawing.Color]::FromArgb($alpha, $red, $green, $blue)
                )
            }
        }
        $output.Save($OutputPath, [Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $output.Dispose()
    }
}

[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$source = [Drawing.Bitmap]::FromFile($sourcePath)
try {
    Export-TransparentCrop `
        -Source $source `
        -X 180 -Y 780 -Width 330 -Height 260 `
        -OutputPath (Join-Path $outputDirectory "petcare-logo-approved-actual-primary.png")
    Export-TransparentCrop `
        -Source $source `
        -X 170 -Y 780 -Width 350 -Height 345 `
        -OutputPath (Join-Path $outputDirectory "petcare-logo-approved-actual-full-lockup.png")
}
finally {
    $source.Dispose()
}

"Extracted 2 approved actual logo raster masters."
