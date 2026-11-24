#!/usr/bin/env bash
set -euo pipefail

archive="${1:-}"
if [[ -z "$archive" || ! -f "$archive" || "$archive" != *.tar.gz.age ]]; then
  echo "Uso: AGE_IDENTITY=... $0 nuvia-volume-....tar.gz.age" >&2
  exit 2
fi
: "${AGE_IDENTITY:?Define AGE_IDENTITY com o caminho da chave privada age}" 
command -v age >/dev/null || { echo "age é necessário." >&2; exit 2; }
command -v docker >/dev/null || { echo "docker é necessário no host Coolify." >&2; exit 2; }

volume="nuvia-restore-check-$(date -u +%Y%m%d%H%M%S)-$$"
cleanup() { docker volume rm "$volume" >/dev/null 2>&1 || true; }
trap cleanup EXIT
age --identity "$AGE_IDENTITY" --decrypt "$archive" | docker run --rm -i alpine:3.22 tar -tzf - >/dev/null
docker volume create "$volume" >/dev/null
age --identity "$AGE_IDENTITY" --decrypt "$archive" | docker run --rm -i -v "$volume:/restore" alpine:3.22 tar -xzf - -C /restore
file_count="$(docker run --rm -v "$volume:/restore:ro" alpine:3.22 sh -c 'find /restore -type f | wc -l | tr -d " "')"
echo "Arquivo decifrado e extraído num volume temporário de teste ($file_count ficheiros). O volume temporário será removido; o arquivo original não foi alterado."
