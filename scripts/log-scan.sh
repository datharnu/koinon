#!/bin/sh
set -eu
file=${1:?}
wordfile=${2:-}
fail=0

hit() {
  if grep -q -F "$1" "$file"; then
    echo "log scan hit: $2"
    fail=1
  fi
}

hit "xprv" "xprv"
hit "tprv" "tprv"
hit "nsec1" "nsec"
hit "cHNidP" "psbt"
hit "membre-" "pseudonym"
hit "demo-pin-1" "pin"

if [ -n "$wordfile" ] && [ -f "$wordfile" ] && [ ! -r "$wordfile" ]; then
  echo "log scan: seed word file is not readable by $(id -un); it must be owned by the user running the scan"
  exit 1
elif [ -n "$wordfile" ] && [ -f "$wordfile" ]; then
  word=$(cat "$wordfile")
  if printf '%s' "$word" | grep -q '^[0-9a-fA-F][0-9a-fA-F]*$'; then
    if grep -E "(^|[^0-9a-fA-F])${word}([^0-9a-fA-F]|$)" "$file" >/dev/null; then
      echo "log scan hit: seed word"
      fail=1
    fi
  elif grep -q -F "$word" "$file"; then
    echo "log scan hit: seed word"
    fail=1
  fi
else
  echo "log scan: seed word file missing"
  fail=1
fi

exit "$fail"
