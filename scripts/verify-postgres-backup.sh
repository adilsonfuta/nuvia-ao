#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Uso: RESTORE_DATABASE_URL='postgresql://…/nuvia_restore' $0 caminho/backup.dump[.age]" >&2
  exit 2
fi
if [[ -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "Define RESTORE_DATABASE_URL para uma base isolada e vazia. Nunca uses a URL de produção." >&2
  exit 2
fi

temporary_file=""
cleanup() { [[ -z "$temporary_file" ]] || rm -f "$temporary_file"; }
trap cleanup EXIT

if [[ "$backup_file" == *.age ]]; then
  command -v age >/dev/null || { echo "Este backup requer age instalado." >&2; exit 3; }
  temporary_file="$(mktemp)"
  age --decrypt --output "$temporary_file" "$backup_file"
  backup_file="$temporary_file"
fi

pg_restore --list "$backup_file" >/dev/null
table_count="$(psql "$RESTORE_DATABASE_URL" -Atqc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
if [[ "$table_count" != "0" ]]; then
  echo "A base de destino não está vazia ($table_count tabelas). Usa uma base isolada acabada de criar." >&2
  exit 4
fi

pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$backup_file"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'SELECT count(*) FROM "_prisma_migrations"' >/dev/null
echo "Restauro de validação concluído numa base isolada."
