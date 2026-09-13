# The Telegram mini app, served by its own Node SSR server (TanStack Start built by nitro with the
# `node-server` preset). Telegram opens it inside a WebView frame; Caddy in front of it owns TLS and
# the security headers (including frame-ancestors), so this image deliberately sets none of them.
#
# Every base image is pinned to an exact version AND a digest: a tag like `22-bookworm-slim` moves
# every few weeks, and a production image that silently changes Node or libc between two builds of
# the same commit is not reproducible. To upgrade, resolve a new tag and digest with
#   docker buildx imagetools inspect node:<version>-bookworm-slim
# and change both together.

# ---------- bun binary ----------
# bun.lock is the committed lockfile, so bun is the only tool that can install EXACTLY what it
# records. We take just the binary from the official image instead of building on it, so the build
# still runs on real Node (see the build stage for why that matters). bun is a self-contained glibc
# executable, so the trixie-based bun image's binary runs fine on the bookworm build stage below.
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 AS bun

# ---------- tini ----------
# The official static tini release, fetched by URL and verified by sha256 (the checksums below are
# the ones krallin/tini publishes next to each v0.19.0 binary). Why not `apt-get install tini`: that
# makes every build depend on reaching deb.debian.org, which proved unreachable from the developer
# machine this image must also build on, and a static binary needs no libc match. --checksum makes
# the build FAIL if the download is ever different, so a compromised mirror cannot slip in a binary.
# One stage per CPU architecture. TARGETARCH is predefined by BuildKit in the global scope (amd64 on
# CI and on an x86 laptop, arm64 on Apple silicon), so the FROM below picks the matching stage and
# BuildKit never downloads the other binary.
FROM scratch AS tini-amd64
ADD --checksum=sha256:c5b0666b4cb676901f90dfcb37106783c5fe2077b04590973b885950611b30ee \
    https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-amd64 /tini

FROM scratch AS tini-arm64
ADD --checksum=sha256:eae1d3aa50c48fb23b8cbdf4e369d0910dfc538566bfd09df89a774aa84a48b9 \
    https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-arm64 /tini

FROM tini-${TARGETARCH} AS tini

# ---------- build ----------
FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build
WORKDIR /app

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Manifests first, so the dependency layer is reused by every build that only changes source.
# bunfig.toml comes along because it carries the install policy (the 24h minimumReleaseAge
# supply-chain guard) that must apply here exactly as it does on a developer machine.
COPY package.json bun.lock bunfig.toml ./

# --frozen-lockfile: fail instead of resolving anything new. If bun.lock is out of date with
# package.json the build must STOP; silently re-resolving would mean production runs dependency
# versions nobody reviewed. Fix it by running `bun install` locally and committing bun.lock.
RUN bun install --frozen-lockfile

COPY . .

# NITRO_PRESET=node-server turns the build into a plain Node HTTP server (.output/server/index.mjs)
# instead of Lovable's default Cloudflare Worker bundle. @lovable.dev/vite-tanstack-config only
# overrides NITRO_PRESET inside a Lovable sandbox (LOVABLE_SANDBOX=1 or DEV_SERVER__PROJECT_PATH),
# neither of which is ever set here.
#
# `npx vite build` runs vite under real Node rather than under bun's Node emulation: the output is
# executed by Node in production, so it is built by the same runtime it will run on. This is the
# exact combination that was verified to produce a working server.
ENV NITRO_PRESET=node-server
RUN npx vite build

# ---------- run ----------
# Same Debian release (and so the same glibc) as the build stage. nitro traces the server's runtime
# dependencies into .output/server/node_modules; keeping libc identical means any native module it
# ever picks up there was selected for the libc it will actually load against.
FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS runtime

# Filled in by CI (docker/build-push-action build-args) so `docker inspect` on a running container
# says exactly which commit it is. Defaults keep a local `docker build` working without arguments.
ARG SOURCE_URL=https://github.com/mostafahasan1995/telegram-balance-bot
ARG REVISION=unknown
LABEL org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.title="cashier-miniapp" \
      org.opencontainers.image.description="Telegram mini app (TanStack Start SSR on Node)"

# tini as PID 1. Node running as PID 1 gets no default signal handlers from the kernel, so SIGTERM
# from `docker stop` would be ignored and every deploy would wait out the 10 s kill timeout. tini
# forwards the signal to node and reaps zombies. It comes from the tini stage above (a static
# binary with a verified checksum), so this stage needs no package manager and no network.
COPY --from=tini --chmod=755 /tini /usr/bin/tini

WORKDIR /app

# HOST=0.0.0.0 because inside a container "localhost" is unreachable from Caddy on the network.
# PORT=3000 is the port the compose stack routes app.<BASE_DOMAIN> to.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Only the build output. .output is self-contained: nitro bundles the server and traces the few
# runtime packages it needs into .output/server/node_modules, so no install happens here and no
# dev dependency or source file ships in the image. Owned by root and read-only to the app user, so
# a compromised server process cannot rewrite the code it is serving.
COPY --from=build /app/.output ./.output

# The official node image already provides the unprivileged `node` user (uid 1000).
USER node
EXPOSE 3000

# No HEALTHCHECK on purpose: the compose stack owns health checks (GET / via node fetch), keeping
# one place to read and change them.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
