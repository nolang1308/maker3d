# MAKER3D 프론트엔드 (Next.js)
# 빌드 위치: 저장소 루트.  deploy/docker-compose.yml 의 web 서비스가 사용합니다.

# ───────────── 1단계: 빌드 ─────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# 화면 코드에 박히는 값(NEXT_PUBLIC_*)은 "빌드할 때" 들어갑니다. 실행할 때 바꿔도 반영되지 않습니다.
# 값은 deploy/.env 에서 옵니다. 빠지면 사이트맵이 없는 주소를 가리키고 백엔드 호출이 localhost 로 갑니다.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_NAVER_PAY_CLIENT_ID
ARG NEXT_PUBLIC_NAVER_PAY_CHAIN_ID
RUN test -n "$NEXT_PUBLIC_SITE_URL" && test -n "$NEXT_PUBLIC_BACKEND_URL" \
 || { echo "NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_BACKEND_URL 이 비어 있습니다. deploy/.env 를 확인하세요."; exit 1; }
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_NAVER_PAY_CLIENT_ID=$NEXT_PUBLIC_NAVER_PAY_CLIENT_ID \
    NEXT_PUBLIC_NAVER_PAY_CHAIN_ID=$NEXT_PUBLIC_NAVER_PAY_CHAIN_ID \
    NEXT_TELEMETRY_DISABLED=1

COPY . ./
RUN --mount=type=cache,target=/app/.next/cache npm run build

# ───────────── 2단계: 실행 (root 가 아닌 node 사용자) ─────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next ./.next

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
