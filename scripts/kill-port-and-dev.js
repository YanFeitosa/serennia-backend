const { execSync } = require('child_process');
const os = require('os');

const PORT = process.env.PORT || 4000;
const platform = os.platform();

(async () => {
  try {
    console.log(`🔍 Verificando processo na porta ${PORT}...`);

    if (platform === 'win32') {
      // Windows: usar PowerShell
      try {
        execSync(
          `powershell -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`,
          { stdio: 'inherit' }
        );
        console.log(`✅ Porta ${PORT} liberada (se havia processo em uso)`);
      } catch (error) {
        // Se não houver processo, o comando pode falhar, mas isso é ok
        if (error.status !== 1) {
          throw error;
        }
        console.log(`✅ Nenhum processo encontrado na porta ${PORT}`);
      }
    } else {
      // Linux/Mac: usar lsof e kill
      try {
        const pid = execSync(`lsof -ti:${PORT}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: 'inherit' });
          console.log(`✅ Processo ${pid} encerrado na porta ${PORT}`);
        }
      } catch (error) {
        // Se não houver processo, lsof retorna erro, mas isso é ok
        console.log(`✅ Nenhum processo encontrado na porta ${PORT}`);
      }
    }

    // Aguardar um pouco para garantir que a porta foi liberada
    console.log('⏳ Aguardando liberação da porta...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🚀 Iniciando servidor de desenvolvimento...\n');
    
    // Executar npm run dev
    execSync('npm run dev', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
})();

