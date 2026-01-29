#!/bin/bash

# Script para subir el proyecto a GitHub
# Ejecuta este script desde la Terminal: bash deploy-to-github.sh

echo "🚀 Preparando proyecto para GitHub..."

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si git está instalado
if ! command -v git &> /dev/null; then
    echo "❌ Git no está instalado. Por favor instálalo primero."
    exit 1
fi

# Cambiar al directorio del proyecto
cd "$(dirname "$0")"

# Inicializar git si no está inicializado
if [ ! -d .git ]; then
    echo "📦 Inicializando repositorio git..."
    git init
    git branch -M main
fi

# Agregar archivos necesarios
echo "📝 Agregando archivos..."
git add index.html styles.css script.js logo.png eventos.json
git add espacio-exclusivo.jpg decoracion-especial.jpg equipo-toddlers.jpg actividades-extra.jpg
git add .gitignore

# Crear commit
echo "💾 Creando commit..."
git commit -m "Initial commit - You&Me website with Supabase integration" || {
    echo "⚠️  No hay cambios nuevos para commitear."
}

echo ""
echo "${GREEN}✅ Archivos preparados para GitHub!${NC}"
echo ""
echo "${YELLOW}📋 Próximos pasos:${NC}"
echo ""
echo "1. Ve a https://github.com y crea un nuevo repositorio llamado 'youandme-website'"
echo "2. Copia la URL del repositorio (algo como: https://github.com/TU-USUARIO/youandme-website.git)"
echo "3. Ejecuta estos comandos en tu Terminal:"
echo ""
echo "   git remote add origin https://github.com/TU-USUARIO/youandme-website.git"
echo "   git push -u origin main"
echo ""
echo "   (Reemplaza TU-USUARIO con tu nombre de usuario de GitHub)"
echo ""
