param([string]$action = "start")

if ($action -eq "start") {
    Write-Output "Starting servers..."
    $jobs = @()

    # Express backend (port 5000)
    $jobs += Start-Job -Name "express" -ScriptBlock {
        Set-Location $args[0]
        node server.js
    } -ArgumentList (Get-Location).Path

    # Python FastAPI backend (port 8000)
    $jobs += Start-Job -Name "fastapi" -ScriptBlock {
        Set-Location (Join-Path $args[0] "server")
        python main.py
    } -ArgumentList (Get-Location).Path

    # Vite frontend (port 5173)
    $jobs += Start-Job -Name "vite" -ScriptBlock {
        Set-Location $args[0]
        npm run dev
    } -ArgumentList (Get-Location).Path

    Write-Output "Jobs started: $($jobs.Count)"
    $jobs | ForEach-Object { Write-Output "  $($_.Name) - Id: $($_.Id)" }
    
    # Save job IDs to file
    $jobs | ForEach-Object { Add-Content -Path "server_jobs.txt" -Value "$($_.Name):$($_.Id)" }

} elseif ($action -eq "status") {
    $jobs = @()
    if (Test-Path "server_jobs.txt") {
        Get-Content "server_jobs.txt" | ForEach-Object {
            $parts = $_ -split ":"
            $name = $parts[0]
            $id = [int]$parts[1]
            $job = Get-Job -Id $id -ErrorAction SilentlyContinue
            if ($job) {
                $state = $job.State
                $hasChildren = $false
                try { $hasChildren = (Get-Process -Id $id -ErrorAction SilentlyContinue) -ne $null } catch {}
                Write-Output "$name ($id): $state"
            } else {
                Write-Output "$name ($id): Not found (may have completed)"
            }
        }
    }
    # Also check port listeners
    Write-Output "`nPort listeners:"
    netstat -ano | Select-String ":5000|:5173|:8000" | Select-String "LISTENING" | ForEach-Object { Write-Output "  $_" }

} elseif ($action -eq "stop") {
    if (Test-Path "server_jobs.txt") {
        Get-Content "server_jobs.txt" | ForEach-Object {
            $parts = $_ -split ":"
            $name = $parts[0]
            $id = [int]$parts[1]
            Stop-Job -Id $id -ErrorAction SilentlyContinue
            Remove-Job -Id $id -ErrorAction SilentlyContinue
            Write-Output "Stopped $name ($id)"
        }
        Remove-Item "server_jobs.txt"
    }
    # Kill any orphan processes
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
