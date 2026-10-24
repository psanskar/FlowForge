FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm prune --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
