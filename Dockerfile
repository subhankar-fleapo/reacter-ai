FROM node:20.15.0-alpine AS build

WORKDIR /app

# Copy everything
COPY --chown=node:node . .

RUN npm ci

RUN npm run build

# Removing dev dependencies
RUN npm ci --only=production && npm cache clean --force

USER node

FROM node:20.15.0-alpine AS production

WORKDIR /app

# Copy only the dist and node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node pg-ca.pem ./
COPY --chown=node:node credentials.json ./

EXPOSE 8080

ARG GIT_SHA
ENV GIT_SHA=${GIT_SHA}

CMD [ "node", "dist/src/main.js" ]