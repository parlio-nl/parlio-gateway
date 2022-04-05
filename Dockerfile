ARG NODE_IMAGE=node:16.14.0-alpine3.15

FROM ${NODE_IMAGE} AS devdeps

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY --from=devdeps /app/node_modules/ /app/node_modules/
COPY tsconfig.json package.json ./
COPY gateway/ ./gateway/
RUN yarn tsc

FROM ${NODE_IMAGE} AS deps

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --non-interactive

FROM ${NODE_IMAGE}

WORKDIR /app
ENV NODE_ENV=production
EXPOSE 4000

RUN apk --no-cache add dumb-init=1.2.5-r1

USER node

COPY --chown=node:node --from=deps /app/node_modules/ ./node_modules/
COPY --chown=node:node --from=build /app/gateway/dist/*.js ./gateway/dist/
COPY --chown=node:node rover/supergraphs/supergraph-production.graphql ./rover/supergraphs/supergraph-production.graphql

CMD ["dumb-init", "node", "-r", "./gateway/dist/dotenv_r.js" , "gateway/dist/index.js"]
