#!/bin/sh
set -eu

tls_dir=/etc/nginx/tls
cert="$tls_dir/cert.pem"
key="$tls_dir/key.pem"

# Production serves this container behind the edge Nginx over internal HTTP.
# Local Compose sets PUBLIC_ORIGIN and enables the standalone TLS configuration.
if [ -z "${PUBLIC_ORIGIN:-}" ]; then
    exit 0
fi

if ! printf '%s\n' "${PUBLIC_ORIGIN:-}" | grep -Eq '^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?$'; then
    echo "PUBLIC_ORIGIN must be an HTTPS origin without a path." >&2
    exit 1
fi

# A supplied certificate and key take precedence over the local fallback.
if [ -s "$cert" ] && [ -s "$key" ]; then
    :
elif [ -e "$cert" ] || [ -e "$key" ]; then
    echo "Supply both TLS files: $cert and $key" >&2
    exit 1
else
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
fi

envsubst '$PUBLIC_ORIGIN' \
    < /etc/nginx/nginx.tls.conf.template \
    > /etc/nginx/conf.d/default.conf
