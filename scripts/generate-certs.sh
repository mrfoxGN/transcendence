#!/bin/sh
set -eu

# TLS_HOST is passed by Compose from PUBLIC_HOST.
TLS_HOST="${TLS_HOST:-localhost}"
CERT_DIR="/certs"
CERT="$CERT_DIR/fullchain.pem"
KEY="$CERT_DIR/privkey.pem"

case "$TLS_HOST" in
  ''|*[!a-zA-Z0-9.:_-]*)
    echo "Invalid TLS_HOST. Use a hostname or IP address only (no scheme or port)." >&2
    exit 1
    ;;
esac

umask 077
mkdir -p "$CERT_DIR"

case "$TLS_HOST" in
  localhost)
    SAN='DNS:localhost,IP:127.0.0.1'
    CHECK_TYPE='-checkhost'
    ;;
  *:*)
    SAN="IP:$TLS_HOST"
    CHECK_TYPE='-checkip'
    ;;
  *[!0-9.]*)
    SAN="DNS:$TLS_HOST"
    CHECK_TYPE='-checkhost'
    ;;
  *)
    SAN="IP:$TLS_HOST"
    CHECK_TYPE='-checkip'
    ;;
esac

# Reuse the current certificate when it matches the requested host and
# has at least 30 days left. Also ensure the private key is usable and matches.
if [ -s "$CERT" ] && [ -s "$KEY" ]; then
  if openssl x509 -in "$CERT" -noout -checkend 2592000 >/dev/null 2>&1 && \
     openssl x509 -in "$CERT" -noout "$CHECK_TYPE" "$TLS_HOST" >/dev/null 2>&1 && \
     openssl pkey -in "$KEY" -noout >/dev/null 2>&1; then
    CERT_PUB="$(openssl x509 -in "$CERT" -noout -pubkey | openssl pkey -pubin -outform der | sha256sum | cut -d' ' -f1)"
    KEY_PUB="$(openssl pkey -in "$KEY" -pubout -outform der | sha256sum | cut -d' ' -f1)"
    if [ "$CERT_PUB" = "$KEY_PUB" ]; then
      echo "Existing certificate is valid for $TLS_HOST; keeping it."
      exit 0
    fi
  fi
fi

# Self-signed certificate suitable for development or controlled environments.
# A public website should use a certificate trusted by browsers.
echo "Generating self-signed certificate for $TLS_HOST ..."
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
  -subj "/CN=$TLS_HOST" \
  -addext "subjectAltName=$SAN"

chmod 600 "$TMP_KEY"
chmod 644 "$TMP_CERT"
mv -f "$TMP_KEY" "$KEY"
mv -f "$TMP_CERT" "$CERT"
echo "Certificate files are ready in $CERT_DIR"
