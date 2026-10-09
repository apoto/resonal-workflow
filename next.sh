#!/usr/bin/env bash
# 進行エンジンの入口（中身は engine/next.js）
set -eu
cd "$(dirname "$0")"
exec node engine/next.js "$@"
