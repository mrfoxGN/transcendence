#!/bin/sh
set -eu

CERT_DIR="/certs"
CERT="$CERT_DIR/fullchain.pem"
KEY="$CERT_DIR/privkey.pem"

umask 077
mkdir -p "$CERT_DIR"

# Reuse the current certificate when it matches localhost and
# has at least 30 days left. Also ensure the private key is usable and matches.
if [ -s "$CERT" ] && [ -s "$KEY" ]; then
  if openssl x509 -in "$CERT" -noout -checkend 2592000 >/dev/null 2>&1 && \
     openssl x509 -in "$CERT" -noout -checkhost localhost >/dev/null 2>&1 && \
     openssl x509 -in "$CERT" -noout -checkip 127.0.0.1 >/dev/null 2>&1 && \
     openssl pkey -in "$KEY" -noout >/dev/null 2>&1; then
    CERT_PUB="$(openssl x509 -in "$CERT" -noout -pubkey | openssl pkey -pubin -outform der | sha256sum | cut -d' ' -f1)"
    KEY_PUB="$(openssl pkey -in "$KEY" -pubout -outform der | sha256sum | cut -d' ' -f1)"
    if [ "$CERT_PUB" = "$KEY_PUB" ]; then
      echo "Existing certificate is valid for localhost; keeping it."
      exit 0
    fi
  fi
fi

# Self-signed certificate for this localhost deployment.
echo "Generating self-signed certificate for localhost ..."
TMP_CERT="$CERT_DIR/.fullchain.pem.$$"
TMP_KEY="$CERT_DIR/.privkey.pem.$$"
trap 'rm -f "$TMP_CERT" "$TMP_KEY"' EXIT

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -sha256 \
  -days 365 \
  -keyout "$TMP_KEY" \
  -out "$TMP_CERT" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$TMP_KEY"
chmod 644 "$TMP_CERT"
mv -f "$TMP_KEY" "$KEY"
mv -f "$TMP_CERT" "$CERT"
echo "Certificate files are ready in $CERT_DIR"
