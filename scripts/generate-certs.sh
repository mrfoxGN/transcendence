#!/bin/sh

set -eu

CERT_DIR="/certs"

umask 077

mkdir -p "$CERT_DIR"

# Keep existing certificates
if [ -s "$CERT_DIR/fullchain.pem" ] && \
   [ -s "$CERT_DIR/privkey.pem" ]; then

    echo "SSL certificates already exist."
    exit 0
fi

echo "Generating SSL certificates..."

openssl req \
    -x509 \
    -nodes \
    -newkey rsa:2048 \
    -sha256 \
    -days 365 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=${TLS_IP:?TLS_IP is required}" \
    -addext "subjectAltName=IP:${TLS_IP}"

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

echo "SSL certificates generated successfully."
