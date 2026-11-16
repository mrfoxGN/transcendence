#!/bin/sh
set -eu

tls_dir=/etc/nginx/tls
cert="$tls_dir/cert.pem"
key="$tls_dir/key.pem"

if ! printf '%s\n' "${PUBLIC_ORIGIN:-}" | grep -Eq '^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?$'; then
    echo "PUBLIC_ORIGIN must be an HTTPS origin without a path." >&2
    exit 1
fi

# A supplied certificate and key take precedence over the local fallback.
if [ -s "$cert" ] && [ -s "$key" ]; then
    exit 0
fi

if [ -e "$cert" ] || [ -e "$key" ]; then
    echo "Supply both TLS files: $cert and $key" >&2
    exit 1
fi

case "${PUBLIC_ORIGIN:-}" in
    https://localhost|https://localhost:*) ;;
    *) echo "Supply a TLS certificate and key for PUBLIC_ORIGIN." >&2; exit 1 ;;
esac

umask 077
mkdir -p "$tls_dir"
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" \
    -keyout "$key" -out "$cert"
