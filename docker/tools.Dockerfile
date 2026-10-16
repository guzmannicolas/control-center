FROM node:22-alpine
# Prisma's migration engine needs OpenSSL.
RUN apk add --no-cache openssl
ENTRYPOINT ["corepack"]
