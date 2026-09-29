#!/usr/bin/env bash
set -euo pipefail

echo "[helpdesk] Instalando dependencias reproducibles..."
pnpm config set store-dir /pnpm/store
pnpm install --frozen-lockfile

echo "[helpdesk] Generando cliente Prisma y aplicando migraciones..."
pnpm db:generate
pnpm db:migrate

echo "[helpdesk] Ejecutando pruebas unitarias..."
pnpm test:unit

echo "[helpdesk] Entorno preparado. Los servicios arrancarán automáticamente."
