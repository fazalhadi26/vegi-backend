# vegi-backend Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node","src/server.js"]

