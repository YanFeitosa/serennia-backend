# Script para encerrar processo na porta 4000
param(
    [int]$Port = 4000
)

Write-Host "🔍 Procurando processo na porta $Port..." -ForegroundColor Cyan

$connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connection) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "📌 Processo encontrado:" -ForegroundColor Yellow
        Write-Host "   PID: $($process.Id)" -ForegroundColor White
        Write-Host "   Nome: $($process.ProcessName)" -ForegroundColor White
        Write-Host "   Caminho: $($process.Path)" -ForegroundColor White
        
        Write-Host "`n🛑 Encerrando processo..." -ForegroundColor Red
        Stop-Process -Id $processId -Force
        Write-Host "✅ Processo encerrado com sucesso!" -ForegroundColor Green
        
        # Aguardar um pouco para garantir que a porta foi liberada
        Start-Sleep -Seconds 2
        
        # Verificar se a porta foi liberada
        $check = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if (-not $check) {
            Write-Host "✅ Porta $Port liberada!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Porta ainda está em uso. Pode ser necessário aguardar alguns segundos." -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Processo não encontrado." -ForegroundColor Red
    }
} else {
    Write-Host "✅ Nenhum processo encontrado na porta $Port" -ForegroundColor Green
}

