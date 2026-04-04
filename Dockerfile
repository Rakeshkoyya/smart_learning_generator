# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Set real values here (or override via build args) if deploying to a fixed URL.
# Server-side-only vars (no NEXT_PUBLIC_ prefix) are NOT embedded and can be
# supplied at container runtime via -e / docker-compose environment:.
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

# Placeholder values to satisfy Next.js static analysis during build.
# These are server-side secrets — supply real values at container runtime.
# Using ARG (build-time only) avoids baking secrets into image layers.
ARG SUPABASE_SERVICE_ROLE_KEY=placeholder
ARG SUPABASE_URL=https://placeholder.supabase.co
ARG GOOGLE_CLIENT_ID=placeholder
ARG GOOGLE_CLIENT_SECRET=placeholder
ARG AUTH_SECRET=placeholder
ARG BACKEND_URL=http://localhost:8000

ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ENV SUPABASE_URL=${SUPABASE_URL}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ENV AUTH_SECRET=${AUTH_SECRET}
ENV BACKEND_URL=${BACKEND_URL}

RUN npm run build

# ─── Stage 3: production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output + static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080
# for local we need to chnage this is 3000
# EXPOSE 3000

# --dns-result-order=ipv4first avoids IPv6 connectivity issues on Docker Desktop (Windows/Mac)
CMD ["node", "--dns-result-order=ipv4first", "server.js"]
